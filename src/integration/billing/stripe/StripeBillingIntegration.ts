import { AsyncTaskType, AsyncTasks } from '../../../types/AsyncTask';
/* eslint-disable @typescript-eslint/member-ordering */
import { BillingAccount, BillingDataTransactionStart, BillingDataTransactionStop, BillingDataTransactionUpdate, BillingInvoice, BillingInvoiceItem, BillingInvoiceStatus, BillingOperationResult, BillingPaymentMethod, BillingPlatformInvoice, BillingSessionAccountData, BillingStatus, BillingTax, BillingTransfer, BillingUser, BillingUserData } from '../../../types/Billing';
import { DimensionType, PricedConsumptionData, PricedDimensionData } from '../../../types/Pricing';
import FeatureToggles, { Feature } from '../../../utils/FeatureToggles';
import StripeHelpers, { StripeChargeOperationResult } from './StripeHelpers';
import Transaction, { StartTransactionErrorCode } from '../../../types/Transaction';

import AsyncTaskBuilder from '../../../async-task/AsyncTaskBuilder';
import AxiosFactory from '../../../utils/AxiosFactory';
import { AxiosInstance } from 'axios';
import BackendError from '../../../exception/BackendError';
import BillingHelpers from '../BillingHelpers';
import BillingIntegration from '../BillingIntegration';
import { BillingSettings } from '../../../types/Setting';
import BillingStorage from '../../../storage/mongodb/BillingStorage';
import Constants from '../../../utils/Constants';
import Cypher from '../../../utils/Cypher';
import DatabaseUtils from '../../../storage/mongodb/DatabaseUtils';
import I18nManager from '../../../utils/I18nManager';
import Logging from '../../../utils/Logging';
import LoggingHelper from '../../../utils/LoggingHelper';
import PricingEngine from '../../pricing/PricingEngine';
import PricingHelper from '../../pricing/PricingHelper';
import { Promise } from 'bluebird';
import { Request } from 'express';
import { ServerAction } from '../../../types/Server';
import SettingStorage from '../../../storage/mongodb/SettingStorage';
import Stripe from 'stripe';
import Tenant from '../../../types/Tenant';
import TransactionStorage from '../../../storage/mongodb/TransactionStorage';
import User from '../../../types/User';
import UserStorage from '../../../storage/mongodb/UserStorage';
import Utils from '../../../utils/Utils';
import moment from 'moment';

const MODULE_NAME = 'StripeBillingIntegration';

export default class StripeBillingIntegration extends BillingIntegration {

  private static readonly STRIPE_MAX_LIST = 100;
  private axiosInstance: AxiosInstance;
  private stripe: Stripe;

  private constructor(tenant: Tenant, settings: BillingSettings) {
    super(tenant, settings);
    this.axiosInstance = AxiosFactory.getAxiosInstance(this.tenant);
  }

  public static getInstance(tenant: Tenant, settings: BillingSettings): StripeBillingIntegration {
    if (settings.stripe?.url && settings.stripe?.secretKey && settings.stripe?.publicKey) {
      return new StripeBillingIntegration(tenant, settings);
    }
    // STRIPE prerequisites are not met
    return null;
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
        const secretKey = await Cypher.decrypt(this.tenant, this.settings.stripe.secretKey);
        this.stripe = new Stripe(secretKey, {
          apiVersion: Constants.STRIPE_API_VERSION,
          // Set application info to let STRIPE know that the account belongs to our solution
          appInfo: {
            name: Constants.STRIPE_APP_NAME,
            partner_id: Constants.STRIPE_PARTNER_ID
          }
        });
      } catch (error) {
        throw new BackendError({
          module: MODULE_NAME, method: 'checkConnection',
          action: ServerAction.CHECK_BILLING_CONNECTION,
          message: 'Failed to connect to Stripe - Key is inconsistent',
          detailedMessages: { error: error.stack }
        });
      }
      // Try to connect
      try {
        // Let's make sure the connection works as expected
        this.productionMode = await StripeHelpers.isConnectedToALiveAccount(this.stripe);
        if (this.productionMode && !Utils.isProductionEnv()) {
          throw new BackendError({
            module: MODULE_NAME, method: 'checkConnection',
            action: ServerAction.CHECK_BILLING_CONNECTION,
            message: 'Failed to connect to Stripe - connecting to a productive account is forbidden in DEV Mode'
          });
        }
      } catch (error) {
        throw new BackendError({
          module: MODULE_NAME, method: 'checkConnection',
          action: ServerAction.CHECK_BILLING_CONNECTION,
          message: 'Failed to connect to Stripe',
          detailedMessages: { error: error.stack }
        });
      }
    }
  }

  public async checkActivationPrerequisites(): Promise<void> {
    await this.checkTaxPrerequisites();
  }

  public async checkTaxPrerequisites(): Promise<void> {
    // Check whether the taxID is set and still active
    const taxID = this.settings.billing?.taxID;
    if (taxID) {
      const billingTax: BillingTax = await this.getTaxRate(taxID);
      if (!billingTax) {
        throw new BackendError({
          module: MODULE_NAME, method: 'checkTaxPrerequisites',
          action: ServerAction.BILLING_TAXES,
          message: `Billing prerequisites are not consistent - taxID is not found or inactive - taxID: '${taxID}'`
        });
      }
    } else {
      throw new BackendError({
        module: MODULE_NAME, method: 'checkTaxPrerequisites',
        action: ServerAction.BILLING_TAXES,
        message: 'Billing prerequisites are not consistent - taxID is mandatory'
      });
    }
  }

  public async checkTestDataCleanupPrerequisites(): Promise<void> {
    // Make sure the STRIPE account is not live
    let secretKey: string, publicKey: string;
    try {
      secretKey = await Cypher.decrypt(this.tenant, this.settings.stripe.secretKey);
      publicKey = this.settings.stripe.publicKey;
    } catch (error) {
      // Ignore error
    }
    if (secretKey?.startsWith('sk_live_') || publicKey?.startsWith('pk_live_')) {
      throw new BackendError({
        module: MODULE_NAME, method: 'checkTestDataCleanupPrerequisites',
        action: ServerAction.BILLING_TEST_DATA_CLEANUP,
        message: 'Stripe Account is live - Test data cleanup has been aborted'
      });
    }
  }

  public async resetConnectionSettings(): Promise<BillingSettings> {
    // Reset connection settings
    const newBillingsSettings = this.settings;
    newBillingsSettings.billing = {
      isTransactionBillingActivated: false,
      immediateBillingAllowed: false,
      periodicBillingAllowed: false,
      taxID: null
    };
    newBillingsSettings.stripe = {
      url: null,
      secretKey: null,
      publicKey: null
    };
    await SettingStorage.saveBillingSetting(this.tenant, newBillingsSettings);
    return newBillingsSettings;
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

  public async getUser(user: User): Promise<BillingUser> {
    // Check Stripe
    await this.checkConnection();
    // Make sure the billing data has been provided
    if (!user.billingData) {
      user = await UserStorage.getUser(this.tenant, user.id);
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
        tenantID: this.tenant.id,
        action: ServerAction.BILLING_TAXES,
        module: MODULE_NAME, method: 'getTaxes',
        message: `Retrieved tax list (${taxes.length} taxes)`
      });
    } catch (error) {
      // catch stripe errors and send the information back to the client
      await Logging.logError({
        tenantID: this.tenant.id,
        action: ServerAction.BILLING_TAXES,
        module: MODULE_NAME, method: 'getTaxes',
        message: 'Failed to retrieve tax rates',
        detailedMessages: { error: error.stack }
      });
    }
    return taxes;
  }

  public async getTaxRate(taxID: string): Promise<BillingTax> {
    await this.checkConnection();
    let taxRate : BillingTax = null;
    try {
      const stripeTaxRate: Stripe.TaxRate = await this.stripe.taxRates.retrieve(taxID);
      if (stripeTaxRate && stripeTaxRate.active) {
        const { id, description, display_name: displayName, percentage } = stripeTaxRate;
        taxRate = { id, description, displayName, percentage };
      }
    } catch (error) {
      // catch stripe errors and send the information back to the client
      await Logging.logError({
        tenantID: this.tenant.id,
        action: ServerAction.BILLING_TAXES,
        module: MODULE_NAME, method: 'getTaxRate',
        message: 'Failed to retrieve tax rate',
        detailedMessages: { error: error.stack }
      });
    }
    return taxRate;
  }

  public async getStripeInvoice(id: string): Promise<Stripe.Invoice> {
    // Get Invoice
    const stripeInvoice = await this.stripe.invoices.retrieve(id);
    return stripeInvoice;
  }

  private async createStripeInvoice(customerID: string, userID: string, idempotencyKey: string, currency: string): Promise<Stripe.Invoice> {
    const creationParameters: Stripe.InvoiceCreateParams = {
      customer: customerID,
      // collection_method: 'send_invoice', //Default option is 'charge_automatically'
      // days_until_due: 30, // Optional when using default settings
      auto_advance: false, // our integration is responsible for transitioning the invoice between statuses
      metadata: {
        tenantID: this.tenant.id,
        userID
      },
      currency
    };
    if (FeatureToggles.isFeatureActive(Feature.BILLING_INVOICES_EXCLUDE_PENDING_ITEMS)) {
      // New STRIPE API to exclude PENDING ITEMS from the new Invoice
      creationParameters.pending_invoice_items_behavior = 'exclude';
    }
    // Let's create the STRIPE invoice
    const stripeInvoice: Stripe.Invoice = await this.stripe.invoices.create(creationParameters, {
      idempotencyKey: idempotencyKey?.toString(),
    });
    return stripeInvoice;
  }

  public async convertToBillingInvoice(stripeInvoice: Stripe.Invoice): Promise<BillingInvoice> {
    if (!stripeInvoice) {
      throw new BackendError({
        message: 'Unexpected situation - invoice is not set',
        module: MODULE_NAME, action: ServerAction.BILLING,
        method: 'synchronizeAsBillingInvoice',
      });
    }
    const stripeInvoiceID = stripeInvoice.id;
    // Destructuring the STRIPE invoice to extract the required information
    // eslint-disable-next-line id-blacklist, max-len
    const { id: invoiceID, customer, number, livemode: liveMode, amount_due: amount, amount_paid: amountPaid, status, currency: invoiceCurrency, invoice_pdf: downloadUrl, metadata, hosted_invoice_url: payInvoiceUrl } = stripeInvoice;
    const customerID = customer as string;
    const currency = invoiceCurrency?.toUpperCase();
    // The invoice date may change when finalizing a DRAFT invoice
    const epoch = stripeInvoice.status_transitions?.finalized_at || stripeInvoice.created;
    const createdOn = moment.unix(epoch).toDate(); // epoch to Date!
    // Check metadata consistency - userID is mandatory!
    const userID = metadata?.userID;
    if (!userID) {
      throw new BackendError({
        message: `Unexpected situation - invoice is not an e-Mobility invoice - ${stripeInvoiceID}`,
        module: MODULE_NAME, action: ServerAction.BILLING,
        method: 'synchronizeAsBillingInvoice',
      });
    }
    // Get the corresponding BillingInvoice (if any)
    const billingInvoice: BillingInvoice = await BillingStorage.getInvoiceByInvoiceID(this.tenant, stripeInvoice.id);
    let invoiceToSave: BillingInvoice;
    if (billingInvoice) {
      // Update existing invoice
      invoiceToSave = {
        ...billingInvoice, // includes the id
        // eslint-disable-next-line id-blacklist
        invoiceID, liveMode, userID, number, status: status as BillingInvoiceStatus,
        amount, amountPaid, currency, customerID, createdOn, downloadable: !!downloadUrl, downloadUrl, payInvoiceUrl,
      };
    } else {
      // Create new invoice
      invoiceToSave = {
        id: null,
        // eslint-disable-next-line id-blacklist
        invoiceID, liveMode, userID, number, status: status as BillingInvoiceStatus,
        amount, amountPaid, currency, customerID, createdOn, downloadable: !!downloadUrl, downloadUrl, payInvoiceUrl,
        sessions: []
      };
    }
    return invoiceToSave;
  }

  private async createStripeInvoiceItem(parameters: Stripe.InvoiceItemCreateParams, idempotencyKey: string | number): Promise<Stripe.InvoiceItem> {
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

  public async downloadInvoiceDocument(invoice: BillingInvoice): Promise<Buffer> {
    if (invoice.downloadUrl) {
      await this.checkConnection();
      // Get fresh data because persisted url expires after 30 days
      const stripeInvoice = await this.getStripeInvoice(invoice.invoiceID);
      const downloadUrl = stripeInvoice.invoice_pdf;
      // Get document
      const response = await this.axiosInstance.get(downloadUrl, {
        responseType: 'arraybuffer'
      });
      // Convert
      return Buffer.from(response.data);
    }
  }

  public async downloadTransferInvoiceDocument(transfer: BillingTransfer): Promise<Buffer> {
    await this.checkConnection();
    // Get fresh data because persisted url expires after 30 days
    const stripeTransferInvoice = await this.getStripeInvoice(transfer.invoice.invoiceID);
    const downloadUrl = stripeTransferInvoice.invoice_pdf;
    // Get document
    const response = await this.axiosInstance.get(downloadUrl, {
      responseType: 'arraybuffer'
    });
    // Convert
    return Buffer.from(response.data);
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
        Logging.logConsoleError('⚠️  Webhook signature verification failed.');
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
      Logging.logConsoleInfo('💰 Payment succeeded with payment method ' + event.data.object.payment_method);
    } else if (event.type === 'payment_intent.payment_failed') {
      // The payment failed to go through due to decline or authentication request
      const error = event.data.object.last_payment_error.message;
      Logging.logConsoleError('❌ Payment failed with error: ' + error);
    } else if (event.type === 'payment_method.attached') {
      // A new payment method was attached to a customer
      Logging.logConsoleInfo('💳 Attached ' + event.data.object.id + ' to customer');
    } else {
      Logging.logConsoleError(`❌ unexpected event : ${event.type}`);
    }
    return true;
  }

  public async chargeInvoice(billingInvoice: BillingInvoice): Promise<BillingInvoice> {
    await this.checkConnection();
    const operationResult = await this.chargeStripeInvoice(billingInvoice.invoiceID);
    if (!operationResult?.succeeded && operationResult?.error) {
      if (StripeHelpers.isResourceMissingError(operationResult.error)) {
        StripeHelpers.enrichInvoiceWithAdditionalData(billingInvoice, operationResult);
        await BillingStorage.saveInvoice(this.tenant, billingInvoice);
        throw operationResult.error;
      } else {
        await Logging.logError({
          tenantID: this.tenant.id,
          action: ServerAction.BILLING_CHARGE_INVOICE,
          actionOnUser: billingInvoice.user,
          module: MODULE_NAME, method: 'chargeInvoice',
          message: `Payment attempt failed - stripe invoice: '${billingInvoice.invoiceID}'`,
          detailedMessages: { error: operationResult.error.stack }
        });
      }
    }
    // Reuse the operation result (for better performance)
    let stripeInvoice = operationResult.invoice;
    if (!stripeInvoice) {
      // Get fresh data only when necessary
      stripeInvoice = await this.getStripeInvoice(billingInvoice.invoiceID);
    }
    // Let's replicate some information on our side
    billingInvoice = await this.convertToBillingInvoice(stripeInvoice);
    StripeHelpers.enrichInvoiceWithAdditionalData(billingInvoice, operationResult);
    // Save invoice
    const invoiceID = await BillingStorage.saveInvoice(this.tenant, billingInvoice);
    billingInvoice.id = invoiceID;
    // Notification the user about the new invoice
    void this.sendInvoiceNotification(billingInvoice);
    // Update transactions with invoice data
    await this.updateTransactionsBillingData(billingInvoice);
    return billingInvoice;
  }

  private async chargeStripeInvoice(invoiceID: string): Promise<StripeChargeOperationResult> {
    try {
      // Fetch the invoice from stripe (do NOT TRUST the local copy)
      let stripeInvoice: Stripe.Invoice = await this.stripe.invoices.retrieve(invoiceID);
      // Check the current invoice status
      if (stripeInvoice.status !== BillingInvoiceStatus.PAID) {
        // Finalize the invoice (if necessary)
        if (stripeInvoice.status === BillingInvoiceStatus.DRAFT) {
          stripeInvoice = await this.stripe.invoices.finalizeInvoice(invoiceID);
        }
        // Once finalized, the invoice is in the "open" state!
        if (stripeInvoice.status === BillingInvoiceStatus.OPEN
          || stripeInvoice.status === BillingInvoiceStatus.UNCOLLECTIBLE) {
          // Set the payment options
          const paymentOptions: Stripe.InvoicePayParams = {};
          stripeInvoice = await this.stripe.invoices.pay(invoiceID, paymentOptions);
        }
      }
      return {
        succeeded: true,
        invoice: stripeInvoice
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
    let customerID = user?.billingData?.customerID;
    if (!customerID) {
      // User Sync is now made implicitly - LAZY mode
      const billingUser = await this.synchronizeUser(user);
      customerID = billingUser?.billingData?.customerID;
    }
    // User should now exist
    if (!customerID) {
      throw new BackendError({
        message: `User is not known in Stripe: '${user.id}')`,
        module: MODULE_NAME,
        method: 'setupPaymentMethod',
        actionOnUser: user,
        action: ServerAction.BILLING_SETUP_PAYMENT_METHOD
      });
    }
    // Let's do it!
    let billingOperationResult: BillingOperationResult;
    if (!paymentMethodId) {
      // Let's create a setupIntent for the stripe customer
      billingOperationResult = await this.createSetupIntent(user, customerID);
    } else {
      // Attach payment method to the stripe customer
      billingOperationResult = await this.attachPaymentMethod(user, customerID, paymentMethodId);
    }
    return billingOperationResult;
  }

  public async getPaymentMethods(user: User): Promise<BillingPaymentMethod[]> {
    // Check Stripe
    await this.checkConnection();
    // Check billing data consistency
    const customerID = user?.billingData?.customerID;
    const paymentMethods: BillingPaymentMethod[] = await this.getStripePaymentMethods(user, customerID);
    await Logging.logInfo({
      tenantID: this.tenant.id,
      user,
      action: ServerAction.BILLING_PAYMENT_METHODS,
      module: MODULE_NAME, method: 'getPaymentMethods',
      message: `Number of payment methods: ${paymentMethods?.length}`
    });
    return paymentMethods;
  }

  public async deletePaymentMethod(user: User, paymentMethodId: string): Promise<BillingOperationResult> {
    // Check Stripe
    await this.checkConnection();
    // Check billing data consistency
    const customerID = user?.billingData?.customerID;
    if (!customerID) {
      throw new BackendError({
        message: `User is not known in Stripe: '${user.id}'`,
        module: MODULE_NAME,
        method: 'deletePaymentMethod',
        actionOnUser: user,
        action: ServerAction.BILLING_DELETE_PAYMENT_METHOD
      });
    }
    // Let's do it!
    const billingOperationResult: BillingOperationResult = await this.detachStripePaymentMethod(paymentMethodId, customerID);
    return billingOperationResult;
  }

  private async createSetupIntent(user: User, customerID: string): Promise<BillingOperationResult> {
    try {
      // Let's create a setupIntent for the stripe customer
      const setupIntent: Stripe.SetupIntent = await this.stripe.setupIntents.create({
        customer: customerID
      });
      await Logging.logInfo({
        tenantID: this.tenant.id,
        action: ServerAction.BILLING_SETUP_PAYMENT_METHOD,
        module: MODULE_NAME, method: 'createSetupIntent',
        actionOnUser: user,
        message: `Setup intent has been created - customer '${customerID}'`
      });
      // Send some feedback
      return {
        succeeded: true,
        internalData: setupIntent
      };
    } catch (error) {
      // catch stripe errors and send the information back to the client
      await Logging.logError({
        tenantID: this.tenant.id,
        action: ServerAction.BILLING_SETUP_PAYMENT_METHOD,
        actionOnUser: user,
        module: MODULE_NAME, method: 'createSetupIntent',
        message: `Stripe operation failed - ${error?.message as string}`
      });
      return {
        succeeded: false,
        error
      };
    }
  }

  private async attachPaymentMethod(user: User, customerID: string, paymentMethodId: string): Promise<BillingOperationResult> {
    try {
      // Attach payment method to the stripe customer
      const paymentMethod: Stripe.PaymentMethod = await this.stripe.paymentMethods.attach(paymentMethodId, {
        customer: customerID
      });
      // Add billing_details to the payment method
      const billingDetails: Stripe.PaymentMethodUpdateParams.BillingDetails = StripeHelpers.buildBillingDetails(user);
      let paymentMethodUpdateParams: Stripe.PaymentMethodUpdateParams;
      if (billingDetails) {
        paymentMethodUpdateParams = {
          billing_details: billingDetails
        };
      }
      await this.stripe.paymentMethods.update(paymentMethodId, paymentMethodUpdateParams);
      await Logging.logInfo({
        tenantID: this.tenant.id,
        action: ServerAction.BILLING_SETUP_PAYMENT_METHOD,
        module: MODULE_NAME, method: 'attachPaymentMethod',
        message: `Payment method ${paymentMethodId} has been attached - customer '${customerID}')`
      });
      // Set this payment method as the default
      await this.stripe.customers.update(customerID, {
        invoice_settings: { default_payment_method: paymentMethodId }
      });
      await Logging.logInfo({
        tenantID: this.tenant.id,
        action: ServerAction.BILLING_SETUP_PAYMENT_METHOD,
        module: MODULE_NAME, method: 'attachPaymentMethod',
        message: `Default payment method has been set ${paymentMethodId} - customer '${customerID}'`
      });
      // Send some feedback
      return {
        succeeded: true,
        internalData: paymentMethod
      };
    } catch (error) {
      // catch stripe errors and send the information back to the client
      await Logging.logError({
        tenantID: this.tenant.id,
        action: ServerAction.BILLING_SETUP_PAYMENT_METHOD,
        actionOnUser: user,
        module: MODULE_NAME, method: 'attachPaymentMethod',
        message: `Stripe operation failed - ${error?.message as string}`
      });
      return {
        succeeded: false,
        error
      };
    }
  }

  private async getStripePaymentMethods(user: User, customerID: string): Promise<BillingPaymentMethod[]> {
    const paymentMethods: BillingPaymentMethod[] = [];
    try {
      const customer = await this.getStripeCustomer(customerID);
      if (customer) {
        let response: Stripe.ApiList<Stripe.PaymentMethod>;
        const requestParams : Stripe.PaymentMethodListParams = {
          limit: StripeBillingIntegration.STRIPE_MAX_LIST,
          customer: customerID,
          type: 'card',
        };
        do {
          response = await this.stripe.paymentMethods.list(requestParams);
          for (const paymentMethod of response.data) {
            const isDefault = (paymentMethod.id === customer.invoice_settings.default_payment_method);
            paymentMethods.push(this.convertToBillingPaymentMethod(paymentMethod, isDefault));
          }
          if (response.has_more) {
            requestParams.starting_after = paymentMethods[paymentMethods.length - 1].id;
          }
        } while (response.has_more);
      }
    } catch (error) {
      await Logging.logError({
        tenantID: this.tenant.id,
        action: ServerAction.BILLING_PAYMENT_METHODS,
        actionOnUser: user,
        module: MODULE_NAME, method: 'getStripePaymentMethods',
        message: 'Failed to retrieve payment methods',
        detailedMessages: { error: error.stack }
      });
    }
    return paymentMethods;
  }

  private async getStripeDefaultPaymentMethod(paymentMethodID: string): Promise<BillingPaymentMethod> {
    return this.getStripePaymentMethod(paymentMethodID, true) ;
  }

  private async getStripePaymentMethod(paymentMethodID: string, asDefault = false): Promise<BillingPaymentMethod> {
    try {
      const paymentMethod = await this.stripe.paymentMethods.retrieve(paymentMethodID);
      return this.convertToBillingPaymentMethod(paymentMethod, asDefault);
    } catch (error) {
      await Logging.logError({
        tenantID: this.tenant.id,
        action: ServerAction.BILLING_PAYMENT_METHODS,
        module: MODULE_NAME, method: 'getStripePaymentMethod',
        message: `Failed to retrieve payment method - ID ${paymentMethodID}`,
        detailedMessages: { error: error.stack }
      });
    }
    return null;
  }

  private convertToBillingPaymentMethod(paymentMethod: Stripe.PaymentMethod, isDefault = false): BillingPaymentMethod {
    return {
      id: paymentMethod.id,
      brand: paymentMethod.card.brand,
      expiringOn: new Date(paymentMethod.card.exp_year, paymentMethod.card.exp_month, 0),
      last4: paymentMethod.card.last4,
      type: paymentMethod.type,
      createdOn: moment.unix(paymentMethod.created).toDate(),
      isDefault
    };
  }

  private async detachStripePaymentMethod(paymentMethodId: string, customerID: string): Promise<BillingOperationResult> {
    try {
      // Verify payment method to be deleted is not the default one
      const customer = await this.getStripeCustomer(customerID);
      if (customer.invoice_settings.default_payment_method === paymentMethodId) {
        throw new BackendError({
          message: 'Cannot delete default payment method',
          module: MODULE_NAME,
          method: 'detachStripePaymentMethod',
          action: ServerAction.BILLING_DELETE_PAYMENT_METHOD,
        });
      }
      // Detach payment method from the stripe customer
      const paymentMethod: Stripe.PaymentMethod = await this.stripe.paymentMethods.detach(paymentMethodId);
      await Logging.logInfo({
        tenantID: this.tenant.id,
        action: ServerAction.BILLING_DELETE_PAYMENT_METHOD,
        module: MODULE_NAME, method: 'detachStripePaymentMethod',
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
        tenantID: this.tenant.id,
        action: ServerAction.BILLING_DELETE_PAYMENT_METHOD,
        module: MODULE_NAME, method: 'detachStripePaymentMethod',
        message: `Failed to detach payment method - customer '${customerID}'`,
        detailedMessages: { error: error.stack }
      });
      // Send some feedback
      return {
        succeeded: false,
        error
      };
    }
  }

  public async startTransaction(transaction: Transaction): Promise<BillingDataTransactionStart> {
    // Check Stripe
    await this.checkConnection();
    // Check Start Transaction Prerequisites
    const customerID: string = transaction.user?.billingData?.customerID;
    // Check whether the customer exists or not
    const customer = await this.checkStripeCustomer(customerID);
    // Check whether the customer has a default payment method
    await this.checkStripePaymentMethod(customer);
    // Well ... when in test mode we may allow to start the transaction
    if (!customerID) {
      // Not yet LIVE ... starting a transaction without a STRIPE CUSTOMER is allowed
      await Logging.logWarning({
        tenantID: this.tenant.id,
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
        module: MODULE_NAME,
        method: 'startTransaction',
        action: ServerAction.BILLING_TRANSACTION
      });
    }
    return customer;
  }

  private async checkStripePaymentMethod(customer: Stripe.Customer): Promise<void> {
    if (Utils.isDevelopmentEnv() && customer.default_source) {
      // Specific situation used only while running tests
      return ;
    }
    if (!customer.invoice_settings?.default_payment_method) {
      throw new BackendError({
        message: `Customer has no default payment method - ${customer.id}`,
        module: MODULE_NAME,
        method: 'startTransaction',
        action: ServerAction.BILLING_TRANSACTION
      });
    }
    const defaultPaymentMethodID = customer.invoice_settings?.default_payment_method as string;
    if (!defaultPaymentMethodID) {
      throw new BackendError({
        message: `Customer has no default payment method - ${customer.id}`,
        module: MODULE_NAME,
        method: 'startTransaction',
        action: ServerAction.BILLING_TRANSACTION
      });
    }
    const billingPaymentMethod = await this.getStripeDefaultPaymentMethod(defaultPaymentMethodID);
    if (!this.isPaymentMethodStillValid(billingPaymentMethod)) {
      throw new BackendError({
        message: `Default payment method has expired - ${customer.id}`,
        module: MODULE_NAME,
        method: 'startTransaction',
        action: ServerAction.BILLING_TRANSACTION
      });
    }
  }

  private isPaymentMethodStillValid(billingPaymentMethod: BillingPaymentMethod): boolean {
    if (billingPaymentMethod.expiringOn && moment().isAfter(moment(billingPaymentMethod.expiringOn))) {
      return false;
    }
    return true;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  public async updateTransaction(transaction: Transaction): Promise<BillingDataTransactionUpdate> {
    return {
      // Just propagate the initial state
      withBillingActive: transaction.billingData?.withBillingActive
    };
  }

  private async createStripeInvoiceItems(customerID: string, billingInvoiceItem: BillingInvoiceItem, invoiceID?: string): Promise<void> {
    // ---------------------------------------------------------------------------------------------------------
    // Be careful, we may have sessions mixing several pricing definitions
    // e.g.: We may have a tariff for the week-end which is different from the regular one.If the user starts a
    // session on friday night and keeps charging during the week-end, the two tariffs are used.
    // The invoice will show the detail for each tariff and for each billed dimension
    // ---------------------------------------------------------------------------------------------------------
    await this.createStripeInvoiceItemHeader(customerID, billingInvoiceItem, invoiceID);
    // Generate an invoice item for each tariff and each dimension!
    let counter = 0;
    for (const pricingConsumptionData of billingInvoiceItem.pricingData) {
      await this.createStripeInvoiceItems4PricingConsumptionData(customerID, billingInvoiceItem, pricingConsumptionData, ++counter, invoiceID);
    }
  }

  private async createStripeInvoiceItemHeader(customerID: string,
      billingInvoiceItem: BillingInvoiceItem, invoiceID?: string): Promise<void> {
    if (!billingInvoiceItem.headerDescription) {
      return;
    }
    const currency = billingInvoiceItem.currency.toLowerCase();
    // Build stripe parameters for the parking time
    const parameters: Stripe.InvoiceItemCreateParams = {
      invoice: invoiceID,
      customer: customerID,
      currency,
      description: billingInvoiceItem.headerDescription,
      tax_rates: [],
      // quantity: 1, //Cannot be set separately
      amount: 0,
      metadata: { ...billingInvoiceItem?.metadata }
    };
    if (!parameters.invoice) {
      // STRIPE throws an exception when invoice is set to null.
      delete parameters.invoice;
    }
    // Make sure to generate a unique idem potency key per pricing definition and dimension
    await this.createStripeInvoiceItem(parameters, this.buildIdemPotencyKey(billingInvoiceItem.transactionID, 'invoice', 'items-header'));
  }

  private async createStripeInvoiceItems4PricingConsumptionData(customerID: string,
      billingInvoiceItem: BillingInvoiceItem, pricedData: PricedConsumptionData, counter: number, invoiceID?: string): Promise<void> {
    // A stripe invoice item per dimension
    await this.createStripeInvoiceItem4Dimension(customerID, DimensionType.FLAT_FEE, billingInvoiceItem, pricedData, counter, invoiceID);
    await this.createStripeInvoiceItem4Dimension(customerID, DimensionType.CHARGING_TIME, billingInvoiceItem, pricedData, counter, invoiceID);
    await this.createStripeInvoiceItem4Dimension(customerID, DimensionType.ENERGY, billingInvoiceItem, pricedData, counter, invoiceID);
    await this.createStripeInvoiceItem4Dimension(customerID, DimensionType.PARKING_TIME, billingInvoiceItem, pricedData, counter, invoiceID);
  }

  private async createStripeInvoiceItem4Dimension(customerID: string, dimension: string,
      billingInvoiceItem: BillingInvoiceItem, pricedData: PricedConsumptionData, counter: number, invoiceID?: string): Promise<Stripe.InvoiceItemCreateParams> {
    // data for the current dimension (energy | parkingTime, etc)
    const dimensionData: PricedDimensionData = pricedData[dimension];
    if (!dimensionData || !dimensionData.amount || !dimensionData.quantity) {
      // Do not bill that dimension
      return null;
    }
    const currency = billingInvoiceItem.currency.toLowerCase();
    // Tax rates
    const tax_rates = dimensionData.taxes || [];
    // Build stripe parameters for the parking time
    const parameters: Stripe.InvoiceItemCreateParams = {
      invoice: invoiceID,
      customer: customerID,
      currency,
      description: dimensionData.itemDescription,
      tax_rates,
      // quantity: 1, //Cannot be set separately
      amount: Utils.createDecimal(dimensionData.roundedAmount).times(100).toNumber(),
      metadata: {
        dimension,
        ...billingInvoiceItem?.metadata
      }
    };
    if (!parameters.invoice) {
      // STRIPE throws an exception when invoice is set to null.
      delete parameters.invoice;
    }
    // Make sure to generate a unique idem potency key per pricing definition and dimension
    await this.createStripeInvoiceItem(parameters, this.buildIdemPotencyKey(billingInvoiceItem.transactionID, 'invoice', dimension + '-' + counter));
    return parameters;
  }

  public async stopTransaction(transaction: Transaction): Promise<BillingDataTransactionStop> {
    // Check whether the billing was activated on start transaction
    if (!transaction.billingData?.withBillingActive) {
      return {
        status: BillingStatus.UNBILLED
      };
    }
    // Do not bill suspicious StopTransaction events
    if (!await this.checkBillingDataThreshold(transaction)) {
      return {
        status: BillingStatus.UNBILLED
      };
    }
    // Inform the calling layer that the billing operation has been postponed
    return {
      status: BillingStatus.PENDING
    };
  }

  public async endTransaction(transaction: Transaction): Promise<BillingDataTransactionStop> {
    // Check whether the billing was activated on start transaction
    if (!transaction.billingData?.withBillingActive) {
      return {
        status: BillingStatus.UNBILLED
      };
    }
    if (transaction.billingData?.stop?.status === BillingStatus.BILLED) {
      await Logging.logInfo({
        tenantID: this.tenant.id,
        action: ServerAction.BILLING_TRANSACTION,
        module: MODULE_NAME, method: 'endTransaction',
        message: `Operation skipped - the session has already been billed - transaction ID: ${transaction.id}`
      });
      // Preserve the previous state unchanged
      return transaction.billingData.stop;
    }
    if (transaction.billingData?.stop?.status === BillingStatus.UNBILLED) {
      // Preserve the previous state unchanged
      return transaction.billingData.stop;
    }
    if (!transaction.stop?.extraInactivityComputed) {
      await Logging.logWarning({
        tenantID: this.tenant.id,
        action: ServerAction.BILLING_TRANSACTION,
        module: MODULE_NAME, method: 'endTransaction',
        message: `Unexpected situation - end transaction is being called while the extra inactivity is not yet known - transaction ID: ${transaction.id}`
      });
      // Preserve the previous state unchanged (if any) or mark it as PENDING
      return transaction.billingData?.stop || { status: BillingStatus.PENDING };
    }
    // Create and Save async task
    await AsyncTaskBuilder.createAndSaveAsyncTasks({
      name: AsyncTasks.BILL_TRANSACTION,
      action: ServerAction.BILLING_TRANSACTION,
      type: AsyncTaskType.TASK,
      tenantID: this.tenant.id,
      parameters: {
        transactionID: String(transaction.id),
        userID: transaction.userID
      },
      module: MODULE_NAME,
      method: 'endTransaction',
    });
    // Inform the calling layer that the operation has been postponed
    return {
      status: BillingStatus.PENDING
    };
  }

  public async billTransaction(transaction: Transaction): Promise<BillingDataTransactionStop> {
    // Check Stripe
    await this.checkConnection();
    // Check object
    this.checkBillTransaction(transaction);
    try {
      // Check that the customer STRIPE exists
      const customerID: string = transaction.user?.billingData?.customerID;
      const customer = await this.getStripeCustomer(customerID);
      if (customer) {
        await Logging.logInfo({
          ...LoggingHelper.getTransactionProperties(transaction),
          tenantID: this.tenant.id,
          user: transaction.userID,
          action: ServerAction.BILLING_TRANSACTION,
          module: MODULE_NAME, method: 'billTransaction',
          message: `Billing process is about to start - transaction ID: ${transaction.id}`,
        });
        // Retrieve billing account settings from the company or the site
        const accountData = await this.retrieveAccountData(transaction);
        // ACHTUNG: a single transaction may generate several lines in the invoice - one line per paring dimension
        const invoiceItem: BillingInvoiceItem = this.convertToBillingInvoiceItem(transaction, accountData);
        const billingInvoice = await this.billInvoiceItem(transaction.user, invoiceItem);
        // Send a notification to the user
        void this.sendInvoiceNotification(billingInvoice);
        return {
          status: BillingStatus.BILLED,
          invoiceID: billingInvoice.id,
          invoiceStatus: billingInvoice.status,
          invoiceNumber: billingInvoice.number,
          invoiceItem: this.shrinkInvoiceItem(invoiceItem),
        };
      }
    } catch (error) {
      await Logging.logError({
        ...LoggingHelper.getTransactionProperties(transaction),
        tenantID: this.tenant.id,
        user: transaction.userID,
        action: ServerAction.BILLING_TRANSACTION,
        module: MODULE_NAME, method: 'billTransaction',
        message: `Failed to bill the transaction - Transaction ID '${transaction.id}'`,
        detailedMessages: { error: error.stack },
      });
    }
    return {
      status: BillingStatus.FAILED
    };
  }

  private async getLatestDraftInvoiceOfTheMonth(tenantID:string, userID: string, customerID: string): Promise<Stripe.Invoice> {
    // Fetch the invoice list - c.f.: https://stripe.com/docs/api/invoices/list
    // The invoices are returned sorted by creation date, with the most recent ones appearing first.
    const list = await this.stripe.invoices.list({
      customer: customerID,
      status: BillingInvoiceStatus.DRAFT,
      limit: 1
    });
    const latestDraftInvoice = !Utils.isEmptyArray((list.data)) ? list.data[0] : null;
    // An invoice with no metadata should not be reused - it may have been created manually from the STRIPE dashboard
    if (latestDraftInvoice?.metadata) {
      // Check for the tenant
      if (tenantID !== latestDraftInvoice.metadata.tenantID) {
        return null;
      }
      // Check for the userID
      if (userID !== latestDraftInvoice.metadata.userID) {
        return null;
      }
      // Check for the date - We do not want to mix in the same invoice charging sessions from different months
      if (moment.unix(latestDraftInvoice.created).isSame(moment(), 'month')) {
        return latestDraftInvoice;
      }
    }
    // The latest DRAFT invoice is too old - don't reuse it!
    return null;
  }

  private shrinkInvoiceItem(fatInvoiceItem: BillingInvoiceItem): BillingInvoiceItem {
    // The initial invoice item includes redundant transaction data
    const { transactionID, currency, pricingData, accountData = null } = fatInvoiceItem;
    // Let's return only essential information
    const lightInvoiceItem: BillingInvoiceItem = {
      transactionID,
      currency,
      pricingData,
      accountData
    };
    return lightInvoiceItem;
  }

  private convertToBillingInvoiceItem(transaction: Transaction, accountData: BillingSessionAccountData) : BillingInvoiceItem {
    const transactionID = transaction.id;
    const currency = transaction.stop.priceUnit;
    const pricingData = this.extractTransactionPricingData(transaction);
    if (accountData?.platformFeeStrategy) {
      // Compute the session fee
      accountData.feeAmount = this.computeAccountSessionFee(accountData.platformFeeStrategy, BillingHelpers.getBilledPrice(pricingData));
    }
    const billingInvoiceItem: BillingInvoiceItem = {
      transactionID,
      currency,
      pricingData,
      accountData,
      metadata: {
        // Let's keep track of the initial data for troubleshooting purposes
        tenantID: this.tenant.id,
        transactionID: transaction.id,
        userID: transaction.userID,
        begin: transaction.timestamp?.valueOf(),
      }
    };
    billingInvoiceItem.headerDescription = this.buildLineItemDescription(transaction, true);
    // Returns a item representing the complete charging session (energy + parking information)
    return billingInvoiceItem ;
  }

  private extractTransactionPricingData(transaction: Transaction) : PricedConsumptionData[] {
    const pricingModel = Object.freeze(transaction.pricingModel);
    let pricingData: PricedConsumptionData[] = PricingEngine.extractFinalPricingData(pricingModel);
    if (!FeatureToggles.isFeatureActive(Feature.BILLING_SHOW_PRICING_DETAIL)) {
      // Accumulate data per dimensions = less details, less disputes
      pricingData = [ PricingHelper.accumulatePricedConsumption(pricingData) ] ;
    }
    pricingData = pricingData.map((pricingConsumptionData) => this.enrichTransactionPricingData(transaction, pricingConsumptionData));
    void Logging.logInfo({
      ...LoggingHelper.getTransactionProperties(transaction),
      tenantID: this.tenant.id,
      module: MODULE_NAME,
      action: ServerAction.PRICING,
      method: 'extractTransactionPricingData',
      message: `Final pricing - Transaction: ${transaction.id}`,
      detailedMessages: pricingData,
    });
    return pricingData;
  }

  private enrichTransactionPricingData(transaction: Transaction, pricingConsumptionData: PricedConsumptionData) : PricedConsumptionData {
    // -------------------------------------------------------------------------------
    // TODO - so far we use the same tax rates for all invoice items!
    // -------------------------------------------------------------------------------
    const taxes = this.getTaxRateIds();
    // -------------------------------------------------------------------------------
    // Enrich the consumption data with information required for billing it
    // -------------------------------------------------------------------------------
    const flatFee = pricingConsumptionData.flatFee;
    if (flatFee) {
      flatFee.itemDescription = this.buildLineItemDescription4PricedDimension(transaction, DimensionType.FLAT_FEE, flatFee);
      flatFee.taxes = taxes;
    }
    const energy = pricingConsumptionData.energy;
    if (energy) {
      energy.itemDescription = this.buildLineItemDescription4PricedDimension(transaction, DimensionType.ENERGY, energy);
      energy.taxes = taxes;
    }
    const chargingTime = pricingConsumptionData.chargingTime;
    if (chargingTime) {
      chargingTime.itemDescription = this.buildLineItemDescription4PricedDimension(transaction, DimensionType.CHARGING_TIME, chargingTime);
      chargingTime.taxes = taxes;
    }
    const parkingTime = pricingConsumptionData.parkingTime;
    if (parkingTime) {
      parkingTime.itemDescription = this.buildLineItemDescription4PricedDimension(transaction, DimensionType.PARKING_TIME, parkingTime);
      parkingTime.taxes = taxes;
    }
    return pricingConsumptionData;
  }

  public async billInvoiceItem(user: User, billingInvoiceItem: BillingInvoiceItem): Promise<BillingInvoice> {
    // Let's collect the required information
    let refreshDataRequired = false;
    const userID: string = user.id;
    const customerID: string = user.billingData?.customerID;
    const currency = billingInvoiceItem.currency.toLowerCase();
    // Check whether a DRAFT invoice can be used or not
    let stripeInvoice: Stripe.Invoice = null;
    if (!this.settings.billing?.immediateBillingAllowed) {
      // immediateBillingAllowed is OFF - let's retrieve to the latest DRAFT invoice (if any)
      stripeInvoice = await this.getLatestDraftInvoiceOfTheMonth(this.tenant.id, userID, customerID);
    }
    if (FeatureToggles.isFeatureActive(Feature.BILLING_INVOICES_EXCLUDE_PENDING_ITEMS)) {
      if (!stripeInvoice) {
        // NEW STRIPE API - Invoice can mow be created before its items
        stripeInvoice = await this.createStripeInvoice(customerID, userID, this.buildIdemPotencyKey(billingInvoiceItem.transactionID, 'invoice'), currency);
      }
      // Let's create an invoice item per dimension
      await this.createStripeInvoiceItems(customerID, billingInvoiceItem, stripeInvoice.id);
      refreshDataRequired = true;
    } else {
      // FORMER STRIPE API - Items must be created before the invoice (as PENDING items)
      await this.createStripeInvoiceItems(customerID, billingInvoiceItem, stripeInvoice?.id);
      if (!stripeInvoice) {
        // Let's create a new DRAFT invoice (if none has been found)
        stripeInvoice = await this.createStripeInvoice(customerID, userID, this.buildIdemPotencyKey(billingInvoiceItem.transactionID, 'invoice'), currency);
      } else {
        // Here an existing invoice is being reused
        refreshDataRequired = true;
      }
    }
    let operationResult: StripeChargeOperationResult;
    if (this.settings.billing?.immediateBillingAllowed) {
      // Let's try to bill the stripe invoice using the default payment method of the customer
      operationResult = await this.chargeStripeInvoice(stripeInvoice.id);
      if (!operationResult?.succeeded && operationResult?.error) {
        await Logging.logError({
          tenantID: this.tenant.id,
          user: user.id,
          action: ServerAction.BILLING_TRANSACTION,
          module: MODULE_NAME, method: 'billInvoiceItem',
          message: `Payment attempt failed - stripe invoice: '${stripeInvoice?.id}'`,
          detailedMessages: { error: operationResult.error.stack }
        });
      }
      if (operationResult?.invoice) {
        // Reuse the operation result (for better performance)
        stripeInvoice = operationResult.invoice;
      } else {
        // Something went wrong - we need to fetch the latest information from STRIPE again!
        refreshDataRequired = true;
      }
    }
    // Get fresh data only when necessary - e.g.: invoice has been finalized, however the payment attempt failed
    if (refreshDataRequired) {
      stripeInvoice = await this.getStripeInvoice(stripeInvoice.id);
    }
    // Let's replicate some information on our side
    const billingInvoice = await this.convertToBillingInvoice(stripeInvoice);
    if (!billingInvoice) {
      throw new Error(`Unexpected situation - failed to synchronize ${stripeInvoice.id} - the invoice is null`);
    }
    // We have now a Billing Invoice - Let's update it with details about the last operation result
    StripeHelpers.enrichInvoiceWithAdditionalData(billingInvoice, operationResult, billingInvoiceItem);
    // Save invoice
    const invoiceID = await BillingStorage.saveInvoice(this.tenant, billingInvoice);
    billingInvoice.id = invoiceID;
    // Return the billing invoice
    return billingInvoice;
  }

  private buildIdemPotencyKey(uniqueId: string | number, prefix: string, suffix: string = null): string {
    if (uniqueId) {
      if (suffix) {
        return `${prefix}_${uniqueId}_${suffix}`;
      }
      return `${prefix}_${uniqueId}`;

    }
    return null;
  }

  private buildLineItemDescription4PricedDimension(transaction: Transaction, dimensionType: DimensionType, pricedData: PricedDimensionData) {
    const i18nManager = I18nManager.getInstanceForLocale(transaction.user.locale);
    const userLocale = this.getUserLocale(transaction);
    const chargeBox = transaction.chargeBox;
    const sessionID = String(transaction?.id);
    const startDate = i18nManager.formatDateTime(transaction.timestamp, 'LL', transaction.timezone);
    const startTime = i18nManager.formatDateTime(transaction.timestamp, 'LT', transaction.timezone);
    // const currency = transaction.priceUnit;
    // const tariffName = pricedData.sourceName;
    // const unitPrice = Utils.createDecimal(pricedData.unitPrice).toNumber().toLocaleString(userLocale);
    // const stepSize = pricedData.stepSize ?? 1;
    let quantity: string, duration: string;
    if (dimensionType === DimensionType.ENERGY) {
      quantity = Utils.createDecimal(pricedData.quantity).div(1000).toNumber().toLocaleString(userLocale); // kWh
      duration = '';
    } else if (dimensionType === DimensionType.PARKING_TIME || dimensionType === DimensionType.CHARGING_TIME) {
      quantity = Utils.createDecimal(pricedData.quantity).toNumber().toLocaleString(userLocale); // seconds
      duration = moment.duration(pricedData.quantity, 's').humanize();
      // duration = moment.duration(quantity, 's').format('HH:mm:ss');
    } else {
      quantity = Utils.createDecimal(pricedData.quantity).toNumber().toLocaleString(userLocale); // Sessions
      duration = '';
    }
    // Get the translated line item description
    const descriptionPattern = `billing.${dimensionType}-shortItemDescription`;
    const description = i18nManager.translate(descriptionPattern, {
      sessionID,
      startDate,
      startTime,
      quantity,
      duration,
      siteAreaName: chargeBox?.siteArea?.name,
      chargeBoxID: transaction?.chargeBoxID,
      // unitPrice,
      // currency,
      // stepSize,
      // tariffName,
    });
    return description;
  }

  private buildLineItemDescription(transaction: Transaction, headerMode = false) {
    const chargeBox = transaction.chargeBox;
    const i18nManager = I18nManager.getInstanceForLocale(transaction.user.locale);
    const sessionID = String(transaction?.id);
    const startDate = i18nManager.formatDateTime(transaction.timestamp, 'LL', transaction.timezone);
    const startTime = i18nManager.formatDateTime(transaction.timestamp, 'LT', transaction.timezone);
    const stopTime = i18nManager.formatDateTime(transaction.stop.timestamp, 'LT', transaction.timezone);
    const formattedConsumptionkWh = this.formatConsumptionToKWh(transaction);
    const timeSpent = this.convertTimeSpentToString(transaction);
    let descriptionPattern = (chargeBox?.siteArea?.name) ? 'billing.chargingAtSiteArea' : 'billing.chargingAtChargeBox';
    if (headerMode) {
      descriptionPattern = 'billing.header-itemDescription';
    }
    // Get the translated line item description
    const description = i18nManager.translate(descriptionPattern, {
      sessionID,
      startDate,
      startTime,
      timeSpent,
      totalConsumption: formattedConsumptionkWh,
      siteAreaName: chargeBox?.siteArea?.name,
      chargeBoxID: transaction?.chargeBoxID,
      stopTime,
    });
    return description;
  }

  private formatConsumptionToKWh(transaction: Transaction): string {
    // ACHTUNG: consumed energy shown in the line item might be slightly different from the billed energy
    return Utils.createDecimal(transaction.stop.totalConsumptionWh).dividedBy(1000).toNumber().toLocaleString(this.getUserLocale(transaction));
  }

  private getUserLocale(transaction: Transaction) {
    return transaction.user.locale ? transaction.user.locale.replace('_', '-') : Constants.DEFAULT_LOCALE.replace('_', '-');
  }

  // eslint-disable-next-line @typescript-eslint/require-await, @typescript-eslint/no-unused-vars
  public async checkIfUserCanBeCreated(user: User): Promise<boolean> {
    // throw new BackendError({
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
        tenantID: this.tenant.id,
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
        tenantID: this.tenant.id,
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
        tenantID: this.tenant.id,
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
    return this.createBillingUser(user, false);
  }

  public async repairUser(user: User): Promise<BillingUser> {
    return this.createBillingUser(user, true);
  }

  private async createBillingUser(user: User, forceUserCreation: boolean): Promise<BillingUser> {
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
      ...StripeHelpers.buildCustomerCommonProperties(user),
      metadata: {
        tenantID: this.tenant.id,
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
    await UserStorage.saveUserBillingData(this.tenant, user.id, user.billingData);
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
      ...StripeHelpers.buildCustomerCommonProperties(user),
    };
    // Update changed data
    customer = await this.stripe.customers.update(customerID, updateParams);
    // Let's update the Billing Data of our customer
    user.billingData.lastChangedOn = new Date();
    await UserStorage.saveUserBillingData(this.tenant, user.id, user.billingData);
    // Let's return the corresponding Billing User
    return this.convertToBillingUser(customer, user);
  }

  public async deleteUser(user: User): Promise<void> {
    if (FeatureToggles.isFeatureActive(Feature.BILLING_PREVENT_CUSTOMER_DELETION)) {
      // To be on the SAFE side - we preserve the customer on the STRIPE side
      return Promise.resolve();
    }
    // Check Stripe
    await this.checkConnection();
    const customerID = user.billingData?.customerID;
    const customer = await this.getStripeCustomer(customerID);
    if (customer && customer.id) {
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
          module: MODULE_NAME, method: 'getStripeCustomer',
          action: ServerAction.BILLING,
          message: `Customer ID is inconsistent - ${customerID}`,
          detailedMessages: { error: error.stack }
        });
      }
    }
    // -----------------------------------------------------------------
    // Returns null only when the customerID input parameter is null
    // Everything else should throw an error
    // --------------------------------------------------------------
    return null;
  }

  public async precheckStartTransactionPrerequisites(user: User): Promise<StartTransactionErrorCode[]> {
    const errorCodes: StartTransactionErrorCode[] = [];
    // Check billing prerequisites
    if (!this.settings.billing.isTransactionBillingActivated) {
      // Nothing to check - billing of transactions is not yet ON
      return errorCodes;
    }
    if (user.freeAccess) {
      // Nothing to check - we do not bill user having a free access
      return errorCodes;
    }
    // Make sure the STRIPE connection is ok
    try {
      await this.checkConnection();
    } catch (error) {
      await Logging.logError({
        tenantID: this.tenant.id,
        user, action: ServerAction.BILLING,
        module: MODULE_NAME, method: 'precheckStartTransactionPrerequisites',
        message: 'Stripe Prerequisites to start a transaction are not met',
        detailedMessages: { error: error.stack }
      });
      return [StartTransactionErrorCode.BILLING_NO_SETTINGS];
    }
    // Check all settings that are necessary to bill a transaction
    try {
      await this.checkTaxPrerequisites(); // Checks that the taxID is still valid
    } catch (error) {
      await Logging.logError({
        tenantID: this.tenant.id,
        user, action: ServerAction.BILLING,
        module: MODULE_NAME, method: 'precheckStartTransactionPrerequisites',
        message: 'Billing setting prerequisites to start a transaction are not met',
        detailedMessages: { error: error.stack }
      });
      errorCodes.push(StartTransactionErrorCode.BILLING_NO_TAX);
    }
    // Check user prerequisites
    const customerID: string = user?.billingData?.customerID;
    try {
      // Check whether the customer exists or not
      const customer = await this.checkStripeCustomer(customerID);
      // Check whether the customer has a default payment method
      await this.checkStripePaymentMethod(customer);
    } catch (error) {
      await Logging.logError({
        tenantID: this.tenant.id,
        user, action: ServerAction.BILLING,
        module: MODULE_NAME, method: 'precheckStartTransactionPrerequisites',
        message: 'User prerequisites to start a transaction are not met',
        detailedMessages: { error: error.stack }
      });
      // TODO - return a more precise error code when payment method has expired
      errorCodes.push(StartTransactionErrorCode.BILLING_NO_PAYMENT_METHOD);
    }
    // Let's return the check results!
    return errorCodes;
  }

  public async repairInvoice(billingInvoice: BillingInvoice): Promise<void> {
    await this.checkConnection();
    const transactions = new Map<string, { transactionID: number, description?: string, pricingData: any }>();
    const stripeInvoice: Stripe.Invoice = await this.stripe.invoices.retrieve(billingInvoice.invoiceID);
    const stripeInvoiceItems = await this.stripe.invoiceItems.list({
      invoice: stripeInvoice.id
    });
    //
    // ACHTUNG - SIMPLE PRICING
    // "sessions" : [
    //   {
    //       "transactionID" : 1884157429,
    //       "description" : "Session de recharge: 1884157429 - ...",
    //       "pricingData" : {
    //           "quantity" : 0.211,
    //           "amount" : 3.37,
    //           "currency" : "EUR"
    //       }
    //   }
    // ]
    //
    // ACHTUNG - BUILT-IN PRICING
    // "sessions" : [
    //   {
    //       "transactionID" : 1745843057,
    //       "pricingData" : [
    //           {
    //               "energy" : {
    //                   "unitPrice" : 0,
    //                   "quantity" : 32325,
    //                   "amount" : 32.325,
    //                   "roundedAmount" : 32.32,
    //                   "itemDescription" : "Energy Consumption: 32.325 kWh",
    //                   "taxes" : []
    //               }
    //           }
    //       ]
    //   },
    for (const stripeInvoiceItem of stripeInvoiceItems.data) {
      const transactionID = stripeInvoiceItem.metadata?.transactionID;
      if (transactionID) {
        // The metadata provides the ID of the session that has been billed
        // ACHTUNG - with the new pricing engine we may have an item per pricing dimensions!
        if (!transactions.has(transactionID)) {
          if (stripeInvoiceItem.metadata.totalConsumptionWh) {
            // Legacy mode - Simple Pricing!
            transactions.set(transactionID, {
              transactionID: Utils.convertToInt(transactionID),
              description: stripeInvoiceItem.description,
              pricingData: {
                quantity: Utils.createDecimal(Utils.convertToFloat(stripeInvoiceItem.metadata.totalConsumptionWh)).div(1000).toNumber(),
                amount: Utils.createDecimal(stripeInvoiceItem.amount).div(100).toNumber(),
                currency: stripeInvoiceItem.metadata.priceUnit
              }
            });
          } else {
            // New pricing engine
            const transaction = await TransactionStorage.getTransaction(this.tenant, Utils.convertToInt(transactionID), {
              withUser: true,
              withChargingStation: true
            });
            const pricingData: PricedConsumptionData[] = this.extractTransactionPricingData(transaction);
            transactions.set(transactionID, {
              transactionID: Utils.convertToInt(transactionID),
              pricingData
            });
          }
        }
      }
    }
    // Now we know the sessions
    const sessions = Array.from(transactions.values());
    DatabaseUtils.checkTenantObject(this.tenant);
    // Set data
    const updatedInvoiceMDB: any = {
      sessions,
    };
    await global.database.getCollection(this.tenant.id, 'invoices').findOneAndUpdate(
      { '_id': DatabaseUtils.convertToObjectID(billingInvoice.id) },
      { $set: updatedInvoiceMDB });
    // Let's get a clean invoice instance
    const repairedInvoice = await BillingStorage.getInvoice(this.tenant, billingInvoice.id);
    await this.repairTransactionsBillingData(repairedInvoice);
  }

  public async repairTransactionsBillingData(billingInvoice: BillingInvoice): Promise<void> {
    // This method is ONLY USED when repairing invoices - c.f.: RepairInvoiceInconsistencies migration task
    if (!billingInvoice.sessions) {
      // This should not happen - but it happened once!
      await Logging.logError({
        tenantID: this.tenant.id,
        action: ServerAction.BILLING,
        actionOnUser: billingInvoice.user,
        module: MODULE_NAME, method: 'repairTransactionsBillingData',
        message: `Unexpected situation - Invoice ${billingInvoice.id} has no sessions attached to it`
      });
    }
    await Promise.all(billingInvoice.sessions.map(async (session) => {
      const transactionID = session.transactionID;
      try {
        const transaction = await TransactionStorage.getTransaction(this.tenant, Number(transactionID), {
          withUser: true
        });
        // Update Billing Data
        if (transaction?.billingData?.stop) {
          transaction.billingData.stop.status = BillingStatus.BILLED,
          transaction.billingData.stop.invoiceID = billingInvoice.id;
          transaction.billingData.stop.invoiceStatus = billingInvoice.status;
          transaction.billingData.stop.invoiceNumber = billingInvoice.number;
          transaction.billingData.lastUpdate = new Date();
          // Add pricing data when built-in pricing engine was used
          if (!transaction.billingData.stop.invoiceItem && transaction.pricingModel) {
            const accountData = await this.retrieveAccountData(transaction);
            const invoiceItem = this.convertToBillingInvoiceItem(transaction, accountData);
            transaction.billingData.stop.invoiceItem = this.shrinkInvoiceItem(invoiceItem);
          }
          // Save repaired billing data
          await TransactionStorage.saveTransactionBillingData(this.tenant, transaction.id, transaction.billingData);
        }
      } catch (error) {
        // Catch stripe errors and send the information back to the client
        await Logging.logError({
          tenantID: this.tenant.id,
          action: ServerAction.BILLING,
          actionOnUser: billingInvoice.user,
          module: MODULE_NAME, method: 'repairTransactionsBillingData',
          message: `Failed to update transaction billing data - transaction: ${transactionID}`,
          detailedMessages: { error: error.stack }
        });
      }
    }));
  }

  public async createConnectedAccount(): Promise<Partial<BillingAccount>> {
    await this.checkConnection();
    let stripeAccount: Stripe.Account;
    // Create the account
    try {
      if (FeatureToggles.isFeatureActive(Feature.BILLING_PLATFORM_USE_EXPRESS_ACCOUNT)) {
        stripeAccount = await this.stripe.accounts.create({
          // Express accounts have access to a simplified dashboard and support separate charges and transfers
          // More info at: https://stripe.com/docs/connect/accounts
          type: 'express',
          capabilities: {
            card_payments: { requested: true },
            transfers: { requested: true }
          }
        });
      } else {
        // According to our STRIPE contact transfers are not supported when using sub-accounts of type 'standard''
        stripeAccount = await this.stripe.accounts.create({
          type: 'standard',
        });
      }
    } catch (e) {
      throw new BackendError({
        message: 'Unexpected situation - unable to create account',
        detailedMessages: { e },
        module: MODULE_NAME, action: ServerAction.BILLING_ACCOUNT_CREATE,
        method: 'createConnectedAccount',
      });
    }
    return {
      accountExternalID: stripeAccount.id
    };
  }

  public async refreshConnectedAccount(billingAccount: BillingAccount, accountActivationURL: string): Promise<Partial<BillingAccount>> {
    await this.checkConnection();
    // Generate the link to activate the account
    let activationLink: Stripe.AccountLink;
    try {
      activationLink = await this.stripe.accountLinks.create({
        account: billingAccount.accountExternalID,
        return_url: accountActivationURL + '&OperationResult=Success',
        refresh_url: accountActivationURL + '&OperationResult=Refresh',
        type: 'account_onboarding',
      });
    } catch (e) {
      throw new BackendError({
        message: 'Unexpected situation - unable to create activation link',
        detailedMessages: { e },
        module: MODULE_NAME, action: ServerAction.BILLING_ACCOUNT_CREATE,
        method: 'createConnectedAccount',
      });
    }
    return {
      id: billingAccount.id,
      activationLink: activationLink.url
    };
  }

  public async billPlatformFee(billingTransfer: BillingTransfer, user: User, billingAccount: BillingAccount): Promise<BillingPlatformInvoice> {
    await this.checkConnection();
    if (!user.billingData || !user.billingData.customerID) {
      // Synchronize owner if needed
      user.billingData = (await this.synchronizeUser(user)).billingData;
    }
    const currency = billingTransfer.currency.toLocaleLowerCase();
    // Create invoice
    const invoiceIdempotencyKey = this.buildIdemPotencyKey(billingTransfer.id, 'invoice', 'platformFee');
    const stripeInvoice = await this.createStripePlatformFeeInvoice(billingTransfer.id, user.billingData.customerID, user.id, invoiceIdempotencyKey, currency);
    if (!stripeInvoice) {
      throw new BackendError({
        message: 'Unexpected situation - platform invoice is not set',
        module: MODULE_NAME, action: ServerAction.BILLING_TRANSFER_FINALIZE,
        method: 'markStripeInvoiceAsPaid',
      });
    }
    // Add items to the invoice
    await this.addItemsToPlatformFeeInvoice(stripeInvoice, billingTransfer, user, billingAccount, this.settings.billing?.platformFeeTaxID);
    // Mark the invoice as paid
    const stripePaidInvoice = await this.markStripeInvoiceAsPaid(stripeInvoice);
    // Preserve some information
    const invoice = this.convertToBillingPlatformInvoice(stripePaidInvoice);
    return invoice;
  }

  private async createStripePlatformFeeInvoice(transferID: string, customerID: string, userID: string, idempotencyKey: string, currency: string): Promise<Stripe.Invoice> {
    try {
      // Let's create an empty STRIPE invoice
      const stripeInvoice: Stripe.Invoice = await this.stripe.invoices.create({
        customer: customerID,
        pending_invoice_items_behavior: 'exclude',
        auto_advance: false, // platform invoices are already paid - c.f.: paid_out_of_band option
        metadata: {
          userID,
          transferID,
          tenantID: this.tenant.id,
        },
        currency
      }, {
        idempotencyKey: idempotencyKey?.toString(), // STRIPE version 8.137.0 - property has been renamed!!!
      });
      return stripeInvoice;
    } catch (e) {
      throw new BackendError({
        message: 'Unexpected situation - unable to create the invoice for the platform fee',
        module: MODULE_NAME, action: ServerAction.BILLING_TRANSFER_FINALIZE,
        method: 'createStripePlatformFeeInvoice',
        detailedMessages: { e },
      });
    }
  }

  private async addItemsToPlatformFeeInvoice(stripeInvoice: Stripe.Invoice, billingTransfer: BillingTransfer, user: User, billingAccount: BillingAccount, taxID: string): Promise<void> {
    // Create invoice items
    try {
      // Convert to cents
      const amount = Utils.createDecimal(billingTransfer.collectedFees).mul(100).toNumber(); // This one is in cents!
      // Generate the invoice item
      const description = this.buildTransferFeeItemDescription(user, billingTransfer.sessionCounter);
      // A single tax rate per session
      const tax_rates = (taxID) ? [taxID] : [] ;
      // Prepare item parameters
      const parameters: Stripe.InvoiceItemCreateParams = {
        invoice: stripeInvoice.id,
        customer: user.billingData.customerID,
        currency: billingTransfer.currency,
        tax_rates,
        description,
        amount, // Stripe expects cents !!!
        metadata: {
          userID: user.id,
          transferID: billingTransfer.id,
          tenantID: this.tenant.id,
        }
      };
      // Create the invoice item
      const idempotencyKey = this.buildIdemPotencyKey(billingTransfer.id, 'invoice', 'platformFee-item');
      await this.stripe.invoiceItems.create(parameters, {
        idempotencyKey
      });
    } catch (e) {
      throw new BackendError({
        message: 'Unexpected situation - unable to create platform fee invoice item',
        module: MODULE_NAME, action: ServerAction.BILLING_TRANSFER_FINALIZE,
        method: 'billPlatformFee',
        detailedMessages: { e },
      });
    }
  }

  private async markStripeInvoiceAsPaid(stripeInvoice: Stripe.Invoice): Promise<Stripe.Invoice> {
    try {
      return await this.stripe.invoices.pay(stripeInvoice.id, {
        // Do not charge the customer
        paid_out_of_band: true
      });
    } catch (e) {
      throw new BackendError({
        message: 'Unexpected situation - unable to flag the invoice as paid out of band',
        module: MODULE_NAME, action: ServerAction.BILLING_TRANSFER_FINALIZE,
        method: 'markStripeInvoiceAsPaid',
        detailedMessages: { e },
      });
    }
  }

  public convertToBillingPlatformInvoice(stripeInvoice: Stripe.Invoice): BillingPlatformInvoice {
    // eslint-disable-next-line id-blacklist, max-len
    const { id: invoiceID, customer, number: documentNumber, livemode: liveMode, amount_due: amountCents, status, currency: invoiceCurrency, metadata } = stripeInvoice;
    const customerID = customer as string;
    const currency = invoiceCurrency?.toUpperCase();
    const epoch = stripeInvoice.status_transitions?.finalized_at || stripeInvoice.created;
    const createdOn = moment.unix(epoch).toDate(); // epoch to Date!
    const userID = metadata.userID;
    // Amount is in cents!
    const amount = amountCents ;
    const totalAmount = Utils.createDecimal(amountCents).div(100).toNumber();
    const invoice: BillingPlatformInvoice = {
      invoiceID, documentNumber, liveMode, userID,
      status: status as BillingInvoiceStatus,
      amount, totalAmount, currency,
      customerID, createdOn
    };
    return invoice;
  }

  private buildTransferFeeItemDescription(user: User, nbSessions: number) {
    const i18nManager = I18nManager.getInstanceForLocale(user.locale);
    const description = i18nManager.translate('billing.transfer-feeItemDescription', {
      nbSessions,
    });
    return description;
  }

  public async sendTransfer(billingTransfer: BillingTransfer, user: User): Promise<string> {
    await this.checkConnection();
    if (!user.billingData || !user.billingData.customerID) {
      // Synchronize owner if needed
      user.billingData = (await this.synchronizeUser(user)).billingData;
    }
    // Create the actual transfer of funds
    let stripeTransfer: Stripe.Transfer;
    try {
      stripeTransfer = await this.stripe.transfers.create({
        amount: Utils.createDecimal(billingTransfer.transferAmount).mul(100).toNumber(),
        currency: billingTransfer.currency,
        destination: billingTransfer.account.accountExternalID,
        // transfer_group: billingTransfer.id,  // TODO - is there any benefit to set a transfer_group?
        metadata: {
          userID: user.id,
          transferID: billingTransfer.id,
          tenantID: this.tenant.id,
        }
      });
    } catch (e) {
      throw new BackendError({
        message: 'Unexpected situation - unable to create transfer invoice',
        module: MODULE_NAME, action: ServerAction.BILLING_TRANSFER_SEND,
        method: 'sendTransfer',
        detailedMessages: { e },
      });
    }
    if (!stripeTransfer) {
      throw new BackendError({
        message: 'Unexpected situation - platform transfer is not set',
        module: MODULE_NAME, action: ServerAction.BILLING_TRANSFER_SEND,
        method: 'sendTransfer',
      });
    }
    return stripeTransfer.id;
  }
}
