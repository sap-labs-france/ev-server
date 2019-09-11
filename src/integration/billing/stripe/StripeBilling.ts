import Billing, { BillingData, BillingDataStart, BillingDataUpdate, BillingDataStop, BillingSettings, TransactionIdemPotencyKey } from '../Billing';
import { Request } from 'express';
import Transaction from '../../../types/Transaction';
import User from '../../../types/User';
import AppError from '../../../exception/AppError';
import Constants from '../../../utils/Constants';
import Cypher from '../../../utils/Cypher';
import Logging from '../../../utils/Logging';
import sanitize from 'mongo-sanitize';
import { StripeBillingSettings } from '../../../types/Setting';
import Utils from '../../../utils/Utils';

// Recommended import:
// import * as Stripe from 'stripe';
import Stripe from 'stripe';
import moment from 'moment';
import UserStorage from '../../../storage/mongodb/UserStorage';
import ChargingStationStorage from '../../../storage/mongodb/ChargingStationStorage';

export interface StripeBillingSettingsContent extends BillingSettings, StripeBillingSettings {
  advanceBillingPlans: string | string[];
}

// New fields for HTTP requests from users:
// paymentToken (if payment with card is mandatory)
// billingMethod (if not defaulted from settings)
// billingPlan (if not defaulted from settings)

export default class StripeBilling extends Billing<StripeBillingSettingsContent> {
  private stripe: Stripe;

  constructor(tenantId: string, settings: StripeBillingSettings, currency: string) {
    const stripeSettings: StripeBillingSettingsContent = settings as StripeBillingSettingsContent;
    stripeSettings.currency = currency;
    super(tenantId, stripeSettings);
    if (this.settings.secretKey) {
      this.settings.secretKey = Cypher.decrypt(stripeSettings.secretKey);
    }
    if (this.settings.publicKey) {
      // Currently the public key is not encrypted
      //      this.settings.publicKey = Cypher.decrypt(settings.publicKey);
    }

    this.stripe = new Stripe(this.settings.secretKey);

    if (StripeBilling.transactionIdemPotencyKeys && StripeBilling.transactionIdemPotencyKeys.length > 0) {
      const timeNow = new Date();
      const pastTimeStamp = timeNow.getTime() - 24 * 60 * 60 * 1000; // Go back 24 hours
      StripeBilling.transactionIdemPotencyKeys = StripeBilling.transactionIdemPotencyKeys.filter((record) => record.timestamp > pastTimeStamp);
    }
  }

  public async checkIfUserCanBeCreated(req: Request): Promise<void> {
    const userBuilder: Partial<User> = {};

    if (req.body.email) {
      userBuilder.email = sanitize(req.body.email);
    }
    if (req.body.locale) {
      userBuilder.locale = sanitize(req.body.locale);
    }
    if (req.body.name) {
      userBuilder.name = sanitize(req.body.name);
    }
    if (req.body.firstName) {
      userBuilder.firstName = sanitize(req.body.firstName);
    }

    const user: User = userBuilder as User;

    return await this.checkIfUserCanBeUpdated(user, req, true);
  }

  public async createUser(req: Request): Promise<BillingData> {
    const userBuilder: Partial<User> = {};

    if (req.body.email) {
      userBuilder.email = sanitize(req.body.email);
    }
    if (req.body.locale) {
      userBuilder.locale = sanitize(req.body.locale);
    }
    if (req.body.name) {
      userBuilder.name = sanitize(req.body.name);
    }
    if (req.body.firstName) {
      userBuilder.firstName = sanitize(req.body.firstName);
    }

    const user: User = userBuilder as User;

    return await this.updateUser(user, req);
  }

  public async checkIfUserCanBeUpdated(user: User, req: Request, createUser = false): Promise<void> {
    let methodName;
    if (createUser) {
      methodName = 'handleCreateUser';
    } else {
      methodName = 'handleUpdateUser';
    }

    try {
      const response = await this._checkConnectionToBillingDB();
      if (response === 'error') {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          'Error during connection to billing database (Stripe)', Constants.HTTP_GENERAL_ERROR,
          'UserService', methodName, req.user);
      }

      if (createUser) {
        const existingCustomer = await this._getCustomer(user, req);
        if (existingCustomer && existingCustomer['email']) {
          throw new AppError(
            Constants.CENTRAL_SERVER,
            `Billing customer with email ${existingCustomer['email']} already exists in billing database (Stripe)` +
            `delete this customer or assign another email (conflict with user ${user.firstName} ${user.name})`, Constants.HTTP_GENERAL_ERROR,
            'UserService', methodName, req.user);
        }
      }

      const newPaymentMethod = req.body.paymentToken ? sanitize(req.body.paymentToken) : null;
      if (!newPaymentMethod && (!user.billingData || !user.billingData.cardID) && !this.settings.noCardAllowed) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `Payment method (card) is mandatory for user ${user.firstName} ${user.name}`, Constants.HTTP_GENERAL_ERROR,
          'UserService', methodName, req.user);
      }

      const newBillingMethod = this._getBillingMethod(user, req);
      if ((newBillingMethod === Constants.BILLING_METHOD_IMMEDIATE && !this.settings.immediateBillingAllowed) ||
        (newBillingMethod === Constants.BILLING_METHOD_PERIODIC && !this.settings.periodicBillingAllowed) ||
        (newBillingMethod === Constants.BILLING_METHOD_ADVANCE && !this.settings.advanceBillingAllowed)) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `Billing method ${newBillingMethod} is not allowed by configuration (user ${user.firstName} ${user.name})`, Constants.HTTP_GENERAL_ERROR,
          'UserService', methodName, req.user);
      }

      if ((!user.billingData || !user.billingData.method) && !newBillingMethod) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `A billing method must be specified for user ${user.firstName} ${user.name}`, Constants.HTTP_GENERAL_ERROR,
          'UserService', methodName, req.user);
      }

      const billingMethod = newBillingMethod ? newBillingMethod : user.billingData ? user.billingData.method : null;

      let billingPlan = req.body.billingPlan ? sanitize(req.body.billingPlan) : null;
      if (!billingPlan && (!user.billingData || !user.billingData.subscriptionID) && billingMethod !== Constants.BILLING_METHOD_IMMEDIATE) {
        billingPlan = this._retrieveFirstBillingPlanFromSettings(billingMethod);
        if (!billingPlan) {
          throw new AppError(
            Constants.CENTRAL_SERVER,
            `A billing plan is needed for subscribing user ${user.firstName} ${user.name}`, Constants.HTTP_GENERAL_ERROR,
            'UserService', methodName, req.user);
        }
      }

      if (billingPlan && billingMethod !== Constants.BILLING_METHOD_IMMEDIATE) {
        const plan = await this.stripe.plans.retrieve(billingPlan);
        if (!plan || !plan.id || plan.id !== billingPlan) {
          throw new AppError(
            Constants.CENTRAL_SERVER,
            `Billing plan ${billingPlan} does not exist`, Constants.HTTP_GENERAL_ERROR,
            'UserService', methodName, req.user);
        } else if (plan.currency.toLocaleLowerCase() !== this.settings.currency.toLocaleLowerCase()) {
          throw new AppError(
            Constants.CENTRAL_SERVER,
            `Billing plan ${billingPlan} uses the wrong currency ${plan.currency} `, Constants.HTTP_GENERAL_ERROR,
            'UserService', methodName, req.user);
        }
      }

    } catch (error) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        'Fatal error when trying to access billing database (Stripe)', Constants.HTTP_GENERAL_ERROR,
        'UserService', methodName, req.user);
    }
  }

  public async updateUser(user: User, req: Request): Promise<BillingData> {
    const email = req.body.email ? sanitize(req.body.email) : user.email;
    const fullName = Utils.buildUserFullName(user, false);

    let locale = req.body.locale ? sanitize(req.body.locale) : user.locale;
    locale = locale.substr(0, 2).toLocaleLowerCase();

    let description: string;
    // LOCALE_SUPPORT_NEEDED #BEGIN
    if (locale === 'fr') {
      description = 'Client généré pour {{email}}';
    } else {
      description = 'Generated customer for {{email}}';
    }
    description = description.replace('{{email}}', email);
    // LOCALE_SUPPORT_NEEDED #END

    let customer = await this._getCustomer(user, req);
    if (!customer['id']) {
      customer = await this.stripe.customers.create({
        email: email,
        description: description,
        name: fullName,
        preferred_locales: [locale]
      });
    }

    if (customer['email'] !== email) {
      // Should not happen
      customer = await this.stripe.customers.update(
        customer['id'],
        { email: email }
      );
    }

    if (customer['description'] !== description) {
      customer = await this.stripe.customers.update(
        customer['id'],
        { description: description }
      );
    }

    if (customer['name'] !== fullName) {
      customer = await this.stripe.customers.update(
        customer['id'],
        { name: fullName }
      );
    }

    if (locale) {
      if (!customer['preferred_locales'] ||
        customer['preferred_locales'].length === 0 ||
        customer['preferred_locales'][0] !== locale) {
        customer = await this.stripe.customers.update(
          customer['id'],
          { preferred_locales: null }
        );
        customer = await this.stripe.customers.update(
          customer['id'],
          { preferred_locales: [locale] }
        );
      }
    }

    const newSource = req.body.paymentToken ? sanitize(req.body.paymentToken) : null;
    if (newSource) {
      customer = await this.stripe.customers.update(
        customer['id'],
        { source: newSource }
      );
    }

    const billingMethod = this._getBillingMethod(user, req, true);

    let collectionMethod;
    let daysUntilDue = 0;
    if (!customer['default_source'] && (!user.billingData || !user.billingData.cardID)) {
      collectionMethod = 'send_invoice';
      daysUntilDue = 30;
    } else {
      collectionMethod = 'charge_automatically';
    }

    let billingPlan = req.body.billingPlan ? sanitize(req.body.billingPlan) : null;
    if (!billingPlan) {
      billingPlan = this._retrieveFirstBillingPlanFromSettings(billingMethod);
    }

    if (user.billingData && user.billingData.subscriptionID && billingMethod !== Constants.BILLING_METHOD_IMMEDIATE) {
      // Check whether existing subscription needs to be updated
      const oldSubscription = await this.stripe.subscriptions.retrieve(user.billingData.subscriptionID);
      if (collectionMethod === 'charge_automatically' && oldSubscription.billing === 'send_invoice') {
        await this.stripe.subscriptions.update(
          user.billingData.subscriptionID,
          {
            billing: collectionMethod,
          });
      }
      if (billingPlan !== oldSubscription.plan) {
        await this.stripe.subscriptions.update(
          user.billingData.subscriptionID,
          {
            plan: billingPlan,
          });
      }
    }

    let newSubscription = user.billingData ? user.billingData.subscriptionID : null;
    if ((!user.billingData || !user.billingData.subscriptionID) && billingMethod !== Constants.BILLING_METHOD_IMMEDIATE) {
      // Create subscription
      let billingCycleAnchor = moment().unix(); // Now
      const plan = await this.stripe.plans.retrieve(billingPlan);
      if (plan.interval === 'year' || plan.interval === 'month') {
        billingCycleAnchor = moment().endOf('month').add(1, 'day').unix(); // Begin of next month
      }
      let subscription: Stripe.subscriptions.ISubscription;
      if (collectionMethod === 'send_invoice') {
        subscription = await this.stripe.subscriptions.create({
          customer: customer['id'],
          items: [
            {
              plan: billingPlan,
            }
          ],
          billing_cycle_anchor: billingCycleAnchor,
          billing: 'send_invoice',
          days_until_due: daysUntilDue,
        });
      } else {
        subscription = await this.stripe.subscriptions.create({
          customer: customer['id'],
          items: [
            {
              plan: billingPlan,
            }
          ],
          billing_cycle_anchor: billingCycleAnchor,
          billing: 'charge_automatically',
        });
      }
      newSubscription = subscription['id'];
    }

    return {
      method: billingMethod,
      customerID: customer['id'],
      cardID: customer['default_source'],
      subscriptionID: newSubscription,
      lastUpdate: new Date(),
    };
  }

  public async checkIfUserCanBeDeleted(user: User, req: Request): Promise<void> {
    try {
      if (user.billingData && user.billingData.customerID) {
        const testMode = this._checkIfTestMode();
        if (testMode) {
          const customer = await this._getCustomer(user, req);
          if (customer) {
            if (!customer['livemode']) {
              return; // In test mode the customer may be deleted
            }
          }
        }

        let list = await this.stripe.invoices.list(
          {
            customer: user.billingData.customerID,
            status: 'open',
          }
        );
        if (list && list.data && list.data.length > 0) {
          throw new AppError(
            Constants.CENTRAL_SERVER,
            `Still open invoices exist for user ${user.firstName} ${user.name} in Stripe (${user.billingData.customerID})`, Constants.HTTP_GENERAL_ERROR,
            'UserService', 'handleDeleteUser', req.user);
        }
        list = await this.stripe.invoices.list(
          {
            customer: user.billingData.customerID,
            status: 'draft',
          }
        );
        if (list && list.data && list.data.length > 0) {
          throw new AppError(
            Constants.CENTRAL_SERVER,
            `Still draft invoices exist for user ${user.firstName} ${user.name} in Stripe (${user.billingData.customerID})`, Constants.HTTP_GENERAL_ERROR,
            'UserService', 'handleDeleteUser', req.user);
        }
        const itemsList = await this.stripe.invoiceItems.list(
          {
            customer: user.billingData.customerID,
            pending: true,
          }
        );
        if (itemsList && itemsList.data && itemsList.data.length > 0) {
          throw new AppError(
            Constants.CENTRAL_SERVER,
            `Still pending invoice items exist for user ${user.firstName} ${user.name} in Stripe (${user.billingData.customerID})`, Constants.HTTP_GENERAL_ERROR,
            'UserService', 'handleDeleteUser', req.user);
        }
      }
    } catch (error) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        'Fatal error when trying to access billing database (Stripe)', Constants.HTTP_GENERAL_ERROR,
        'UserService', 'handleDeleteUser', req.user);
    }
  }

  public async deleteUser(user: User, req: Request): Promise<void> {
    if (user.billingData && user.billingData.customerID) {
      const customer = await this._getCustomer(user, req);
      if (customer && customer['id']) {
        await this.stripe.customers.del(
          customer['id']
        );
      }
    }
  }

  public async startSession(user: User, transaction: Transaction): Promise<BillingDataStart> {
    // Read user, perform checks and if no problems, return user data for billing:
    if (!transaction.userID) {
      throw new AppError(
        transaction.chargeBoxID,
        `Billing is active - a transaction user must exist when starting a session on charging station '${transaction.chargeBoxID}'`,
        Constants.HTTP_GENERAL_ERROR,
        'OCPPService', 'handleStartTransaction');
    }

    let billingUser: User;
    if ((!user || !user.billingData) && transaction.userID) {
      billingUser = await UserStorage.getUser(this.tenantId, transaction.userID);
    } else {
      billingUser = user;
    }

    if (!billingUser.billingData || !billingUser.billingData.customerID || !billingUser.billingData.method) {
      throw new AppError(
        transaction.chargeBoxID,
        `Billing is active - user ${billingUser.firstName} ${billingUser.name} has not mandatory configuration to start a session on charging station '${transaction.chargeBoxID}'`,
        Constants.HTTP_GENERAL_ERROR,
        'OCPPService', 'handleStartTransaction');
    }

    if (!billingUser.billingData.subscriptionID &&
      (billingUser.billingData.method === Constants.BILLING_METHOD_PERIODIC ||
        billingUser.billingData.method === Constants.BILLING_METHOD_ADVANCE)) {
      throw new AppError(
        transaction.chargeBoxID,
        `Billing configuration for user ${billingUser.firstName} ${billingUser.name} is not complete to start a session on charging station '${transaction.chargeBoxID}'`,
        Constants.HTTP_GENERAL_ERROR,
        'OCPPService', 'handleStartTransaction');
    }

    if (billingUser.billingData.method === Constants.BILLING_METHOD_ADVANCE) {
      throw new AppError(
        transaction.chargeBoxID,
        `User ${billingUser.firstName} ${billingUser.name} is assigned to billing method 'Charge on Advance Payment' which currently cannot be used to start a session on charging station '${transaction.chargeBoxID}'`,
        Constants.HTTP_GENERAL_ERROR,
        'OCPPService', 'handleStartTransaction');
    }

    try {
      const customer = await this._getCustomer(billingUser);
      if (!customer || customer['id'] !== billingUser.billingData.customerID) {
        throw new AppError(
          transaction.chargeBoxID,
          `User ${billingUser.firstName} ${billingUser.name} is assigned to invalid billing customer (Stripe) '${billingUser.billingData.customerID}'`,
          Constants.HTTP_GENERAL_ERROR,
          'OCPPService', 'handleStartTransaction');
      }

      if (billingUser.billingData.subscriptionID &&
        (billingUser.billingData.method === Constants.BILLING_METHOD_PERIODIC ||
          billingUser.billingData.method === Constants.BILLING_METHOD_ADVANCE)) {
        const subscription = await this.stripe.subscriptions.retrieve(
          billingUser.billingData.subscriptionID
        );
        if (!subscription || subscription['id'] !== billingUser.billingData.subscriptionID) {
          throw new AppError(
            transaction.chargeBoxID,
            `User's ${billingUser.firstName} ${billingUser.name} subscription (Stripe) '${billingUser.billingData.subscriptionID}' is invalid`,
            Constants.HTTP_GENERAL_ERROR,
            'OCPPService', 'handleStartTransaction');
        }
      }
    } catch (error) {
      throw new AppError(
        transaction.chargeBoxID,
        'Fatal error when trying to access billing database (Stripe)',
        Constants.HTTP_GENERAL_ERROR,
        'OCPPService', 'handleStartTransaction');
    }

    return {
      method: billingUser.billingData.method,
      customerID: billingUser.billingData.customerID,
      cardID: billingUser.billingData.cardID,
      subscriptionID: billingUser.billingData.subscriptionID,
    };
  }

  public async updateSession(transaction: Transaction): Promise<BillingDataUpdate> {
    // Only relevant for Advance Billing...

    return {
      stopTransaction: false,
    };
  }

  public async stopSession(transaction: Transaction): Promise<BillingDataStop> {
    // Create or update invoice in Stripe
    const user = await UserStorage.getUser(this.tenantId, transaction.userID);
    let locale = user.locale;
    locale = locale.substr(0, 2).toLocaleLowerCase();

    let description = '';
    // LOCALE_SUPPORT_NEEDED #BEGIN
    const chargeBox = await ChargingStationStorage.getChargingStation(this.tenantId, transaction.chargeBoxID);
    if (chargeBox && chargeBox.siteArea && chargeBox.siteArea.name) {
      if (locale === 'fr') {
        description = 'Charger {{totalConsumption}} kWh à {{siteArea}} (terminé à {{time}})';
      } else {
        description = 'Charging {{totalConsumption}} kWh at {{siteArea}} (finished at {{time}})';
      }
      description = description.replace('{{siteArea}}', chargeBox.siteArea.name);
    } else {
      if (locale === 'fr') {
        description = 'Charger {{totalConsumption}} kWh à la borne {{chargeBox}} (terminé à {{time}})';
      } else {
        description = 'Charging {{totalConsumption}} kWh at charging station {{chargeBox}} (finished at {{time}})';
      }
      description = description.replace('{{chargeBox}}', transaction.chargeBoxID);
    }
    description = description.replace('{{totalConsumption}}', `${Math.round(transaction.stop.totalConsumption / 100) / 10}`);
    description = description.replace('{{time}}', transaction.stop.timestamp.toLocaleTimeString(user.locale.replace('_', '-')));
    // LOCALE_SUPPORT_NEEDED #END

    let collectionMethod = 'send_invoice';
    let daysUntilDue = 30;
    if (transaction.billingData.cardID) {
      collectionMethod = 'charge_automatically';
      daysUntilDue = 0;
    }

    // LOCALE_SUPPORT_NEEDED #BEGIN
    let statementDescriptor = ''; // Maximum of 22 characters!
    if (collectionMethod === 'send_invoice') {
      if (locale === 'fr') {
        statementDescriptor = 'Paiement différé';
      } else {
        statementDescriptor = 'Payment on receipt';
      }
    } else {
      if (locale === 'fr') {
        statementDescriptor = 'Paiement automatique';
      } else {
        statementDescriptor = 'Automatic payment';
      }
    }
    // LOCALE_SUPPORT_NEEDED #END

    let invoiceStatus: string;
    let invoiceItemID: string;
    let newInvoiceItem: Stripe.invoiceItems.InvoiceItem;
    let newInvoice: Stripe.invoices.IInvoice;

    let idemPotencyKey: TransactionIdemPotencyKey = {} as TransactionIdemPotencyKey;
    if (!StripeBilling.transactionIdemPotencyKeys) {
      idemPotencyKey.transactionID = transaction.id;
      idemPotencyKey.keyNewInvoice = Utils.generateGUID();
      idemPotencyKey.keyNewInvoiceItem = Utils.generateGUID();
      idemPotencyKey.timestamp = new Date().getTime();
      StripeBilling.transactionIdemPotencyKeys = [idemPotencyKey];
    } else {
      idemPotencyKey = StripeBilling.transactionIdemPotencyKeys.find((record) => record.transactionID === transaction.id);
      if (!idemPotencyKey || idemPotencyKey.transactionID !== transaction.id) {
        idemPotencyKey = {} as TransactionIdemPotencyKey;
        idemPotencyKey.transactionID = transaction.id;
        idemPotencyKey.keyNewInvoice = Utils.generateGUID();
        idemPotencyKey.keyNewInvoiceItem = Utils.generateGUID();
        idemPotencyKey.timestamp = new Date().getTime();
        StripeBilling.transactionIdemPotencyKeys.push(idemPotencyKey);
      }
    }
    try {
      switch (transaction.billingData.method) {

        case Constants.BILLING_METHOD_IMMEDIATE:
          // Create pending invoice item without subscription
          newInvoiceItem = await this.stripe.invoiceItems.create({
            customer: transaction.billingData.customerID,
            currency: this.settings.currency.toLocaleLowerCase(),
            amount: Math.round(transaction.stop.roundedPrice * 100),
            description: description
          }, {
            idempotency_key: idemPotencyKey.keyNewInvoiceItem
          });
          // Create invoice without subscription which automatically adds all pending invoice items
          if (collectionMethod === 'send_invoice') {
            newInvoice = await this.stripe.invoices.create({
              customer: transaction.billingData.customerID,
              statement_descriptor: statementDescriptor,
              billing: 'send_invoice',
              days_until_due: daysUntilDue,
              auto_advance: true
            }, {
              idempotency_key: idemPotencyKey.keyNewInvoice
            });
            newInvoice = await this.stripe.invoices.sendInvoice(newInvoice.id);
          } else {
            newInvoice = await this.stripe.invoices.create({
              customer: transaction.billingData.customerID,
              billing: 'charge_automatically',
              auto_advance: true
            }, {
              idempotency_key: idemPotencyKey.keyNewInvoice
            });
            newInvoice = await this.stripe.invoices.finalizeInvoice(newInvoice.id);
          }
          invoiceStatus = newInvoice.status;
          invoiceItemID = newInvoiceItem.id;
          break;

        case Constants.BILLING_METHOD_PERIODIC:
          // Create new invoice item for next invoice to come
          // (with subscription, but usually this invoice does not yet exist!)
          newInvoiceItem = await this.stripe.invoiceItems.create({
            customer: transaction.billingData.customerID,
            subscription: transaction.billingData.subscriptionID,
            currency: this.settings.currency.toLocaleLowerCase(),
            amount: Math.round(transaction.stop.roundedPrice * 100),
            description: description
          }, {
            idempotency_key: idemPotencyKey.keyNewInvoiceItem
          });
          if (!newInvoiceItem.invoice) {
            invoiceStatus = 'pending';
          } else {
            if (typeof (newInvoiceItem.invoice) === 'string') {
              newInvoice.id = newInvoiceItem.invoice;
            } else {
              newInvoice = newInvoiceItem.invoice;
            }
            try {
              newInvoice = await this.stripe.invoices.retrieve(
                newInvoice.id
              );
              invoiceStatus = newInvoice.status;
            } catch (error) {
              invoiceStatus = 'unknown';
            }
          }
          invoiceItemID = newInvoiceItem.id;
          break;

        default:

      }
    } catch (error) {
      // Set the source
      error.source = transaction.userID;
      // Log error
      Logging.logActionExceptionMessage(this.tenantId, 'CreateStripeBillingItem', error);
      // Return
      return {
        invoiceStatus: null,
        invoiceItemID: null,
      };
    }

    StripeBilling.transactionIdemPotencyKeys = StripeBilling.transactionIdemPotencyKeys.filter((record) => record.transactionID !== transaction.id);

    return {
      invoiceStatus: invoiceStatus,
      invoiceItemID: invoiceItemID,
    };
  }

  private async _checkConnectionToBillingDB(): Promise<string> {
    // Try to access customer list in stripe
    const list = await this.stripe.customers.list(
      { limit: 1 }
    );

    if (!('object' in list) ||
      (list['object'] !== 'list')) {
      return 'error';
    }
  }

  private _getBillingMethod(user: User, req: Request, useUserData?: boolean): string {
    if (useUserData && user.billingData && user.billingData.method) {
      return user.billingData.method;
    }
    let billingMethod = req.body.billingMethod ? sanitize(req.body.billingMethod) : null;
    if (!billingMethod ||
      (billingMethod !== Constants.BILLING_METHOD_IMMEDIATE
        && billingMethod !== Constants.BILLING_METHOD_PERIODIC
        && billingMethod !== Constants.BILLING_METHOD_ADVANCE)) {
      if (this.settings.immediateBillingAllowed) {
        billingMethod = Constants.BILLING_METHOD_IMMEDIATE;
      } else if (this.settings.periodicBillingAllowed) {
        billingMethod = Constants.BILLING_METHOD_PERIODIC;
      } else if (this.settings.advanceBillingAllowed) {
        billingMethod = Constants.BILLING_METHOD_ADVANCE;
      }
    }
    return billingMethod;
  }

  private _retrieveFirstBillingPlanFromSettings(billingMethod: string): string {
    if (billingMethod === Constants.BILLING_METHOD_PERIODIC) {
      if (this.settings.periodicBillingAllowed && this.settings.periodicBillingPlans) {
        if (Array.isArray(this.settings.periodicBillingPlans)) {
          if (this.settings.periodicBillingPlans.length > 0) {
            return this.settings.periodicBillingPlans[0];
          }
        } else {
          return this.settings.periodicBillingPlans;
        }
      }
    } else if (billingMethod === Constants.BILLING_METHOD_ADVANCE) {
      if (this.settings.advanceBillingAllowed && this.settings.advanceBillingPlans) {
        if (Array.isArray(this.settings.advanceBillingPlans)) {
          if (this.settings.advanceBillingPlans.length > 0) {
            return this.settings.advanceBillingPlans[0];
          }
        } else {
          return this.settings.advanceBillingPlans;
        }
      }
    }
    return '';
  }

  private _checkIfTestMode(): boolean {
    if (this.settings.secretKey.substr(0, 7) === 'sk_test') {
      return true;
    }
    return false;
  }

  private async _getCustomer(user: User, req?: Request): Promise<object> {
    if (user.billingData && user.billingData.customerID) {
      return await this.stripe.customers.retrieve(
        user.billingData.customerID
      );
    }
    const email = req.body.email ? sanitize(req.body.email) : user.email;
    if (email) {
      const list = await this.stripe.customers.list(
        { email: email, limit: 1 }
      );
      if (list && list['data'] && list['data'].length > 0) {
        return list['data'][0];
      }
    }
    return {};
  }

}
