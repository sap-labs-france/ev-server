import { BillingInvoice, BillingInvoiceItem, BillingInvoiceStatus, BillingUser } from '../../src/types/Billing';
import { BillingSetting, BillingSettingsType, SettingDB, StripeBillingSetting } from '../../src/types/Setting';
import chai, { assert, expect } from 'chai';

import BillingIntegration from '../../src/integration/billing/BillingIntegration';
import BillingStorage from '../../src/storage/mongodb/BillingStorage';
import CentralServerService from './client/CentralServerService';
import ContextDefinition from './context/ContextDefinition';
import ContextProvider from './context/ContextProvider';
import Cypher from '../../src/utils/Cypher';
import Factory from '../factories/Factory';
import { IStripeSource } from 'stripe';
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
  public billingImpl: BillingIntegration<BillingSetting>; // ==> StripeBillingIntegration
  public billingUser: BillingUser; // DO NOT CONFUSE - BillingUser is not a User!

  public async initialize(): Promise<void> {

    this.tenantContext = await ContextProvider.defaultInstance.getTenantContext(ContextDefinition.TENANT_CONTEXTS.TENANT_BILLING);
    this.adminUserContext = this.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN);
    this.adminUserService = new CentralServerService(
      this.tenantContext.getTenant().subdomain,
      this.adminUserContext
    );
    // Create a new user for testing stripe scenarios - BILING-TEST
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
    this.billingUser = await this.billingImpl.getUser(this.getCustomerID());
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
    const ordering = [{ field: 'createdOn', direction: 'desc' }];
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

  public async assignPaymentMethod(stripe_test_token: string) : Promise<IStripeSource> {
    const concreteImplementation : StripeBillingIntegration = this.billingImpl as StripeBillingIntegration;
    const stripeInstance = await concreteImplementation.getStripeInstance();
    const source = await stripeInstance.customers.createSource(this.getCustomerID(), {
      source: stripe_test_token
    });
    expect(source).to.not.be.null;
    return source;
  }

  public async createDraftInvoice() : Promise<BillingInvoice> {
    assert(this.billingUser, 'Billing user cannot be null');
    const item = { description: 'Stripe Integration - Item 777', amount: 777 };
    const invoiceWrapper: { invoice: BillingInvoice; invoiceItem: BillingInvoiceItem } = await this.billingImpl.createInvoice(this.billingUser, item);
    assert(invoiceWrapper?.invoice, 'Invoice should not be null');
    return invoiceWrapper?.invoice;
  }

  public async updateDraftInvoice(billingInvoice: BillingInvoice) : Promise<void> {
    assert(this.billingUser, 'Billing user cannot be null');
    const item = { description: 'Stripe Integration - Item 555', amount: 555 };
    const billingInvoiceItem: BillingInvoiceItem = await this.billingImpl.createInvoiceItem(this.billingUser, billingInvoice.invoiceID, item);
    assert(billingInvoiceItem, 'Invoice Item should not be null');
  }

  public async payDraftInvoice(draftInvoice: { id: string }): Promise<void> {
    const draftInvoiceId = draftInvoice.id;
    const billingInvoice: BillingInvoice = await BillingStorage.getInvoice(this.getTenantID(), draftInvoiceId);
    // Let's attempt a payment using the default payment method
    const operationResult: any = await this.billingImpl.chargeInvoice(billingInvoice);
    assert(operationResult && operationResult?.invoiceStatus === 'paid' && operationResult?.rawData?.paid, 'Invoice should have been paid');
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
