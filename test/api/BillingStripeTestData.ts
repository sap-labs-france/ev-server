import { BillingInvoice, BillingInvoiceItem, BillingInvoiceStatus, BillingUser } from '../../src/types/Billing';
import { BillingSettingsType, SettingDB, StripeBillingSetting } from '../../src/types/Setting';
import chai, { assert, expect } from 'chai';

import BillingStorage from '../../src/storage/mongodb/BillingStorage';
import CentralServerService from './client/CentralServerService';
import ContextDefinition from './context/ContextDefinition';
import ContextProvider from './context/ContextProvider';
import Cypher from '../../src/utils/Cypher';
import Factory from '../factories/Factory';
import Stripe from 'stripe';
import StripeBillingIntegration from '../../src/integration/billing/stripe/StripeBillingIntegration';
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
    // Let's get access to the STRIPE implementation - StripeBillingIntegration instance
    this.billingImpl = await this.setBillingSystemValidCredentials();
    this.billingUser = await this.billingImpl.getBillingUserByInternalID(this.getCustomerID());
    expect(this.billingUser, 'Billing user should not ber null');
  }

  public async setBillingSystemValidCredentials() : Promise<StripeBillingIntegration> {
    const stripeSettings = this.getStripeSettings();
    await this.saveBillingSettings(stripeSettings);
    stripeSettings.secretKey = await Cypher.encrypt(this.getTenantID(), stripeSettings.secretKey);
    const billingImpl = new StripeBillingIntegration(this.getTenantID(), stripeSettings);
    expect(this.billingImpl).to.not.be.null;
    return billingImpl;
  }

  public async setBillingSystemInvalidCredentials() : Promise<StripeBillingIntegration> {
    const stripeSettings = this.getStripeSettings();
    stripeSettings.secretKey = await Cypher.encrypt(this.getTenantID(), 'sk_test_' + 'invalid_credentials');
    await this.saveBillingSettings(stripeSettings);
    const billingImpl = new StripeBillingIntegration(this.getTenantID(), stripeSettings);
    expect(this.billingImpl).to.not.be.null;
    return billingImpl;
  }

  public getStripeSettings(): StripeBillingSetting {
    return {
      url: config.get('billing.url'),
      publicKey: config.get('billing.publicKey'),
      secretKey: config.get('billing.secretKey'),
      noCardAllowed: config.get('billing.noCardAllowed'),
      advanceBillingAllowed: config.get('billing.advanceBillingAllowed'),
      currency: config.get('billing.currency'),
      immediateBillingAllowed: config.get('billing.immediateBillingAllowed'),
      periodicBillingAllowed: config.get('billing.periodicBillingAllowed')
    } as StripeBillingSetting;
  }

  public async saveBillingSettings(stripeSettings: StripeBillingSetting) : Promise<void> {
    const tenantBillingSettings = await this.adminUserService.settingApi.readAll({ 'Identifier': 'billing' });
    expect(tenantBillingSettings.data.count).to.be.eq(1);
    const componentSetting: SettingDB = tenantBillingSettings.data.result[0];
    componentSetting.content.type = BillingSettingsType.STRIPE;
    componentSetting.content.stripe = stripeSettings;
    componentSetting.sensitiveData = ['content.stripe.secretKey'];
    await this.adminUserService.settingApi.update(componentSetting);
  }

  public async checkForDraftInvoices(userId: string, expectedValue: number): Promise<number> {
    const result = await this.getDraftInvoices(userId);
    assert(result?.length === expectedValue, 'The number of invoice is not the expected one');
    return (result) ? result.length : -1;
  }

  public async getDraftInvoices(userId: string) : Promise<any> {
    const params = { Status: BillingInvoiceStatus.DRAFT, UserID: [userId] };
    const paging = TestConstants.DEFAULT_PAGING;
    const ordering = [{ field: '-createdOn' }];
    const response = await this.adminUserService.billingApi.readAll(params, paging, ordering, '/client/api/BillingUserInvoices');
    return response?.data?.result;
  }

  public isBillingProperlyConfigured(): boolean {
    const billingSettings = this.getStripeSettings();
    for (const key of Object.keys(billingSettings)) {
      if (!billingSettings[key] || billingSettings[key] === '') {
        return false ;
      }
    }
    return true;
  }

  public async assignPaymentMethod(stripe_test_token: string) : Promise<Stripe.CustomerSource> {
    // Assign a payment method using test tokens (instead of test card numbers)
    // c.f.: https://stripe.com/docs/testing#cards
    const concreteImplementation : StripeBillingIntegration = this.billingImpl ;
    const stripeInstance = await concreteImplementation.getStripeInstance();
    const source = await stripeInstance.customers.createSource(this.getCustomerID(), {
      source: stripe_test_token // e.g.: tok_visa, tok_amex, tok_fr
    });
    expect(source).to.not.be.null;
    return source;
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
    // Make it the default tax to apply when charging invoices
    concreteImplementation.alterStripeSettings({
      taxID: taxRate?.id
    });
    return taxRate;
  }

  public async createDraftInvoice() : Promise<BillingInvoice> {
    assert(this.billingUser, 'Billing user cannot be null');
    const item = { description: 'Stripe Integration - Item 777', amount: 777 };
    const billingInvoiceItem: BillingInvoiceItem = await this.billingImpl.createPendingInvoiceItem(this.billingUser, item);
    assert(billingInvoiceItem, 'Billing invoice item should not be null');
    const billingInvoice: BillingInvoice = await this.billingImpl.createInvoice(this.billingUser);
    assert(billingInvoice, 'Billing invoice should not be null');
    return billingInvoice;
  }

  public async updateDraftInvoice(billingInvoice: BillingInvoice) : Promise<void> {
    assert(this.billingUser, 'Billing user cannot be null');
    const item = { description: 'Stripe Integration - Item 555', amount: 555 };
    const billingInvoiceItem: BillingInvoiceItem = await this.billingImpl.createInvoiceItem(this.billingUser, billingInvoice.invoiceID, item);
    assert(billingInvoiceItem, 'Invoice Item should not be null');
  }

  public async payDraftInvoice(draftInvoice: { id: string }): Promise<void> {
    const draftInvoiceId = draftInvoice.id;
    let billingInvoice: BillingInvoice = await BillingStorage.getInvoice(this.getTenantID(), draftInvoiceId);
    // Let's attempt a payment using the default payment method
    billingInvoice = await this.billingImpl.chargeInvoice(billingInvoice);
    assert(billingInvoice.status === BillingInvoiceStatus.PAID, 'Invoice should have been paid');
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
}
