import { BillingSetting, BillingSettingsType, SettingDB, StripeBillingSetting } from '../../src/types/Setting';
import chai, { assert, expect } from 'chai';

import BillingIntegration from '../../src/integration/billing/BillingIntegration';
import { BillingInvoiceStatus } from '../../src/types/Billing';
import CentralServerService from './client/CentralServerService';
import ChargingStationContext from './context/ChargingStationContext';
import Constants from '../../src/utils/Constants';
import ContextDefinition from './context/ContextDefinition';
import ContextProvider from './context/ContextProvider';
import Cypher from '../../src/utils/Cypher';
import Factory from '../factories/Factory';
import { HTTPAuthError } from '../../src/types/HTTPError';
import { ObjectID } from 'mongodb';
import SiteContext from './context/SiteContext';
import StripeBillingIntegration from '../../src/integration/billing/stripe/StripeBillingIntegration';
import TenantContext from './context/TenantContext';
import TestConstants from './client/utils/TestConstants';
import User from '../../src/types/User';
import { UserInErrorType } from '../../src/types/InError';
import chaiSubset from 'chai-subset';
import config from '../config';
import moment from 'moment';
import responseHelper from '../helpers/responseHelper';

chai.use(chaiSubset);
chai.use(responseHelper);

let billingImpl: BillingIntegration<BillingSetting>;

class TestData {
  public tenantContext: TenantContext;
  public centralUserContext: any;
  public centralUserService: CentralServerService;
  public userContext: User;
  public userService: CentralServerService;
  public siteContext: SiteContext;
  public siteAreaContext: any;
  public chargingStationContext: ChargingStationContext;
  public transactionUserService: CentralServerService;
  public createdUsers: User[] = [];
  public isForcedSynchro: boolean;
  public pending = false;

  public static async setBillingSystemValidCredentials(testData) {
    const stripeSettings = TestData.getStripeSettings();
    await TestData.saveBillingSettings(testData, stripeSettings);
    stripeSettings.secretKey = Cypher.encrypt(stripeSettings.secretKey);
    billingImpl = new StripeBillingIntegration(testData.tenantContext.getTenant().id, stripeSettings);
    expect(billingImpl).to.not.be.null;
  }

  public static async setBillingSystemInvalidCredentials(testData) {
    const stripeSettings = TestData.getStripeSettings();
    stripeSettings.secretKey = Cypher.encrypt('sk_test_invalid_credentials');
    await TestData.saveBillingSettings(testData, stripeSettings);
    billingImpl = new StripeBillingIntegration(testData.tenantContext.getTenant().id, stripeSettings);
    expect(billingImpl).to.not.be.null;
  }

  public static getStripeSettings(): StripeBillingSetting {
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

  public static async saveBillingSettings(testData, stripeSettings: StripeBillingSetting) {
    const tenantBillingSettings = await testData.userService.settingApi.readAll({ 'Identifier': 'billing' });
    expect(tenantBillingSettings.data.count).to.be.eq(1);
    const componentSetting: SettingDB = tenantBillingSettings.data.result[0];
    componentSetting.content.type = BillingSettingsType.STRIPE;
    componentSetting.content.stripe = stripeSettings;
    componentSetting.sensitiveData = ['content.stripe.secretKey'];
    await testData.userService.settingApi.update(componentSetting);
  }
}


async function generateTransaction(user, chargingStationContext): Promise<number> {
  const connectorId = 1;
  const tagId = user.tags[0].id;
  const meterStart = 0;
  const meterStop = 1000;
  const startDate = moment().toDate();
  const stopDate = moment(startDate).add(1, 'hour');
  const startTransactionResponse = await chargingStationContext.startTransaction(connectorId, tagId, meterStart, startDate);
  // eslint-disable-next-line @typescript-eslint/unbound-method
  expect(startTransactionResponse).to.be.transactionValid;
  const transactionId1 = startTransactionResponse.transactionId as number;
  const stopTransactionResponse = await chargingStationContext.stopTransaction(transactionId1, tagId, meterStop, stopDate);
  expect(stopTransactionResponse).to.be.transactionStatus('Accepted');
  return transactionId1;
}

const testData: TestData = new TestData();
const billingSettings = TestData.getStripeSettings();
for (const key of Object.keys(billingSettings)) {
  if (!billingSettings[key] || billingSettings[key] === '') {
    testData.pending = true;
  }
}

describe('Billing Service', function() {
  this.pending = testData.pending;
  this.timeout(1000000);
  describe('With component Billing (tenant utbilling)', () => {
    before(async () => {
      testData.tenantContext = await ContextProvider.defaultInstance.getTenantContext(ContextDefinition.TENANT_CONTEXTS.TENANT_BILLING);
      testData.centralUserContext = testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN);
      testData.userContext = testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN);
      expect(testData.userContext).to.not.be.null;
      testData.centralUserService = new CentralServerService(
        testData.tenantContext.getTenant().subdomain,
        testData.centralUserContext
      );
      testData.isForcedSynchro = false;
      testData.siteContext = testData.tenantContext.getSiteContext(ContextDefinition.SITE_CONTEXTS.SITE_WITH_OTHER_USER_STOP_AUTHORIZATION);
      testData.siteAreaContext = testData.siteContext.getSiteAreaContext(ContextDefinition.SITE_AREA_CONTEXTS.WITH_ACL);
      testData.chargingStationContext = testData.siteAreaContext.getChargingStationContext(ContextDefinition.CHARGING_STATION_CONTEXTS.ASSIGNED_OCPP16);
      testData.transactionUserService = new CentralServerService(
        testData.tenantContext.getTenant().subdomain, testData.userContext);
    });

    describe('Where admin user', () => {
      before(async () => {
        testData.userContext = testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN);
        assert(testData.userContext, 'User context cannot be null');
        if (testData.userContext === testData.centralUserContext) {
          // Reuse the central user service (to avoid double login)
          testData.userService = testData.centralUserService;
        } else {
          testData.userService = new CentralServerService(
            testData.tenantContext.getTenant().subdomain,
            testData.userContext
          );
        }
        assert(!!testData.userService, 'User service cannot be null');
        const tenant = testData.tenantContext.getTenant();
        if (tenant.id) {
          await TestData.setBillingSystemValidCredentials(testData);
        } else {
          throw new Error(`Unable to get Tenant ID for tenant : ${ContextDefinition.TENANT_CONTEXTS.TENANT_BILLING}`);
        }
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

        const exists = await billingImpl.userExists(fakeUser);
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
        const billingUser = await billingImpl.getUserByEmail(fakeUser.email);
        expect(billingUser.name).to.be.eq(fakeUser.firstName + ' ' + fakeUser.name);
      });

      it('Should delete a user', async () => {
        await testData.userService.deleteEntity(
          testData.userService.userApi,
          { id: testData.createdUsers[0].id }
        );

        const exists = await billingImpl.userExists(testData.createdUsers[0]);
        expect(exists).to.be.false;
        testData.createdUsers.shift();
      });

      it('Should synchronize a new user', async () => {
        const fakeUser = {
          ...Factory.user.build(),
        } as User;
        fakeUser.issuer = true;
        await TestData.setBillingSystemInvalidCredentials(testData);
        await testData.userService.createEntity(
          testData.userService.userApi,
          fakeUser
        );
        testData.createdUsers.push(fakeUser);
        await TestData.setBillingSystemValidCredentials(testData);
        await testData.userService.billingApi.synchronizeUser({ id: fakeUser.id });
        const userExists = await billingImpl.userExists(fakeUser);
        expect(userExists).to.be.true;
      });

      it('Should set in error users without Billing data', async () => {
        const fakeUser = {
          ...Factory.user.build()
        } as User;
        fakeUser.issuer = true;
        await TestData.setBillingSystemInvalidCredentials(testData);
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
        await TestData.setBillingSystemValidCredentials(testData);
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
        const billingUserAfter = await billingImpl.getUserByEmail(fakeUser.email);
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
        await generateTransaction(testData.userContext, testData.chargingStationContext);
        await testData.userService.billingApi.synchronizeInvoices({});
        response = await testData.userService.billingApi.readAll({ Status: BillingInvoiceStatus.DRAFT, UserID: [testData.userContext.id] }, TestConstants.DEFAULT_PAGING, [{ field: 'createdOn', direction: 'desc' }], '/client/api/BillingUserInvoices');
        const itemsAfter = response.data.result[0].nbrOfItems;
        expect(itemsAfter).to.be.eq(itemsBefore + 1);
      });

      it('should synchronize 1 invoice after a transaction', async () => {
        await testData.userService.billingApi.synchronizeInvoices({});
        await generateTransaction(testData.userContext, testData.chargingStationContext);
        const response = await testData.userService.billingApi.synchronizeInvoices({});
        expect(response.data).containSubset(Constants.REST_RESPONSE_SUCCESS);
        expect(response.data.inSuccess).to.be.eq(1);
      });

      it('should not delete a transaction linked to an invoice', async () => {
        const transactionID = await generateTransaction(testData.userContext, testData.chargingStationContext);
        const transactionDeleted = await testData.transactionUserService.transactionApi.delete(transactionID);
        expect(transactionDeleted.data.inError).to.be.eq(1);
        expect(transactionDeleted.data.inSuccess).to.be.eq(0);
      });

      it('Should set a transaction in error', async () => {
        await TestData.setBillingSystemInvalidCredentials(testData);
        const transactionID = await generateTransaction(testData.userContext, testData.chargingStationContext);
        expect(transactionID).to.not.be.null;
        const transactions = await testData.transactionUserService.transactionApi.readAllInError({});
        expect(transactions.data.result.find((transaction) => transaction.id === transactionID)).to.not.be.null;
      });
    });

    describe('Where basic user', () => {
      before(async () => {
        testData.tenantContext = await ContextProvider.defaultInstance.getTenantContext(ContextDefinition.TENANT_CONTEXTS.TENANT_BILLING);
        testData.centralUserContext = testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.BASIC_USER);

        testData.userContext = testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN);
        assert(testData.userContext, 'User context cannot be null');
        if (testData.userContext === testData.centralUserContext) {
          // Reuse the central user service (to avoid double login)
          testData.userService = testData.centralUserService;
        } else {
          testData.userService = new CentralServerService(
            testData.tenantContext.getTenant().subdomain,
            testData.userContext
          );
        }
        assert(!!testData.userService, 'User service cannot be null');
        const tenant = testData.tenantContext.getTenant();
        if (tenant.id) {
          await TestData.setBillingSystemValidCredentials(testData);
        } else {
          throw new Error(`Unable to get Tenant ID for tenant : ${ContextDefinition.TENANT_CONTEXTS.TENANT_BILLING}`);
        }

        testData.userContext = testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.BASIC_USER);
        expect(testData.userContext).to.not.be.null;
        testData.centralUserService = new CentralServerService(
          testData.tenantContext.getTenant().subdomain,
          testData.centralUserContext
        );
        if (testData.userContext === testData.centralUserContext) {
          // Reuse the central user service (to avoid double login)
          testData.userService = testData.centralUserService;
        } else {
          testData.userService = new CentralServerService(
            testData.tenantContext.getTenant().subdomain,
            testData.userContext
          );
        }
        expect(testData.userService).to.not.be.null;
      });

      it('Should not be able to test connection to Billing Provider', async () => {
        const response = await testData.userService.billingApi.testConnection({}, TestConstants.DEFAULT_PAGING, TestConstants.DEFAULT_ORDERING);
        expect(response.status).to.be.eq(HTTPAuthError.ERROR);
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
        expect(response.status).to.be.eq(HTTPAuthError.ERROR);
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
        expect(response.status).to.be.eq(HTTPAuthError.ERROR);
      });

      it('Should not delete a user', async () => {
        const response = await testData.userService.deleteEntity(
          testData.userService.userApi,
          { id: 0 },
          false
        );
        expect(response.status).to.be.eq(HTTPAuthError.ERROR);
      });

      it('Should not synchronize a user', async () => {
        const fakeUser = {
          ...Factory.user.build(),
        } as User;
        const response = await testData.userService.billingApi.synchronizeUser({ id: fakeUser.id });
        expect(response.status).to.be.eq(HTTPAuthError.ERROR);
      });

      it('Should not force synchronization of a user', async () => {
        const fakeUser = {
          ...Factory.user.build(),
        } as User;
        const response = await testData.userService.billingApi.forceSynchronizeUser({ id: fakeUser.id });
        expect(response.status).to.be.eq(HTTPAuthError.ERROR);
      });

      it('Should list invoices', async () => {
        const basicUser: User = testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.BASIC_USER);

        // Set back userContext to BASIC to consult invoices
        testData.userService = new CentralServerService(
          testData.tenantContext.getTenant().subdomain,
          basicUser
        );
        const response = await testData.userService.billingApi.readAll({}, TestConstants.DEFAULT_PAGING, TestConstants.DEFAULT_ORDERING, '/client/api/BillingUserInvoices');
        for (let i = 0; i < response.data.result.length - 1; i++) {
          expect(response.data.result[i].user.id).to.be.eq(basicUser.id);
        }
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
        await generateTransaction(testData.userContext, testData.chargingStationContext);
        await testData.userService.billingApi.synchronizeInvoices({});
        response = await testData.userService.billingApi.readAll({ Status: BillingInvoiceStatus.DRAFT }, TestConstants.DEFAULT_PAGING, [{ field: 'createdOn', direction: 'desc' }], '/client/api/BillingUserInvoices');
        const itemsAfter = response.data.result[0].nbrOfItems;
        expect(itemsAfter).to.be.eq(itemsBefore + 1);
      });
    });
  });

  after(async () => {
    await TestData.setBillingSystemValidCredentials(testData);
  });
});
