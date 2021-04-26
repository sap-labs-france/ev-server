/* eslint-disable @typescript-eslint/member-ordering */
import { BillingDataTransactionStart, BillingDataTransactionStop, BillingDataTransactionUpdate, BillingInvoice, BillingInvoiceDocument, BillingInvoiceItem, BillingInvoiceStatus, BillingOperationResult, BillingPaymentMethod, BillingStatus, BillingTax, BillingUser, BillingUserData } from '../../../types/Billing';
import { DocumentEncoding, DocumentType } from '../../../types/GlobalType';
import FeatureToggles, { Feature } from '../../../utils/FeatureToggles';

import AxiosFactory from '../../../utils/AxiosFactory';
import { AxiosInstance } from 'axios';
import BackendError from '../../../exception/BackendError';
import BillingIntegration from '../BillingIntegration';
import { BillingSettings } from '../../../types/Setting';
import BillingStorage from '../../../storage/mongodb/BillingStorage';
import Constants from '../../../utils/Constants';
import Cypher from '../../../utils/Cypher';
import { Decimal } from 'decimal.js';
import I18nManager from '../../../utils/I18nManager';
import Logging from '../../../utils/Logging';
import { Request } from 'express';
import { ServerAction } from '../../../types/Server';
import { StatusCodes } from 'http-status-codes';
import Stripe from 'stripe';
import StripeHelpers from './StripeHelpers';
import Transaction from '../../../types/Transaction';
import User from '../../../types/User';
import UserStorage from '../../../storage/mongodb/UserStorage';
import Utils from '../../../utils/Utils';
import moment from 'moment';

const MODULE_NAME = 'StripeBillingIntegration';
export default class StripeBillingIntegration extends BillingIntegration {

  private static readonly STRIPE_MAX_LIST = 100;
  private axiosInstance: AxiosInstance;
  private stripe: Stripe;

  constructor(tenantId: string, settings: BillingSettings) {
    super(tenantId, settings);
    this.axiosInstance = AxiosFactory.getAxiosInstance(this.tenantID);
  }

  public static getInstance(tenantID: string, settings: BillingSettings): StripeBillingIntegration {
    if (settings.stripe?.url && settings.stripe?.secretKey && settings.stripe?.publicKey) {
      return new StripeBillingIntegration(tenantID, settings);
    }
    // STRIPE prerequisites are not met
    return null;
  }

  private static async isConnectedToALiveAccount(stripeFacade: Stripe): Promise<boolean> {
    try {
      // TODO - find a way to avoid that call
      const list = await stripeFacade.customers.list({ limit: 1 });
      return !!list.data?.[0]?.livemode;
    } catch (error) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME, method: 'isConnectedToALiveAccount',
        action: ServerAction.CHECK_CONNECTION,
        message: 'Failed to connect to Stripe',
        detailedMessages: { error: error.message, stack: error.stack }
      });
    }
  }

  public async getStripeInstance(): Promise<Stripe> {
    // TODO - To be removed - only used by automated tests!
    await this.checkConnection();
    return this.stripe;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  public async checkConnection(): Promise<void> {
    // Initialize Stripe
    if (!this.stripe) {
      try {
        this.settings.stripe.secretKey = await Cypher.decrypt(this.tenantID, this.settings.stripe.secretKey);
      } catch (error) {
        throw new BackendError({
          source: Constants.CENTRAL_SERVER,
          module: MODULE_NAME, method: 'checkConnection',
          action: ServerAction.CHECK_CONNECTION,
          message: 'Failed to connect to Stripe',
          detailedMessages: { error: error.message, stack: error.stack }
        });
      }
      // Try to connect
      this.stripe = new Stripe(this.settings.stripe.secretKey, {
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
      // TODO - rethink that part - this is slow and useless!
      // this.productionMode = await StripeBillingIntegration.isConnectedToALiveAccount(this.stripe);
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

  private convertToBillingUser(customer: Stripe.Customer, user: User) : BillingUser {
    if (!user) {
      throw new Error('Unexpected situation - user cannot be null');
    }
    if (!customer) {
      throw new Error('Unexpected situation - customer cannot be null');
    }
    const userID = customer.metadata?.['userID'];
    if (userID !== user.id) {
      throw new Error('Unexpected situation - the STRIPE metadata does not match');
    }
    const billingData = {
      ...user?.billingData
    };
    const billingUser: BillingUser = {
      userID,
      name: customer.name,
      billingData
    };
    return billingUser;
  }

  public async isUserSynchronized(user: User): Promise<boolean> {
    // Check Stripe
    await this.checkConnection();
    // Make sure to get fresh data
    user = await UserStorage.getUser(this.tenantID, user.id);
    const customerID: string = user?.billingData?.customerID;
    // returns true when the customerID is properly set!
    return !!customerID;
  }

  public async getUser(user: User): Promise<BillingUser> {
    // Check Stripe
    await this.checkConnection();
    // Make sure the billing data has been provided
    if (!user.billingData) {
      user = await UserStorage.getUser(this.tenantID, user.id);
    }
    // Retrieve the STRIPE customer (if any)
    const customerID: string = user.billingData?.customerID;
    if (customerID) {
      const customer = await this.getStripeCustomer(customerID);
      // Return the corresponding  Billing User
      return this.convertToBillingUser(customer, user);
    }
    // customerID is not set - do not throw exceptions in that case
    return null;
  }

  public async getTaxes(): Promise<BillingTax[]> {
    await this.checkConnection();
    const taxes : BillingTax[] = [];
    try {
      let request;
      const requestParams : Stripe.TaxRateListParams = { limit: StripeBillingIntegration.STRIPE_MAX_LIST, active: true };
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
      await Logging.logInfo({
        tenantID: this.tenantID,
        source: Constants.CENTRAL_SERVER,
        action: ServerAction.BILLING_TAXES,
        module: MODULE_NAME, method: 'getTaxes',
        message: `Retrieved tax list (${taxes.length} taxes)`
      });
    } catch (e) {
      // catch stripe errors and send the information back to the client
      await Logging.logError({
        tenantID: this.tenantID,
        action: ServerAction.BILLING_TAXES,
        module: MODULE_NAME, method: 'getTaxes',
        message: `Stripe operation failed - ${e?.message as string}`
      });
    }
    return taxes;
  }

  public async getStripeInvoice(id: string): Promise<Stripe.Invoice> {
    // Get Invoice
    const stripeInvoice = await this.stripe.invoices.retrieve(id);
    return stripeInvoice;
  }

  private async _createStripeInvoice(customerID: string, userID: string, idempotencyKey?: string | number): Promise<Stripe.Invoice> {
    // Let's create the STRIPE invoice
    const stripeInvoice: Stripe.Invoice = await this.stripe.invoices.create({
      customer: customerID,
      // collection_method: 'send_invoice', //Default option is 'charge_automatically'
      // days_until_due: 30, // Optional when using default settings
      auto_advance: false, // our integration is responsible for transitioning the invoice between statuses
      metadata: {
        tenantID: this.tenantID,
        userID
      }
    }, {
      // idempotency_key: idempotencyKey?.toString(),
      idempotencyKey: idempotencyKey?.toString(), // STRIPE version 8.137.0 - property as been renamed!!!
    });
    return stripeInvoice;
  }

  public async synchronizeAsBillingInvoice(stripeInvoiceID: string, checkUserExists:boolean): Promise<BillingInvoice> {
    // Make sure to get fresh data !
    const stripeInvoice: Stripe.Invoice = await this.getStripeInvoice(stripeInvoiceID);
    if (!stripeInvoice) {
      throw new BackendError({
        message: `Unexpected situation - invoice not found - ${stripeInvoiceID}`,
        source: Constants.CENTRAL_SERVER, module: MODULE_NAME, action: ServerAction.BILLING,
        method: 'synchronizeAsBillingInvoice',
      });
    }
    // Destructuring the STRIPE invoice to extract the required information
    // eslint-disable-next-line id-blacklist, max-len
    const { id: invoiceID, customer, number, livemode: liveMode, amount_due: amount, amount_paid: amountPaid, status, currency, invoice_pdf: downloadUrl, metadata } = stripeInvoice;
    const customerID = customer as string;
    const createdOn = moment.unix(stripeInvoice.created).toDate(); // epoch to Date!
    // Check metadata consistency - userID is mandatory!
    const userID = metadata?.userID;
    if (!userID) {
      throw new BackendError({
        message: `Unexpected situation - invoice is not an e-Mobility invoice - ${stripeInvoiceID}`,
        source: Constants.CENTRAL_SERVER, module: MODULE_NAME, action: ServerAction.BILLING,
        method: 'synchronizeAsBillingInvoice',
      });
    } else if (checkUserExists) {
      // Let's make sure the userID is still valid
      const user = await UserStorage.getUser(this.tenantID, userID);
      if (!user) {
        throw new BackendError({
          message: `Unexpected situation - the e-Mobility user does not exist - ${userID}`,
          source: Constants.CENTRAL_SERVER, module: MODULE_NAME, action: ServerAction.BILLING,
          method: 'synchronizeAsBillingInvoice',
        });
      }
    }
    // Get the corresponding BillingInvoice (if any)
    const billingInvoice: BillingInvoice = await BillingStorage.getInvoiceByInvoiceID(this.tenantID, stripeInvoice.id);
    const invoiceToSave: BillingInvoice = {
      id: billingInvoice?.id, // ACHTUNG: billingInvoice is null when creating the Billing Invoice
      // eslint-disable-next-line id-blacklist
      userID, invoiceID, customerID, liveMode, number, amount, amountPaid, currency, createdOn, downloadUrl, downloadable: !!downloadUrl,
      status: status as BillingInvoiceStatus,
    };
    // Let's persist the up-to-date data
    const freshInvoiceId = await BillingStorage.saveInvoice(this.tenantID, invoiceToSave);
    // TODO - perf improvement? - can't we just reuse
    const freshBillingInvoice = await BillingStorage.getInvoice(this.tenantID, freshInvoiceId);
    return freshBillingInvoice;
  }

  private async _createStripeInvoiceItem(parameters: Stripe.InvoiceItemCreateParams, idempotencyKey: string | number): Promise<Stripe.InvoiceItem> {
    // Let's create the line item
    const stripeInvoiceItem = await this.stripe.invoiceItems.create(parameters, {
      // idempotency_key: idempotencyKey?.toString()
      idempotencyKey: idempotencyKey?.toString(), // STRIPE version 8.137.0 - property as been renamed!!!
    });
      // returns the newly created invoice item
    return stripeInvoiceItem;
  }

  private getTaxRateIds(): Array<string> {
    if (this.settings.billing.taxID) {
      return [this.settings.billing.taxID] ;
    }
    return []; // No tax rates so far!
  }

  public async downloadInvoiceDocument(invoice: BillingInvoice): Promise<BillingInvoiceDocument> {
    if (invoice.downloadUrl) {
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

  // eslint-disable-next-line @typescript-eslint/require-await
  public async consumeBillingEvent(req: Request): Promise<boolean> {
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
        // pragma return res.sendStatus(StatusCodes.BAD_REQUEST);
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

  public async chargeInvoice(billingInvoice: BillingInvoice): Promise<BillingInvoice> {
    await this.checkConnection();
    const operationResult: BillingOperationResult = await this._chargeStripeInvoice(billingInvoice.invoiceID);
    if (!operationResult?.succeeded && operationResult?.error) {
      await Logging.logError({
        tenantID: this.tenantID,
        source: Constants.CENTRAL_SERVER,
        action: ServerAction.BILLING_TRANSACTION,
        module: MODULE_NAME, method: 'billInvoiceItem',
        message: `Payment attempt failed - stripe invoice: '${billingInvoice.invoiceID}'`,
        detailedMessages: { error: operationResult.error.message, stack: operationResult.error.stack }
      });
    }

    billingInvoice = await this.synchronizeAsBillingInvoice(billingInvoice.invoiceID, false);
    await StripeHelpers.updateInvoiceAdditionalData(this.tenantID, billingInvoice, operationResult);
    return billingInvoice;
  }

  private async _chargeStripeInvoice(invoiceID: string): Promise<BillingOperationResult> {
    try {
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
      return {
        succeeded: true,
        internalData: stripeInvoice
      };
    } catch (error) {
      return {
        succeeded: false,
        error,
      };
    }
  }

  public async setupPaymentMethod(user: User, paymentMethodId: string): Promise<BillingOperationResult> {
    // Check Stripe
    await this.checkConnection();
    // Check billing data consistency
    const customerID = user?.billingData?.customerID;
    if (!customerID) {
      throw new BackendError({
        message: `User is not known in Stripe: '${user.id}' - (${user.email})`,
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME,
        method: 'setupPaymentMethod',
        action: ServerAction.BILLING_TRANSACTION
      });
    }
    // Let's do it!
    let billingOperationResult: BillingOperationResult;
    if (!paymentMethodId) {
      // Let's create a setupIntent for the stripe customer
      billingOperationResult = await this._createSetupIntent(user, customerID);
    } else {
      // Attach payment method to the stripe customer
      billingOperationResult = await this._attachPaymentMethod(user, customerID, paymentMethodId);
    }
    return billingOperationResult;
  }

  public async getPaymentMethods(user: User): Promise<BillingPaymentMethod[]> {
    // Check Stripe
    await this.checkConnection();
    // Check billing data consistency
    const customerID = user?.billingData?.customerID;
    if (!customerID) {
      throw new BackendError({
        message: `User is not known in Stripe: '${user.id}' - (${user.email})`,
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME,
        method: 'getPaymentMethods',
        action: ServerAction.BILLING_TRANSACTION
      });
    }
    // Let's do it!
    const paymentMethods: BillingPaymentMethod[] = await this._getPaymentMethods(user, customerID);
    return paymentMethods;
  }

  public async deletePaymentMethod(user: User, paymentMethodId: string): Promise<BillingOperationResult> {
    // Check Stripe
    await this.checkConnection();
    // Check billing data consistency
    const customerID = user?.billingData?.customerID;
    if (!customerID) {
      throw new BackendError({
        message: `User is not known in Stripe: '${user.id}' - (${user.email})`,
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME,
        method: 'deletePaymentMethod',
        action: ServerAction.BILLING_TRANSACTION
      });
    }
    // Let's do it!
    const billingOperationResult: BillingOperationResult = await this._detachPaymentMethod(paymentMethodId, customerID);
    return billingOperationResult;
  }

  private async _createSetupIntent(user: User, customerID: string): Promise<BillingOperationResult> {
    try {
      // Let's create a setupIntent for the stripe customer
      const setupIntent: Stripe.SetupIntent = await this.stripe.setupIntents.create({
        customer: customerID
      });
      await Logging.logInfo({
        tenantID: this.tenantID,
        source: Constants.CENTRAL_SERVER,
        action: ServerAction.BILLING_SETUP_PAYMENT_METHOD,
        module: MODULE_NAME, method: '_createSetupIntent',
        message: `Setup intent has been created - customer '${customerID}' - (${user.email})`
      });
      // Send some feedback
      return {
        succeeded: true,
        internalData: setupIntent
      };
    } catch (error) {
      // catch stripe errors and send the information back to the client
      await Logging.logError({
        tenantID: this.tenantID,
        action: ServerAction.BILLING_SETUP_PAYMENT_METHOD,
        actionOnUser: user,
        module: MODULE_NAME, method: '_createSetupIntent',
        message: `Stripe operation failed - ${error?.message as string}`
      });
      return {
        succeeded: false,
        error
      };
    }
  }

  private async _attachPaymentMethod(user: User, customerID: string, paymentMethodId: string): Promise<BillingOperationResult> {
    try {
      // Attach payment method to the stripe customer
      const paymentMethod: Stripe.PaymentMethod = await this.stripe.paymentMethods.attach(paymentMethodId, {
        customer: customerID
      });
      await Logging.logInfo({
        tenantID: this.tenantID,
        source: Constants.CENTRAL_SERVER,
        action: ServerAction.BILLING_SETUP_PAYMENT_METHOD,
        module: MODULE_NAME, method: '_attachPaymentMethod',
        message: `Payment method ${paymentMethodId} has been attached - customer '${customerID}' - (${user.email})`
      });
      // Set this payment method as the default
      await this.stripe.customers.update(customerID, {
        invoice_settings: { default_payment_method: paymentMethodId }
      });
      await Logging.logInfo({
        tenantID: this.tenantID,
        source: Constants.CENTRAL_SERVER,
        action: ServerAction.BILLING_SETUP_PAYMENT_METHOD,
        module: MODULE_NAME, method: '_attachPaymentMethod',
        message: `Default payment method has been set ${paymentMethodId} - customer '${customerID}' - (${user.email})`
      });
      // Send some feedback
      return {
        succeeded: true,
        internalData: paymentMethod
      };
    } catch (error) {
      // catch stripe errors and send the information back to the client
      await Logging.logError({
        tenantID: this.tenantID,
        action: ServerAction.BILLING_SETUP_PAYMENT_METHOD,
        actionOnUser: user,
        module: MODULE_NAME, method: '_attachPaymentMethod',
        message: `Stripe operation failed - ${error?.message as string}`
      });
      return {
        succeeded: false,
        error
      };
    }
  }

  private async _getPaymentMethods(user: User, customerID: string): Promise<BillingPaymentMethod[]> {
    const paymentMethods: BillingPaymentMethod[] = [];
    try {
      let request;
      const requestParams : Stripe.PaymentMethodListParams = {
        limit: StripeBillingIntegration.STRIPE_MAX_LIST,
        customer: customerID,
        type: 'card',
      };
      const customer = await this.getStripeCustomer(customerID);
      do {
        request = await this.stripe.paymentMethods.list(requestParams);
        for (const paymentMethod of request.data) {
          paymentMethods.push({
            id: paymentMethod.id,
            brand: paymentMethod.card.brand,
            expiringOn: new Date(paymentMethod.card.exp_year, paymentMethod.card.exp_month, 0),
            last4: paymentMethod.card.last4,
            type: paymentMethod.type,
            createdOn: moment.unix(paymentMethod.created).toDate(),
            isDefault: paymentMethod.id === customer.invoice_settings.default_payment_method
          });
        }
        if (request.has_more) {
          requestParams.starting_after = paymentMethods[paymentMethods.length - 1].id;
        }
      } while (request.has_more);
    } catch (e) {
      // catch stripe errors and send the information back to the client
      await Logging.logError({
        tenantID: this.tenantID,
        action: ServerAction.BILLING_SETUP_PAYMENT_METHOD,
        actionOnUser: user,
        module: MODULE_NAME, method: '_getPaymentMethods',
        message: `Stripe operation failed - ${e?.message as string}`
      });
    }
    return paymentMethods;
  }

  private async _detachPaymentMethod(paymentMethodId: string, customerID: string): Promise<BillingOperationResult> {
    try {
      // Verify payment method to be deleted is not the default one
      const customer = await this.getStripeCustomer(customerID);
      if (customer.invoice_settings.default_payment_method === paymentMethodId) {
        throw new BackendError({
          message: 'Cannot delete default payment method',
          source: Constants.CENTRAL_SERVER,
          module: MODULE_NAME,
          method: '_detachPaymentMethod',
          action: ServerAction.BILLING_DELETE_PAYMENT_METHOD,
        });
      }
      // Detach payment method from the stripe customer
      const paymentMethod: Stripe.PaymentMethod = await this.stripe.paymentMethods.detach(paymentMethodId);
      await Logging.logInfo({
        tenantID: this.tenantID,
        source: Constants.CENTRAL_SERVER,
        action: ServerAction.BILLING_DELETE_PAYMENT_METHOD,
        module: MODULE_NAME, method: '_detachPaymentMethod',
        message: `Payment method ${paymentMethodId} has been detached - customer '${customerID}'`
      });
      // Send some feedback
      return {
        succeeded: true,
        internalData: paymentMethod
      };
    } catch (error) {
      // catch stripe errors and send the information back to the client
      await Logging.logError({
        tenantID: this.tenantID,
        action: ServerAction.BILLING_DELETE_PAYMENT_METHOD,
        module: MODULE_NAME, method: '_detachPaymentMethod',
        message: `Failed to detach payment method - customer '${customerID}'`,
        detailedMessages: { error: error.message, stack: error.stack }
      });
      // Send some feedback
      return {
        succeeded: false,
        error
      };
    }
  }

  public async startTransaction(transaction: Transaction): Promise<BillingDataTransactionStart> {

    if (!this.settings.billing.isTransactionBillingActivated) {
      return {
        // Keeps track whether the billing was activated or not on start transaction
        withBillingActive: false
      };
    }

    // Check Stripe
    await this.checkConnection();
    // Check Transaction
    this.checkStartTransaction(transaction);
    // Check Start Transaction Prerequisites
    const customerID: string = transaction.user?.billingData?.customerID;
    if (FeatureToggles.isFeatureActive(Feature.BILLING_CHECK_CUSTOMER_ID)) {
      // Check whether the customer exists or not
      const customer = await this.checkStripeCustomer(customerID);
      // Check whether the customer has a default payment method
      this.checkStripePaymentMethod(customer);
    }
    // Well ... when in test mode we may allow to start the transaction
    if (!customerID) {
      // Not yet LIVE ... starting a transaction without a STRIPE CUSTOMER is allowed
      await Logging.logWarning({
        tenantID: this.tenantID,
        source: Constants.CENTRAL_SERVER,
        action: ServerAction.BILLING_TRANSACTION,
        module: MODULE_NAME, method: 'startTransaction',
        message: 'Live Mode is OFF - transaction has been started with NO customer data'
      });
    }
    return {
      withBillingActive: true
    };
  }

  private async checkStripeCustomer(customerID: string): Promise<Stripe.Customer> {
    const customer = await this.getStripeCustomer(customerID);
    if (!customer) {
      throw new BackendError({
        message: `Customer not found - ${customerID}`,
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME,
        method: 'startTransaction',
        action: ServerAction.BILLING_TRANSACTION
      });
    }
    return customer;
  }

  private checkStripePaymentMethod(customer: Stripe.Customer): void {
    if (FeatureToggles.isFeatureActive(Feature.BILLING_CHECK_USER_DEFAULT_PAYMENT_METHOD)) {
      if (!customer.default_source && !customer.invoice_settings?.default_payment_method) {
        throw new BackendError({
          message: `Customer has no default payment method - ${customer.id}`,
          source: Constants.CENTRAL_SERVER,
          module: MODULE_NAME,
          method: 'startTransaction',
          action: ServerAction.BILLING_TRANSACTION
        });
      }
    }
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
      // Just propagate the initial state
      withBillingActive: transaction.billingData?.withBillingActive
    };
  }

  private _buildInvoiceItemParameters(customerID: string, billingInvoiceItem: BillingInvoiceItem, invoiceID?: string): Stripe.InvoiceItemCreateParams {
    /* --------------------------------------------------------------------------------
     Convert pricing information to STRIPE expected data
    -----------------------------------------------------------------------------------
    Example:
      Consumption 1000 Kw.h - total amount: 4 euros
      Unit price should be (4 / 1000) ==> 0.004
    Stripe expects 'unit_amount' as an Integer, in Cents
      unit_amount: 0.4 ==> Not an integer - throws an exception
    Stripe alternative - 'unit_amount_decimal' in Cents, with 2 decimals, as a string!
      unit_amount_decimal: '004.00' (in Cents, with 2 decimals, as a string)
    ----------------------------------------------------------------------------------- */
    const { description, pricingData, taxes } = billingInvoiceItem;
    const currency = pricingData.currency.toLowerCase();
    // Build stripe parameters for the item
    const parameters: Stripe.InvoiceItemCreateParams = {
      invoice: invoiceID,
      customer: customerID,
      currency,
      description,
      tax_rates: taxes,
      // quantity: 1, //Cannot be set separately
      amount: new Decimal(pricingData.amount).times(100).round().toNumber(),
      metadata: { ...billingInvoiceItem?.metadata }
    };

    // // ----------------------------------------------------------------------------------------
    // // INVESTIGATIONS - Attempts to set both the quantity and the unit_amount
    // // ----------------------------------------------------------------------------------------
    // Quantity must be an Integer! - STRIPE does not support decimals
    // const quantity = new Decimal(pricingData.quantity).round().toNumber(); // kW.h -
    // if (quantity === 0) {
    //   // ----------------------------------------------------------------------------------------
    //   // The quantity was too small - let's prevent dividing by zero
    //   // parameters.quantity = 0; // Not an option for STRIPE
    //   // ----------------------------------------------------------------------------------------
    //   parameters.amount = new Decimal(pricingData.amount).times(100).round().toNumber();
    // } else {
    //   // ----------------------------------------------------------------------------------------
    //   // STRIPE expects either "unit_amount" in Cents - or unit_amount_decimal (with 4 decimals)
    //   // ----------------------------------------------------------------------------------------
    //   const unit_amount_in_cents = new Decimal(pricingData.amount).times(100).dividedBy(quantity);
    //   // Let's use the more precise option
    //   const unit_amount_decimal: string = unit_amount_in_cents.times(100).round().dividedBy(100).toNumber().toFixed(2);
    //   parameters.quantity = quantity;
    //   parameters.unit_amount_decimal = unit_amount_decimal;
    // }

    if (!parameters.invoice) {
      // STRIPE throws an exception when invoice is set to null.
      delete parameters.invoice;
    }
    return parameters;
  }

  public async stopTransaction(transaction: Transaction): Promise<BillingDataTransactionStop> {
    // Check whether the billing was activated on start transaction
    if (!transaction.billingData.withBillingActive) {
      return {
        status: BillingStatus.UNBILLED
      };
    }
    // Check Stripe
    await this.checkConnection();
    // Check object
    this.checkStopTransaction(transaction);
    try {
      // Check that the customer STRIPE exists
      const customerID: string = transaction.user?.billingData?.customerID;
      const customer = await this.getStripeCustomer(customerID);
      if (customer) {
        const billingDataTransactionStop: BillingDataTransactionStop = await this.billTransaction(transaction);
        return billingDataTransactionStop;
      }
    } catch (error) {
      await Logging.logError({
        tenantID: this.tenantID,
        user: transaction.userID,
        source: Constants.CENTRAL_SERVER,
        action: ServerAction.BILLING_TRANSACTION,
        module: MODULE_NAME, method: 'stopTransaction',
        message: `Failed to bill the transaction - Transaction ID '${transaction.id}'`,
        detailedMessages: { error: error.message, stack: error.stack }
      });
    }

    return {
      status: BillingStatus.UNBILLED
    };
  }

  private async _getLatestDraftInvoice(customerID: string): Promise<Stripe.Invoice> {
    const list = await this.stripe.invoices.list({
      customer: customerID,
      status: BillingInvoiceStatus.DRAFT,
      limit: 1
    });
    return !Utils.isEmptyArray((list.data)) ? list.data[0] : null;
  }

  public async billTransaction(transaction: Transaction): Promise<BillingDataTransactionStop> {
    // ACHTUNG: a single transaction may generate several lines in the invoice
    const invoiceItem: BillingInvoiceItem = this.convertToBillingInvoiceItem(transaction);
    const billingInvoice = await this.billInvoiceItem(transaction.user, invoiceItem, `${transaction.id}`);
    // Send a notification to the user
    void this.sendInvoiceNotification(billingInvoice);
    return {
      status: BillingStatus.BILLED,
      invoiceID: billingInvoice.id,
      invoiceStatus: billingInvoice.status,
      invoiceItem: this.shrinkInvoiceItem(invoiceItem),
    };
  }

  private shrinkInvoiceItem(fatInvoiceItem: BillingInvoiceItem): BillingInvoiceItem {
    // The initial invoice item includes redundant transaction data
    const { description, transactionID, pricingData } = fatInvoiceItem;
    // Let's return only essential information
    const lightInvoiceItem: BillingInvoiceItem = {
      description,
      transactionID,
      pricingData
    };
    return lightInvoiceItem;
  }

  private convertToBillingInvoiceItem(transaction: Transaction) : BillingInvoiceItem {
    // Destructuring transaction.stop
    const transactionID = transaction.id;
    const { price, priceUnit, roundedPrice, totalConsumptionWh, timestamp } = transaction.stop;
    const description = this.buildLineItemDescription(transaction);
    // -------------------------------------------------------------------------------
    // ACHTUNG - STRIPE expects the amount and prices in CENTS!
    // -------------------------------------------------------------------------------
    const quantity = new Decimal(transaction.stop.totalConsumptionWh).dividedBy(1000).toNumber(); // Total consumption in kW.h
    const amount = roundedPrice; // Total amount for the line item
    const currency = priceUnit;
    // -------------------------------------------------------------------------------
    const taxes = this.getTaxRateIds(); // TODO - take into account SITE settings
    // Build a billing invoice item based on the transaction
    const billingInvoiceItem: BillingInvoiceItem = {
      description,
      transactionID,
      pricingData: {
        quantity,
        amount,
        currency
      },
      taxes,
      metadata: {
        // Let's keep track of the initial data for troubleshooting purposes
        tenantID: this.tenantID,
        transactionID: transaction.id,
        userID: transaction.userID,
        price,
        roundedPrice,
        priceUnit,
        totalConsumptionWh,
        begin: transaction.timestamp?.valueOf(),
        end: timestamp?.valueOf()
      }
    };
    return billingInvoiceItem ;
  }

  public async billInvoiceItem(user: User, billingInvoiceItem: BillingInvoiceItem, idemPotencyKey?: string): Promise<BillingInvoice> {
    // Let's collect the required information
    const userID: string = user.id;
    const customerID: string = user.billingData?.customerID;
    // Check whether a DRAFT invoice can be used
    let stripeInvoice = await this._getLatestDraftInvoice(customerID);
    // Let's create an invoice item (could be a pending one when the stripeInvoice does not yet exist)
    const invoiceItemParameters: Stripe.InvoiceItemCreateParams = this._buildInvoiceItemParameters(customerID, billingInvoiceItem, stripeInvoice?.id);
    const stripeInvoiceItem = await this._createStripeInvoiceItem(invoiceItemParameters, this.buildIdemPotencyKey(idemPotencyKey, true));
    if (!stripeInvoiceItem) {
      await Logging.logError({
        tenantID: this.tenantID,
        user: user.id,
        source: Constants.CENTRAL_SERVER,
        action: ServerAction.BILLING_TRANSACTION,
        module: MODULE_NAME, method: 'billInvoiceItem',
        message: `Unexpected situation - stripe invoice item is null - stripe invoice id: '${stripeInvoice?.id }'`
      });
    }
    if (!stripeInvoice) {
      // Let's create a new draft invoice (if none has been found)
      stripeInvoice = await this._createStripeInvoice(customerID, userID, this.buildIdemPotencyKey(idemPotencyKey));
    }
    let operationResult: BillingOperationResult;
    if (this.settings.billing.immediateBillingAllowed) {
      // Let's try to bill the stripe invoice using the default payment method of the customer
      operationResult = await this._chargeStripeInvoice(stripeInvoice.id);
      if (!operationResult?.succeeded && operationResult?.error) {
        await Logging.logError({
          tenantID: this.tenantID,
          user: user.id,
          source: Constants.CENTRAL_SERVER,
          action: ServerAction.BILLING_TRANSACTION,
          module: MODULE_NAME, method: 'billInvoiceItem',
          message: `Payment attempt failed - stripe invoice: '${stripeInvoice?.id}'`,
          detailedMessages: { error: operationResult.error.message, stack: operationResult.error.stack }
        });
      }
    }
    // Let's replicate some information on our side
    const billingInvoice = await this.synchronizeAsBillingInvoice(stripeInvoice.id, false);
    // We have now a Billing Invoice - Let's update it with details about the last operation result
    await StripeHelpers.updateInvoiceAdditionalData(this.tenantID, billingInvoice, operationResult, billingInvoiceItem);
    // Return the billing invoice
    return billingInvoice;
  }

  private buildIdemPotencyKey(uniqueId: string, forLineItem = false): string {
    if (uniqueId) {
      return (forLineItem) ? 'item_' + uniqueId : 'invoice_' + uniqueId;
    }
    return null;
  }

  private buildLineItemDescription(transaction: Transaction) {
    let description: string;
    const chargeBox = transaction.chargeBox;
    const i18nManager = I18nManager.getInstanceForLocale(transaction.user.locale);
    const time = i18nManager.formatDateTime(transaction.stop.timestamp, 'LTS');
    const consumptionkWh = this.convertConsumptionToKWh(transaction);

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

  private convertConsumptionToKWh(transaction: Transaction): number {
    return new Decimal(transaction.stop.totalConsumptionWh).dividedBy(10).round().dividedBy(100).toNumber();
  }

  // eslint-disable-next-line @typescript-eslint/require-await, @typescript-eslint/no-unused-vars
  public async checkIfUserCanBeCreated(user: User): Promise<boolean> {
    // throw new BackendError({
    //   source: Constants.CENTRAL_SERVER,
    //   module: MODULE_NAME, method: 'createUser',
    //   action: ServerAction.USER_CREATE,
    //   user: user,
    //   message: 'Cannot create the user'
    // });
    return true;
  }

  // eslint-disable-next-line @typescript-eslint/require-await, @typescript-eslint/no-unused-vars
  public async checkIfUserCanBeUpdated(user: User): Promise<boolean> {
    // throw new BackendError({
    //   source: Constants.CENTRAL_SERVER,
    //   module: MODULE_NAME, method: 'updateUser',
    //   action: ServerAction.USER_CREATE,
    //   user: user,
    //   message: 'Cannot update the user'
    // });
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
    if (list && !Utils.isEmptyArray(list.data)) {
      await Logging.logError({
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
    if (list && !Utils.isEmptyArray(list.data)) {
      await Logging.logError({
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
      await Logging.logError({
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
    return await this._createUser(user, false);
  }

  public async repairUser(user: User): Promise<BillingUser> {
    return await this._createUser(user, true);
  }

  private async _createUser(user: User, forceUserCreation: boolean): Promise<BillingUser> {
    // Check connection
    await this.checkConnection();
    await this.checkIfUserCanBeCreated(user);
    if (user.billingData?.customerID) {
      // The customerID should be preserved - unless the creation is forced
      if (!forceUserCreation) {
        throw new Error('Unexpected situation - the customerID is already set');
      }
    }
    // Checks create a new STRIPE customer
    const customer: Stripe.Customer = await this.stripe.customers.create({
      ...this._buildCustomerCommonProperties(user),
      metadata: {
        tenantID: this.tenantID,
        userID: user.id // IMPORTANT - keep track on the stripe side of the original eMobility user
      }
    });
    // Let's populate the initial Billing Data of our new customer
    const billingData: BillingUserData = {
      customerID: customer.id,
      liveMode: customer.livemode, // true when using a productive STRIPE account
      lastChangedOn: new Date(),
      hasSynchroError: false,
      invoicesLastSynchronizedOn: null
    };
    // Save the billing data
    user.billingData = billingData;
    await UserStorage.saveUserBillingData(this.tenantID, user.id, user.billingData);
    // Let's return the corresponding Billing User
    return this.convertToBillingUser(customer, user);
  }

  public async updateUser(user: User): Promise<BillingUser> {
    // Check connection
    await this.checkConnection();
    await this.checkIfUserCanBeUpdated(user);
    // Let's check if the STRIPE customer exists
    const customerID:string = user?.billingData?.customerID;
    if (!customerID) {
      throw new Error('Unexpected situation - the customerID is NOT set');
    }
    let customer = await this.getStripeCustomer(customerID);
    const userID = customer?.metadata?.['userID'];
    if (userID !== user.id) {
      throw new Error('Unexpected situation - the STRIPE metadata does not match');
    }
    // Update user data
    const updateParams: Stripe.CustomerUpdateParams = {
      ...this._buildCustomerCommonProperties(user),
    };
    // Update changed data
    customer = await this.stripe.customers.update(customerID, updateParams);
    // Let's update the Billing Data of our customer
    user.billingData.lastChangedOn = new Date();
    await UserStorage.saveUserBillingData(this.tenantID, user.id, user.billingData);
    // Let's return the corresponding Billing User
    return this.convertToBillingUser(customer, user);
  }

  private _buildCustomerCommonProperties(user: User): { name: string, description: string, preferred_locales: string[], email: string } {
    const i18nManager = I18nManager.getInstanceForLocale(user.locale);
    return {
      name: Utils.buildUserFullName(user, false, false),
      description: i18nManager.translate('billing.generatedUser', { email: user.email }),
      preferred_locales: [ Utils.getLanguageFromLocale(user.locale).toLocaleLowerCase() ],
      email: user.email
    };
  }

  public async deleteUser(user: User): Promise<void> {
    // Check Stripe
    await this.checkConnection();
    // const customer = await this.getCustomerByEmail(user.email);
    const customerID = user.billingData?.customerID;
    const customer = await this.getStripeCustomer(customerID);
    if (customer && customer.id) {
      // TODO - ro be clarified - is this allowed when the user has some invoices
      await this.stripe.customers.del(
        customer.id
      );
    }
  }

  private async getStripeCustomer(customerID: string): Promise<Stripe.Customer> {
    if (customerID) {
      try {
        // Gets the STRIPE Customer
        const customer: Stripe.Customer | Stripe.DeletedCustomer = await this.stripe.customers.retrieve(customerID);
        // Check for the deletion flag
        const deleted = (customer.deleted) ? true : false; // ACHTUNG - STRIPE type definition is wrong!
        if (deleted) {
          throw new BackendError({
            source: Constants.CENTRAL_SERVER,
            module: MODULE_NAME, method: 'getStripeCustomer',
            action: ServerAction.BILLING,
            message: `Customer is marked as deleted - ${customerID}`
          });
        }
        // We are now sure this is not a Stripe.DeletedCustomer!!
        return customer as Stripe.Customer;
      } catch (error) {
        // ---------------------------------------------------------------------------------------
        // This should not happen - The customerID should be stable
        // May happen when billing settings are changed to point to a different STRIPE account
        // ---------------------------------------------------------------------------------------
        throw new BackendError({
          source: Constants.CENTRAL_SERVER,
          module: MODULE_NAME, method: 'getStripeCustomer',
          action: ServerAction.BILLING,
          message: `Customer ID is inconsistent - ${customerID}`,
          detailedMessages: { error: error.message, stack: error.stack }
        });
      }
    }
    // -----------------------------------------------------------------
    // Returns null only when the customerID input parameter is null
    // Everything else should throw an error
    // --------------------------------------------------------------
    return null;
  }
}
