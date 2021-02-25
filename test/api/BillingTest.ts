import { BillingInvoice, BillingInvoiceItem, BillingInvoiceStatus, BillingUser } from '../../src/types/Billing';
import { BillingSetting, BillingSettingsType, SettingDB, StripeBillingSetting } from '../../src/types/Setting';
import chai, { assert, expect } from 'chai';

import BillingIntegration from '../../src/integration/billing/BillingIntegration';
import BillingStorage from '../../src/storage/mongodb/BillingStorage';
import CentralServerService from './client/CentralServerService';
import ChargingStationContext from './context/ChargingStationContext';
import Constants from '../../src/utils/Constants';
import ContextDefinition from './context/ContextDefinition';
import ContextProvider from './context/ContextProvider';
import Cypher from '../../src/utils/Cypher';
import Factory from '../factories/Factory';
import { HTTPAuthError } from '../../src/types/HTTPError';
import MongoDBStorage from '../../src/storage/mongodb/MongoDBStorage';
import { ObjectID } from 'mongodb';
import SiteContext from './context/SiteContext';
import StripeBillingIntegration from '../../src/integration/billing/stripe/StripeBillingIntegration';
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
  public dynamicUser: User;
  // Billing Implementation - STRIPE?
  public billingImpl: BillingIntegration<BillingSetting>;
  public billingUser: BillingUser; // DO NOT CONFUSE - BillingUser is not a User!

  public async setBillingSystemValidCredentials() : Promise<StripeBillingIntegration> {
    const stripeSettings = this.getStripeSettings();
    await this.saveBillingSettings(stripeSettings);
    const tenantId = this.tenantContext?.getTenant()?.id;
    assert(!!tenantId, 'Tenant ID cannot be null');
    stripeSettings.secretKey = await Cypher.encrypt(tenantId, stripeSettings.secretKey);
    const billingImpl = new StripeBillingIntegration(tenantId, stripeSettings);
    expect(this.billingImpl).to.not.be.null;
    return billingImpl;
  }

  public async setBillingSystemInvalidCredentials() : Promise<StripeBillingIntegration> {
    const stripeSettings = this.getStripeSettings();
    const tenantId = this.tenantContext?.getTenant()?.id;
    assert(!!tenantId, 'Tenant ID cannot be null');
    stripeSettings.secretKey = await Cypher.encrypt(tenantId, 'sk_test_' + 'invalid_credentials');
    await this.saveBillingSettings(stripeSettings);
    const billingImpl = new StripeBillingIntegration(tenantId, stripeSettings);
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

  public async saveBillingSettings(stripeSettings: StripeBillingSetting) {
    const tenantBillingSettings = await this.adminUserService.settingApi.readAll({ 'Identifier': 'billing' });
    expect(tenantBillingSettings.data.count).to.be.eq(1);
    const componentSetting: SettingDB = tenantBillingSettings.data.result[0];
    componentSetting.content.type = BillingSettingsType.STRIPE;
    componentSetting.content.stripe = stripeSettings;
    componentSetting.sensitiveData = ['content.stripe.secretKey'];
    await this.adminUserService.settingApi.update(componentSetting);
  }

  public async generateTransaction(user: any): Promise<number> {
    // const user:any = this.userContext;
    const connectorId = 1;
    assert((user.tags && user.tags.length), 'User must have a valid tag');
    const tagId = user.tags[0].id;
    const meterStart = 0;
    const meterStop = 1000;
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

  public async getDraftInvoices(userId: string) {
    const params = { Status: BillingInvoiceStatus.DRAFT, UserID: [userId] };
    const paging = TestConstants.DEFAULT_PAGING;
    const ordering = [{ field: 'createdOn', direction: 'desc' }];
    const response = await testData.adminUserService.billingApi.readAll(params, paging, ordering, '/client/api/BillingUserInvoices');
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
      // Create a new user for testing stripe scenarios - BILING-TEST
      testData.dynamicUser = {
        ...Factory.user.build(),
        name: 'BILLING-TEST',
        firstName: 'Billing Integration Tests',
        issuer: true
      } as User;
      await testData.adminUserService.createEntity(
        testData.adminUserService.userApi,
        testData.dynamicUser
      );
      // testData.createdUsers.push(testData.dynamicUser);
      testData.billingImpl = await testData.setBillingSystemValidCredentials();
      await testData.adminUserService.billingApi.forceSynchronizeUser({ id: testData.dynamicUser.id });
      testData.billingUser = await testData.billingImpl.getUserByEmail(testData.dynamicUser.email);
      expect(testData.billingUser, 'Billing user should not ber null');

      // await testData.setBillingSystemValidCredentials();
      // assert(!!testData.billingImpl, 'Billing service cannot be null');
      // const exists = await testData.billingImpl.userExists(testData.dynamicUser);
      // expect(exists).to.be.true;
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

      it('Should create a user', async () => {
        const fakeUser = {
          ...Factory.user.build(),
        } as User;
        fakeUser.issuer = true;
        await testData.userService.createEntity(
          testData.userService.userApi,
          fakeUser
        );
        testData.createdUsers.push(fakeUser);

        const exists = await testData.billingImpl.userExists(fakeUser);
        expect(exists).to.be.true;
      });

      it('Should update a user', async () => {
        const fakeUser = {
          ...Factory.user.build(),
        } as User;
        fakeUser.issuer = true;
        await testData.userService.createEntity(
          testData.userService.userApi,
          fakeUser
        );
        fakeUser.firstName = 'Test';
        fakeUser.name = 'NAME';
        fakeUser.issuer = true;
        await testData.userService.updateEntity(
          testData.userService.userApi,
          fakeUser,
          false
        );
        testData.createdUsers.push(fakeUser);
        const billingUser = await testData.billingImpl.getUserByEmail(fakeUser.email);
        expect(billingUser.name).to.be.eq(fakeUser.firstName + ' ' + fakeUser.name);
      });

      it('Should delete a user', async () => {
        await testData.userService.deleteEntity(
          testData.userService.userApi,
          { id: testData.createdUsers[0].id }
        );

        const exists = await testData.billingImpl.userExists(testData.createdUsers[0]);
        expect(exists).to.be.false;
        testData.createdUsers.shift();
      });

      it('Should synchronize a new user', async () => {
        const fakeUser = {
          ...Factory.user.build(),
        } as User;
        fakeUser.issuer = true;
        testData.billingImpl = await testData.setBillingSystemInvalidCredentials();
        await testData.userService.createEntity(
          testData.userService.userApi,
          fakeUser
        );
        testData.createdUsers.push(fakeUser);
        testData.billingImpl = await testData.setBillingSystemValidCredentials();
        await testData.userService.billingApi.synchronizeUser({ id: fakeUser.id });
        const userExists = await testData.billingImpl.userExists(fakeUser);
        expect(userExists).to.be.true;
      });

      it('Should set in error users without Billing data', async () => {
        const fakeUser = {
          ...Factory.user.build()
        } as User;
        fakeUser.issuer = true;
        testData.billingImpl = await testData.setBillingSystemInvalidCredentials();
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

      it('Should force a user synchronization', async () => {
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
        fakeUser.billingData = { customerID: 'cus_test' };
        await testData.userService.updateEntity(
          testData.userService.userApi,
          fakeUser
        );
        await testData.userService.billingApi.forceSynchronizeUser({ id: fakeUser.id });
        const billingUserAfter = await testData.billingImpl.getUserByEmail(fakeUser.email);
        expect(fakeUser.billingData.customerID).to.not.be.eq(billingUserAfter.billingData.customerID);
      });

      it('Should list invoices', async () => {
        const response = await testData.userService.billingApi.readAll({}, TestConstants.DEFAULT_PAGING, TestConstants.DEFAULT_ORDERING, '/client/api/BillingUserInvoices');
        expect(response.status).to.be.eq(200);
        expect(response.data.result.length).to.be.gt(0);
      });

      it('Should list filtered invoices', async () => {
        const response = await testData.userService.billingApi.readAll({ Status: BillingInvoiceStatus.OPEN }, TestConstants.DEFAULT_PAGING, TestConstants.DEFAULT_ORDERING, '/client/api/BillingUserInvoices');
        expect(response.data.result.length).to.be.gt(0);
        for (const invoice of response.data.result) {
          expect(invoice.status).to.be.eq(BillingInvoiceStatus.OPEN);
        }
      });

      it('Should download invoice as PDF', async () => {
        const response = await testData.userService.billingApi.readAll({ Status: BillingInvoiceStatus.OPEN }, TestConstants.DEFAULT_PAGING, TestConstants.DEFAULT_ORDERING, '/client/api/BillingUserInvoices');
        expect(response.data.result.length).to.be.gt(0);
        const downloadResponse = await testData.userService.billingApi.downloadInvoiceDocument({ ID: response.data.result[0].id });
        expect(downloadResponse.headers['content-type']).to.be.eq('application/pdf');
      });

      it('Should synchronize invoices', async () => {
        const response = await testData.userService.billingApi.synchronizeInvoices({});
        expect(response.data).containSubset(Constants.REST_RESPONSE_SUCCESS);
      });

      it('should add an item to the existing invoice after a transaction', async () => {
        await testData.userService.billingApi.forceSynchronizeUser({ id: testData.userContext.id });
        let response = await testData.userService.billingApi.readAll({ Status: BillingInvoiceStatus.DRAFT, UserID: [testData.userContext.id] }, TestConstants.DEFAULT_PAGING, [{ field: 'createdOn', direction: 'desc' }], '/client/api/BillingUserInvoices');
        const itemsBefore: number = response.data.result[0].nbrOfItems;
        const transactionID = await testData.generateTransaction(testData.userContext);
        expect(transactionID).to.not.be.null;
        await testData.userService.billingApi.synchronizeInvoices({});
        response = await testData.userService.billingApi.readAll({ Status: BillingInvoiceStatus.DRAFT, UserID: [testData.userContext.id] }, TestConstants.DEFAULT_PAGING, [{ field: 'createdOn', direction: 'desc' }], '/client/api/BillingUserInvoices');
        const itemsAfter = response.data.result[0].nbrOfItems;
        expect(itemsAfter).to.be.eq(itemsBefore + 1);
      });

      it('should synchronize 1 invoice after a transaction', async () => {
        await testData.userService.billingApi.synchronizeInvoices({});
        const transactionID = await testData.generateTransaction(testData.userContext);
        expect(transactionID).to.not.be.null;
        const response = await testData.userService.billingApi.synchronizeInvoices({});
        expect(response.data).containSubset(Constants.REST_RESPONSE_SUCCESS);
        expect(response.data.inSuccess).to.be.eq(1);
      });

      it('should not delete a transaction linked to an invoice', async () => {
        const transactionID = await testData.generateTransaction(testData.userContext);
        expect(transactionID).to.not.be.null;
        const transactionDeleted = await testData.userService.transactionApi.delete(transactionID);
        expect(transactionDeleted.data.inError).to.be.eq(1);
        expect(transactionDeleted.data.inSuccess).to.be.eq(0);
      });

      it('Should set a transaction in error', async () => {
        testData.billingImpl = await testData.setBillingSystemInvalidCredentials();
        const transactionID = await testData.generateTransaction(testData.userContext);
        expect(transactionID).to.not.be.null;
        const transactions = await testData.userService.transactionApi.readAllInError({});
        expect(transactions.data.result.find((transaction) => transaction.id === transactionID)).to.not.be.null;
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
        expect(response.status).to.be.eq(HTTPAuthError.FORBIDDEN);
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
        expect(response.status).to.be.eq(HTTPAuthError.FORBIDDEN);
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
        expect(response.status).to.be.eq(HTTPAuthError.FORBIDDEN);
      });

      it('Should not delete a user', async () => {
        const response = await testData.userService.deleteEntity(
          testData.userService.userApi,
          { id: 0 },
          false
        );
        expect(response.status).to.be.eq(HTTPAuthError.FORBIDDEN);
      });

      it('Should not synchronize a user', async () => {
        const fakeUser = {
          ...Factory.user.build(),
        } as User;
        const response = await testData.userService.billingApi.synchronizeUser({ id: fakeUser.id });
        expect(response.status).to.be.eq(HTTPAuthError.FORBIDDEN);
      });

      it('Should not force synchronization of a user', async () => {
        const fakeUser = {
          ...Factory.user.build(),
        } as User;
        const response = await testData.userService.billingApi.forceSynchronizeUser({ id: fakeUser.id });
        expect(response.status).to.be.eq(HTTPAuthError.FORBIDDEN);
      });

      it('Should list invoices', async () => {
        const basicUser: User = testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.BASIC_USER);

        // Set back userContext to BASIC to consult invoices
        testData.userService = new CentralServerService(
          testData.tenantContext.getTenant().subdomain,
          basicUser
        );
        const response = await testData.userService.billingApi.readAll({}, TestConstants.DEFAULT_PAGING, TestConstants.DEFAULT_ORDERING, '/client/api/BillingUserInvoices');
        expect(response.data.result.length).to.be.eq(2);
      });

      it('Should list filtered invoices', async () => {
        const response = await testData.userService.billingApi.readAll({ Status: BillingInvoiceStatus.OPEN }, TestConstants.DEFAULT_PAGING, TestConstants.DEFAULT_ORDERING, '/client/api/BillingUserInvoices');
        for (const invoice of response.data.result) {
          expect(invoice.status).to.be.eq(BillingInvoiceStatus.OPEN);
        }
      });

      it('Should download invoice as PDF', async () => {
        const response = await testData.userService.billingApi.readAll({ Status: BillingInvoiceStatus.OPEN }, TestConstants.DEFAULT_PAGING, TestConstants.DEFAULT_ORDERING, '/client/api/BillingUserInvoices');
        expect(response.data.result.length).to.be.gt(0);
        const downloadResponse = await testData.userService.billingApi.downloadInvoiceDocument({ ID: response.data.result[0].id });
        expect(downloadResponse.headers['content-type']).to.be.eq('application/pdf');
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
        await testData.userService.billingApi.synchronizeInvoices({});
        let response = await testData.userService.billingApi.readAll({ Status: BillingInvoiceStatus.DRAFT }, TestConstants.DEFAULT_PAGING, [{ field: 'createdOn', direction: 'desc' }], '/client/api/BillingUserInvoices');
        const itemsBefore: number = response.data.result[0].nbrOfItems;
        const transactionID = await testData.generateTransaction(testData.userContext);
        expect(transactionID).to.not.be.null;
        await testData.userService.billingApi.synchronizeInvoices({});
        response = await testData.userService.billingApi.readAll({ Status: BillingInvoiceStatus.DRAFT }, TestConstants.DEFAULT_PAGING, [{ field: 'createdOn', direction: 'desc' }], '/client/api/BillingUserInvoices');
        const itemsAfter = response.data.result[0].nbrOfItems;
        expect(itemsAfter).to.be.eq(itemsBefore + 1);
      });
    });

  });

});
