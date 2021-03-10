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
      periodicBillingAllowed: config.get('billing.periodicBillingAllowed'),
      taxID: config.get('billing.taxID'),
      liveMode: config.get('billing.liveMode')
    };
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

  public isBillingProperlyConfigured(): boolean {
    const billingSettings = this.getStripeSettings();
    // Check that the mandatory settings are properly provided
    return (!!billingSettings.publicKey
      && !!billingSettings.secretKey
      && !!billingSettings.url
      && !!billingSettings.currency);
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
    // concreteImplementation.alterStripeSettings({
    //   taxID: taxRate?.id, // Default tax to apply when charging invoices
    //   // immediateBillingAllowed: true // Activate immediate billing
    // });
    return taxRate;
  }

  public async checkBusinessProcessBillToPay(withTax?:boolean) : Promise<number> {

    let taxId: string = null;
    if (withTax) {
      const taxRate: Stripe.TaxRate = await this.assignTaxRate(20); // VAT 20%
      taxId = taxRate.id;
    }
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
    await this.payDraftInvoice(draftInvoices[0]);
    // Next step should not be necessary
    // await testData.billingImpl.synchronizeInvoices(testData.dynamicUser);
    // Let's check that the user do not have any DRAFT invoice anymore
    const nbDraftInvoice:number = await this.checkForDraftInvoices(this.dynamicUser.id, 0);
    return nbDraftInvoice;
  }

  public async billInvoiceItem(quantity: number, amount: number, taxId?: string) : Promise<BillingInvoice> {
    assert(this.billingUser, 'Billing user cannot be null');
    const price = amount / quantity;

    // array of tax ids to apply to the line item
    const invoiceItem:BillingInvoiceItem = {
      description: `Stripe Integration - ${quantity} kWh * ${price} Eur`,
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
    const billingInvoice: BillingInvoice = await this.billingImpl.billInvoiceItems(this.dynamicUser, [ invoiceItem ]);
    assert(billingInvoice, 'Billing invoice should not be null');
    return billingInvoice;
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

  public async checkDownloadInvoiceAsPdf() : Promise<void> {
    const paidInvoices = await await this.getInvoicesByState(this.dynamicUser.id, BillingInvoiceStatus.PAID);
    assert(paidInvoices, 'User should have at least a paid invoice');
    // const response = await this.adminUserService.billingApi.readAll({ Status: BillingInvoiceStatus.PAID }, TestConstants.DEFAULT_PAGING, TestConstants.DEFAULT_ORDERING, '/client/api/BillingUserInvoices');
    // expect(response.data.result.length).to.be.gt(0);
    const downloadResponse = await this.adminUserService.billingApi.downloadInvoiceDocument({ ID: paidInvoices[0].id });
    expect(downloadResponse.headers['content-type']).to.be.eq('application/pdf');
  }

}
