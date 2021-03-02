/* eslint-disable @typescript-eslint/member-ordering */
import { BillingDataTransactionStart, BillingDataTransactionStop, BillingDataTransactionUpdate, BillingInvoice, BillingInvoiceDocument, BillingInvoiceItem, BillingInvoiceStatus, BillingStatus, BillingTax, BillingUser } from '../../../types/Billing';
import { DocumentEncoding, DocumentType } from '../../../types/GlobalType';

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
import Stripe from 'stripe';
import { StripeBillingSetting } from '../../../types/Setting';
import Transaction from '../../../types/Transaction';
import User from '../../../types/User';
import UserStorage from '../../../storage/mongodb/UserStorage';
import Utils from '../../../utils/Utils';
import moment from 'moment';

const MODULE_NAME = 'StripeBillingIntegration';
export default class StripeBillingIntegration extends BillingIntegration<StripeBillingSetting> {

  private static readonly STRIPE_MAX_LIST = 100;
  private axiosInstance: AxiosInstance;
  private stripe: Stripe;

  constructor(tenantId: string, settings: StripeBillingSetting) {
    super(tenantId, settings);
    this.axiosInstance = AxiosFactory.getAxiosInstance(this.tenantID);
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
      this.settings.secretKey = await Cypher.decrypt(this.tenantID, this.settings.secretKey);
      // Check Key
      if (!this.settings.secretKey) {
        throw new BackendError({
          source: Constants.CENTRAL_SERVER,
          module: MODULE_NAME, method: 'checkConnection',
          action: ServerAction.CHECK_CONNECTION,
          message: 'No secret key provided for connection to Stripe'
        });
      }
      this.stripe = new Stripe(this.settings.secretKey, {
        apiVersion: '2020-08-27',
      });
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
    const requestParams: Stripe.CustomerListParams = { limit: StripeBillingIntegration.STRIPE_MAX_LIST };
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


  private convertToBillingUser(customer: Stripe.Customer) : BillingUser {
    if (customer) {
      const billingUser: BillingUser = {
        userID: customer.metadata['userID'],
        // email: customer.email,
        name: customer.name,
        billingData: {
          customerID: customer.id
        }
      };
      return billingUser;
    }

    return null;
  }

  public async userExists(user: User): Promise<boolean> {
    // Check Stripe
    await this.checkConnection();
    // Make sure the billing data has been provided
    if (!user.billingData) {
      user = await UserStorage.getUser(this.tenantID, user.id);
    }
    // Get customer
    const customer = await this.getStripeCustomer(user);
    return !!customer;
  }

  public async getUser(user: User): Promise<BillingUser> {
    // Check Stripe
    await this.checkConnection();
    // Make sure the billing data has been provided
    if (!user.billingData) {
      user = await UserStorage.getUser(this.tenantID, user.id);
    }
    // Get the STRIPE customer
    const customer = await this.getStripeCustomer(user);
    // Return the corresponding  Billing User
    return this.convertToBillingUser(customer);
  }

  public async getBillingUserByInternalID(customerID: string): Promise<BillingUser> {
    // Check Stripe
    await this.checkConnection();
    // Get customIDer
    const customer: Stripe.Customer = await this.getStripeCustomer(customerID);
    return this.convertToBillingUser(customer);
  }

  // public async getUserByEmail(email: string): Promise<BillingUser> {
  //   // Check Stripe
  //   await this.checkConnection();
  //   // Get customer
  //   const customer = await this.getCustomerByEmail(email);
  //   return this.convertToBillingUser(customer);
  // }

  public async getTaxes(): Promise<BillingTax[]> {
    const taxes = [] as BillingTax[];
    let request;
    const requestParams : Stripe.TaxRateListParams = { limit: StripeBillingIntegration.STRIPE_MAX_LIST };
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

  public async getStripeInvoice(id: string): Promise<Stripe.Invoice> {
    // Get Invoice
    const stripeInvoice = await this.stripe.invoices.retrieve(id);
    return stripeInvoice;
  }

  public async getInvoice(id: string): Promise<BillingInvoice> {
    // Check Stripe
    await this.checkConnection();
    // Get Invoice
    try {
      const stripeInvoice = await this.stripe.invoices.retrieve(id);
      const nbrOfItems: number = this.getNumberOfItems(stripeInvoice);
      return {
        invoiceID: stripeInvoice.id,
        customerID: stripeInvoice.customer,
        number: stripeInvoice.number,
        amount: stripeInvoice.amount_due,
        status: stripeInvoice.status as BillingInvoiceStatus,
        currency: stripeInvoice.currency,
        createdOn: new Date(stripeInvoice.created * 1000),
        nbrOfItems: nbrOfItems,
        downloadUrl: stripeInvoice.invoice_pdf
      } as BillingInvoice;
    } catch (e) {
      return null;
    }
  }

  private getNumberOfItems(stripeInvoice: Stripe.Invoice): number {
    // STRIPE version 8.137.0 - total_count property is deprecated - TODO - find another way to get it!
    const nbrOfItems: number = stripeInvoice.lines['total_count'];
    return nbrOfItems;
  }

  public async getUpdatedUserIDsInBilling(): Promise<string[]> {
    const createdSince = this.settings.usersLastSynchronizedOn ? moment(this.settings.usersLastSynchronizedOn).unix() : 0;
    const collectedCustomerIDs: string[] = [];
    const queryRange: Stripe.RangeQueryParam = { gt: createdSince };
    const request: Stripe.EventListParams = {
      created: queryRange,
      limit: StripeBillingIntegration.STRIPE_MAX_LIST,
      type: 'customer.*',
    };
    // Check Stripe
    await this.checkConnection();
    // Loop until all users are read
    do {
      const events: Stripe.ApiList<Stripe.Event> = await this.stripe.events.list(request);
      for (const evt of events.data) {
        // c.f.: https://stripe.com/docs/api/events/object
        const customer: Stripe.Customer = evt.data.object as Stripe.Customer; // TODO - to be clarified how to determine the object type?
        if (customer.object === 'customer' && customer.id) {
          if (!collectedCustomerIDs.includes(customer.id)) {
            collectedCustomerIDs.push(customer.id);
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
    let createdSince: number;
    // Check Stripe
    await this.checkConnection();
    if (billingUser) {
      // Start sync from last invoices sync
      createdSince = billingUser.billingData.invoicesLastSynchronizedOn ? moment(billingUser.billingData.invoicesLastSynchronizedOn).unix() : 0;
    } else {
      // Start sync from last global sync
      createdSince = this.settings.invoicesLastSynchronizedOn ? moment(this.settings.invoicesLastSynchronizedOn).unix() : 0;
    }
    const collectedInvoiceIDs: string[] = [];
    const queryRange: Stripe.RangeQueryParam = { gt: createdSince };
    const request: Stripe.EventListParams = {
      created: queryRange,
      limit: StripeBillingIntegration.STRIPE_MAX_LIST,
      type: 'invoice.*',
    };
    // Loop until all invoices are read
    do {
      const events: Stripe.ApiList<Stripe.Event> = await this.stripe.events.list(request);
      for (const evt of events.data) {
        // c.f.: https://stripe.com/docs/api/events/object
        const invoice: Stripe.Invoice = evt.data.object as Stripe.Invoice; // TODO - to be clarified how to determine the object type?
        if (invoice.object === 'invoice' && invoice.id) {
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
    // Let's create the STRIPE invoice
    const stripeInvoice: Stripe.Invoice = await this.stripe.invoices.create({
      customer: user.billingData.customerID,
      collection_method: 'send_invoice',
      days_until_due: 30,
      auto_advance: false
    }, {
      // idempotency_key: idempotencyKey?.toString(),
      idempotencyKey: idempotencyKey?.toString(), // STRIPE version 8.137.0 - property as been renamed!!!
    });
    // Let's update the data which is replicated on our side
    return this.persistBillingInvoice(user.userID, stripeInvoice);
  }

  private async persistBillingInvoice(userID: string, stripeInvoice: Stripe.Invoice, billingInvoiceID?: string): Promise<BillingInvoice> {
    const nbrOfItems: number = this.getNumberOfItems(stripeInvoice);
    const invoiceToSave: Partial<BillingInvoice> = {
      id: billingInvoiceID, // null when the billing invoice does not yet exist
      userID,
      invoiceID: stripeInvoice.id,
      customerID: stripeInvoice.customer as string, // TODO - clarify is this is always correct - customer might be expanded
      number: stripeInvoice.number,
      amount: stripeInvoice.amount_due,
      status: stripeInvoice.status as BillingInvoiceStatus,
      currency: stripeInvoice.currency,
      createdOn: new Date(),
      nbrOfItems,
      downloadUrl: stripeInvoice.invoice_pdf,
      downloadable: !!stripeInvoice.invoice_pdf,
    };
    // Save Invoice
    const billingInvoice: BillingInvoice = {
      id: await BillingStorage.saveInvoice(this.tenantID, invoiceToSave),
      ...invoiceToSave,
    } as BillingInvoice;
    return billingInvoice;
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
      // STRIPE throws an exception when invoice is set to null.
      if (invoiceID) {
        // Make sure to only add that property when updating an existing invoice
        itemInputParameters.invoice = invoiceID;
      }
      // Let's create the line item
      const stripeInvoiceItem = await this.stripe.invoiceItems.create(itemInputParameters, {
        // idempotency_key: idempotencyKey?.toString()
        idempotencyKey: idempotencyKey?.toString(), // STRIPE version 8.137.0 - property as been renamed!!!
      });
      // returns the newly created invoice item
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

  public async chargeInvoice(invoice: BillingInvoice): Promise<BillingInvoice> {
    await this.checkConnection();
    try {
      const stripeInvoice = await this._chargeStripeInvoice(invoice.invoiceID);
      const billingInvoice = await this.persistBillingInvoice(invoice.userID, stripeInvoice, invoice.id);
      if (billingInvoice.downloadable) {
        const invoiceDocument = await this.downloadInvoiceDocument(billingInvoice);
        await BillingStorage.saveInvoiceDocument(this.tenantID, invoiceDocument);
      }
      return billingInvoice;
    } catch (error) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME, method: 'chargeInvoice',
        action: ServerAction.BILLING,
        message: `Stripe Operation Failed: ${error.message as string}`,
        detailedMessages: { error: error.message, stack: error.stack }
      });
    }
  }

  private async _chargeStripeInvoice(invoiceID: string): Promise<Stripe.Invoice> {
    // Fetch the invoice from stripe (do NOT TRUST the local copy)
    let stripeInvoice: Stripe.Invoice = await this.stripe.invoices.retrieve(invoiceID);
    // Check the current invoice status
    if (stripeInvoice.status !== 'paid') {
      // Finalize the invoice (if necessary)
      if (stripeInvoice.status === 'draft') {
        stripeInvoice = await this.stripe.invoices.finalizeInvoice(invoiceID);
      }
      // Once finalized, the invoice is in the "open" state!
      if (stripeInvoice.status === 'open') {
        // Set the payment options
        const paymentOptions: Stripe.InvoicePayParams = {};
        stripeInvoice = await this.stripe.invoices.pay(invoiceID, paymentOptions);
      }
    }
    return stripeInvoice;
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
    const operationResult: Stripe.Response<Stripe.PaymentMethod> = await this.stripe.paymentMethods.attach(paymentMethodId, {
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
    // const customer = await this.getCustomerByUserID(transaction.user.id);
    const customer = await this.getStripeCustomer(transaction.user);
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
    const billingUser = await this.getUser(transaction.user);
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
    let draftInvoice = await this.getDraftInvoice(transaction); // TODO - clarify if we can trust the local replication of the data
    if (!draftInvoice) {
      // STRIPE requires that we first create an item (a pending one - and then create the invoice)
      newInvoiceItem = await this.createPendingInvoiceItem(billingUser, lineItemInputParameters, this.buildIdemPotencyKey(transaction, true));
      // Make sure a new item has been created
      if (!newInvoiceItem) {
        throw new BackendError({
          message: 'Failed to create a pending item',
          source: Constants.CENTRAL_SERVER,
          module: MODULE_NAME, method: 'stopTransaction',
          action: ServerAction.BILLING_TRANSACTION
        });
      }
      draftInvoice = await this.createInvoice(billingUser, this.buildIdemPotencyKey(transaction));
      // Make sure we have now a draft invoice (before we trigger a payment attempt)
      if (!draftInvoice) {
        throw new BackendError({
          message: 'Failed to create DRAFT invoice',
          source: Constants.CENTRAL_SERVER,
          module: MODULE_NAME, method: 'stopTransaction',
          action: ServerAction.BILLING_TRANSACTION
        });
      }
    } else {
      // We already have a draft invoice - let's add an item to it
      newInvoiceItem = await this.createInvoiceItem(billingUser, draftInvoice.invoiceID, lineItemInputParameters, this.buildIdemPotencyKey(transaction));
      if (!newInvoiceItem) {
        throw new BackendError({
          message: 'Failed to create a new item',
          source: Constants.CENTRAL_SERVER,
          module: MODULE_NAME, method: 'stopTransaction',
          action: ServerAction.BILLING_TRANSACTION
        });
      }
      // Let's get the raw data from stripe!
      const stripeInvoice = await this.getStripeInvoice(draftInvoice.invoiceID);
      // Well ... we need to update the billing invoice to reflect the latest changes
      await this.persistBillingInvoice(billingUser.userID, stripeInvoice, draftInvoice.id);
    }

    if (this.settings.immediateBillingAllowed) {
      // Let's try to bill the invoice
      await this.chargeInvoice(draftInvoice);
    }

    // Return the operation result as a BillingDataTransactionStop
    return {
      status: BillingStatus.BILLED,
      invoiceID: draftInvoice.id,
      invoiceStatus: draftInvoice.status,
      invoiceItem: newInvoiceItem // TODO - is this used by any layer?
    };
  }

  private buildIdemPotencyKey(transaction: Transaction, forLineItem = false): string {
    return (forLineItem) ? 'item_' + transaction.id : 'invoice_' + transaction.id;
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

  private async getDraftInvoice(transaction: Transaction): Promise<BillingInvoice> {
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
    // const customer = await this.getCustomerByEmail(user.email);
    const customer = await this.getStripeCustomer(user);
    if (customer && customer.id) {
      await this.stripe.customers.del(
        customer.id
      );
    }
  }

  private async getStripeCustomer(userOrCustomerID: User | string): Promise<Stripe.Customer> {
    await this.checkConnection();
    // Get customer

    let customerID ;
    if (typeof userOrCustomerID === 'string') {
      customerID = userOrCustomerID;
    } else {
      customerID = userOrCustomerID?.billingData?.customerID;
    }

    if (customerID) {
      try {
        const customer: Stripe.Customer = await this.stripe.customers.retrieve(customerID) as Stripe.Customer;
        return customer;
      } catch (error) {
        throw new BackendError({
          source: Constants.CENTRAL_SERVER,
          module: MODULE_NAME, method: 'getStripeCustomer',
          action: ServerAction.BILLING,
          message: `Stripe Inconsistency: ${error.message as string}`,
          detailedMessages: { error: error.message, stack: error.stack }
        });
      }
    }

    // No Customer in STRIPE DB so far!
    return null;
  }

  private async modifyUser(user: User): Promise<BillingUser> {
    await this.checkConnection();
    const fullName = Utils.buildUserFullName(user, false, false);
    const locale = Utils.getLanguageFromLocale(user.locale).toLocaleLowerCase();
    const i18nManager = I18nManager.getInstanceForLocale(user.locale);
    const description = i18nManager.translate('billing.generatedUser', { email: user.email });
    // Let's check if the STRIPE customer exists
    let customer = await this.getStripeCustomer(user);
    if (!customer) {
      customer = await this.stripe.customers.create({
        email: user.email,
        description: description,
        name: fullName,
        preferred_locales: [locale],
        metadata: { 'userID': user.id } // IMPORTANT - keep track on the stripe side of the original eMobility user
      });
    }
    // Update user data
    const userDataToUpdate: Stripe.CustomerUpdateParams = {};
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
    // Let's return the corresponding Billing User
    return this.convertToBillingUser(customer);
  }
}
