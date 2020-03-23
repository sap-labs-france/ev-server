/* eslint-disable @typescript-eslint/camelcase */
import i18n from 'i18n-js';
import moment from 'moment';
import Stripe from 'stripe';
import BackendError from '../../../exception/BackendError';
import { Action } from '../../../types/Authorization';
import { BillingDataStart, BillingDataStop, BillingDataUpdate, BillingInvoice, BillingInvoiceFilter, BillingInvoiceItem, BillingInvoiceStatus, BillingPartialUser, BillingTax, BillingUserData } from '../../../types/Billing';
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
import ITaxRate = Stripe.taxRates.ITaxRate;
import ItaxRateSearchOptions = Stripe.taxRates.ItaxRateSearchOptions;

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
        action: Action.BILLING_CHECK_CONNECTION,
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
        action: Action.BILLING_CHECK_CONNECTION,
        message: `Error occured when connecting to Stripe: ${error.message}`,
        detailedMessages: { error }
      });
    }
    if (!isKeyValid) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        module: 'StripeBilling', method: 'checkConnection',
        action: Action.BILLING_CHECK_CONNECTION,
        message: 'Error occured when connecting to Stripe: Invalid key'
      });
    }
  }

  public async getUsers(): Promise<BillingPartialUser[]> {
    const users = [];
    let request;
    const requestParams = { limit: StripeBilling.STRIPE_MAX_LIST } as ICustomerListOptions;
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

  public async getUser(id: string): Promise<BillingPartialUser> {
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

  public async getUserByEmail(email: string): Promise<BillingPartialUser> {
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

  public async getUserInvoice(user: BillingPartialUser, invoiceId: string): Promise<BillingInvoice> {
    await this.checkConnection();
    const invoice = await this.stripe.invoices.retrieve(invoiceId);
    if (invoice) {
      return {
        id: invoice.id,
        number: invoice.number,
        status: invoice.status,
        amountDue: invoice.amount_due,
        currency: invoice.currency,
        customerID: invoice.customer,
        createdOn: new Date(invoice.created * 1000),
        downloadUrl: invoice.invoice_pdf,
        payUrl: invoice.hosted_invoice_url,
        items: invoice.lines.data,
      };
    }
  }

  public async getUserInvoices(user: BillingPartialUser, filters?: BillingInvoiceFilter): Promise<BillingInvoice[]> {
    await this.checkConnection();
    const invoices = [] as BillingInvoice[];
    let request;
    const requestParams: any = { limit: StripeBilling.STRIPE_MAX_LIST, customer: user.billingData.customerID };
    if (filters) {
      if (filters.startDateTime) {
        Object.assign(requestParams, { created: { gte: new Date(filters.startDateTime).getTime() / 1000 } });
      }
      if (filters.endDateTime) {
        if (requestParams.created) {
          Object.assign(requestParams.created, { lte: new Date(filters.endDateTime).getTime() / 1000 });
        } else {
          Object.assign(requestParams, { created: { lte: new Date(filters.endDateTime).getTime() / 1000 } });
        }
      }
    }
    do {
      request = await this.stripe.invoices.list(requestParams);
      for (const invoice of request.data) {
        const matchStatus = !filters.status || filters.status.split('|').includes(invoice.status);
        const matchSearch = !filters.search || filters.search === '' || invoice.number.toUpperCase().startsWith(filters.search.toUpperCase().trim());
        if (!filters || (matchStatus && matchSearch)) {
          invoices.push({
            id: invoice.id,
            number: invoice.number,
            status: invoice.status,
            amountDue: invoice.amount_due,
            currency: invoice.currency,
            customerID: invoice.customer,
            createdOn: new Date(invoice.created * 1000),
            downloadUrl: invoice.invoice_pdf,
            payUrl: invoice.hosted_invoice_url,
            items: invoice.lines.data,
          });
        }
      }
      if (request.has_more) {
        requestParams['starting_after'] = invoices[invoices.length - 1].id;
      }
    } while (request.has_more);
    return invoices;
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
    let events: Stripe.IList<Stripe.events.IEvent>;
    const collectedCustomerIDs: string[] = [];
    const request = {
      created: { gt: createdSince },
      limit: StripeBilling.STRIPE_MAX_LIST,
      type: 'customer.*',
    };

    try {
      // Check Stripe
      await this.checkConnection();
      // Loop until all users are read

      do {
        events = await this.stripe.events.list(request);
        for (const evt of events.data) {
          if (evt.data.object.object === 'customer' && evt.data.object.id) {
            if (!collectedCustomerIDs.includes(evt.data.object.id)) {
              collectedCustomerIDs.push(evt.data.object.id);
            }
          }
        }
        if (request['has_more']) {
          request['starting_after'] = collectedCustomerIDs[collectedCustomerIDs.length - 1];
        }
      } while (request['has_more']);
    } catch (error) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        action: Action.BILLING_SYNCHRONIZE,
        module: 'StripeBilling', method: 'getUpdatedCustomersForSynchronization',
        message: `Impossible to retrieve changed customers from Stripe Billing: ${error.message}`,
        detailedMessages: { error }
      });
    }
    return collectedCustomerIDs;
  }

  public async getOpenedInvoice(user: BillingPartialUser): Promise<BillingInvoice> {
    if (!user.billingData || !user.billingData.customerID) {
      throw new BackendError({
        message: 'User has no Billing data',
      });
    }
    try {
      const userOpenedInvoices = await this.getUserInvoices(user, { status: BillingInvoiceStatus.DRAFT });
      if (userOpenedInvoices.length > 0) {
        return userOpenedInvoices[0];
      }
    } catch (error) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        action: Action.BILLING_GET_OPENED_INVOICE,
        module: 'StripeBilling', method: 'getOpenedInvoice',
        message: 'Failed to retrieve opened invoices',
        detailedMessages: { error }
      });
    }
  }

  public async createInvoice(user: BillingPartialUser, invoiceItem: BillingInvoiceItem): Promise<{ invoice: BillingInvoice; invoiceItem: BillingInvoiceItem }> {
    if (!user) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        action: Action.BILLING_CREATE_INVOICE,
        module: 'StripeBilling', method: 'createInvoice',
        message: 'Billing User not provided',
      });
    }
    if (!invoiceItem) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        action: Action.BILLING_CREATE_INVOICE,
        module: 'StripeBilling', method: 'createInvoice',
        message: 'Invoice item not provided',
      });
    }
    await this.checkConnection();
    const daysUntilDue = 30;
    let invoice: BillingInvoice;
    try {
      // Invoice Items already exists
      invoice = await this.stripe.invoices.create({
        customer: user.billingData.customerID,
        collection_method: 'send_invoice',
        days_until_due: daysUntilDue,
        auto_advance: true
      });
    } catch (e) {
      // No pending invoice item found
      try {
        invoiceItem = await this.stripe.invoiceItems.create({
          customer: user.billingData.customerID,
          currency: this.settings.currency.toLocaleLowerCase(),
          amount: invoiceItem.amount,
          description: invoiceItem.description,
          tax_rates: invoiceItem.taxes ? invoiceItem.taxes : []
        });

        invoice = await this.stripe.invoices.create({
          customer: user.billingData.customerID,
          collection_method: 'send_invoice',
          days_until_due: daysUntilDue,
          auto_advance: true
        });
      } catch (error) {
        throw new BackendError({
          source: Constants.CENTRAL_SERVER,
          action: Action.BILLING_CREATE_INVOICE,
          module: 'StripeBilling', method: 'createInvoice',
          message: 'Failed to create invoice',
          detailedMessages: { error }
        });
      }
    }
    return { invoice: invoice, invoiceItem: invoiceItem };
  }

  public async createInvoiceItem(user: BillingPartialUser, invoice: BillingInvoice, invoiceItem: BillingInvoiceItem): Promise<BillingInvoiceItem> {
    await this.checkConnection();
    if (!invoiceItem) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        action: Action.BILLING_CREATE_INVOICE_ITEM,
        module: 'StripeBilling', method: 'createInvoiceItem',
        message: 'Invoice item not provided',
      });
    }
    try {
      return await this.stripe.invoiceItems.create({
        customer: user.billingData.customerID,
        currency: this.settings.currency.toLocaleLowerCase(),
        amount: invoiceItem.amount * 100,
        description: invoiceItem.description,
        tax_rates: invoiceItem.taxes ? invoiceItem.taxes : [],
        invoice: invoice.id
      });
    } catch (error) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        action: Action.BILLING_CREATE_INVOICE_ITEM,
        module: 'StripeBilling', method: 'createInvoiceItem',
        message: 'Failed to create invoice item',
        detailedMessages: { error }
      });
    }
  }

  public async sendInvoice(invoiceId: string): Promise<BillingInvoice> {
    await this.checkConnection();
    try {
      return await this.stripe.invoices.sendInvoice(invoiceId);
    } catch (error) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        action: Action.BILLING_SEND_INVOICE,
        module: 'StripeBilling', method: 'sendInvoice',
        message: 'Failed to send invoice',
        detailedMessages: { error }
      });
    }
  }

  public async startTransaction(transaction: Transaction): Promise<BillingDataStart> {
    try {
      // Check Stripe
      await this.checkConnection();
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
        action: Action.BILLING_TRANSACTION,
        module: 'StripeBilling', method: 'startTransaction',
        message: `Billing error in Start Transaction: ${error.message}`,
        detailedMessages: { error }
      });
    }
    return {
      cancelTransaction: false
    };
  }

  public async updateTransaction(transaction: Transaction): Promise<BillingDataUpdate> {
    try {
      // Check Stripe
      await this.checkConnection();
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
        action: Action.BILLING_TRANSACTION,
        module: 'StripeBilling', method: 'updateTransaction',
        message: `Billing error in Update Transaction: ${error.message}`,
        detailedMessages: { error }
      });
    }
    return {
      cancelTransaction: false
    };
  }

  public async stopTransaction(transaction: Transaction): Promise<BillingDataStop> {
    try {
      // Check Stripe
      await this.checkConnection();
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
            invoiceStatus = BillingInvoiceStatus.PENDING;
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
        action: Action.BILLING_TRANSACTION,
        module: 'StripeBilling', method: 'updateTransaction',
        message: `Billing error in Stop Transaction: ${error.message}`,
        detailedMessages: { error }
      });
      return {
        status: Constants.BILLING_STATUS_UNBILLED,
        invoiceStatus: null,
        invoiceItem: null
      };
    }
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
      Logging.logError({
        tenantID: this.tenantID,
        action: Action.USER_DELETE,
        actionOnUser: user,
        module: 'StripeBilling', method: 'checkIfUserCanBeUpdated',
        message: `User '${Utils.buildUserFullName(user, false)}' cannot be created/updated in Stripe: No payment method`
      });
      return false;
    }
    const billingMethod = this.retrieveBillingMethod(user);
    if (!billingMethod) {
      Logging.logError({
        tenantID: this.tenantID,
        action: Action.USER_DELETE,
        actionOnUser: user,
        module: 'StripeBilling', method: 'checkIfUserCanBeUpdated',
        message: `User '${Utils.buildUserFullName(user, false)}' cannot be created/updated in Stripe: No billing method was selected`
      });
      return false;
    }
    if ((billingMethod === Constants.BILLING_METHOD_IMMEDIATE && !this.settings.immediateBillingAllowed) ||
          (billingMethod === Constants.BILLING_METHOD_PERIODIC && !this.settings.periodicBillingAllowed) ||
          (billingMethod === Constants.BILLING_METHOD_ADVANCE && !this.settings.advanceBillingAllowed)) {
      Logging.logError({
        tenantID: this.tenantID,
        action: Action.USER_DELETE,
        actionOnUser: user,
        module: 'StripeBilling', method: 'checkIfUserCanBeUpdated',
        message: `User '${Utils.buildUserFullName(user, false)}' cannot be created/updated in Stripe: Billing method '${billingMethod}' not allowed`
      });
      return false;
    }
    const subscription = (customer.subscriptions && customer.subscriptions.data && customer.subscriptions.data.length > 0)
      ? customer.subscriptions.data[0] : null;
    let billingPlan = null;
    if (!subscription && billingMethod !== Constants.BILLING_METHOD_IMMEDIATE) {
      billingPlan = await this.retrieveBillingPlan();
    }
    if (!billingPlan && !subscription && billingMethod !== Constants.BILLING_METHOD_IMMEDIATE) {
      Logging.logError({
        tenantID: this.tenantID,
        action: Action.USER_DELETE,
        actionOnUser: user,
        module: 'StripeBilling', method: 'checkIfUserCanBeUpdated',
        message: `User '${Utils.buildUserFullName(user, false)}' cannot be created/updated in Stripe: No billing plan provided`
      });
      return false;
    }
    if (billingPlan && billingMethod !== Constants.BILLING_METHOD_IMMEDIATE) {
      const plan = await this.getBillingPlan(billingPlan);
      if (!plan || !plan.id || plan.id !== billingPlan) {
        Logging.logError({
          tenantID: this.tenantID,
          action: Action.USER_DELETE,
          actionOnUser: user,
          module: 'StripeBilling', method: 'checkIfUserCanBeUpdated',
          message: `User '${Utils.buildUserFullName(user, false)}' cannot be created/updated in Stripe: Billing plan '${billingPlan}' does not exist`
        });
        return false;
      } else if (plan.currency.toLocaleLowerCase() !== this.settings.currency.toLocaleLowerCase()) {
        Logging.logError({
          tenantID: this.tenantID,
          action: Action.USER_DELETE,
          actionOnUser: user,
          module: 'StripeBilling', method: 'checkIfUserCanBeUpdated',
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
        action: Action.USER_DELETE,
        actionOnUser: user,
        module: 'StripeBilling', method: 'checkIfUserCanBeDeleted',
        message: 'Cannot delete user: Opened invoice still exist in Stripe'
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
        action: Action.USER_DELETE,
        actionOnUser: user,
        module: 'StripeBilling', method: 'checkIfUserCanBeDeleted',
        message: 'Cannot delete user: Draft invoice still exist in Stripe'
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
        action: Action.USER_DELETE,
        actionOnUser: user,
        module: 'StripeBilling', method: 'checkIfUserCanBeDeleted',
        message: 'Cannot delete user: Pending invoice still exist in Stripe'
      });
      return false;
    }
    return true;
  }

  public async createUser(user: User): Promise<BillingUserData> {
    // Check
    const success = await this.checkIfUserCanBeUpdated(user);
    if (!success) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        module: 'StripeBilling', method: 'createUser',
        action: Action.USER_CREATE,
        user: user,
        message: 'Cannot create the user'
      });
    }
    return this.modifyUser(user);
  }

  public async updateUser(user: User): Promise<BillingUserData> {
    // Check
    const success = await this.checkIfUserCanBeUpdated(user);
    if (!success) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        module: 'StripeBilling', method: 'updateUser',
        action: Action.USER_CREATE,
        user: user,
        message: 'Cannot update the user'
      });
    }
    return await this.modifyUser(user);
  }

  public async deleteUser(user: User) {
    // Check Stripe
    await this.checkConnection();
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
            action: Action.USER_CREATE,
            user: user,
            message: 'Cannot delete the User'
          });
        }
      }
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
    await this.checkConnection();
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
    await this.checkConnection();
    let locale = user.locale;
    const fullName = Utils.buildUserFullName(user);
    if (locale) {
      locale = locale.substr(0, 2).toLocaleLowerCase();
    }
    I18nManager.switchLocale(user.locale);
    const description = i18n.t('billing.generatedUser', { email: user.email });
    let customer;
    if (user.billingData && user.billingData.customerID) {
      customer = await this.getCustomerByID(user.billingData.customerID);
    } else {
      customer = await this.getCustomerByEmail(user.email);
    }
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
          action: Action.USER_CREATE,
          user: user,
          message: 'Impossible to create a Stripe customer',
          detailedMessages: { error }
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
          action: Action.USER_CREATE,
          user: user,
          message: `Impossible to update Stripe customer '${customer.id}' with email '${user.email}'`,
          detailedMessages: { error }
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
    //       action: Action.USER_CREATE,
    //       user: user,
    //       message: `Impossible to update Stripe customer '${customer.id}' with email '${user.email}'`,
    //       detailedMessages: { error }
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
            action: Action.USER_CREATE,
            user: user,
            message: `Impossible to update Stripe customer's subscription '${subscription.id}' with email '${user.email}'`,
            detailedMessages: { error }
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
            action: Action.CREATE,
            user: user,
            message: `Impossible to update Stripe customer's subscription '${subscription.id}' with email '${user.email}'`,
            detailedMessages: { error }
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
          action: Action.USER_CREATE,
          user: user,
          message: `Impossible to create new Stripe subscription for user with email '${user.email}'`,
          detailedMessages: { error }
        });
      }
    }
    return {
      method: billingMethod,
      customerID: customer.id,
      cardID: (customer.default_source && typeof (customer.default_source) === 'string' && customer.default_source.substr(0, 4) === 'card') ? customer.default_source : '',
      subscriptionID: subscription && subscription.id ? subscription.id : '',
      lastChangedOn: new Date(),
      hasSynchroError: false
    };
  }

  private checkIfStripeIsInitialized() {
    if (!this.stripe) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        module: 'StripeBilling', method: 'checkIfStripeIsInitialized',
        action: Action.BILLING_CHECK_CONNECTION,
        message: 'No connection to Stripe available'
      });
    }
  }
}
