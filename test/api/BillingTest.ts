import AsyncTask, { AsyncTaskStatus } from '../../src/types/AsyncTask';
import { BillingChargeInvoiceAction, BillingDataTransactionStop, BillingInvoiceStatus, BillingStatus, BillingUser } from '../../src/types/Billing';
import { BillingSettings, BillingSettingsType, SettingDB } from '../../src/types/Setting';
import FeatureToggles, { Feature } from '../../src/utils/FeatureToggles';
import chai, { assert, expect } from 'chai';

import AsyncTaskStorage from '../../src/storage/mongodb/AsyncTaskStorage';
import CentralServerService from './client/CentralServerService';
import ChargingStationContext from './context/ChargingStationContext';
import Constants from '../../src/utils/Constants';
import ContextDefinition from './context/ContextDefinition';
import ContextProvider from './context/ContextProvider';
import Cypher from '../../src/utils/Cypher';
import { DataResult } from '../types/DataResult';
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
import TestUtils from './TestUtils';
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

  public async setBillingSystemValidCredentials(activateTransactionBilling = true, immediateBillingAllowed = false) : Promise<StripeBillingIntegration> {
    const billingSettings = this.getLocalSettings(immediateBillingAllowed);
    // Here we switch ON or OFF the billing of charging sessions
    billingSettings.billing.isTransactionBillingActivated = activateTransactionBilling;
    // Invoke the generic setting service API to properly persist this information
    await this.saveBillingSettings(billingSettings);
    const tenant = this.tenantContext?.getTenant();
    assert(!!tenant, 'Tenant cannot be null');
    billingSettings.stripe.secretKey = await Cypher.encrypt(tenant.id, billingSettings.stripe.secretKey);
    const billingImpl = StripeBillingIntegration.getInstance(tenant, billingSettings);
    assert(billingImpl, 'Billing implementation should not be null');
    return billingImpl;
  }

  public async setBillingSystemInvalidCredentials() : Promise<StripeBillingIntegration> {
    const billingSettings = this.getLocalSettings(false);
    const tenant = this.tenantContext?.getTenant();
    assert(!!tenant, 'Tenant cannot be null');
    billingSettings.stripe.secretKey = await Cypher.encrypt(tenant.id, 'sk_test_' + 'invalid_credentials');
    await this.saveBillingSettings(billingSettings);
    const billingImpl = StripeBillingIntegration.getInstance(tenant, billingSettings);
    assert(billingImpl, 'Billing implementation should not be null');
    return billingImpl;
  }

  public getLocalSettings(immediateBillingAllowed: boolean): BillingSettings {
    // ---------------------------------------------------------------------
    // ACHTUNG: Our test may need the immediate billing to be switched off!
    // Because we want to check the DRAFT state of the invoice
    // ---------------------------------------------------------------------
    const billingProperties = {
      isTransactionBillingActivated: true, // config.get('billing.isTransactionBillingActivated'),
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

  public async checkTransactionBillingData(transactionId: number, expectedInvoiceStatus: BillingInvoiceStatus) {
    // Check the transaction status
    const transactionResponse = await this.adminUserService.transactionApi.readById(transactionId);
    expect(transactionResponse.status).to.equal(StatusCodes.OK);
    assert(transactionResponse.data?.billingData, 'Billing Data should be set');
    const billingDataStop: BillingDataTransactionStop = transactionResponse.data.billingData.stop;
    expect(billingDataStop?.status).to.equal(BillingStatus.BILLED);
    assert(billingDataStop?.invoiceID, 'Invoice ID should be set');
    assert(billingDataStop?.invoiceStatus === expectedInvoiceStatus, `The invoice status should be ${expectedInvoiceStatus}`);
    if (expectedInvoiceStatus !== BillingInvoiceStatus.DRAFT) {
      assert(billingDataStop?.invoiceNumber, 'Invoice Number should be set');
    } else {
      assert(billingDataStop?.invoiceNumber === null, 'Invoice Number should not yet been set');
    }
  }

  public async generateTransaction(user: any, expectedStatus = 'Accepted'): Promise<number> {
    // const user:any = this.userContext;
    const connectorId = 1;
    assert((user.tags && user.tags.length), 'User must have a valid tag');
    const tagId = user.tags[0].id;
    const meterStart = 0;
    const meterStop = 32325; // Unit: Wh
    const startDate = moment().toDate();
    const stopDate = moment(startDate).add(1, 'hour').toDate();
    const startTransactionResponse = await this.chargingStationContext.startTransaction(connectorId, tagId, meterStart, startDate);
    expect(startTransactionResponse).to.be.transactionStatus(expectedStatus);
    const transactionId = startTransactionResponse.transactionId;
    if (expectedStatus === 'Accepted') {
      const stopTransactionResponse = await this.chargingStationContext.stopTransaction(transactionId, tagId, meterStop, stopDate);
      expect(stopTransactionResponse).to.be.transactionStatus('Accepted');
    }
    // Give some time to the asyncTask to bill the transaction
    await this.waitForAsyncTasks();
    return transactionId;
  }

  public async waitForAsyncTasks() {
    let counter = 0, pending: DataResult<AsyncTask>, running: DataResult<AsyncTask>;
    while (counter++ <= 10) {
      // Get the number of pending tasks
      pending = await AsyncTaskStorage.getAsyncTasks({ status: AsyncTaskStatus.PENDING }, Constants.DB_PARAMS_COUNT_ONLY);
      running = await AsyncTaskStorage.getAsyncTasks({ status: AsyncTaskStatus.RUNNING }, Constants.DB_PARAMS_COUNT_ONLY);
      if (!pending.count && !running.count) {
        break;
      }
      // Give some time to the asyncTask to bill the transaction
      console.log(`Waiting for async tasks - pending tasks: ${pending.count} - running tasks: ${running.count}`);
      await TestUtils.sleep(1000);
    }
    if (!pending.count && !running.count) {
      console.log('Async tasks have been completed');
    } else {
      console.warn(`Gave up after more than 10 seconds - pending tasks: ${pending.count} - running tasks: ${running.count}`);
    }
  }

  public async checkForDraftInvoices(userId?: string): Promise<number> {
    const result = await this.getDraftInvoices(userId);
    return result.length;
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
    const response = await testData.adminUserService.billingApi.readInvoices(params, paging, ordering);
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

describe('Billing Settings', function() {
  // Do not run the tests when the settings are not properly set
  this.pending = !testData.isBillingProperlyConfigured();
  this.timeout(1000000);

  describe('With component Billing (utbilling)', () => {
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
    });

    describe('As an admin - with transaction billing OFF', () => {
      // eslint-disable-next-line @typescript-eslint/require-await
      before(async () => {
        testData.userContext = testData.adminUserContext;
        assert(testData.userContext, 'User context cannot be null');
        testData.userService = testData.adminUserService;
        assert(!!testData.userService, 'User service cannot be null');
        // Initialize the Billing module with transaction billing ON
        testData.billingImpl = await testData.setBillingSystemValidCredentials(false);
      });

      it('Should be able to invoke Billing Settings endpoints', async () => {
        // Get the Billing settings
        let response = await testData.userService.billingApi.getBillingSetting();
        assert(response.status === StatusCodes.OK, 'Response status should be 200');
        const billingSettings = response.data as BillingSettings ;
        assert(billingSettings.billing, 'Billing Properties should not be null');
        assert(billingSettings.type === BillingSettingsType.STRIPE, 'Billing Setting Type should not be set to STRIPE');
        assert(billingSettings.stripe, 'Stripe Properties should not be null');
        assert(billingSettings.stripe.secretKey, 'Secret Key should not be null');
        assert(billingSettings.id, 'ID should not be null');
        // Check billing connection to STRIPE
        response = await testData.userService.billingApi.checkBillingConnection();
        assert(response.status === StatusCodes.OK, 'Response status should be 200');
        assert(response.data, 'Response data should not be null');
        assert(response.data.connectionIsValid === true, 'Connection should be valid');
      });

      it('Should be able to update the secret key', async () => {
        // Get the Billing settings
        let response = await testData.userService.billingApi.getBillingSetting();
        assert(response.status === StatusCodes.OK, 'Response status should be 200');
        let billingSettings = response.data as BillingSettings ;
        assert(billingSettings.billing, 'Billing Properties should not be null');
        assert(!billingSettings.billing.isTransactionBillingActivated, 'Transaction Billing should be OFF');
        assert(billingSettings.stripe.secretKey, 'Hash of the secret key should not be null');
        const keyHash = billingSettings.stripe.secretKey;
        // Let's attempt to update the secret key
        billingSettings.stripe.secretKey = config.get('stripe.secretKey'),
        response = await testData.userService.billingApi.updateBillingSetting(billingSettings);
        assert(response.status === StatusCodes.OK, 'Response status should be 200');
        // Check that the hash is still correct
        response = await testData.userService.billingApi.getBillingSetting();
        assert(response.status === StatusCodes.OK, 'Response status should be 200');
        billingSettings = response.data as BillingSettings ;
        assert(billingSettings.billing, 'Billing Properties should not be null');
        assert(keyHash !== billingSettings.stripe.secretKey, 'Hash of the secret key should be different');
      });

      it('Should check prerequisites when switching Transaction Billing ON', async () => {
        let response = await testData.userService.billingApi.getBillingSetting();
        assert(response.status === StatusCodes.OK, 'Response status should be 200');
        const billingSettings = response.data as BillingSettings ;
        // Let's attempt to switch ON the billing of transactions
        billingSettings.billing.isTransactionBillingActivated = true;
        response = await testData.userService.billingApi.updateBillingSetting(billingSettings);
        // taxID is not set - so the prerequisites are not met
        assert(response.status !== StatusCodes.OK, 'Response status should not be 200');
        // Check again the billing connection to STRIPE
        response = await testData.userService.billingApi.checkBillingConnection();
        assert(response.status === StatusCodes.OK, 'Response status should be 200');
        assert(response.data, 'Response data should not be null');
        assert(response.data.connectionIsValid === true, 'Connection should be valid');
      });
    });

    describe('As an admin - with transaction billing ON', () => {
      // eslint-disable-next-line @typescript-eslint/require-await
      before(async () => {
        testData.userContext = testData.adminUserContext;
        assert(testData.userContext, 'User context cannot be null');
        testData.userService = testData.adminUserService;
        assert(!!testData.userService, 'User service cannot be null');
        // Initialize the Billing module with transaction billing ON
        testData.billingImpl = await testData.setBillingSystemValidCredentials();
      });

      it('Should be able to invoke Billing Settings endpoints', async () => {
        // Get the Billing settings
        let response = await testData.userService.billingApi.getBillingSetting();
        assert(response.status === StatusCodes.OK, 'Response status should be 200');
        const billingSettings = response.data as BillingSettings ;
        assert(billingSettings.billing, 'Billing Properties should not be null');
        assert(billingSettings.type === BillingSettingsType.STRIPE, 'Billing Setting Type should not be set to STRIPE');
        assert(billingSettings.stripe, 'Stripe Properties should not be null');
        assert(billingSettings.stripe.secretKey, 'Secret Key should not be null');
        assert(billingSettings.id, 'ID should not be null');
        // Check billing connection to STRIPE
        response = await testData.userService.billingApi.checkBillingConnection();
        assert(response.status === StatusCodes.OK, 'Response status should be 200');
        assert(response.data, 'Response data should not be null');
        assert(response.data.connectionIsValid === true, 'Connection should be valid');
      });

      it('Should not be able to alter the secretKey when transaction billing is ON', async () => {
        // Get the Billing settings
        let response = await testData.userService.billingApi.getBillingSetting();
        assert(response.status === StatusCodes.OK, 'Response status should be 200');
        let billingSettings = response.data as BillingSettings ;
        assert(billingSettings.billing, 'Billing Properties should not be null');
        assert(billingSettings.billing.isTransactionBillingActivated, 'Transaction Billing should be ON');
        assert(billingSettings.stripe.secretKey, 'Hash of the secret key should not be null');
        const keyHash = billingSettings.stripe.secretKey;
        // Let's attempt to alter the secret key while transaction billing is ON
        billingSettings.stripe.secretKey = '1234567890';
        response = await testData.userService.billingApi.updateBillingSetting(billingSettings);
        // Here it does not fail - but the initial secret key should have been preserved!
        assert(response.status === StatusCodes.OK, 'Response status should be 200');
        // Check that the secret key was preserved
        response = await testData.userService.billingApi.getBillingSetting();
        assert(response.status === StatusCodes.OK, 'Response status should be 200');
        billingSettings = response.data as BillingSettings ;
        assert(billingSettings.billing, 'Billing Properties should not be null');
        assert(keyHash === billingSettings.stripe.secretKey, 'Hash of the secret key should not have changed');
        // Check again the billing connection to STRIPE
        response = await testData.userService.billingApi.checkBillingConnection();
        assert(response.status === StatusCodes.OK, 'Response status should be 200');
        assert(response.data, 'Response data should not be null');
        assert(response.data.connectionIsValid === true, 'Connection should be valid');
      });

      it('Should not be able to switch the transaction billing OFF', async () => {
        // Get the Billing settings
        let response = await testData.userService.billingApi.getBillingSetting();
        assert(response.status === StatusCodes.OK, 'Response status should be 200');
        const billingSettings = response.data as BillingSettings ;
        assert(billingSettings.billing, 'Billing Properties should not be null');
        assert(billingSettings.billing.isTransactionBillingActivated, 'Transaction Billing should be ON');
        // Let's attempt to switch the transaction billing OFF
        billingSettings.billing.isTransactionBillingActivated = false;
        response = await testData.userService.billingApi.updateBillingSetting(billingSettings);
        assert(response.status === StatusCodes.METHOD_NOT_ALLOWED, 'Response status should be 405');
        // Check again the billing connection to STRIPE
        response = await testData.userService.billingApi.checkBillingConnection();
        assert(response.status === StatusCodes.OK, 'Response status should be 200');
        assert(response.data, 'Response data should not be null');
        assert(response.data.connectionIsValid === true, 'Connection should be valid');
      });
    });
  });
});

describe('Billing Service', function() {
  // Do not run the tests when the settings are not properly set
  this.pending = !testData.isBillingProperlyConfigured();
  this.timeout(1000000);

  describe('with Transaction Billing ON', () => {
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
        assert(transactionID, 'transactionID should not be null');
        // await testData.checkTransactionBillingData(transactionID); // TODO - Check not yet possible!
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
        const response = await testData.userService.billingApi.readInvoices({}, TestConstants.DEFAULT_PAGING, TestConstants.DEFAULT_ORDERING);
        expect(response.status).to.be.eq(StatusCodes.OK);
        expect(response.data.result.length).to.be.gt(0);
      });

      xit('Should list filtered invoices', async () => {
        const response = await testData.userService.billingApi.readInvoices({ Status: BillingInvoiceStatus.OPEN }, TestConstants.DEFAULT_PAGING, TestConstants.DEFAULT_ORDERING);
        expect(response.data.result.length).to.be.gt(0);
        for (const invoice of response.data.result) {
          expect(invoice.status).to.be.eq(BillingInvoiceStatus.OPEN);
        }
      });

      xit('Should synchronize invoices', async () => {
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
        testData.userService = new CentralServerService(
          testData.tenantContext.getTenant().subdomain,
          testData.userContext
        );
        assert(!!testData.userService, 'User service cannot be null');
      });

      it('Should not be able to test connection to Billing Provider', async () => {
        const response = await testData.userService.billingApi.testConnection({}, TestConstants.DEFAULT_PAGING, TestConstants.DEFAULT_ORDERING);
        expect(response.status).to.be.eq(StatusCodes.FORBIDDEN);
      });

      xit('Should not create a user', async () => {
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

      xit('Should not update a user', async () => {
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

      xit('Should not delete a user', async () => {
        const response = await testData.userService.deleteEntity(
          testData.userService.userApi,
          { id: 0 },
          false
        );
        expect(response.status).to.be.eq(StatusCodes.FORBIDDEN);
      });

      xit('Should not synchronize a user', async () => {
        const fakeUser = {
          ...Factory.user.build(),
        } as User;
        const response = await testData.userService.billingApi.synchronizeUser({ id: fakeUser.id });
        expect(response.status).to.be.eq(StatusCodes.FORBIDDEN);
      });

      xit('Should not force synchronization of a user', async () => {
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
        const response = await testData.userService.billingApi.readInvoices({}, TestConstants.DEFAULT_PAGING, TestConstants.DEFAULT_ORDERING);
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
        assert(transactionID, 'transactionID should not be null');
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

    describe('Negative tests - Wrong Billing Settings', () => {
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

      it('Should not be able to start a transaction', async () => {
        const transactionID = await testData.generateTransaction(testData.userContext, 'Invalid');
        assert(!transactionID, 'Transaction ID should not be set');
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
        if (FeatureToggles.isFeatureActive(Feature.BILLING_SYNC_USERS)) {
          assert(userFound, 'User with no billing data should be listed as a User In Error');
        } else {
          // LAZY User Sync - The billing data will be created on demand (i.e.: when entering a payment method)
          assert(!userFound, 'User with no billing data should not be listed as a User In Error');
        }
      });

    });

    describe('Negative tests', () => {
      // eslint-disable-next-line @typescript-eslint/require-await
      before(async () => {
        testData.userContext = testData.adminUserContext;
        assert(testData.userContext, 'User context cannot be null');
        testData.userService = testData.adminUserService;
        assert(!!testData.userService, 'User service cannot be null');
        // Set STRIPE credentials
        testData.billingImpl = await testData.setBillingSystemInvalidCredentials();
      });

      after(async () => {
      });

      xit('Should set a transaction in error', async () => {
        const transactionID = await testData.generateTransaction(testData.userContext);
        const transactions = await testData.userService.transactionApi.readAllInError({});
        expect(transactions.data.result.find((transaction) => transaction.id === transactionID)).to.not.be.null;
      });

    });

  });

  describe('with Transaction Billing OFF', () => {
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
      testData.billingImpl = await testData.setBillingSystemValidCredentials(false);
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

      it('should NOT add an item to a DRAFT invoice after a transaction', async () => {
        await testData.userService.billingApi.forceSynchronizeUser({ id: testData.userContext.id });
        // const userWithBillingData = await testData.billingImpl.getUser(testData.userContext);
        // await testData.assignPaymentMethod(userWithBillingData, 'tok_fr');
        const itemsBefore = await testData.getNumberOfSessions(testData.userContext.id);
        const transactionID = await testData.generateTransaction(testData.userContext);
        assert(transactionID, 'transactionID should not be null');
        // await testData.userService.billingApi.synchronizeInvoices({});
        const itemsAfter = await testData.getNumberOfSessions(testData.userContext.id);
        expect(itemsAfter).to.be.eq(itemsBefore);
      });

    });
  });


  describe('with Transaction Billing + Immediate Billing ON', () => {
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
      testData.billingImpl = await testData.setBillingSystemValidCredentials(true, true /* immediateBillingAllowed ON */);
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

      it('should create and bill an invoice after a transaction', async () => {
        await testData.userService.billingApi.forceSynchronizeUser({ id: testData.userContext.id });
        const userWithBillingData = await testData.billingImpl.getUser(testData.userContext);
        await testData.assignPaymentMethod(userWithBillingData, 'tok_fr');
        const transactionID = await testData.generateTransaction(testData.userContext);
        assert(transactionID, 'transactionID should not be null');
        // Check that we have a new invoice with an invoiceID and an invoiceNumber
        await testData.checkTransactionBillingData(transactionID, BillingInvoiceStatus.PAID);
      });

    });
  });

  describe('with Transaction Billing + Periodic Billing ON', () => {
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
      testData.billingImpl = await testData.setBillingSystemValidCredentials(true, false /* immediateBillingAllowed OFF, so periodicBilling ON */);
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

      it('should create a DRAFT invoice after a transaction', async () => {
        await testData.userService.billingApi.forceSynchronizeUser({ id: testData.userContext.id });
        const userWithBillingData = await testData.billingImpl.getUser(testData.userContext);
        await testData.assignPaymentMethod(userWithBillingData, 'tok_fr');
        const transactionID = await testData.generateTransaction(testData.userContext);
        assert(transactionID, 'transactionID should not be null');
        // Check that we have a new invoice with an invoiceID and but no invoiceNumber yet
        await testData.checkTransactionBillingData(transactionID, BillingInvoiceStatus.DRAFT);
        // Let's simulate the periodic billing operation
        const operationResult: BillingChargeInvoiceAction = await testData.billingImpl.chargeInvoices(true /* forceOperation */);
        assert(operationResult.inSuccess > 0, 'The operation should have been able to process at least one invoice');
        assert(operationResult.inError === 0, 'The operation should detect any errors');
        // The transaction should now have a different status and know the final invoice number
        await testData.checkTransactionBillingData(transactionID, BillingInvoiceStatus.PAID);
        // The user should have no DRAFT invoices
        const nbDraftInvoices = await testData.checkForDraftInvoices();
        assert(nbDraftInvoices === 0, 'The expected number of DRAFT invoices is not correct');
      });

    });
  });

});
