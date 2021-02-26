/* eslint-disable @typescript-eslint/member-ordering */
import { BillingDataTransactionStart, BillingDataTransactionStop, BillingDataTransactionUpdate, BillingInvoice, BillingInvoiceDocument, BillingInvoiceItem, BillingInvoiceStatus, BillingStatus, BillingTax, BillingUser } from '../../../types/Billing';
import { DocumentEncoding, DocumentType } from '../../../types/GlobalType';
import Stripe, { IResourceObject, customers, invoices, paymentMethods } from 'stripe';

import AxiosFactory from '../../../utils/AxiosFactory';
import { AxiosInstance } from 'axios';
import BackendError from '../../../exception/BackendError';
import BillingIntegration from '../BillingIntegration';
import BillingStorage from '../../../storage/mongodb/BillingStorage';
import Constants from '../../../utils/Constants';
import Cypher from '../../../utils/Cypher';
import I18nManager from '../../../utils/I18nManager';
import Logging from '../../../utils/Logging';
import { Request } from 'express';
import { ServerAction } from '../../../types/Server';
import { StripeBillingSetting } from '../../../types/Setting';
import Transaction from '../../../types/Transaction';
import User from '../../../types/User';
import UserStorage from '../../../storage/mongodb/UserStorage';
import Utils from '../../../utils/Utils';
import moment from 'moment';

import ICustomerListOptions = Stripe.customers.ICustomerListOptions;
import ItaxRateSearchOptions = Stripe.taxRates.ItaxRateSearchOptions;
import IInvoice = Stripe.invoices.IInvoice;

const MODULE_NAME = 'StripeBillingIntegration';

export default class StripeBillingIntegration extends BillingIntegration<StripeBillingSetting> {
  private static readonly STRIPE_MAX_LIST = 100;
  private axiosInstance: AxiosInstance;
  private stripe: Stripe;
  private stripeSettings: StripeBillingSetting;

  constructor(tenantId: string, settings: StripeBillingSetting) {
    super(tenantId, settings);
    this.axiosInstance = AxiosFactory.getAxiosInstance(this.tenantID);
    this.stripeSettings = settings;
  }

  public async getStripeInstance(): Promise<Stripe> {
    // TODO - To be clarified - only used by automated tests!!! - remove it ASAP
    await this.checkConnection();
    return this.stripe;
  }

  public async checkConnection(): Promise<void> {
    // Initialize Stripe
    if (!this.stripe) {
      // STRIPE not yet initialized - let's do it!
      this.settings.currency = this.stripeSettings.currency;
      this.settings.secretKey = await Cypher.decrypt(this.tenantID, this.stripeSettings.secretKey);
      // Check Key
      if (!this.settings.secretKey) {
        throw new BackendError({
          source: Constants.CENTRAL_SERVER,
          module: MODULE_NAME, method: 'checkConnection',
          action: ServerAction.CHECK_CONNECTION,
          message: 'No secret key provided for connection to Stripe'
        });
      }
      this.stripe = new Stripe(this.settings.secretKey);
      // Let's check if the connection is working properly
      if (!this.stripe) {
        throw new BackendError({
          source: Constants.CENTRAL_SERVER,
          module: MODULE_NAME, method: 'checkConnection',
          action: ServerAction.CHECK_CONNECTION,
          message: 'Failed to connect to Stripe'
        });
      }
      // Validate the connection
      let isKeyValid = false;
      try {
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
          message: `Error occurred when connecting to Stripe: ${error.message as string}`,
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
    const billingUser = await this.getCustomerByEmail(email);
    if (billingUser) {
      return {
        email: email,
        name: billingUser.name,
        billingData: {
          customerID: billingUser.id
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
    try {
      const stripeInvoice = await this.stripe.invoices.retrieve(id);
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
    } catch (e) {
      return null;
    }
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

  public async createInvoice(user: BillingUser, idempotencyKey?: string | number): Promise<BillingInvoice> {
    if (!user) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        action: ServerAction.BILLING_CREATE_INVOICE,
        module: MODULE_NAME, method: 'createInvoice',
        message: 'Billing User not provided',
      });
    }
    await this.checkConnection();

    const stripeInvoice: IInvoice = await this.stripe.invoices.create({
      customer: user.billingData.customerID,
      collection_method: 'send_invoice',
      days_until_due: 30,
      auto_advance: false
    }, {
      idempotency_key: idempotencyKey ? idempotencyKey.toString() : null
    });

    const invoice = {
      invoiceID: stripeInvoice.id,
      customerID: stripeInvoice.customer.toString(),
      number: stripeInvoice.number,
      amount: stripeInvoice.amount_due,
      status: stripeInvoice.status as BillingInvoiceStatus,
      currency: stripeInvoice.currency,
      createdOn: new Date(),
      nbrOfItems: stripeInvoice.lines.total_count
    } as BillingInvoice;

    // Set user
    invoice.user = await UserStorage.getUserByBillingID(this.tenantID, user.billingData.customerID);
    // Save Invoice
    invoice.id = await BillingStorage.saveInvoice(this.tenantID, invoice);
    return invoice;
  }

  public async createPendingInvoiceItem(user: BillingUser, invoiceItem: BillingInvoiceItem, idempotencyKey?: string | number): Promise<BillingInvoiceItem> {
    // TODO - We create an item while the invoice ID is not yet known!
    return this.createInvoiceItem(user, null, invoiceItem, idempotencyKey);
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
    try {

      const itemInputParameters: any = {
        customer: user.billingData.customerID,
        currency: this.settings.currency.toLocaleLowerCase(),
        amount: invoiceItem.amount,
        description: invoiceItem.description,
        tax_rates: this.getTaxRateIds()
      };

      if (invoiceID) {
        // STRIPE throws an exception when invoice is set to null.
        // Make sure to only add that property when updating an existing invoice
        itemInputParameters.invoice = invoiceID;
      }

      const stripeInvoiceItem = await this.stripe.invoiceItems.create(itemInputParameters, {
        idempotency_key: idempotencyKey?.toString()
      });

      // TODO - move that logic somewhere else!
      // const invoice = await BillingStorage.getInvoiceByBillingInvoiceID(this.tenantID, invoiceID);
      // invoice.nbrOfItems++; // TODO - Clarify why we only update the number of items and not the other info (amount?)
      // await BillingStorage.saveInvoice(this.tenantID, invoice);

      return stripeInvoiceItem;
    } catch (e) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        action: ServerAction.BILLING_CREATE_INVOICE_ITEM,
        module: MODULE_NAME, method: 'createInvoiceItem',
        message: 'Failed to create invoice item',
        detailedMessages: { error: e.message, stack: e.stack }
      });
    }
  }

  private getTaxRateIds(): Array<string> {
    // TODO - just a hack for now - tax rate should be part of the billing settings
    // return [ 'txr_1IP3FJKHtGlSi68frTdAro48' ];
    return []; // No tax rates so far!
  }

  public async downloadInvoiceDocument(invoice: BillingInvoice): Promise<BillingInvoiceDocument> {
    if (invoice.downloadUrl && invoice.downloadUrl !== '') {
      // Get document
      const response = await this.axiosInstance.get(invoice.downloadUrl, {
        responseType: 'arraybuffer'
      });
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

  public async finalizeInvoice(invoice: BillingInvoice): Promise<string> {
    await this.checkConnection();
    try {
      const stripeInvoice = await this.stripe.invoices.finalizeInvoice(invoice.invoiceID);
      invoice.downloadUrl = stripeInvoice.invoice_pdf;
      invoice.status = BillingInvoiceStatus.OPEN;
      invoice.downloadable = true;
      await BillingStorage.saveInvoice(this.tenantID, invoice);
      const invoiceDocument = await this.downloadInvoiceDocument(invoice);
      await BillingStorage.saveInvoiceDocument(this.tenantID, invoiceDocument);
      return stripeInvoice.invoice_pdf;
    } catch (error) {
      throw new BackendError({
        message: 'Failed to finalize invoice',
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME,
        method: 'finalizeInvoice',
        action: ServerAction.BILLING_SEND_INVOICE
      });
    }
  }

  public handleBillingEvent(req: Request): boolean {
    let event: { data, type: string };
    if (process.env.STRIPE_WEBHOOK_SECRET) { // ##CR - to be clarified - where this secret key should come from
      // Retrieve the event by verifying the signature using the raw body and secret.
      const signature = req.headers['stripe-signature'];
      try {
        event = this.stripe.webhooks.constructEvent(
          req.body, // Req.rawBody,
          signature,
          process.env.STRIPE_WEBHOOK_SECRET
        );
      } catch (err) {
        console.log('⚠️  Webhook signature verification failed.');
        // Return res.sendStatus(400);
        return false; // ##CR - this is stupid
      }
    } else {
      // Webhook signing is recommended, but if the secret is not known
      // we can retrieve the event data directly from the request body.
      event = {
        data: req.body.data,
        type: req.body.type
      };
    }
    if (event.type === 'payment_intent.succeeded') {
      // The payment was complete
      // Fulfill any orders, e-mail receipts, etc
      console.log('💰 Payment succeeded with payment method ' + event.data.object.payment_method);
    } else if (event.type === 'payment_intent.payment_failed') {
      // The payment failed to go through due to decline or authentication request
      const error = event.data.object.last_payment_error.message;
      console.log('❌ Payment failed with error: ' + error);
    } else if (event.type === 'payment_method.attached') {
      // A new payment method was attached to a customer
      console.log('💳 Attached ' + event.data.object.id + ' to customer');
    } else {
      console.log(`❌ unexpected event : ${event.type}`);
    }
    return true;
  }

  public async chargeInvoice(invoice: BillingInvoice): Promise<unknown> {
    await this.checkConnection();
    // Fetch the invoice from stripe (do NOT TRUST the local copy)
    let stripeInvoice: invoices.IInvoice = await this.stripe.invoices.retrieve(invoice.invoiceID);
    // Check the current invoice status
    if (stripeInvoice.status !== 'paid') {
      // Finalize the invoice (if necessary)
      if (stripeInvoice.status === 'draft') {
        stripeInvoice = await this.stripe.invoices.finalizeInvoice(invoice.invoiceID);
      }
      // Once finalized, the invoice is in the "open" state!
      if (stripeInvoice.status === 'open') {
        // Set the payment options
        // TODO - default payment is used by default - is this ok?
        const paymentOptions: invoices.IInvoicePayOptions = {};
        stripeInvoice = await this.stripe.invoices.pay(invoice.invoiceID, paymentOptions);
      }
    }
    // TODO - Handle inconsistencies - Operation failed - unexpected status
    return {
      invoiceStatus: stripeInvoice.status,
      rawData: stripeInvoice
    };
  }

  public async attachPaymentMethod(user: User, paymentMethodId: string): Promise<unknown> {
    // Check Stripe
    await this.checkConnection();
    // Check billing data consistency
    if (!user.billingData || !user.billingData.customerID) {
      throw new BackendError({
        message: 'User is not yet known in Stripe',
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME,
        method: 'attachPaymentMethod',
        action: ServerAction.BILLING_TRANSACTION
      });
    }
    // Attach payment method to stripe customer
    const customerID = user.billingData.customerID;
    const operationResult: paymentMethods.IPaymentMethod = await this.stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerID
    });
    // Set this payment method as the default
    await this.stripe.customers.update(customerID, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      }
    });
    return operationResult;
  }

  public async startTransaction(transaction: Transaction): Promise<BillingDataTransactionStart> {
    // Check Stripe
    await this.checkConnection();
    // Check Transaction
    this.checkStartTransaction(transaction);
    // Checks
    const customer = await this.getCustomerByEmail(transaction.user.email);
    if (!customer || customer.id !== transaction.user.billingData.customerID) {
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

  // eslint-disable-next-line @typescript-eslint/require-await
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
    //
    let newInvoiceItem: BillingInvoiceItem;
    const lineItemInputParameters = this.buildLineItem(transaction);
    // Get the current draft invoice (if any)
    let draftInvoice = await this.getDraftInvoice(transaction);
    if (!draftInvoice) {
      // STRIPE requires that we first create an item (a pending one - and then create the invoice)
      newInvoiceItem = await this.createPendingInvoiceItem(billingUser, lineItemInputParameters, transaction.id);
      draftInvoice = await this.createInvoice(billingUser, transaction.id);
    } else {
      newInvoiceItem = await this.createInvoiceItem(billingUser, draftInvoice.invoiceID, lineItemInputParameters, transaction.id);
    }

    if (!draftInvoice) {
      throw new BackendError({
        message: 'Failed to create DRAFT invoice',
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME, method: 'stopTransaction',
        action: ServerAction.BILLING_TRANSACTION
      });
    }

    // Make sure a new item has been created
    if (!draftInvoice || !newInvoiceItem) {
      throw new BackendError({
        message: 'Failed to create draft invoice',
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME, method: 'stopTransaction',
        action: ServerAction.BILLING_TRANSACTION
      });
    }
    // Return the operation result as a BillingDataTransactionStop
    return {
      status: BillingStatus.BILLED,
      invoiceID: draftInvoice.id,
      invoiceStatus: draftInvoice.status,
      invoiceItem: newInvoiceItem // TODO - get rid of that information - the new item might be pending!
    };
  }

  private buildLineItem(transaction: Transaction) {
    return {
      description: this.buildLineItemDescription(transaction),
      amount: this.convertTransactionPrice(transaction)
    };
  }

  private buildLineItemDescription(transaction: Transaction) {
    let description: string;
    const chargeBox = transaction.chargeBox;
    const i18nManager = I18nManager.getInstanceForLocale(transaction.user.locale);
    const time = i18nManager.formatDateTime(transaction.stop.timestamp, 'LTS');
    const consumptionkWh = this.convertConsumptionWh(transaction);

    if (chargeBox && chargeBox.siteArea && chargeBox.siteArea.name) {
      description = i18nManager.translate('billing.chargingStopSiteArea', {
        totalConsumption: consumptionkWh,
        siteArea:
        chargeBox.siteArea,
        time: time
      });
    } else {
      description = i18nManager.translate('billing.chargingStopChargeBox', {
        totalConsumption: consumptionkWh, chargeBox: transaction.chargeBoxID, time: time
      });
    }
    return description;
  }

  private convertConsumptionWh(transaction: Transaction): number {
    // TODO - clarify why we need this conversion
    return Math.round(transaction.stop.totalConsumptionWh / 100) / 10;
  }

  private convertTransactionPrice(transaction: Transaction): number {
    // STRIPE expects the amount, in cents!!!
    return Math.round(transaction.stop.roundedPrice * 100);
  }

  private async getDraftInvoice(transaction: Transaction) {
    // Get the draft invoice
    const draftInvoices = await BillingStorage.getInvoices(this.tenantID, {
      invoiceStatus: [BillingInvoiceStatus.DRAFT], userIDs: [transaction.userID] }, { limit: 1, skip: 0, sort: { createdOn: -1 }
    });
    return draftInvoices?.result?.[0];
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

  // eslint-disable-next-line @typescript-eslint/require-await
  public async checkIfUserCanBeUpdated(user: User): Promise<boolean> {
    // Check connection
    // await this.checkConnection();
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
    // OPENED
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
    // DRAFT
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
    // PENDING
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
    const billingUser = await this.stripe.customers.retrieve(id);
    return billingUser && !billingUser['deleted'] ? billingUser : null;
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

  private async modifyUser(user: User): Promise<BillingUser> {
    await this.checkConnection();
    const fullName = Utils.buildUserFullName(user, false, false);
    const locale = Utils.getLanguageFromLocale(user.locale).toLocaleLowerCase();
    const i18nManager = I18nManager.getInstanceForLocale(user.locale);
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
    // Update user data
    const userDataToUpdate: customers.ICustomerUpdateOptions = {};
    if (customer.description !== description) {
      userDataToUpdate.description = description;
    }
    if (customer.name !== fullName) {
      userDataToUpdate.name = fullName;
    }
    if (customer.email !== user.email) {
      userDataToUpdate.email = user.email;
    }
    if (locale &&
      (!customer.preferred_locales ||
        customer.preferred_locales.length === 0 ||
        customer.preferred_locales[0] !== locale)) {
      userDataToUpdate.preferred_locales = [locale];
    }
    // Update
    customer = await this.stripe.customers.update(
      customer.id, userDataToUpdate
    );
    return {
      name: customer.name,
      email: customer.email,
      billingData: {
        customerID: customer.id,
        lastChangedOn: new Date(),
        hasSynchroError: false
      }
    };
  }

  private async initializeStripe() {
    if (!this.stripe) {
      this.settings.currency = this.stripeSettings.currency;
      this.settings.secretKey = await Cypher.decrypt(this.tenantID, this.stripeSettings.secretKey);
      this.stripe = new Stripe(this.settings.secretKey);
    }
  }
}
