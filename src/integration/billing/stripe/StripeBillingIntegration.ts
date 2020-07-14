import { BillingDataTransactionStart, BillingDataTransactionStop, BillingDataTransactionUpdate, BillingInvoice, BillingInvoiceDocument, BillingInvoiceItem, BillingInvoiceStatus, BillingMethod, BillingStatus, BillingTax, BillingUser } from '../../../types/Billing';
import { DocumentEncoding, DocumentType } from '../../../types/GlobalType';
import Stripe, { IResourceObject } from 'stripe';

import BackendError from '../../../exception/BackendError';
import BillingIntegration from '../BillingIntegration';
import BillingStorage from '../../../storage/mongodb/BillingStorage';
import Constants from '../../../utils/Constants';
import Cypher from '../../../utils/Cypher';
import I18nManager from '../../../utils/I18nManager';
import Logging from '../../../utils/Logging';
import { ServerAction } from '../../../types/Server';
import { StripeBillingSetting } from '../../../types/Setting';
import Transaction from '../../../types/Transaction';
import User from '../../../types/User';
import UserStorage from '../../../storage/mongodb/UserStorage';
import Utils from '../../../utils/Utils';
import axios from 'axios';
import moment from 'moment';

import ICustomerListOptions = Stripe.customers.ICustomerListOptions;
import ItaxRateSearchOptions = Stripe.taxRates.ItaxRateSearchOptions;
import IInvoice = Stripe.invoices.IInvoice;

const MODULE_NAME = 'StripeBilling';

export default class StripeBillingIntegration extends BillingIntegration<StripeBillingSetting> {
  private static readonly STRIPE_MAX_LIST = 100;
  private stripe: Stripe;

  constructor(tenantId: string, settings: StripeBillingSetting) {
    super(tenantId, settings);
    this.settings.currency = settings.currency;
    if (this.settings.secretKey) {
      this.settings.secretKey = Cypher.decrypt(settings.secretKey);
    }
    // Currently the public key is not encrypted
    this.stripe = new Stripe(this.settings.secretKey);
  }

  public async checkConnection(): Promise<void> {
    // Check Stripe
    this.checkIfStripeIsInitialized();
    // Check Key
    if (!this.settings.secretKey) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME, method: 'checkConnection',
        action: ServerAction.CHECK_CONNECTION,
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
        module: MODULE_NAME, method: 'checkConnection',
        action: ServerAction.CHECK_CONNECTION,
        message: `Error occurred when connecting to Stripe: ${error.message}`,
        detailedMessages: { error: error.message, stack: error.stack }
      });
    }
    if (!isKeyValid) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME, method: 'checkConnection',
        action: ServerAction.CHECK_CONNECTION,
        message: 'Error occurred when connecting to Stripe: Invalid key'
      });
    }
  }

  public async getUsers(): Promise<BillingUser[]> {
    const users = [];
    let request;
    const requestParams = { limit: StripeBillingIntegration.STRIPE_MAX_LIST } as ICustomerListOptions;
    // Check Stripe
    await this.checkConnection();
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

  public async getUser(id: string): Promise<BillingUser> {
    // Check Stripe
    await this.checkConnection();
    // Get customer
    const customer = await this.getCustomerByID(id);
    if (customer && customer.email) {
      return {
        email: customer.email,
        name: customer.name,
        billingData: {
          customerID: customer.id
        }
      };
    }
  }

  public async getUserByEmail(email: string): Promise<BillingUser> {
    // Check Stripe
    await this.checkConnection();
    // Get customer
    const request = await this.getCustomerByEmail(email);
    if (request) {
      return {
        email: email,
        name: request.name,
        billingData: {
          customerID: request.id
        }
      };
    }
  }

  public async getTaxes(): Promise<BillingTax[]> {
    const taxes = [] as BillingTax[];
    let request;
    const requestParams = { limit: StripeBillingIntegration.STRIPE_MAX_LIST } as ItaxRateSearchOptions;
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

  public async getInvoice(id: string): Promise<BillingInvoice> {
    // Check Stripe
    await this.checkConnection();
    // Get Invoice
    const stripeInvoice = await this.stripe.invoices.retrieve(id);
    if (stripeInvoice) {
      return {
        invoiceID: stripeInvoice.id,
        customerID: stripeInvoice.customer.toString(),
        number: stripeInvoice.number,
        amount: stripeInvoice.amount_due,
        status: stripeInvoice.status as BillingInvoiceStatus,
        currency: stripeInvoice.currency,
        createdOn: new Date(stripeInvoice.created * 1000),
        nbrOfItems: stripeInvoice.lines.total_count,
        downloadUrl: stripeInvoice.invoice_pdf
      } as BillingInvoice;
    }
    return null;
  }

  public async getUpdatedUserIDsInBilling(): Promise<string[]> {
    const createdSince = this.settings.usersLastSynchronizedOn ? `${moment(this.settings.usersLastSynchronizedOn).unix()}` : '0';
    let events: Stripe.IList<Stripe.events.IEvent>;
    const collectedCustomerIDs: string[] = [];
    const request = {
      created: { gt: createdSince },
      limit: StripeBillingIntegration.STRIPE_MAX_LIST,
      type: 'customer.*',
    };
    // Check Stripe
    await this.checkConnection();
    // Loop until all users are read
    do {
      events = await this.stripe.events.list(request);
      for (const evt of events.data) {
        if (evt.data.object.object === 'customer' && (evt.data.object as IResourceObject).id) {
          if (!collectedCustomerIDs.includes((evt.data.object as IResourceObject).id)) {
            collectedCustomerIDs.push((evt.data.object as IResourceObject).id);
          }
        }
      }
      if (request['has_more']) {
        request['starting_after'] = collectedCustomerIDs[collectedCustomerIDs.length - 1];
      }
    } while (request['has_more']);
    return collectedCustomerIDs;
  }

  public async getUpdatedInvoiceIDsInBilling(billingUser?: BillingUser): Promise<string[]> {
    let createdSince: string;
    // Check Stripe
    await this.checkConnection();
    if (billingUser) {
      // Start sync from last invoices sync
      createdSince = billingUser.billingData.invoicesLastSynchronizedOn ? `${moment(billingUser.billingData.invoicesLastSynchronizedOn).unix()}` : '0';
    } else {
      // Start sync from last global sync
      createdSince = this.settings.invoicesLastSynchronizedOn ? `${moment(this.settings.invoicesLastSynchronizedOn).unix()}` : '0';
    }
    let events: Stripe.IList<Stripe.events.IEvent>;
    const collectedInvoiceIDs: string[] = [];
    const request = {
      created: { gt: createdSince },
      limit: StripeBillingIntegration.STRIPE_MAX_LIST,
      type: 'invoice.*',
    };
    // Loop until all invoices are read
    do {
      events = await this.stripe.events.list(request);
      for (const evt of events.data) {
        if (evt.data.object.object === 'invoice' && (evt.data.object as IInvoice).id) {
          const invoice = (evt.data.object as IInvoice);
          if (!collectedInvoiceIDs.includes(invoice.id)) {
            if (billingUser) {
              // Collect specific user's invoices
              if (billingUser.billingData.customerID === invoice.customer) {
                collectedInvoiceIDs.push(invoice.id);
              }
            } else {
              // Collect every invoices
              collectedInvoiceIDs.push(invoice.id);
            }
          }
        }
      }
      if (request['has_more']) {
        request['starting_after'] = collectedInvoiceIDs[collectedInvoiceIDs.length - 1];
      }
    } while (request['has_more']);
    return collectedInvoiceIDs;
  }

  public async createInvoice(user: BillingUser, invoiceItem: BillingInvoiceItem, idempotencyKey?: string | number): Promise<{ invoice: BillingInvoice; invoiceItem: BillingInvoiceItem }> {
    if (!user) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        action: ServerAction.BILLING_CREATE_INVOICE,
        module: MODULE_NAME, method: 'createInvoice',
        message: 'Billing User not provided',
      });
    }
    if (!invoiceItem) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        action: ServerAction.BILLING_CREATE_INVOICE,
        module: MODULE_NAME, method: 'createInvoice',
        message: 'Invoice item not provided',
      });
    }
    await this.checkConnection();
    const daysUntilDue = 30;
    let stripeInvoice: IInvoice;
    try {
      // Some Invoice Items already exists
      stripeInvoice = await this.stripe.invoices.create({
        customer: user.billingData.customerID,
        collection_method: 'send_invoice',
        days_until_due: daysUntilDue,
        auto_advance: false
      }, {
        idempotency_key: idempotencyKey ? idempotencyKey.toString() : null
      });
      // Add new invoice item
      await this.createInvoiceItem(user, stripeInvoice.id, invoiceItem, idempotencyKey);
    } catch (error) {
      // No pending invoice item found: Create one
      invoiceItem = await this.stripe.invoiceItems.create({
        customer: user.billingData.customerID,
        currency: this.settings.currency.toLocaleLowerCase(),
        amount: invoiceItem.amount,
        description: invoiceItem.description,
      });
      stripeInvoice = await this.stripe.invoices.create({
        customer: user.billingData.customerID,
        collection_method: 'send_invoice',
        days_until_due: daysUntilDue,
        auto_advance: false
      });
    }
    const invoice = {
      invoiceID: stripeInvoice.id,
      customerID: stripeInvoice.customer.toString(),
      number: stripeInvoice.number,
      amount: stripeInvoice.amount_due,
      status: stripeInvoice.status as BillingInvoiceStatus,
      currency: stripeInvoice.currency,
      createdOn: new Date(),
      nbrOfItems: stripeInvoice.lines.total_count
    } as Partial<BillingInvoice>;
    invoice.user = await UserStorage.getUserByBillingID(this.tenantID, user.billingData.customerID);
    invoice.id = await BillingStorage.saveInvoice(this.tenantID, invoice);
    return { invoice: invoice as BillingInvoice, invoiceItem: invoiceItem };
  }

  public async createInvoiceItem(user: BillingUser, invoiceID: string, invoiceItem: BillingInvoiceItem, idempotencyKey?: string | number): Promise<BillingInvoiceItem> {
    await this.checkConnection();
    if (!invoiceItem) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        action: ServerAction.BILLING_CREATE_INVOICE_ITEM,
        module: MODULE_NAME, method: 'createInvoiceItem',
        message: 'Invoice item not provided',
      });
    }
    return await this.stripe.invoiceItems.create({
      customer: user.billingData.customerID,
      currency: this.settings.currency.toLocaleLowerCase(),
      amount: invoiceItem.amount,
      description: invoiceItem.description,
      invoice: invoiceID
    }, {
      idempotency_key: idempotencyKey ? idempotencyKey.toString() : null
    });
  }

  public async downloadInvoiceDocument(invoice: BillingInvoice): Promise<BillingInvoiceDocument> {
    if (invoice.downloadUrl && invoice.downloadUrl !== '') {
      // Get document
      const response = await axios.get(invoice.downloadUrl, { responseType: 'arraybuffer' });
      // Convert
      const base64Image = Buffer.from(response.data).toString('base64');
      const content = 'data:' + response.headers['content-type'] + ';base64,' + base64Image;
      return {
        id: invoice.id,
        invoiceID: invoice.invoiceID,
        content: content,
        type: DocumentType.PDF,
        encoding: DocumentEncoding.BASE64
      };
    }
  }

  public async startTransaction(transaction: Transaction): Promise<BillingDataTransactionStart> {
    // Check Stripe
    await this.checkConnection();
    // Check Transaction
    this.checkStartTransaction(transaction);
    // Checks
    const billingUser = transaction.user;
    if (billingUser.billingData.subscriptionID &&
      billingUser.billingData.method !== BillingMethod.IMMEDIATE) {
      const subscription = await this.getSubscription(billingUser.billingData.subscriptionID);
      if (!subscription || subscription.id !== billingUser.billingData.subscriptionID) {
        throw new BackendError({
          message: 'Stripe subscription ID of the transaction user is invalid',
          source: Constants.CENTRAL_SERVER,
          module: MODULE_NAME,
          method: 'startTransaction',
          action: ServerAction.BILLING_TRANSACTION
        });
      }
    }
    const customer = await this.getCustomerByEmail(billingUser.email);
    if (!customer || customer.id !== billingUser.billingData.customerID) {
      throw new BackendError({
        message: 'Stripe customer ID of the transaction user is invalid',
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME,
        method: 'startTransaction',
        action: ServerAction.BILLING_TRANSACTION
      });
    }
    return {
      cancelTransaction: false
    };
  }

  public async updateTransaction(transaction: Transaction): Promise<BillingDataTransactionUpdate> {
    // Check User
    if (!transaction.userID || !transaction.user) {
      throw new BackendError({
        message: 'User is not provided',
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME,
        method: 'updateTransaction',
        action: ServerAction.BILLING_TRANSACTION
      });
    }
    return {
      cancelTransaction: false
    };
  }

  public async stopTransaction(transaction: Transaction): Promise<BillingDataTransactionStop> {
    // Check Stripe
    await this.checkConnection();
    // Check object
    this.checkStopTransaction(transaction);
    // Get the user
    const billingUser = await this.getUser(transaction.user.billingData.customerID);
    if (!billingUser) {
      throw new BackendError({
        message: 'User does not exists in Stripe',
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME, method: 'stopTransaction',
        action: ServerAction.BILLING_TRANSACTION
      });
    }
    const chargeBox = transaction.chargeBox;
    // Create or update invoice in Stripe
    let description = '';
    const i18nManager = new I18nManager(transaction.user.locale);
    const totalConsumptionWh = Math.round(transaction.stop.totalConsumptionWh / 100) / 10;
    const time = i18nManager.formatDateTime(transaction.stop.timestamp, 'LTS');
    if (chargeBox && chargeBox.siteArea && chargeBox.siteArea.name) {
      description = i18nManager.translate('billing.chargingStopSiteArea',
        { totalConsumption: totalConsumptionWh, siteArea: chargeBox.siteArea, time: time });
    } else {
      description = i18nManager.translate('billing.chargingStopChargeBox',
        { totalConsumption: totalConsumptionWh, chargeBox: transaction.chargeBoxID, time: time });
    }
    // Const taxRates: ITaxRate[] = [];
    // if (this.settings.taxID) {
    //   taxRates.push(this.settings.taxID);
    // }
    let invoice = {} as { invoice: BillingInvoice; invoiceItem: BillingInvoiceItem };
    // Billing Method
    switch (transaction.user.billingData.method) {
      // Immediate
      case BillingMethod.IMMEDIATE:
        invoice = await this.createInvoice(billingUser, {
          description: description,
          amount: Math.round(transaction.stop.roundedPrice * 100)
        }, transaction.id);
        await this.sendInvoiceToUser(invoice.invoice);
        break;
      // Periodic
      case BillingMethod.PERIODIC:
        // Get the draft invoice
        invoice.invoice = (await BillingStorage.getInvoices(this.tenantID, { invoiceStatus: [BillingInvoiceStatus.DRAFT] }, Constants.DB_PARAMS_SINGLE_RECORD)).result[0];
        if (invoice.invoice) {
          // A draft invoice already exists: append a new invoice item
          invoice.invoiceItem = await this.createInvoiceItem(billingUser, invoice.invoice.id, {
            description: description,
            amount: Math.round(transaction.stop.roundedPrice * 100)
          }, transaction.id);
        } else {
          // No draft invoice: create a new invoice with invoice item
          invoice.invoice = (await this.createInvoice(billingUser, {
            description: description,
            amount: Math.round(transaction.stop.roundedPrice * 100)
          }, transaction.id)).invoice;
        }
        break;
    }
    return {
      status: BillingStatus.BILLED,
      invoiceID: invoice.invoice.id,
      invoiceStatus: invoice.invoice.status,
      invoiceItem: invoice.invoiceItem,
    };
  }

  public async checkIfUserCanBeCreated(user: User): Promise<boolean> {
    // Check
    return this.checkIfUserCanBeUpdated(user);
  }

  public async userExists(user: User): Promise<boolean> {
    // Check Stripe
    await this.checkConnection();
    // Get customer
    const customer = await this.getCustomerByEmail(user.email);
    return !!customer;
  }

  public async checkIfUserCanBeUpdated(user: User): Promise<boolean> {
    // Check connection
    await this.checkConnection();
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
      Logging.logError({
        tenantID: this.tenantID,
        action: ServerAction.USER_DELETE,
        actionOnUser: user,
        module: MODULE_NAME, method: 'checkIfUserCanBeUpdated',
        message: `User '${Utils.buildUserFullName(user, false)}' cannot be created/updated in Stripe: No payment method`
      });
      return false;
    }
    const billingMethod = this.retrieveBillingMethod(user);
    if (!billingMethod) {
      Logging.logError({
        tenantID: this.tenantID,
        action: ServerAction.USER_DELETE,
        actionOnUser: user,
        module: MODULE_NAME, method: 'checkIfUserCanBeUpdated',
        message: `User '${Utils.buildUserFullName(user, false)}' cannot be created/updated in Stripe: No billing method was selected`
      });
      return false;
    }
    if ((billingMethod === BillingMethod.IMMEDIATE && !this.settings.immediateBillingAllowed) ||
      (billingMethod === BillingMethod.PERIODIC && !this.settings.periodicBillingAllowed)) {
      Logging.logError({
        tenantID: this.tenantID,
        action: ServerAction.USER_DELETE,
        actionOnUser: user,
        module: MODULE_NAME, method: 'checkIfUserCanBeUpdated',
        message: `User '${Utils.buildUserFullName(user, false)}' cannot be created/updated in Stripe: Billing method '${billingMethod}' not allowed`
      });
      return false;
    }
    const subscription = (customer.subscriptions && customer.subscriptions.data && customer.subscriptions.data.length > 0)
      ? customer.subscriptions.data[0] : null;
    let billingPlan = null;
    if (!subscription && billingMethod !== BillingMethod.IMMEDIATE) {
      billingPlan = await this.retrieveBillingPlan();
    }
    if (!billingPlan && !subscription && billingMethod !== BillingMethod.IMMEDIATE) {
      Logging.logError({
        tenantID: this.tenantID,
        action: ServerAction.USER_DELETE,
        actionOnUser: user,
        module: MODULE_NAME, method: 'checkIfUserCanBeUpdated',
        message: `User '${Utils.buildUserFullName(user, false)}' cannot be created/updated in Stripe: No billing plan provided`
      });
      return false;
    }
    if (billingPlan && billingMethod !== BillingMethod.IMMEDIATE) {
      const plan = await this.getBillingPlan(billingPlan);
      if (!plan || !plan.id || plan.id !== billingPlan) {
        Logging.logError({
          tenantID: this.tenantID,
          action: ServerAction.USER_DELETE,
          actionOnUser: user,
          module: MODULE_NAME, method: 'checkIfUserCanBeUpdated',
          message: `User '${Utils.buildUserFullName(user, false)}' cannot be created/updated in Stripe: Billing plan '${billingPlan}' does not exist`
        });
        return false;
      } else if (plan.currency.toLocaleLowerCase() !== this.settings.currency.toLocaleLowerCase()) {
        Logging.logError({
          tenantID: this.tenantID,
          action: ServerAction.USER_DELETE,
          actionOnUser: user,
          module: MODULE_NAME, method: 'checkIfUserCanBeUpdated',
          message: `User '${Utils.buildUserFullName(user, false)}' cannot be created/updated in Stripe: Billing plan '${billingPlan}' uses wrong currency ${plan.currency}`
        });
        return false;
      }
    }
    return true;
  }

  public async checkIfUserCanBeDeleted(user: User): Promise<boolean> {
    // Check connection
    await this.checkConnection();
    // No billing in progress
    if (!user.billingData || !user.billingData.customerID) {
      return true;
    }
    // Check connection
    await this.checkConnection();
    // Check invoices
    let list = await this.stripe.invoices.list({
      customer: user.billingData.customerID,
      status: BillingInvoiceStatus.OPEN,
    });
    if (list && list.data && list.data.length > 0) {
      Logging.logError({
        tenantID: this.tenantID,
        action: ServerAction.USER_DELETE,
        actionOnUser: user,
        module: MODULE_NAME, method: 'checkIfUserCanBeDeleted',
        message: 'Opened invoice still exist in Stripe'
      });
      return false;
    }
    list = await this.stripe.invoices.list({
      customer: user.billingData.customerID,
      status: BillingInvoiceStatus.DRAFT,
    });
    if (list && list.data && list.data.length > 0) {
      Logging.logError({
        tenantID: this.tenantID,
        action: ServerAction.USER_DELETE,
        actionOnUser: user,
        module: MODULE_NAME, method: 'checkIfUserCanBeDeleted',
        message: 'Draft invoice still exist in Stripe'
      });
      return false;
    }
    const itemsList = await this.stripe.invoiceItems.list({
      customer: user.billingData.customerID,
      pending: true,
    });
    if (itemsList && itemsList.data && itemsList.data.length > 0) {
      Logging.logError({
        tenantID: this.tenantID,
        action: ServerAction.USER_DELETE,
        actionOnUser: user,
        module: MODULE_NAME, method: 'checkIfUserCanBeDeleted',
        message: 'Pending invoice still exist in Stripe'
      });
      return false;
    }
    return true;
  }

  public async createUser(user: User): Promise<BillingUser> {
    // Check
    const success = await this.checkIfUserCanBeUpdated(user);
    if (!success) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME, method: 'createUser',
        action: ServerAction.USER_CREATE,
        user: user,
        message: 'Cannot create the user'
      });
    }
    return this.modifyUser(user);
  }

  public async updateUser(user: User): Promise<BillingUser> {
    // Check
    const success = await this.checkIfUserCanBeUpdated(user);
    if (!success) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME, method: 'updateUser',
        action: ServerAction.USER_CREATE,
        user: user,
        message: 'Cannot update the user'
      });
    }
    return this.modifyUser(user);
  }

  public async deleteUser(user: User): Promise<void> {
    // Check Stripe
    await this.checkConnection();
    const customer = await this.getCustomerByEmail(user.email);
    if (customer && customer.id) {
      await this.stripe.customers.del(
        customer.id
      );
    }
  }

  private async getCustomerByID(id: string): Promise<Stripe.customers.ICustomer> {
    await this.checkConnection();
    // Get customer
    return await this.stripe.customers.retrieve(id);
  }

  private async getCustomerByEmail(email: string): Promise<Stripe.customers.ICustomer> {
    await this.checkConnection();
    // Get customer
    const list = await this.stripe.customers.list(
      { email: email, limit: 1 }
    );
    if (list && list.data && list.data.length > 0) {
      return list.data[0];
    }
  }

  private async getSubscription(subscriptionID: string): Promise<Stripe.subscriptions.ISubscription> {
    await this.checkConnection();
    // Get subscription
    return await this.stripe.subscriptions.retrieve(subscriptionID);
  }

  private retrieveBillingMethod(user: User): string {
    // Get billing method
    if (user.billingData && user.billingData.method) {
      return user.billingData.method;
    }
    // Take the first allowed method from the settings
    if (this.settings.immediateBillingAllowed) {
      return BillingMethod.IMMEDIATE;
    }
    if (this.settings.periodicBillingAllowed) {
      return BillingMethod.PERIODIC;
    }
  }

  private async getBillingPlan(billingPlanID: string): Promise<Stripe.plans.IPlan> {
    await this.checkConnection();
    return await this.stripe.plans.retrieve(billingPlanID);
  }

  private async retrieveBillingPlan(): Promise<string> {
    // If not provided from the HTTP request (e.g. req.body.billingPlan), try to assign a billing plan from
    // somewhere else, for example a default plan from this.settings... TODO !!!
    return '';
  }

  private async modifyUser(user: User): Promise<BillingUser> {
    await this.checkConnection();
    const fullName = Utils.buildUserFullName(user, false, false);
    const locale = Utils.getLanguageFromLocale(user.locale).toLocaleLowerCase();
    const i18nManager = new I18nManager(user.locale);
    const description = i18nManager.translate('billing.generatedUser', { email: user.email });
    let customer;
    if (user.billingData && user.billingData.customerID) {
      customer = await this.getCustomerByID(user.billingData.customerID);
    } else {
      customer = await this.getCustomerByEmail(user.email);
    }
    // Create
    if (!customer) {
      customer = await this.stripe.customers.create({
        email: user.email,
        description: description,
        name: fullName,
        preferred_locales: [locale]
      });
    }
    const dataToUpdate: any = {};
    if (customer.description !== description) {
      dataToUpdate.description = description;
    }
    if (customer.name !== fullName) {
      dataToUpdate.name = fullName;
    }
    if (customer.email !== user.email) {
      dataToUpdate.email = user.email;
    }
    if (locale &&
      (!customer.preferred_locales ||
        customer.preferred_locales.length === 0 ||
        customer.preferred_locales[0] !== locale)) {
      dataToUpdate.preferred_locales = [locale];
    }
    // Update
    if (customer.id) {
      customer = await this.stripe.customers.update(
        customer.id,
        dataToUpdate
      );
    }
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
    if (!subscription && billingMethod !== BillingMethod.IMMEDIATE) {
      billingPlan = await this.retrieveBillingPlan();
    }
    if (subscription && billingMethod !== BillingMethod.IMMEDIATE) {
      // Check whether existing subscription needs to be updated
      if (collectionMethod !== subscription.billing) {
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
      }
      if (billingPlan && billingPlan !== subscription.plan) {
        await this.stripe.subscriptions.update(
          subscription.id,
          {
            plan: billingPlan,
          }
        );
      }
    }
    if (!subscription && billingPlan && billingMethod && billingMethod !== BillingMethod.IMMEDIATE) {
      // Create subscription
      let billingCycleAnchor = moment().unix(); // Now
      const plan = await this.getBillingPlan(billingPlan); // Existence was already checked
      if (plan.interval === 'year' || plan.interval === 'month') {
        billingCycleAnchor = moment().endOf('month').add(1, 'day').unix(); // Begin of next month
      }
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
    }
    return {
      name: customer.name,
      email: customer.email,
      billingData: {
        method: billingMethod,
        customerID: customer.id,
        cardID: (customer.default_source && typeof (customer.default_source) === 'string' && customer.default_source.substr(0, 4) === 'card') ? customer.default_source : '',
        subscriptionID: subscription && subscription.id ? subscription.id : '',
        lastChangedOn: new Date(),
        hasSynchroError: false
      }
    };
  }

  private checkIfStripeIsInitialized() {
    if (!this.stripe) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME, method: 'checkIfStripeIsInitialized',
        action: ServerAction.CHECK_CONNECTION,
        message: 'No connection to Stripe available'
      });
    }
  }
}
