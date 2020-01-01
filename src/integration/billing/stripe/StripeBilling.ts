/* eslint-disable @typescript-eslint/camelcase */
import i18n from 'i18n-js';
import moment from 'moment';
import Stripe from 'stripe';
import BackendError from '../../../exception/BackendError';
import { BillingDataStart, BillingDataStop, BillingDataUpdate, BillingPartialUser, BillingTax, BillingUserData } from '../../../types/Billing';
import { StripeBillingSetting } from '../../../types/Setting';
import Transaction from '../../../types/Transaction';
import User from '../../../types/User';
import Constants from '../../../utils/Constants';
import Cypher from '../../../utils/Cypher';
import I18nManager from '../../../utils/I18nManager';
import Logging from '../../../utils/Logging';
import Utils from '../../../utils/Utils';
import Billing from '../Billing';
import ICustomerListOptions = Stripe.customers.ICustomerListOptions;
import ItaxRateSearchOptions = Stripe.taxRates.ItaxRateSearchOptions;
import ITaxRate = Stripe.taxRates.ITaxRate;

export interface TransactionIdemPotencyKey {
  transactionID: number;
  keyNewInvoiceItem: string;
  keyNewInvoice: string;
  timestamp: number;
}

export default class StripeBilling extends Billing<StripeBillingSetting> {
  private static transactionIdemPotencyKeys: TransactionIdemPotencyKey[];
  private static readonly STRIPE_MAX_LIST = 100;
  private stripe: Stripe;

  constructor(tenantId: string, settings: StripeBillingSetting) {
    super(tenantId, settings);
    this.settings.currency = settings.currency;
    if (this.settings.secretKey) {
      this.settings.secretKey = Cypher.decrypt(settings.secretKey);
    }
    // Currently the public key is not encrypted
    try {
      this.stripe = new Stripe(this.settings.secretKey);
    } catch (error) {
      delete this.stripe;
    }
    // Delete outdated keys for creating new invoices and invoice items
    if (StripeBilling.transactionIdemPotencyKeys && StripeBilling.transactionIdemPotencyKeys.length > 0) {
      const timeNow = new Date();
      const pastTimeStamp = timeNow.getTime() - 24 * 60 * 60 * 1000; // Go back 24 hours
      StripeBilling.transactionIdemPotencyKeys = StripeBilling.transactionIdemPotencyKeys.filter((record) => record.timestamp > pastTimeStamp);
    }
  }

  public async checkConnection() {
    // Check Stripe
    this.checkIfStripeIsInitialized();
    // Check Key
    if (!this.settings.secretKey) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        module: 'StripeBilling', method: 'checkConnection',
        action: Constants.ACTION_CHECK_CONNECTION_BILLING,
        message: 'No secret key provided for connection to Stripe'
      });
    }
    // Validate the connection
    let isKeyValid = false;
    try {
      this.stripe = new Stripe(this.settings.secretKey);
      // Get one customer
      const list = await this.stripe.customers.list(
        { limit: 1 }
      );
      if (('object' in list) &&
        (list.object === 'list')) {
        isKeyValid = true;
      }
    } catch (error) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        module: 'StripeBilling', method: 'checkConnection',
        action: Constants.ACTION_CHECK_CONNECTION_BILLING,
        message: `Error occured when connecting to Stripe: ${error.message}`,
        detailedMessages: error
      });
    }
    if (!isKeyValid) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        module: 'StripeBilling', method: 'checkConnection',
        action: Constants.ACTION_CHECK_CONNECTION_BILLING,
        message: 'Error occured when connecting to Stripe: Invalid key'
      });
    }
  }

  public async getUsers(): Promise<BillingPartialUser[]> {
    const users = [];
    let request;
    const requestParams = { limit: StripeBilling.STRIPE_MAX_LIST } as ICustomerListOptions;
    // Check Stripe
    this.checkIfStripeIsInitialized();
    do {
      request = await this.stripe.customers.list(requestParams);
      for (const customer of request.data) {
        users.push({
          email: customer.email,
          billingData: {
            customerID: customer.id
          }
        });
      }
      if (request.has_more) {
        requestParams.starting_after = users[users.length - 1].billingData.customerID;
      }
    } while (request.has_more);
    return users;
  }

  public async getUser(id: string): Promise<BillingPartialUser> {
    // Check Stripe
    this.checkIfStripeIsInitialized();
    // Get customer
    const customer = await this.getCustomerByID(id);
    if (customer && customer.email) {
      return {
        email: customer.email,
        billingData: {
          customerID: customer.id
        }
      };
    }
  }

  public async getUserByEmail(email: string): Promise<BillingPartialUser> {
    // Check Stripe
    this.checkIfStripeIsInitialized();
    // Get customer
    const request = await this.getCustomerByEmail(email);
    if (request) {
      return {
        email: email,
        billingData: {
          customerID: request.id
        }
      };
    }
  }

  public async getTaxes(): Promise<BillingTax[]> {
    const taxes = [] as BillingTax[];
    let request;
    const requestParams = { limit: StripeBilling.STRIPE_MAX_LIST } as ItaxRateSearchOptions;
    do {
      request = await this.stripe.taxRates.list(requestParams);
      for (const tax of request.data) {
        taxes.push({
          id: tax.id,
          description: tax.description,
          displayName: tax.display_name,
          percentage: tax.percentage
        });
      }
      if (request.has_more) {
        requestParams.starting_after = taxes[taxes.length - 1].id;
      }
    } while (request.has_more);
    return taxes;
  }

  public async getUpdatedUserIDsInBilling(): Promise<string[]> {
    const createdSince = this.settings.lastSynchronizedOn ? `${moment(this.settings.lastSynchronizedOn).unix()}` : '0';
    let stillData = true;
    let lastEventID: string;
    let events: Stripe.IList<Stripe.events.IEvent>;
    let skipCustomer: boolean;
    let lastCustomerID: string;
    const collectedCustomerIDs: string[] = [];
    try {
      // Check Stripe
      this.checkIfStripeIsInitialized();
      // Loop until all users are read
      while (stillData) {
        if (lastEventID) {
          events = await this.stripe.events.list(
            {
              created: { gt: createdSince },
              limit: 20,
              type: 'customer.*',
              starting_after: lastEventID
            }
          );
        } else {
          events = await this.stripe.events.list(
            {
              created: { gt: createdSince },
              limit: 20,
              type: 'customer.*'
            }
          );
        }
        if (events.data.length > 0) {
          for (const evt of events.data) {
            skipCustomer = false;
            lastEventID = evt.id;
            lastCustomerID = evt.data.object.customer ? evt.data.object.customer :
              ((evt.data.object.object === 'customer') ? evt.data.object.id : null);
            if (!lastCustomerID) {
              skipCustomer = true;
            }
            if (!skipCustomer && (collectedCustomerIDs.length > 0) &&
              (collectedCustomerIDs.findIndex((id) => id === lastCustomerID) > -1)) {
              skipCustomer = true;
            }
            if (!skipCustomer) {
              collectedCustomerIDs.push(lastCustomerID);
            }
          }
          stillData = events.data.length <= 20;
        } else {
          stillData = false;
        }
      }
      if (collectedCustomerIDs && collectedCustomerIDs.length > 0) {
        return collectedCustomerIDs;
      }
    } catch (error) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        action: Constants.ACTION_SYNCHRONIZE_BILLING,
        module: 'StripeBilling', method: 'getUpdatedCustomersForSynchronization',
        message: `Impossible to retrieve changed customers from Stripe Billing: ${error.message}`,
        detailedMessages: error
      });
    }
  }

  public async startTransaction(transaction: Transaction): Promise<BillingDataStart> {
    try {
      // Check Stripe
      this.checkIfStripeIsInitialized();
      // Check User
      if (!transaction.userID || !transaction.user) {
        throw new BackendError({
          message: 'User is not provided'
        });
      }
      // Get User
      const billingUser = transaction.user;
      if (!billingUser.billingData || !billingUser.billingData.customerID || !billingUser.billingData.method) {
        throw new BackendError({
          message: 'Transaction user has no billing method or no customer in Stripe'
        });
      }
      if (billingUser.billingData.method !== Constants.BILLING_METHOD_IMMEDIATE &&
          billingUser.billingData.method !== Constants.BILLING_METHOD_PERIODIC &&
          billingUser.billingData.method !== Constants.BILLING_METHOD_ADVANCE) {
        throw new BackendError({
          message: 'Transaction user is assigned to unknown billing method'
        });
      }
      if (billingUser.billingData.method === Constants.BILLING_METHOD_ADVANCE) {
        throw new BackendError({
          message: `Selected billing method '${billingUser.billingData.method}' currently not supported`
        });
      }
      if (!billingUser.billingData.subscriptionID &&
        billingUser.billingData.method !== Constants.BILLING_METHOD_IMMEDIATE) {
        throw new BackendError({
          message: 'Transaction user is not subscribed to Stripe billing plan'
        });
      }
      if (billingUser.billingData.subscriptionID &&
        billingUser.billingData.method !== Constants.BILLING_METHOD_IMMEDIATE) {
        const subscription = await this.getSubscription(billingUser.billingData.subscriptionID);
        if (!subscription || subscription.id !== billingUser.billingData.subscriptionID) {
          throw new BackendError({
            message: 'Stripe subscription ID of the transaction user is invalid'
          });
        }
      }
      const customer = await this.getCustomerByEmail(billingUser.email);
      if (!customer || customer.id !== billingUser.billingData.customerID) {
        throw new BackendError({
          message: 'Stripe customer ID of the transaction user is invalid'
        });
      }
    } catch (error) {
      Logging.logError({
        tenantID: this.tenantID,
        user: transaction.userID,
        source: Constants.CENTRAL_SERVER,
        action: Constants.ACTION_BILLING_TRANSACTION,
        module: 'StripeBilling', method: 'startTransaction',
        message: `Billing error in Start Transaction: ${error.message}`,
        detailedMessages: error
      });
    }
    return {
      cancelTransaction: false
    };
  }

  public async updateTransaction(transaction: Transaction): Promise<BillingDataUpdate> {
    try {
      // Check Stripe
      this.checkIfStripeIsInitialized();
      // Check User
      if (!transaction.userID || !transaction.user) {
        throw new BackendError({
          message: 'User is not provided'
        });
      }
      // Only relevant for Advance Billing to stop the running transaction, if the credit amount is no more sufficient

    } catch (error) {
      Logging.logError({
        tenantID: this.tenantID,
        user: transaction.userID,
        source: Constants.CENTRAL_SERVER,
        action: Constants.ACTION_BILLING_TRANSACTION,
        module: 'StripeBilling', method: 'updateTransaction',
        message: `Billing error in Update Transaction: ${error.message}`,
        detailedMessages: error
      });
    }
    return {
      cancelTransaction: false
    };
  }

  public async stopTransaction(transaction: Transaction): Promise<BillingDataStop> {
    try {
      // Check Stripe
      this.checkIfStripeIsInitialized();
      // Check User
      if (!transaction.userID || !transaction.user) {
        throw new BackendError({
          message: 'User is not provided'
        });
      }
      // Check Charging Station
      if (!transaction.chargeBox) {
        throw new BackendError({
          message: 'Charging Station is not provided'
        });
      }
      const billingUser = transaction.user;
      if (!billingUser.billingData) {
        throw new BackendError({
          message: 'User has no Billing Data'
        });
      }
      const chargeBox = transaction.chargeBox;
      // Create or update invoice in Stripe
      let description = '';
      I18nManager.switchLocale(transaction.user.locale);
      const totalConsumption = Math.round(transaction.stop.totalConsumption / 100) / 10;
      const time = I18nManager.formatDateTime(transaction.stop.timestamp, 'LTS');
      if (chargeBox && chargeBox.siteArea && chargeBox.siteArea.name) {
        description = i18n.t('billing.chargingStopSiteArea', { totalConsumption: totalConsumption, siteArea: chargeBox.siteArea, time: time });
      } else {
        description = i18n.t('billing.chargingStopChargeBox', { totalConsumption: totalConsumption, chargeBox: transaction.chargeBoxID, time: time });
      }
      let collectionMethod = 'send_invoice';
      let daysUntilDue = 30;
      if (billingUser.billingData.cardID) {
        collectionMethod = 'charge_automatically';
        daysUntilDue = 0;
      }
      const taxRates: ITaxRate[] = [];
      if (this.settings.taxID) {
        taxRates.push(this.settings.taxID);
      }
      let invoiceStatus: string;
      let invoiceItem: string;
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
      // Billing Method
      switch (billingUser.billingData.method) {
        // Immediate
        case Constants.BILLING_METHOD_IMMEDIATE:
          // Create pending invoice item without subscription
          newInvoiceItem = await this.stripe.invoiceItems.create({
            customer: billingUser.billingData.customerID,
            currency: this.settings.currency.toLocaleLowerCase(),
            amount: Math.round(transaction.stop.roundedPrice * 100),
            description: description,
            tax_rates: taxRates,
          }, {
            idempotency_key: idemPotencyKey.keyNewInvoiceItem
          });
          // Create invoice without subscription which automatically adds all pending invoice items
          if (collectionMethod === 'send_invoice') {
            newInvoice = await this.stripe.invoices.create({
              customer: billingUser.billingData.customerID,
              collection_method: 'send_invoice',
              days_until_due: daysUntilDue,
              auto_advance: true
            }, {
              idempotency_key: idemPotencyKey.keyNewInvoice
            });
            newInvoice = await this.stripe.invoices.sendInvoice(newInvoice.id);
          } else {
            newInvoice = await this.stripe.invoices.create({
              customer: billingUser.billingData.customerID,
              collection_method: 'charge_automatically',
              auto_advance: true
            }, {
              idempotency_key: idemPotencyKey.keyNewInvoice
            });
            newInvoice = await this.stripe.invoices.finalizeInvoice(newInvoice.id);
          }
          invoiceStatus = newInvoice.status;
          invoiceItem = newInvoiceItem.id;
          break;
        // Periodic
        case Constants.BILLING_METHOD_PERIODIC:
          // Create new invoice item for next invoice to come
          // (with subscription, but usually this invoice does not yet exist!)
          newInvoiceItem = await this.stripe.invoiceItems.create({
            customer: billingUser.billingData.customerID,
            subscription: billingUser.billingData.subscriptionID,
            currency: this.settings.currency.toLocaleLowerCase(),
            amount: Math.round(transaction.stop.roundedPrice * 100),
            description: description,
            tax_rates: taxRates,
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
          invoiceItem = newInvoiceItem.id;
          break;
      }
      StripeBilling.transactionIdemPotencyKeys =
        StripeBilling.transactionIdemPotencyKeys.filter((record) => record.transactionID !== transaction.id);
      return {
        status: Constants.BILLING_STATUS_BILLED,
        invoiceStatus: invoiceStatus,
        invoiceItem: invoiceItem,
      };
    } catch (error) {
      Logging.logError({
        tenantID: this.tenantID,
        user: transaction.userID,
        source: Constants.CENTRAL_SERVER,
        action: Constants.ACTION_BILLING_TRANSACTION,
        module: 'StripeBilling', method: 'updateTransaction',
        message: `Billing error in Stop Transaction: ${error.message}`,
        detailedMessages: error
      });
      return {
        status: Constants.BILLING_STATUS_UNBILLED,
        invoiceStatus: null,
        invoiceItem: null
      };
    }
  }

  public async checkIfUserCanBeCreated(user: User): Promise<boolean> {
    // Check Stripe
    this.checkIfStripeIsInitialized();
    // Check
    return this.checkIfUserCanBeUpdated(user);
  }

  public async userExists(user: User): Promise<boolean> {
    // Check Stripe
    this.checkIfStripeIsInitialized();
    // Get customer
    const customer = await this.getCustomerByEmail(user.email);
    return !!customer;
  }

  public async checkIfUserCanBeUpdated(user: User): Promise<boolean> {
    // Check Stripe
    this.checkIfStripeIsInitialized();
    // Check connection
    await this.checkConnection();


    I18nManager.switchLocale(user.locale);
    let customer: Stripe.customers.ICustomer = null;
    if (user.billingData && user.billingData.customerID) {
      customer = await this.getCustomerByEmail(user.email);
      if (customer && customer.email) {
        // Currently it is allowed to re-use an existing customer in Stripe, if the email address is matching!
      }
    }
    // Check
    if (!customer) {
      // User does not exist
      return true;
    }
    // Check more details
    let paymentMethod = null;
    if (customer.default_source) {
      paymentMethod = customer.default_source;
    }
    if (!paymentMethod && !this.settings.noCardAllowed) {
      throw new BackendError({
        message: `User '${Utils.buildUserFullName(user, false)}' cannot be created/updated in Stripe: No payment method`
      });
    }
    const billingMethod = this.retrieveBillingMethod(user);
    if (!billingMethod) {
      throw new BackendError({
        message: `User '${Utils.buildUserFullName(user, false)}' cannot be created/updated in Stripe: No billing method was selected`
      });
    }
    if ((billingMethod === Constants.BILLING_METHOD_IMMEDIATE && !this.settings.immediateBillingAllowed) ||
          (billingMethod === Constants.BILLING_METHOD_PERIODIC && !this.settings.periodicBillingAllowed) ||
          (billingMethod === Constants.BILLING_METHOD_ADVANCE && !this.settings.advanceBillingAllowed)) {
      throw new BackendError({
        message: `User '${Utils.buildUserFullName(user, false)}' cannot be created/updated in Stripe: Billing method '${billingMethod}' not allowed`
      });
    }
    const subscription = (customer.subscriptions && customer.subscriptions.data && customer.subscriptions.data.length > 0)
      ? customer.subscriptions.data[0] : null;
    let billingPlan = null;
    if (!subscription && billingMethod !== Constants.BILLING_METHOD_IMMEDIATE) {
      billingPlan = await this.retrieveBillingPlan();
    }
    if (!billingPlan && !subscription && billingMethod !== Constants.BILLING_METHOD_IMMEDIATE) {
      throw new BackendError({
        message: `User '${Utils.buildUserFullName(user, false)}' cannot be created/updated in Stripe: No billing plan provided`
      });
    }
    if (billingPlan && billingMethod !== Constants.BILLING_METHOD_IMMEDIATE) {
      const plan = await this.getBillingPlan(billingPlan);
      if (!plan || !plan.id || plan.id !== billingPlan) {
        throw new BackendError({
          message: `User '${Utils.buildUserFullName(user, false)}' cannot be created/updated in Stripe: Billing plan '${billingPlan}' does not exist`
        });
      } else if (plan.currency.toLocaleLowerCase() !== this.settings.currency.toLocaleLowerCase()) {
        throw new BackendError({
          message: `User '${Utils.buildUserFullName(user, false)}' cannot be created/updated in Stripe: Billing plan '${billingPlan}' uses wrong currency ${plan.currency}`
        });
      }
    }
    return true;
  }

  public async checkIfUserCanBeDeleted(user: User): Promise<boolean> {
    try {
      // Check Stripe
      this.checkIfStripeIsInitialized();
      // No billing in progress
      if (!user.billingData || !user.billingData.customerID) {
        return true;
      }
      // Check connection
      await this.checkConnection();

      if (this.checkIfTestMode()) {
        const customer = await this.getCustomerByEmail(user.email);
        if (customer && !customer.livemode) {
          return true;
        }
      }
      let list = await this.stripe.invoices.list(
        {
          customer: user.billingData.customerID,
          status: 'open',
        }
      );
      if (list && list.data && list.data.length > 0) {
        throw new BackendError({
          message: `User '${Utils.buildUserFullName(user, false)}' cannot be deleted in Stripe: Open invoice still exist in Stripe`
        });
      }
      list = await this.stripe.invoices.list(
        {
          customer: user.billingData.customerID,
          status: 'draft',
        }
      );
      if (list && list.data && list.data.length > 0) {
        throw new BackendError({
          message: `User '${Utils.buildUserFullName(user, false)}' cannot be deleted in Stripe: Open invoice still exist in Stripe`
        });
      }
      const itemsList = await this.stripe.invoiceItems.list(
        {
          customer: user.billingData.customerID,
          pending: true,
        }
      );
      if (itemsList && itemsList.data && itemsList.data.length > 0) {
        throw new BackendError({
          message: `User '${Utils.buildUserFullName(user, false)}' cannot be deleted in Stripe: Pending invoice items still exist in Stripe`
        });
      }
      return true;
    } catch (error) {
      Logging.logError({
        tenantID: this.tenantID,
        user: user,
        source: Constants.CENTRAL_SERVER,
        action: Constants.ACTION_DELETE,
        module: 'StripeBilling', method: 'checkIfUserCanBeDeleted',
        message: `Billing error in Stop Transaction: ${error.message}`,
        detailedMessages: error
      });
      return false;
    }
  }

  public async createUser(user: User): Promise<BillingUserData> {
    // Check Stripe
    this.checkIfStripeIsInitialized();
    // Check
    const success = await this.checkIfUserCanBeUpdated(user);
    if (!success) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        module: 'StripeBilling', method: 'createUser',
        action: Constants.ACTION_CREATE,
        user: user,
        message: 'Cannot create the user'
      });
    }
    return this.modifyUser(user);
  }

  public async updateUser(user: User): Promise<BillingUserData> {
    // Check Stripe
    this.checkIfStripeIsInitialized();
    // Check
    const success = await this.checkIfUserCanBeUpdated(user);
    if (!success) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        module: 'StripeBilling', method: 'updateUser',
        action: Constants.ACTION_CREATE,
        user: user,
        message: 'Cannot update the user'
      });
    }
    return await this.modifyUser(user);
  }

  public async deleteUser(user: User) {
    // Check Stripe
    this.checkIfStripeIsInitialized();
    // Check
    const success = await this.checkIfUserCanBeDeleted(user);
    if (!success) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        module: 'StripeBilling', method: 'deleteUser',
        action: Constants.ACTION_CREATE,
        user: user,
        message: 'Cannot delete the user'
      });
    }
    if (user.billingData && user.billingData.customerID) {
      const customer = await this.getCustomerByEmail(user.email);
      if (customer && customer.id) {
        try {
          await this.stripe.customers.del(
            customer.id
          );
        } catch (error) {
          throw new BackendError({
            source: Constants.CENTRAL_SERVER,
            module: 'StripeBilling', method: 'updateUser',
            action: Constants.ACTION_CREATE,
            user: user,
            message: 'Cannot delete the User'
          });
        }
      }
    }
  }

  private async getCustomerByID(id: string): Promise<Stripe.customers.ICustomer> {
    // Get customer
    return await this.stripe.customers.retrieve(id);
  }

  private async getCustomerByEmail(email: string): Promise<Stripe.customers.ICustomer> {
    // Get customer
    const list = await this.stripe.customers.list(
      { email: email, limit: 1 }
    );
    if (list && list.data && list.data.length > 0) {
      return list.data[0];
    }
  }

  private async getSubscription(subscriptionID: string): Promise<Stripe.subscriptions.ISubscription> {
    // Get subscriptiom
    return await this.stripe.subscriptions.retrieve(subscriptionID);
  }

  private retrieveBillingMethod(user: User): string {
    // Get billing method
    if (user.billingData && user.billingData.method) {
      return user.billingData.method;
    }
    // Take the first allowed method from the settings
    if (this.settings.immediateBillingAllowed) {
      return Constants.BILLING_METHOD_IMMEDIATE;
    }
    if (this.settings.periodicBillingAllowed) {
      return Constants.BILLING_METHOD_PERIODIC;
    }
    if (this.settings.advanceBillingAllowed) {
      return Constants.BILLING_METHOD_ADVANCE;
    }
  }

  private async getBillingPlan(billingPlanID: string): Promise<Stripe.plans.IPlan> {
    return await this.stripe.plans.retrieve(billingPlanID);
  }

  private async retrieveBillingPlan(): Promise<string> {
    // If not provided from the HTTP request (e.g. req.body.billingPlan), try to assign a billing plan from
    // somewhere else, for example a default plan from this.settings... TODO !!!
    return '';
  }

  private checkIfTestMode(): boolean {
    return this.settings.secretKey.substr(0, 7) === 'sk_test';
  }

  private async modifyUser(user: User): Promise<BillingUserData> {
    let locale = user.locale;
    const fullName = Utils.buildUserFullName(user);
    if (locale) {
      locale = locale.substr(0, 2).toLocaleLowerCase();
    }
    I18nManager.switchLocale(user.locale);
    const description = i18n.t('billing.generatedUser', { email: user.email });
    let customer = await this.getCustomerByEmail(user.email);
    if (!customer) {
      try {
        customer = await this.stripe.customers.create({
          email: user.email,
          description: description,
          name: fullName,
          preferred_locales: [locale]
        });
      } catch (error) {
        throw new BackendError({
          source: Constants.CENTRAL_SERVER,
          module: 'StripeBilling', method: 'modifyUser',
          action: Constants.ACTION_CREATE,
          user: user,
          message: 'Impossible to create a Stripe customer',
          detailedMessages: error
        });
      }
    }
    const dataToUpdate: any = {};
    if (customer.description !== description) {
      dataToUpdate.description = description;
    }
    if (customer.name !== fullName) {
      dataToUpdate.name = fullName;
    }
    if (locale &&
        (!customer.preferred_locales ||
          customer.preferred_locales.length === 0 ||
          customer.preferred_locales[0] !== locale)) {
      dataToUpdate.preferred_locales = [locale];
    }
    // Update
    if (!Utils.isEmptyJSon(dataToUpdate)) {
      try {
        customer = await this.stripe.customers.update(
          customer.id,
          dataToUpdate
        );
      } catch (error) {
        throw new BackendError({
          source: Constants.CENTRAL_SERVER,
          module: 'StripeBilling', method: 'modifyUser',
          action: Constants.ACTION_CREATE,
          user: user,
          message: `Impossible to update Stripe customer '${customer.id}' with email '${user.email}'`,
          detailedMessages: error
        });
      }
    }
    // Payment method has to be stored in User's BillingData
    // const newPaymentMethod = req.body.paymentToken ? sanitize(req.body.paymentToken) : null;
    // if (newPaymentMethod) {
    //   try {
    //     customer = await this.stripe.customers.update(
    //       customer.id,
    //       { source: newPaymentMethod }
    //     );
    //   } catch (error) {
    //     throw new BackendError({
    //       source: Constants.CENTRAL_SERVER,
    //       module: 'StripeBilling', method: 'modifyUser',
    //       action: Constants.ACTION_CREATE,
    //       user: user,
    //       message: `Impossible to update Stripe customer '${customer.id}' with email '${user.email}'`,
    //       detailedMessages: error
    //     });
    //   }
    // }
    const billingMethod = this.retrieveBillingMethod(user);
    let collectionMethod;
    let daysUntilDue = 0;
    if (!customer.default_source || typeof (customer.default_source) !== 'string' ||
      (typeof (customer.default_source) === 'string' && customer.default_source.substr(0, 4) !== 'card')) {
      collectionMethod = 'send_invoice';
      daysUntilDue = 30;
    } else {
      collectionMethod = 'charge_automatically';
    }
    let subscription = (customer.subscriptions && customer.subscriptions.data && customer.subscriptions.data.length > 0)
      ? customer.subscriptions.data[0] : null; // Always take the first subscription!
    // No billing plan
    let billingPlan = null;
    // Only overwrite existing subscription with new billing plan, if billing plan is received from HTTP request
    if (!subscription && billingMethod !== Constants.BILLING_METHOD_IMMEDIATE) {
      billingPlan = await this.retrieveBillingPlan();
    }
    if (subscription && billingMethod !== Constants.BILLING_METHOD_IMMEDIATE) {
      // Check whether existing subscription needs to be updated
      if (collectionMethod !== subscription.billing) {
        try {
          if (collectionMethod === 'send_invoice') {
            await this.stripe.subscriptions.update(
              subscription.id,
              {
                billing: 'send_invoice',
                days_until_due: daysUntilDue,
              });
          } else {
            await this.stripe.subscriptions.update(
              subscription.id,
              {
                billing: 'charge_automatically',
              });
          }
        } catch (error) {
          throw new BackendError({
            source: Constants.CENTRAL_SERVER,
            module: 'StripeBilling', method: 'modifyUser',
            action: Constants.ACTION_CREATE,
            user: user,
            message: `Impossible to update Stripe customer's subscription '${subscription.id}' with email '${user.email}'`,
            detailedMessages: error
          });
        }
      }
      if (billingPlan && billingPlan !== subscription.plan) {
        try {
          await this.stripe.subscriptions.update(
            subscription.id,
            {
              plan: billingPlan,
            });
        } catch (error) {
          throw new BackendError({
            source: Constants.CENTRAL_SERVER,
            module: 'StripeBilling', method: 'modifyUser',
            action: Constants.ACTION_CREATE,
            user: user,
            message: `Impossible to update Stripe customer's subscription '${subscription.id}' with email '${user.email}'`,
            detailedMessages: error
          });
        }
      }
    }
    if (!subscription && billingMethod !== Constants.BILLING_METHOD_IMMEDIATE) {
      // Create subscription
      let billingCycleAnchor = moment().unix(); // Now
      const plan = await this.getBillingPlan(billingPlan); // Existence was already checked
      if (plan.interval === 'year' || plan.interval === 'month') {
        billingCycleAnchor = moment().endOf('month').add(1, 'day').unix(); // Begin of next month
      }
      try {
        if (collectionMethod === 'send_invoice') {
          subscription = await this.stripe.subscriptions.create({
            customer: customer.id,
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
            customer: customer.id,
            items: [
              {
                plan: billingPlan,
              }
            ],
            billing_cycle_anchor: billingCycleAnchor,
            billing: 'charge_automatically',
          });
        }
      } catch (error) {
        throw new BackendError({
          source: Constants.CENTRAL_SERVER,
          module: 'StripeBilling', method: 'modifyUser',
          action: Constants.ACTION_CREATE,
          user: user,
          message: `Impossible to create new Stripe subscription for user with email '${user.email}'`,
          detailedMessages: error
        });
      }
    }
    return {
      method: billingMethod,
      customerID: customer.id,
      cardID: (customer.default_source && typeof (customer.default_source) === 'string' && customer.default_source.substr(0, 4) === 'card') ? customer.default_source : '',
      subscriptionID: subscription && subscription.id ? subscription.id : '',
      lastChangedOn: new Date()
    };
  }

  private checkIfStripeIsInitialized() {
    if (!this.stripe) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        module: 'StripeBilling', method: 'checkIfStripeIsInitialized',
        action: Constants.ACTION_CHECK_CONNECTION_BILLING,
        message: 'No connection to Stripe available'
      });
    }
  }
}
