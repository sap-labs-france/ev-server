import { BillingInvoiceStatus, BillingUser } from '../../src/types/Billing';
import { BillingSettings, BillingSettingsType, SettingDB } from '../../src/types/Setting';
import FeatureToggles, { Feature } from '../../src/utils/FeatureToggles';
import chai, { assert, expect } from 'chai';

import CentralServerService from './client/CentralServerService';
import ChargingStationContext from './context/ChargingStationContext';
import Constants from '../../src/utils/Constants';
import ContextDefinition from './context/ContextDefinition';
import ContextProvider from './context/ContextProvider';
import Cypher from '../../src/utils/Cypher';
import Factory from '../factories/Factory';
import MongoDBStorage from '../../src/storage/mongodb/MongoDBStorage';
import { ObjectID } from 'mongodb';
import SiteContext from './context/SiteContext';
import { StatusCodes } from 'http-status-codes';
import Stripe from 'stripe';
import StripeBillingIntegration from '../../src/integration/billing/stripe/StripeBillingIntegration';
import TenantComponents from '../../src/types/TenantComponents';
import TenantContext from './context/TenantContext';
import TestConstants from './client/utils/TestConstants';
import User from '../../src/types/User';
import { UserInErrorType } from '../../src/types/InError';
import chaiSubset from 'chai-subset';
import config from '../config';
import global from '../../src/types/GlobalType';
import moment from 'moment';
import responseHelper from '../helpers/responseHelper';

chai.use(chaiSubset);
chai.use(responseHelper);

class TestData {
  // Tenant: utbilling
  public tenantContext: TenantContext;
  // User Service for action requiring admin permissions (e.g.: set/reset stripe settings)
  public adminUserContext: User;
  public adminUserService: CentralServerService;
  // User Service for common actions
  public userContext: User;
  public userService: CentralServerService;
  // Other test resources
  public siteContext: SiteContext;
  public siteAreaContext: any;
  public chargingStationContext: ChargingStationContext;
  public createdUsers: User[] = [];
  // Dynamic User for testing billing against an empty STRIPE account
  // Billing Implementation - STRIPE?
  public billingImpl: StripeBillingIntegration;
  public billingUser: BillingUser; // DO NOT CONFUSE - BillingUser is not a User!

  public async assignPaymentMethod(user: BillingUser, stripe_test_token: string) : Promise<Stripe.CustomerSource> {
    // Assign a source using test tokens (instead of test card numbers)
    // c.f.: https://stripe.com/docs/testing#cards
    const concreteImplementation : StripeBillingIntegration = this.billingImpl ;
    const stripeInstance = await concreteImplementation.getStripeInstance();
    const customerID = user.billingData?.customerID;
    assert(customerID, 'customerID should not be null');
    // TODO - rethink that part - the concrete billing implementation should be called instead
    const source = await stripeInstance.customers.createSource(customerID, {
      source: stripe_test_token // e.g.: tok_visa, tok_amex, tok_fr
    });
    assert(source, 'Source should not be null');
    // TODO - rethink that part - the concrete billing implementation should be called instead
    const customer = await stripeInstance.customers.update(customerID, {
      default_source: source.id
    });
    assert(customer, 'Customer should not be null');
    return source;
  }

  public async setBillingSystemValidCredentials() : Promise<StripeBillingIntegration> {
    const billingSettings = this.getLocalSettings(false);
    await this.saveBillingSettings(billingSettings);
    const tenantId = this.tenantContext?.getTenant()?.id;
    assert(!!tenantId, 'Tenant ID cannot be null');
    billingSettings.stripe.secretKey = await Cypher.encrypt(tenantId, billingSettings.stripe.secretKey);
    const billingImpl = StripeBillingIntegration.getInstance(tenantId, billingSettings);
    assert(billingImpl, 'Billing implementation should not be null');
    return billingImpl;
  }

  public async setBillingSystemInvalidCredentials() : Promise<StripeBillingIntegration> {
    const billingSettings = this.getLocalSettings(false);
    const tenantId = this.tenantContext?.getTenant()?.id;
    assert(!!tenantId, 'Tenant ID cannot be null');
    billingSettings.stripe.secretKey = await Cypher.encrypt(tenantId, 'sk_test_' + 'invalid_credentials');
    await this.saveBillingSettings(billingSettings);
    const billingImpl = StripeBillingIntegration.getInstance(tenantId, billingSettings);
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
    // Our test needs the immediate billing to be switched off!
    // Because we want to check the DRAFT state of the invoice
    settings.billing.immediateBillingAllowed = immediateBillingAllowed;
    // -----------------------------------------------------------------
    return settings;
  }

  public async saveBillingSettings(billingSettings: BillingSettings) {
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

  public async generateTransaction(user: any): Promise<number> {
    // const user:any = this.userContext;
    const connectorId = 1;
    assert((user.tags && user.tags.length), 'User must have a valid tag');
    const tagId = user.tags[0].id;
    const meterStart = 0;
    const meterStop = 32325; // Unit: Wh
    const startDate = moment().toDate();
    const stopDate = moment(startDate).add(1, 'hour').toDate();
    const startTransactionResponse = await this.chargingStationContext.startTransaction(connectorId, tagId, meterStart, startDate);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(startTransactionResponse).to.be.transactionValid;
    const transactionId = startTransactionResponse.transactionId;
    const stopTransactionResponse = await this.chargingStationContext.stopTransaction(transactionId, tagId, meterStop, stopDate);
    expect(stopTransactionResponse).to.be.transactionStatus('Accepted');
    return transactionId;
  }

  public async checkForDraftInvoices(userId: string): Promise<number> {
    const result = await this.getDraftInvoices(userId);
    return (result?.length) ? result.length : -1;
  }

  public async getDraftInvoices(userId?: string) {
    let params;
    if (userId) {
      params = { Status: BillingInvoiceStatus.DRAFT, UserID: [this.userContext.id] };
    } else {
      params = { Status: BillingInvoiceStatus.DRAFT };
    }

    const paging = TestConstants.DEFAULT_PAGING;
    const ordering = [{ field: '-createdOn' }];
    const response = await testData.adminUserService.billingApi.readAll(params, paging, ordering, '/client/api/BillingUserInvoices');
    return response?.data?.result;
  }

  public isBillingProperlyConfigured(): boolean {
    const billingSettings = this.getLocalSettings(false);
    // Check that the mandatory settings are properly provided
    return (!!billingSettings.stripe.publicKey
      && !!billingSettings.stripe.secretKey
      && !!billingSettings.stripe.url);
  }

  public async getLatestDraftInvoice(userId?: string) {
    // ACHTUNG: There is no data after running: npm run mochatest:createContext
    // In that situation we return 0!
    const draftInvoices = await this.getDraftInvoices(userId);
    return (draftInvoices && draftInvoices.length > 0) ? draftInvoices[0] : null;
  }

  public async getNumberOfSessions(userId?: string): Promise<number> {
    // ACHTUNG: There is no data after running: npm run mochatest:createContext
    // In that situation we return 0!
    const draftInvoice = await this.getLatestDraftInvoice(userId);
    return (draftInvoice) ? draftInvoice.sessions?.length : 0;
  }
}

const testData: TestData = new TestData();

describe('Billing Service', function() {
  // Do not run the tests when the settings are not properly set
  this.pending = !testData.isBillingProperlyConfigured();
  this.timeout(1000000);

  describe('With component Billing (tenant utbilling)', () => {
    before(async () => {
      global.database = new MongoDBStorage(config.get('storage'));
      await global.database.start();
      testData.tenantContext = await ContextProvider.defaultInstance.getTenantContext(ContextDefinition.TENANT_CONTEXTS.TENANT_BILLING);
      testData.adminUserContext = testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN);
      testData.adminUserService = new CentralServerService(
        testData.tenantContext.getTenant().subdomain,
        testData.adminUserContext
      );
      expect(testData.userContext).to.not.be.null;
      testData.siteContext = testData.tenantContext.getSiteContext(ContextDefinition.SITE_CONTEXTS.SITE_WITH_OTHER_USER_STOP_AUTHORIZATION);
      testData.siteAreaContext = testData.siteContext.getSiteAreaContext(ContextDefinition.SITE_AREA_CONTEXTS.WITH_ACL);
      testData.chargingStationContext = testData.siteAreaContext.getChargingStationContext(ContextDefinition.CHARGING_STATION_CONTEXTS.ASSIGNED_OCPP16);
      // Initialize the Billing module
      testData.billingImpl = await testData.setBillingSystemValidCredentials();
    });

    describe('Where admin user (essential)', () => {
      // eslint-disable-next-line @typescript-eslint/require-await
      before(async () => {
        testData.userContext = testData.adminUserContext;
        assert(testData.userContext, 'User context cannot be null');
        testData.userService = testData.adminUserService;
        assert(!!testData.userService, 'User service cannot be null');
        // await testData.setBillingSystemValidCredentials();
      });

      it('should add an item to a DRAFT invoice after a transaction', async () => {
        await testData.userService.billingApi.forceSynchronizeUser({ id: testData.userContext.id });
        const userWithBillingData = await testData.billingImpl.getUser(testData.userContext);
        await testData.assignPaymentMethod(userWithBillingData, 'tok_fr');
        const itemsBefore = await testData.getNumberOfSessions(testData.userContext.id);
        const transactionID = await testData.generateTransaction(testData.userContext);
        assert(transactionID, 'transactionID should noy be null');
        // await testData.userService.billingApi.synchronizeInvoices({});
        const itemsAfter = await testData.getNumberOfSessions(testData.userContext.id);
        expect(itemsAfter).to.be.gt(itemsBefore);
      });

    });

    describe('Where admin user', () => {
      // eslint-disable-next-line @typescript-eslint/require-await
      before(async () => {
        testData.userContext = testData.adminUserContext;
        assert(testData.userContext, 'User context cannot be null');
        testData.userService = testData.adminUserService;
        assert(!!testData.userService, 'User service cannot be null');
        // await testData.setBillingSystemValidCredentials();
      });

      it('Should connect to Billing Provider', async () => {
        const response = await testData.userService.billingApi.testConnection({}, TestConstants.DEFAULT_PAGING, TestConstants.DEFAULT_ORDERING);
        expect(response.data.connectionIsValid).to.be.true;
        expect(response.data).containSubset(Constants.REST_RESPONSE_SUCCESS);
      });

      it('Should create/update/delete a user', async () => {
        const fakeUser = {
          ...Factory.user.build(),
        } as User;
        fakeUser.issuer = true;
        // Let's create a user
        await testData.userService.createEntity(
          testData.userService.userApi,
          fakeUser
        );
        testData.createdUsers.push(fakeUser);
        // Let's check that the corresponding billing user exists as well (a Customer in the STRIPE DB)
        let billingUser = await testData.billingImpl.getUser(fakeUser);
        if (!billingUser && !FeatureToggles.isFeatureActive(Feature.BILLING_SYNC_USER)) {
          billingUser = await testData.billingImpl.forceSynchronizeUser(fakeUser);
        }
        expect(billingUser).to.be.not.null;
        // Let's update the new user
        fakeUser.firstName = 'Test';
        fakeUser.name = 'NAME';
        fakeUser.issuer = true;
        await testData.userService.updateEntity(
          testData.userService.userApi,
          fakeUser,
          false
        );
        if (!FeatureToggles.isFeatureActive(Feature.BILLING_SYNC_USER)) {
          billingUser = await testData.billingImpl.forceSynchronizeUser(fakeUser);
        }
        // Let's check that the corresponding billing user was updated as well
        billingUser = await testData.billingImpl.getUser(fakeUser);
        expect(billingUser.name).to.be.eq(fakeUser.firstName + ' ' + fakeUser.name);
        // Let's delete the user
        await testData.userService.deleteEntity(
          testData.userService.userApi,
          { id: testData.createdUsers[0].id }
        );
        // Verify that the corresponding billing user is gone
        const exists = await testData.billingImpl.isUserSynchronized(testData.createdUsers[0]);
        expect(exists).to.be.false;
        testData.createdUsers.shift();
      });

      it('should add an item to the existing invoice after a transaction', async () => {
        await testData.userService.billingApi.forceSynchronizeUser({ id: testData.userContext.id });
        const itemsBefore = await testData.getNumberOfSessions(testData.userContext.id);
        const transactionID = await testData.generateTransaction(testData.userContext);
        expect(transactionID).to.not.be.null;
        // await testData.userService.billingApi.synchronizeInvoices({});
        const itemsAfter = await testData.getNumberOfSessions(testData.userContext.id);
        expect(itemsAfter).to.be.eq(itemsBefore + 1);
      });

      xit('should synchronize 1 invoice after a transaction', async () => {
        // Synchronize Invoices is now deprecated
        await testData.userService.billingApi.synchronizeInvoices({});
        const transactionID = await testData.generateTransaction(testData.userContext);
        expect(transactionID).to.not.be.null;
        const response = await testData.userService.billingApi.synchronizeInvoices({});
        expect(response.data).containSubset(Constants.REST_RESPONSE_SUCCESS);
        expect(response.data.inSuccess).to.be.eq(1);
      });

      it('Should list invoices', async () => {
        const response = await testData.userService.billingApi.readAll({}, TestConstants.DEFAULT_PAGING, TestConstants.DEFAULT_ORDERING, '/client/api/BillingUserInvoices');
        expect(response.status).to.be.eq(StatusCodes.OK);
        expect(response.data.result.length).to.be.gt(0);
      });

      xit('Should list filtered invoices', async () => {
        const response = await testData.userService.billingApi.readAll({ Status: BillingInvoiceStatus.OPEN }, TestConstants.DEFAULT_PAGING, TestConstants.DEFAULT_ORDERING, '/client/api/BillingUserInvoices');
        expect(response.data.result.length).to.be.gt(0);
        for (const invoice of response.data.result) {
          expect(invoice.status).to.be.eq(BillingInvoiceStatus.OPEN);
        }
      });

      it('Should synchronize invoices', async () => {
        const response = await testData.userService.billingApi.synchronizeInvoices({});
        expect(response.data).containSubset(Constants.REST_RESPONSE_SUCCESS);
      });

      xit('Should force a user synchronization', async () => {
        const fakeUser = {
          ...Factory.user.build(),
        } as User;
        fakeUser.issuer = true;
        testData.billingImpl = await testData.setBillingSystemValidCredentials();
        await testData.userService.createEntity(
          testData.userService.userApi,
          fakeUser
        );
        testData.createdUsers.push(fakeUser);
        fakeUser.billingData = {
          customerID: 'cus_utbilling_fake_user',
          liveMode: false,
          lastChangedOn: new Date(),
        }; // TODO - not supported anymore
        await testData.userService.updateEntity(
          testData.userService.userApi,
          fakeUser
        );
        await testData.userService.billingApi.forceSynchronizeUser({ id: fakeUser.id });
        const billingUserAfter = await testData.billingImpl.getUser(fakeUser);
        expect(fakeUser.billingData.customerID).to.not.be.eq(billingUserAfter.billingData.customerID);
      });
    });

    describe('Where basic user', () => {

      before(async () => {
        testData.billingImpl = await testData.setBillingSystemValidCredentials();
        testData.userContext = testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.BASIC_USER);
        assert(!!testData.userService, 'User service cannot be null');
        testData.userService = new CentralServerService(
          testData.tenantContext.getTenant().subdomain,
          testData.userContext
        );
        expect(testData.userService).to.not.be.null;
      });

      it('Should not be able to test connection to Billing Provider', async () => {
        const response = await testData.userService.billingApi.testConnection({}, TestConstants.DEFAULT_PAGING, TestConstants.DEFAULT_ORDERING);
        expect(response.status).to.be.eq(StatusCodes.FORBIDDEN);
      });

      it('Should not create a user', async () => {
        const fakeUser = {
          ...Factory.user.build(),
        } as User;

        const response = await testData.userService.createEntity(
          testData.userService.userApi,
          fakeUser,
          false
        );
        testData.createdUsers.push(fakeUser);
        expect(response.status).to.be.eq(StatusCodes.FORBIDDEN);
      });

      it('Should not update a user', async () => {
        const fakeUser = {
          id: new ObjectID(),
          ...Factory.user.build(),
        } as User;
        fakeUser.firstName = 'Test';
        fakeUser.name = 'Name';
        const response = await testData.userService.updateEntity(
          testData.userService.userApi,
          fakeUser,
          false
        );
        expect(response.status).to.be.eq(StatusCodes.FORBIDDEN);
      });

      it('Should not delete a user', async () => {
        const response = await testData.userService.deleteEntity(
          testData.userService.userApi,
          { id: 0 },
          false
        );
        expect(response.status).to.be.eq(StatusCodes.FORBIDDEN);
      });

      it('Should not synchronize a user', async () => {
        const fakeUser = {
          ...Factory.user.build(),
        } as User;
        const response = await testData.userService.billingApi.synchronizeUser({ id: fakeUser.id });
        expect(response.status).to.be.eq(StatusCodes.FORBIDDEN);
      });

      it('Should not force synchronization of a user', async () => {
        const fakeUser = {
          ...Factory.user.build(),
        } as User;
        const response = await testData.userService.billingApi.forceSynchronizeUser({ id: fakeUser.id });
        expect(response.status).to.be.eq(StatusCodes.FORBIDDEN);
      });

      xit('Should list invoices', async () => {
        const basicUser: User = testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.BASIC_USER);

        // Set back userContext to BASIC to consult invoices
        testData.userService = new CentralServerService(
          testData.tenantContext.getTenant().subdomain,
          basicUser
        );
        const response = await testData.userService.billingApi.readAll({}, TestConstants.DEFAULT_PAGING, TestConstants.DEFAULT_ORDERING, '/client/api/BillingUserInvoices');
        expect(response.data.result.length).to.be.eq(2);
      });

      it('should create an invoice after a transaction', async () => {
        const adminUser = testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN);
        const basicUser = testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.BASIC_USER);
        // Connect as Admin to Force synchronize basic user
        testData.userContext = adminUser;
        testData.userService = new CentralServerService(
          testData.tenantContext.getTenant().subdomain,
          testData.userContext
        );
        await testData.userService.billingApi.forceSynchronizeUser({ id: basicUser.id });
        // Reconnect as Basic user
        testData.userContext = basicUser;
        testData.userService = new CentralServerService(
          testData.tenantContext.getTenant().subdomain,
          testData.userContext
        );
        // await testData.userService.billingApi.synchronizeInvoices({});
        const userWithBillingData = await testData.billingImpl.getUser(testData.userContext);
        await testData.assignPaymentMethod(userWithBillingData, 'tok_fr');
        const itemsBefore = await testData.getNumberOfSessions(basicUser.id);
        const transactionID = await testData.generateTransaction(testData.userContext);
        assert(transactionID, 'transactionID should noy be null');
        // await testData.userService.billingApi.synchronizeInvoices({});
        const itemsAfter = await testData.getNumberOfSessions(basicUser.id);
        expect(itemsAfter).to.be.eq(itemsBefore + 1);
      });
    });

    describe('Negative tests as an admin user', () => {
      // eslint-disable-next-line @typescript-eslint/require-await
      before(async () => {
        testData.userContext = testData.adminUserContext;
        assert(testData.userContext, 'User context cannot be null');
        testData.userService = testData.adminUserService;
        assert(!!testData.userService, 'User service cannot be null');
        // await testData.setBillingSystemValidCredentials();
      });

      it('should not delete a transaction linked to an invoice', async () => {
        const transactionID = await testData.generateTransaction(testData.userContext);
        expect(transactionID).to.not.be.null;
        const transactionDeleted = await testData.userService.transactionApi.delete(transactionID);
        expect(transactionDeleted.data.inError).to.be.eq(1);
        expect(transactionDeleted.data.inSuccess).to.be.eq(0);
      });
    });

    describe('Recovery Scenarios', () => {
      // eslint-disable-next-line @typescript-eslint/require-await
      before(async () => {
        testData.userContext = testData.adminUserContext;
        assert(testData.userContext, 'User context cannot be null');
        testData.userService = testData.adminUserService;
        assert(!!testData.userService, 'User service cannot be null');
      });

      after(async () => {
        // Restore VALID STRIPE credentials
        testData.billingImpl = await testData.setBillingSystemValidCredentials();
      });

      it('Should recover after a synchronization issue', async () => {
        const fakeUser = {
          ...Factory.user.build(),
        } as User;
        fakeUser.issuer = true;
        testData.billingImpl = await testData.setBillingSystemInvalidCredentials();
        assert(testData.billingImpl, 'Billing implementation should not be null');
        await testData.userService.createEntity(
          testData.userService.userApi,
          fakeUser
        );
        testData.createdUsers.push(fakeUser);
        testData.billingImpl = await testData.setBillingSystemValidCredentials();
        if (FeatureToggles.isFeatureActive(Feature.BILLING_SYNC_USER)) {
          await testData.userService.billingApi.synchronizeUser({ id: fakeUser.id });
        } else {
          await testData.userService.billingApi.forceSynchronizeUser(fakeUser);
        }
        const userExists = await testData.billingImpl.isUserSynchronized(fakeUser);
        expect(userExists).to.be.true;
      });
    });

    describe('Negative tests - Invalid Credentials', () => {
      // eslint-disable-next-line @typescript-eslint/require-await
      before(async () => {
        testData.userContext = testData.adminUserContext;
        assert(testData.userContext, 'User context cannot be null');
        testData.userService = testData.adminUserService;
        assert(!!testData.userService, 'User service cannot be null');
        // Force INVALID STRIPE credentials
        testData.billingImpl = await testData.setBillingSystemInvalidCredentials();
        assert(testData.billingImpl, 'Billing implementation should not be null');
      });

      after(async () => {
        // Restore VALID STRIPE credentials
        testData.billingImpl = await testData.setBillingSystemValidCredentials();
      });

      it('Should set a transaction in error', async () => {
        const transactionID = await testData.generateTransaction(testData.userContext);
        expect(transactionID).to.not.be.null;
        const transactions = await testData.userService.transactionApi.readAllInError({});
        expect(transactions.data.result.find((transaction) => transaction.id === transactionID)).to.not.be.null;
      });

      it('Should set in error users without Billing data', async () => {
        const fakeUser = {
          ...Factory.user.build()
        } as User;
        fakeUser.issuer = true;
        // Creates user without billing data
        await testData.userService.createEntity(
          testData.userService.userApi,
          fakeUser
        );
        testData.createdUsers.push(fakeUser);
        // Check if user is in Users In Error
        const response = await testData.userService.userApi.readAllInError({ ErrorType: UserInErrorType.NO_BILLING_DATA }, {
          limit: 100,
          skip: 0
        });
        let userFound = false;
        for (const user of response.data.result) {
          if (user.id === fakeUser.id) {
            userFound = true;
            break;
          }
        }
        assert(userFound, 'User with no billing data not found in Users In Error');
      });
    });

  });

});
