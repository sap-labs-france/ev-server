import { BillingAccount, BillingInvoice, BillingInvoiceItem, BillingInvoiceStatus, BillingOperationResult, BillingUser, BillingUserData } from '../../src/types/Billing';
import { BillingSettings, BillingSettingsType, SettingDB } from '../../src/types/Setting';
import Tenant, { TenantComponents } from '../../src/types/Tenant';
import chai, { expect } from 'chai';

import { BillingPeriodicOperationTaskConfig } from '../../src/types/TaskConfig';
import BillingStorage from '../../src/storage/mongodb/BillingStorage';
import CentralServerService from './client/CentralServerService';
import ContextDefinition from './context/ContextDefinition';
import ContextProvider from './context/ContextProvider';
import Cypher from '../../src/utils/Cypher';
import Factory from '../factories/Factory';
import { PricedConsumptionData } from '../../src/types/Pricing';
import Stripe from 'stripe';
import StripeBillingIntegration from '../../src/integration/billing/stripe/StripeBillingIntegration';
import TenantContext from './context/TenantContext';
import TestConstants from './client/utils/TestConstants';
import User from '../../src/types/User';
import UserStorage from '../../src/storage/mongodb/UserStorage';
import Utils from '../../src/utils/Utils';
import assert from 'assert';
import chaiSubset from 'chai-subset';
import config from '../config';
import responseHelper from '../helpers/responseHelper';

chai.use(chaiSubset);
chai.use(responseHelper);

export class BillingTestConfigHelper {
  public static isBillingProperlyConfigured(): boolean {
    const billingSettings = BillingTestConfigHelper.getLocalSettings(false);
    // Check that the mandatory settings are properly provided
    return (!!billingSettings.stripe.publicKey
      && !!billingSettings.stripe.secretKey
      && !!billingSettings.stripe.url);
  }

  public static getLocalSettings(immediateBillingAllowed: boolean): BillingSettings {
    // ----------------------------------
    // CONFIGURATION EXAMPLE - in test/local.json
    // ----------------------------------
    // "billing": {
    //   "isTransactionBillingActivated": true,
    //   "immediateBillingAllowed": true,
    //   "periodicBillingAllowed": false,
    //   "taxID": ""
    // },
    // "stripe": {
    //   "url": "https://dashboard.stripe.com/b/acct_1FFFFFFFFFFF",
    //   "publicKey": "pk_test_511FFFFFFFFFFF",
    //   "secretKey": "sk_test_51K1FFFFFFFFFF"
    // },
    const billingProperties = {
      isTransactionBillingActivated: config.get('billing.isTransactionBillingActivated'),
      immediateBillingAllowed: immediateBillingAllowed, // config.get('billing.immediateBillingAllowed'),
      periodicBillingAllowed: !immediateBillingAllowed, // config.get('billing.periodicBillingAllowed'),
      taxID: config.get('billing.taxID')
    };
    const stripeProperties = {
      url: config.get('stripe.url'),
      publicKey: config.get('stripe.publicKey'),
      secretKey: config.get('stripe.secretKey'),
    };
    const settings: BillingSettings = {
      identifier: TenantComponents.BILLING,
      type: BillingSettingsType.STRIPE,
      billing: billingProperties,
      stripe: stripeProperties,
    };

    // -----------------------------------------------------------------
    // Our test may need the immediate billing to be switched off!
    // Because we want to check the DRAFT state of the invoice
    settings.billing.immediateBillingAllowed = immediateBillingAllowed;
    // -----------------------------------------------------------------
    return settings;
  }
}

export class StripeTaxHelper {
  public static async fetchOrCreateTaxRate(billingImplementation: StripeBillingIntegration, rate: number) : Promise<Stripe.TaxRate> {
    // Get the stripe facade
    const stripeInstance = await billingImplementation.getStripeInstance();
    // Get the list of tax rates
    const taxRates = await stripeInstance.taxRates.list({
      limit: 10,
      active: true,
      inclusive: false
    });
    let taxRate = null;
    // Iterate the list to find one having the expected rate
    for (const existingTaxRate of taxRates.data) {
      if (existingTaxRate.percentage === rate && !existingTaxRate.inclusive) {
        taxRate = existingTaxRate;
        break;
      }
    }
    if (!taxRate) {
      // Not found - let's create it!
      taxRate = await stripeInstance.taxRates.create({
        display_name: 'Tax',
        description: `Tax rate - ${rate}%`,
        percentage: rate,
        inclusive: false
      });
    }
    expect(taxRate).to.not.be.null;
    return taxRate;
  }
}

export default class StripeTestHelper {
  // Tenant: utbilling
  private tenantContext: TenantContext;
  // User Service for action requiring admin permissions (e.g.: set/reset stripe settings)
  private adminUserContext: User;
  private adminUserService: CentralServerService;
  // Dynamic User for testing billing against an test STRIPE account
  private dynamicUser: User;
  // Billing Implementation - STRIPE
  private billingImpl: StripeBillingIntegration;
  private billingUser: BillingUser; // DO NOT CONFUSE - BillingUser is not a User!

  public async initialize(tenantContext = ContextDefinition.TENANT_CONTEXTS.TENANT_BILLING): Promise<void> {

    this.tenantContext = await ContextProvider.defaultInstance.getTenantContext(tenantContext);
    this.adminUserContext = this.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN);
    this.adminUserService = new CentralServerService(
      this.tenantContext.getTenant().subdomain,
      this.adminUserContext
    );
    // Create a new user for testing stripe scenarios - BILLING-TEST
    const user = {
      ...Factory.user.build(),
      name: 'BILLING',
      firstName: 'UT',
      issuer: true,
      locale: 'fr_FR'
    } as User;
    // Let's create a new user
    const userData = await this.adminUserService.createEntity(
      this.adminUserService.userApi,
      user
    );
    assert(userData && userData.id, 'response should not be null');
    // Let's get the newly created user
    this.dynamicUser = await UserStorage.getUser(this.getTenant(), userData.id);
  }

  public async forceBillingSettings(immediateBilling: boolean): Promise<void> {
    // The tests requires some settings to be forced
    await this.setBillingSystemValidCredentials(immediateBilling);
    this.billingUser = await this.billingImpl.getUser(this.dynamicUser);
    this.billingUser = await this.billingImpl.forceSynchronizeUser(this.dynamicUser);
    assert(this.billingUser, 'Billing user should not be null');
  }

  public async setBillingSystemValidCredentials(immediateBilling: boolean) : Promise<void> {
    const billingSettings = BillingTestConfigHelper.getLocalSettings(immediateBilling);
    await this.saveBillingSettings(billingSettings);
    billingSettings.stripe.secretKey = await Cypher.encrypt(this.getTenant(), billingSettings.stripe.secretKey);
    this.billingImpl = StripeBillingIntegration.getInstance(this.getTenant(), billingSettings);
    assert(this.billingImpl, 'Billing implementation should not be null');
  }

  public async fakeLiveBillingSettings() : Promise<StripeBillingIntegration> {
    const billingSettings = BillingTestConfigHelper.getLocalSettings(true);
    const mode = 'live';
    billingSettings.stripe.secretKey = `sk_${mode}_0234567890`;
    billingSettings.stripe.publicKey = `pk_${mode}_0234567890`;
    await this.saveBillingSettings(billingSettings);
    const billingImpl = StripeBillingIntegration.getInstance(this.getTenant(), billingSettings);
    assert(billingImpl, 'Billing implementation should not be null');
    return billingImpl;
  }

  public async saveBillingSettings(billingSettings: BillingSettings) : Promise<void> {
    // TODO - rethink that part
    const tenantBillingSettings = await this.adminUserService.settingApi.readByIdentifier({ 'Identifier': 'billing' });
    expect(tenantBillingSettings.data).to.not.be.null;
    const componentSetting: SettingDB = tenantBillingSettings.data;
    componentSetting.content.type = BillingSettingsType.STRIPE;
    componentSetting.content.billing = billingSettings.billing;
    componentSetting.content.stripe = billingSettings.stripe;
    componentSetting.sensitiveData = ['content.stripe.secretKey'];
    await this.adminUserService.settingApi.update(componentSetting);
  }

  public async assignPaymentMethod(stripe_test_token: string) : Promise<Stripe.CustomerSource> {
    // Assign a source using test tokens (instead of test card numbers)
    // c.f.: https://stripe.com/docs/testing#cards
    const stripeInstance = await this.billingImpl.getStripeInstance();
    const source = await stripeInstance.customers.createSource(this.getCustomerID(), {
      source: stripe_test_token // e.g.: tok_visa, tok_amex, tok_fr
    });
    expect(source).to.not.be.null;
    return source;
  }

  // Detach the latest assigned source
  public async checkDetachPaymentMethod(newSourceId: string) : Promise<void> {
    const concreteImplementation : StripeBillingIntegration = this.billingImpl;
    // TODO: check this is not the default pm as here we are dealing with source and not pm
    const operationResult: BillingOperationResult = await concreteImplementation.deletePaymentMethod(this.dynamicUser, newSourceId);
    expect(operationResult.internalData).to.not.be.null;
    const paymentMethod = operationResult.internalData as { id: string };
    await this.retrievePaymentMethod(paymentMethod.id);
  }

  // TODO : modify this test with concrete implementation when we have implemented getPaymentMethod(pmID)
  public async retrievePaymentMethod(deletedSourceId: string) : Promise<void> {
    const concreteImplementation : StripeBillingIntegration = this.billingImpl;
    const stripeInstance = await concreteImplementation.getStripeInstance();
    try {
      await stripeInstance.paymentMethods.retrieve(deletedSourceId);
    } catch (error) {
      expect(error.code).to.equal('resource_missing');
    }
  }

  public async fetchOrCreateTaxRate(rate: number) : Promise<Stripe.TaxRate> {
    return StripeTaxHelper.fetchOrCreateTaxRate(this.billingImpl, rate);
  }

  public async checkBusinessProcessBillToPay(paymentShouldFail: boolean, withTax?:boolean) : Promise<void> {
    let taxId: string = null;
    if (withTax) {
      const taxRate: Stripe.TaxRate = await this.fetchOrCreateTaxRate(20); // VAT 20%
      taxId = taxRate.id;
    }
    // The user should have no DRAFT invoices
    await this.checkForDraftInvoices(this.dynamicUser.id, 0);
    // Let's create an Invoice with a first Item
    const dynamicInvoice = await this.billInvoiceItem({
      energyConsumptionkWh: 4, // kWh
      energyAmount: 1, // EUR
      parkingTime: 10, // Minutes
      parkingAmount: 5, // EUR
      taxId
    });
    assert(dynamicInvoice, 'Invoice should not be null');
    // Let's add an second item to the same invoice
    const updatedInvoice = await this.billInvoiceItem({
      energyConsumptionkWh: 8, // kWh
      energyAmount: 2, // EUR
      parkingTime: 10, // Minutes
      parkingAmount: 5, // EUR
      taxId
    });
    assert(updatedInvoice, 'Invoice should not be null');
    // User should have a DRAFT invoice
    const draftInvoices = await this.getInvoicesByState(this.dynamicUser.id, BillingInvoiceStatus.DRAFT);
    assert(draftInvoices, 'User should have at least a draft invoice');
    expect(draftInvoices.length).to.be.eql(1);
    // Let's pay that particular DRAFT invoice
    await this.payDraftInvoice(draftInvoices[0], paymentShouldFail);
    if (!paymentShouldFail) {
      // Let's down load the corresponding PDF document
      await this.checkDownloadInvoiceAsPdf(this.dynamicUser.id);
    }
  }

  public async checkBusinessProcessRetryPayment(): Promise<void> {
    // Let's check that the user do not have any DRAFT invoice anymore
    const nbPaidInvoiceBefore = await this.checkForPaidInvoices(this.dynamicUser.id);
    // Let's simulate the periodic billing operation
    const taskConfiguration: BillingPeriodicOperationTaskConfig = {
      onlyProcessUnpaidInvoices: true,
      forceOperation: true
    };
    // Here we simulate the periodic operation which is supposed to try to pay again after a payment failure
    const operationResult = await this.billingImpl.chargeInvoices(taskConfiguration);
    assert(operationResult.inSuccess > 0, 'The operation should have been able to process at least one invoice');
    assert(operationResult.inError === 0, 'The operation should detect any errors');
    // Let's check whether the nb of paid invoices has changed
    const nbPaidInvoiceAfter = await this.checkForPaidInvoices(this.dynamicUser.id);
    assert(nbPaidInvoiceAfter > nbPaidInvoiceBefore, 'The number of paid invoices should be different');
  }

  public async checkImmediateBillingWithTaxes() : Promise<void> {
    // Inputs / Expected Outputs
    const tax20percent = 20 /* VAT 20 % */;
    // PREREQUISITE - immediateBillingAllowed MUST BE ON!
    const taxRate: Stripe.TaxRate = await this.fetchOrCreateTaxRate(tax20percent);
    const taxId = taxRate.id;
    // The user should have no DRAFT invoices
    await this.checkForDraftInvoices(this.dynamicUser.id, 0);
    // Let's create an Invoice with a first Item
    const beforeInvoiceDateTime = Utils.createDecimal(new Date().getTime()).div(1000).trunc().toNumber();
    const dynamicInvoice = await this.billInvoiceItem({
      energyConsumptionkWh: 16, // kWh
      energyAmount: 4, // EUR
      parkingTime: 10, // Minutes
      parkingAmount: 5, // EUR
      taxId
    });
    const expectedTotal = 1080; /* in cents, including taxes */
    assert(dynamicInvoice, 'Invoice should not be null');
    // User should have a PAID invoice
    const paidInvoices = await this.getInvoicesByState(this.dynamicUser.id, BillingInvoiceStatus.PAID);
    // The last invoice should be the one that has just been created
    const lastPaidInvoice: BillingInvoice = paidInvoices[0];
    assert(lastPaidInvoice, 'User should have at least a paid invoice');
    // TODO - Why do we get the amount in cents here?
    expect(lastPaidInvoice.amount).to.be.eq(expectedTotal); // 480 cents - TODO - Billing Invoice exposing cents???
    // Stripe is using Unix Epoch for its date - and looses some precision
    const lastPaidInvoiceDateTime = Utils.createDecimal(new Date(lastPaidInvoice.createdOn).getTime()).div(1000).trunc().toNumber();
    expect(lastPaidInvoiceDateTime).to.be.gte(beforeInvoiceDateTime);
    const downloadResponse = await this.adminUserService.billingApi.downloadInvoiceDocument({ invoiceID: lastPaidInvoice.id });
    expect(downloadResponse.headers['content-type']).to.be.eq('application/pdf');
    // User should not have any DRAFT invoices
    const nbDraftInvoice = await this.checkForDraftInvoices(this.dynamicUser.id, 0);
    expect(nbDraftInvoice).to.be.eql(0);
  }

  public async billInvoiceItem(consumptionTestData: {
    energyConsumptionkWh: number, // kWh
    energyAmount: number, // EUR
    parkingTime: number, // Minutes
    parkingAmount: number // EUR
    taxId: string
  }) : Promise<BillingInvoice> {
    assert(this.billingUser, 'Billing user cannot be null');
    // array of tax ids to apply to the line item
    const taxes = (consumptionTestData.taxId) ? [ consumptionTestData.taxId ] : [];
    // Pricing/Consumption Data
    const pricingConsumptionData: PricedConsumptionData = {
      energy: {
        itemDescription: `Energy consumption - ${consumptionTestData.energyConsumptionkWh} kWh * ${consumptionTestData.energyAmount / consumptionTestData.energyConsumptionkWh} Eur`,
        unitPrice: Utils.createDecimal(consumptionTestData.energyAmount).div(consumptionTestData.energyConsumptionkWh).toNumber(),
        amountAsDecimal: Utils.createDecimal(consumptionTestData.energyAmount), // total amount to bill -  not yet in cents
        amount: consumptionTestData.energyAmount, // total amount to bill -  not yet in cents
        roundedAmount: Utils.truncTo(consumptionTestData.energyAmount, 2),
        quantity: Utils.createDecimal(consumptionTestData.energyConsumptionkWh).div(1000).toNumber(), // Wh
        taxes // Array of taxes - cannot be null
      },
      parkingTime: {
        itemDescription: `Parking time - ${consumptionTestData.parkingTime} minutes`,
        unitPrice: Utils.createDecimal(consumptionTestData.parkingAmount).div(consumptionTestData.parkingTime).toNumber(),
        amountAsDecimal: Utils.createDecimal(consumptionTestData.parkingAmount),
        amount: consumptionTestData.parkingAmount, // Euros
        roundedAmount: Utils.truncTo(consumptionTestData.parkingAmount, 2),
        quantity: Utils.createDecimal(consumptionTestData.parkingTime).div(60).toNumber(), // seconds
        taxes // Array of taxes - cannot be null
      }
    };
    // Invoice Item
    const invoiceItem:BillingInvoiceItem = {
      currency: 'EUR',
      transactionID: Utils.getRandomIntSafe(),
      pricingData: [ pricingConsumptionData ]
    };
    // Let's attempt to bill the line item
    const billingInvoice: BillingInvoice = await this.billingImpl.billInvoiceItem(this.dynamicUser, invoiceItem);
    assert(billingInvoice, 'Billing invoice should not be null');
    return billingInvoice;
  }

  public async payDraftInvoice(draftInvoice: { id: string }, paymentShouldFail: boolean): Promise<void> {
    const draftInvoiceId = draftInvoice.id;
    let billingInvoice: BillingInvoice = await BillingStorage.getInvoice(this.tenantContext?.getTenant(), draftInvoiceId);
    // Let's attempt a payment using the default payment method
    billingInvoice = await this.billingImpl.chargeInvoice(billingInvoice);
    if (paymentShouldFail) {
      assert(billingInvoice.status === BillingInvoiceStatus.OPEN, 'Invoice should have been be finalized but not yet paid');
      // TODO - retrieve and check the last payment error and the corresponding error code
      // billingInvoice = await BillingStorage.getInvoice(draftInvoiceId);
      // assert(billingInvoice.lastPaymentFailure.error.error_code === "missing"!!!!
    } else {
      assert(billingInvoice.status === BillingInvoiceStatus.PAID, 'Invoice should have been paid');
    }
  }

  public getTenantID(): string {
    const tenantId = this.tenantContext?.getTenant()?.id;
    assert(tenantId, 'Tenant ID cannot be null');
    return tenantId;
  }

  public getTenant(): Tenant {
    return this.tenantContext?.getTenant();
  }

  public getCustomerID(): string {
    const customerID = this.dynamicUser?.billingData?.customerID;
    assert(customerID, 'customer ID cannot be null');
    return customerID;
  }

  public async checkNoInvoices() : Promise<void> {
    const response = await this.adminUserService.billingApi.readInvoices({}, { limit: 1, skip: 0 });
    assert(response?.data?.result.length === 0, 'There should be no invoices with test billing data anymore');
  }

  public async checkNoUsersWithTestData() : Promise<void> {
    // const response = await this.adminUserService.userApi.readAll({ withTestBillingData: true }, { limit: 1, skip: 0 });
    // assert(response?.data?.result.length === 0, 'There should be no users with test billing data anymore');
    const response = await UserStorage.getUsers(this.getTenant(), {
      withTestBillingData: true
    }, {
      limit: 1,
      skip: 0
    }, ['id']);
    assert(response?.result.length === 0, 'There should be no invoices with test billing data anymore');
  }

  public async checkForDraftInvoices(userId: string, expectedValue?: number): Promise<number> {
    const result = await this.getInvoicesByState(userId, BillingInvoiceStatus.DRAFT);
    if (!Utils.isNullOrUndefined(expectedValue)) {
      assert(result?.length === expectedValue, 'The number of invoice is not the expected one');
    }
    return (result) ? result.length : -1;
  }

  public async checkForPaidInvoices(userId: string, expectedValue?: number): Promise<number> {
    const result = await this.getInvoicesByState(userId, BillingInvoiceStatus.PAID);
    if (!Utils.isNullOrUndefined(expectedValue)) {
      assert(result?.length === expectedValue, 'The number of invoice is not the expected one');
    }
    return (result) ? result.length : -1;
  }

  public async getInvoicesByState(userId: string, state: BillingInvoiceStatus) : Promise<any> {
    const params = { Status: state, UserID: [userId] };
    const paging = TestConstants.DEFAULT_PAGING;
    const ordering = [{ field: '-createdOn' }];
    const response = await this.adminUserService.billingApi.readInvoices(params, paging, ordering);
    return response?.data?.result;
  }

  public async checkDownloadInvoiceAsPdf(userId: string) : Promise<void> {
    const paidInvoices = await this.getInvoicesByState(userId, BillingInvoiceStatus.PAID);
    assert(paidInvoices, 'User should have at least a paid invoice');
    const downloadResponse = await this.adminUserService.billingApi.downloadInvoiceDocument({ invoiceID: paidInvoices[0].id });
    expect(downloadResponse.headers['content-type']).to.be.eq('application/pdf');
  }

  public async checkRepairInconsistencies() : Promise<void> {
    // Create a new user for testing stripe scenarios - BILLING-TEST
    const user = {
      ...Factory.user.build(),
      name: 'RECOVERY-TEST',
      firstName: 'Billing Recovery Tests',
      issuer: true
    } as User;
    // Let's create a new user
    const userData = await this.adminUserService.createEntity(
      this.adminUserService.userApi,
      user
    );
    assert(userData && userData.id, 'response should not be null');
    // Let's get the newly created user
    const testUser = await UserStorage.getUser(this.getTenant(), userData.id);
    expect(testUser.billingData).not.to.be.null;
    const corruptedBillingData: BillingUserData = {
      ...testUser.billingData,
      customerID: 'cus_corrupted_data'
    };
    // Let's update the billing data with an inconsistent customer ID
    await UserStorage.saveUserBillingData(this.getTenant(), testUser.id, corruptedBillingData);
    // Let's now try to repair the user data.
    const billingUser: BillingUser = await this.billingImpl.forceSynchronizeUser(user);
    expect(corruptedBillingData.customerID).to.not.be.eq(billingUser.billingData.customerID);
  }

  public async checkTestDataCleanup(successExpected: boolean): Promise<void> {
    // await this.billingImpl.clearTestData();
    const response = await this.adminUserService.billingApi.clearBillingTestData();
    if (successExpected) {
      // Check the response
      assert(response?.data?.succeeded === true, 'The operation should succeed');
      assert(!response?.data?.error, 'error should not be set');
      assert(response?.data?.internalData, 'internalData should provide the new settings');
      // Check the new billing settings
      const newSettings: BillingSettings = response?.data?.internalData as BillingSettings;
      assert(newSettings.billing.isTransactionBillingActivated === false, 'Transaction billing should be switched OFF');
      assert(!newSettings.billing.taxID, 'taxID should not be set anymore');
      assert(!newSettings.billing?.platformFeeTaxID, 'Platform Fee TaxID should not be set anymore');
      assert(!newSettings.stripe.url, 'URL should not be set anymore');
      assert(!newSettings.stripe.publicKey, 'publicKey should not be set anymore');
      assert(!newSettings.stripe.secretKey, 'secretKey should not be set anymore');
      // Check the invoices
      await this.checkNoInvoices();
      // Check the users
      await this.checkNoUsersWithTestData();
    } else {
      assert(response?.data?.succeeded === false, 'The operation should fail');
      assert(response?.data?.error, 'error should not be null');
    }
  }

  public async createConnectedAccount(): Promise<Partial<BillingAccount>> {
    return this.billingImpl.createConnectedAccount();
  }
}
