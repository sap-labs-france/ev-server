import { BillingInvoice, BillingInvoiceItem, BillingInvoiceStatus, BillingOperationResult, BillingUser, BillingUserData } from '../../src/types/Billing';
import { BillingSettings, BillingSettingsType, SettingDB } from '../../src/types/Setting';
import FeatureToggles, { Feature } from '../../src/utils/FeatureToggles';
import chai, { assert, expect } from 'chai';

import BillingStorage from '../../src/storage/mongodb/BillingStorage';
import CentralServerService from './client/CentralServerService';
import ContextDefinition from './context/ContextDefinition';
import ContextProvider from './context/ContextProvider';
import Cypher from '../../src/utils/Cypher';
import Factory from '../factories/Factory';
import Stripe from 'stripe';
import StripeBillingIntegration from '../../src/integration/billing/stripe/StripeBillingIntegration';
import TenantComponents from '../../src/types/TenantComponents';
import TenantContext from './context/TenantContext';
import TestConstants from './client/utils/TestConstants';
import User from '../../src/types/User';
import UserStorage from '../../src/storage/mongodb/UserStorage';
import chaiSubset from 'chai-subset';
import config from '../config';
import responseHelper from '../helpers/responseHelper';

chai.use(chaiSubset);
chai.use(responseHelper);

export default class StripeIntegrationTestData {

  // Tenant: utbilling
  public tenantContext: TenantContext;
  // User Service for action requiring admin permissions (e.g.: set/reset stripe settings)
  public adminUserContext: User;
  public adminUserService: CentralServerService;
  // Dynamic User for testing billing against an test STRIPE account
  public dynamicUser: User;
  // Billing Implementation - STRIPE
  public billingImpl: StripeBillingIntegration;
  public billingUser: BillingUser; // DO NOT CONFUSE - BillingUser is not a User!

  public async initialize(): Promise<void> {

    this.tenantContext = await ContextProvider.defaultInstance.getTenantContext(ContextDefinition.TENANT_CONTEXTS.TENANT_BILLING);
    this.adminUserContext = this.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN);
    this.adminUserService = new CentralServerService(
      this.tenantContext.getTenant().subdomain,
      this.adminUserContext
    );
    // Create a new user for testing stripe scenarios - BILLING-TEST
    const user = {
      ...Factory.user.build(),
      name: 'BILLING-TEST',
      firstName: 'Billing Integration Tests',
      issuer: true
    } as User;
    // Let's create a new user
    const userData = await this.adminUserService.createEntity(
      this.adminUserService.userApi,
      user
    );
    assert(userData && userData.id, 'response should not be null');
    // Let's get the newly created user
    this.dynamicUser = await UserStorage.getUser(this.getTenantID(), userData.id);
  }

  public async forceBillingSettings(immediateBilling: boolean): Promise<void> {
    // The tests requires some settings to be forced
    this.billingImpl = await this.setBillingSystemValidCredentials(immediateBilling);
    this.billingUser = await this.billingImpl.getUser(this.dynamicUser);
    if (!this.billingUser && !FeatureToggles.isFeatureActive(Feature.BILLING_SYNC_USER)) {
      this.billingUser = await this.billingImpl.forceSynchronizeUser(this.dynamicUser);
    }
    assert(this.billingUser, 'Billing user should not be null');
  }

  public async setBillingSystemValidCredentials(immediateBilling: boolean) : Promise<StripeBillingIntegration> {
    const billingSettings = this.getLocalSettings(immediateBilling);
    await this.saveBillingSettings(billingSettings);
    billingSettings.stripe.secretKey = await Cypher.encrypt(this.getTenantID(), billingSettings.stripe.secretKey);
    const billingImpl = StripeBillingIntegration.getInstance(this.getTenantID(), billingSettings);
    assert(billingImpl, 'Billing implementation should not be null');
    return billingImpl;
  }

  public getLocalSettings(immediateBillingAllowed: boolean): BillingSettings {
    const billingProperties = {
      isTransactionBillingActivated: config.get('billing.isTransactionBillingActivated'),
      immediateBillingAllowed: config.get('billing.immediateBillingAllowed'),
      periodicBillingAllowed: config.get('billing.periodicBillingAllowed'),
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

  public async saveBillingSettings(billingSettings: BillingSettings) : Promise<void> {
    // TODO - rethink that part
    const tenantBillingSettings = await this.adminUserService.settingApi.readAll({ 'Identifier': 'billing' });
    expect(tenantBillingSettings.data.count).to.be.eq(1);
    const componentSetting: SettingDB = tenantBillingSettings.data.result[0];
    componentSetting.content.type = BillingSettingsType.STRIPE;
    componentSetting.content.billing = billingSettings.billing;
    componentSetting.content.stripe = billingSettings.stripe;
    componentSetting.sensitiveData = ['content.stripe.secretKey'];
    await this.adminUserService.settingApi.update(componentSetting);
  }

  public isBillingProperlyConfigured(): boolean {
    const billingSettings = this.getLocalSettings(false);
    // Check that the mandatory settings are properly provided
    return (!!billingSettings.stripe.publicKey
      && !!billingSettings.stripe.secretKey
      && !!billingSettings.stripe.url);
  }

  public async assignPaymentMethod(stripe_test_token: string) : Promise<Stripe.CustomerSource> {
    // Assign a source using test tokens (instead of test card numbers)
    // c.f.: https://stripe.com/docs/testing#cards
    const concreteImplementation : StripeBillingIntegration = this.billingImpl ;
    const stripeInstance = await concreteImplementation.getStripeInstance();
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
    const paymentMethod = operationResult.internalData as any;
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

  public async assignTaxRate(rate: number) : Promise<Stripe.TaxRate> {
    // Let's create a tax rate
    const concreteImplementation : StripeBillingIntegration = this.billingImpl ;
    const stripeInstance = await concreteImplementation.getStripeInstance();
    const taxRate = await stripeInstance.taxRates.create({
      display_name: 'TVA',
      description: `TVA France - ${rate}%`,
      jurisdiction: 'FR',
      percentage: rate,
      inclusive: false
    });
    expect(taxRate).to.not.be.null;
    return taxRate;
  }

  public async checkBusinessProcessBillToPay(paymentShouldFail: boolean, withTax?:boolean) : Promise<number> {

    let taxId: string = null;
    if (withTax) {
      const taxRate: Stripe.TaxRate = await this.assignTaxRate(20); // VAT 20%
      taxId = taxRate.id;
    }
    // The user should have no DRAFT invoices
    await this.checkForDraftInvoices(this.dynamicUser.id, 0);
    // Let's create an Invoice with a first Item
    const dynamicInvoice = await this.billInvoiceItem(1000 /* kW.h */, 4 /* EUR */, taxId);
    assert(dynamicInvoice, 'Invoice should not be null');
    // Let's add an second item to the same invoice
    const updatedInvoice = await this.billInvoiceItem(2000 /* kW.h */, 8 /* EUR */, taxId);
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
    // Next step should not be necessary
    // await testData.billingImpl.synchronizeInvoices(testData.dynamicUser);
    // Let's check that the user do not have any DRAFT invoice anymore
    const nbDraftInvoice:number = await this.checkForDraftInvoices(this.dynamicUser.id, 0);
    return nbDraftInvoice;
  }

  public async checkImmediateBillingWithTaxes() : Promise<void> {
    // Inputs / Expected Outputs
    const transactionPrice = 4 /* EUR */;
    const tax20percent = 20 /* VAT 20 % */;
    const expectedTotal = 480; /* in cents, including taxes */
    // PREREQUISITE - immediateBillingAllowed MUST BE ON!
    const taxRate: Stripe.TaxRate = await this.assignTaxRate(tax20percent);
    const taxId = taxRate.id;
    // The user should have no DRAFT invoices
    await this.checkForDraftInvoices(this.dynamicUser.id, 0);
    // Let's create an Invoice with a first Item
    const beforeInvoiceDateTime = new Date().getTime();
    const dynamicInvoice = await this.billInvoiceItem(500 /* kW.h */, transactionPrice /* EUR */, taxId);
    assert(dynamicInvoice, 'Invoice should not be null');
    // User should have a PAID invoice
    const paidInvoices = await this.getInvoicesByState(this.dynamicUser.id, BillingInvoiceStatus.PAID);
    // The last invoice should be the one that has just been created
    const lastPaidInvoice: BillingInvoice = paidInvoices[0];
    assert(lastPaidInvoice, 'User should have at least a paid invoice');
    // TODO - Why do we get the amount in cents here?
    expect(lastPaidInvoice.amount).to.be.eq(expectedTotal); // 480 cents - TODO - Billing Invoice exposing cents???
    const lastPaidInvoiceDateTime = new Date(lastPaidInvoice.createdOn).getTime();
    expect(lastPaidInvoiceDateTime).to.be.gt(beforeInvoiceDateTime);
    const downloadResponse = await this.adminUserService.billingApi.downloadInvoiceDocument({ ID: lastPaidInvoice.id });
    expect(downloadResponse.headers['content-type']).to.be.eq('application/pdf');
    // User should not have any DRAFT invoices
    const nbDraftInvoice:number = await this.checkForDraftInvoices(this.dynamicUser.id, 0);
    expect(nbDraftInvoice).to.be.eql(0);
  }

  public async billInvoiceItem(quantity: number, amount: number, taxId?: string) : Promise<BillingInvoice> {
    assert(this.billingUser, 'Billing user cannot be null');
    const price = amount / quantity;

    // array of tax ids to apply to the line item
    const invoiceItem:BillingInvoiceItem = {
      description: `Stripe Integration - ${quantity} kWh * ${price} Eur`,
      transactionID: 777,
      pricingData: {
        quantity, // kW.h
        amount, // total amount to bill -  not yet in cents
        currency: 'EUR'
      }
    };
    if (taxId) {
      invoiceItem.taxes = [ taxId ];
    }
    // Let's attempt to bill the line item
    const billingInvoice: BillingInvoice = await this.billingImpl.billInvoiceItem(this.dynamicUser, invoiceItem);
    assert(billingInvoice, 'Billing invoice should not be null');
    return billingInvoice;
  }

  public async payDraftInvoice(draftInvoice: { id: string }, paymentShouldFail: boolean): Promise<void> {
    const draftInvoiceId = draftInvoice.id;
    let billingInvoice: BillingInvoice = await BillingStorage.getInvoice(this.getTenantID(), draftInvoiceId);
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

  public getCustomerID(): string {
    const customerID = this.dynamicUser?.billingData?.customerID;
    assert(customerID, 'customer ID cannot be null');
    return customerID;
  }

  public async checkForDraftInvoices(userId: string, expectedValue: number): Promise<number> {
    const result = await this.getInvoicesByState(userId, BillingInvoiceStatus.DRAFT);
    assert(result?.length === expectedValue, 'The number of invoice is not the expected one');
    return (result) ? result.length : -1;
  }

  public async checkForPaidInvoices(userId: string, expectedValue: number): Promise<number> {
    const result = await this.getInvoicesByState(userId, BillingInvoiceStatus.PAID);
    assert(result?.length === expectedValue, 'The number of invoice is not the expected one');
    return (result) ? result.length : -1;
  }

  public async getInvoicesByState(userId: string, state: BillingInvoiceStatus) : Promise<any> {
    const params = { Status: state, UserID: [userId] };
    const paging = TestConstants.DEFAULT_PAGING;
    const ordering = [{ field: '-createdOn' }];
    const response = await this.adminUserService.billingApi.readAll(params, paging, ordering, '/client/api/BillingUserInvoices');
    return response?.data?.result;
  }

  public async checkDownloadInvoiceAsPdf(userId: string) : Promise<void> {
    const paidInvoices = await this.getInvoicesByState(userId, BillingInvoiceStatus.PAID);
    assert(paidInvoices, 'User should have at least a paid invoice');
    const downloadResponse = await this.adminUserService.billingApi.downloadInvoiceDocument({ ID: paidInvoices[0].id });
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
    const testUser = await UserStorage.getUser(this.getTenantID(), userData.id);
    expect(testUser.billingData).not.to.be.null;
    const corruptedBillingData: BillingUserData = {
      ...testUser.billingData,
      customerID: 'cus_corrupted_data'
    };
    // Let's update the billing data with an inconsistent customer ID
    await UserStorage.saveUserBillingData(this.getTenantID(), testUser.id, corruptedBillingData);
    // Let's now try to repair the user data.
    const billingUser: BillingUser = await this.billingImpl.forceSynchronizeUser(user);
    expect(corruptedBillingData.customerID).to.not.be.eq(billingUser.billingData.customerID);
  }
}
