import chai, { expect } from 'chai';
import Billing from '../../src/integration/billing/Billing';
import CONTEXTS from './contextProvider/ContextConstants';
import CentralServerService from './client/CentralServerService';
import { default as ClientConstants } from './client/utils/Constants';
import Constants from '../../src/utils/Constants';
import ContextProvider from './contextProvider/ContextProvider';
import Cypher from '../../src/utils/Cypher';
import Factory from '../factories/Factory';
import SiteContext from './contextProvider/SiteContext';
import StripeBilling from '../../src/integration/billing/stripe/StripeBilling';
import { BillingSetting, StripeBillingSettings } from '../../src/types/Setting';
import TenantContext from './contextProvider/TenantContext';
import User from '../../src/types/User';
import chaiSubset from 'chai-subset';
import config from '../config';
import UserStorage from "../../src/storage/mongodb/UserStorage";

chai.use(chaiSubset);

const billingSettings = {
  url: config.get('billing.url'),
  publicKey: config.get('billing.publicKey'),
  secretKey: config.get('billing.secretKey'),
  noCardAllowed: config.get('billing.noCardAllowed'),
  advanceBillingAllowed: config.get('billing.advanceBillingAllowed'),
  currency: config.get('billing.currency'),
  immediateBillingAllowed: config.get('billing.immediateBillingAllowed'),
  periodicBillingAllowed: config.get('billing.periodicBillingAllowed')
} as StripeBillingSettings;

let billingImpl: Billing<BillingSetting>;

class TestData {
  public tenantContext: TenantContext;
  public centralUserContext: any;
  public centralUserService: CentralServerService;
  public userContext: any;
  public userService: CentralServerService;
  public siteContext: SiteContext;
  public createdUsers: User[] = [];
}

const testData: TestData = new TestData();

describe('Billing Service', function() {
  this.timeout(1000000);

  describe('With admin user', () => {
    before(async () => {
      testData.tenantContext = await ContextProvider.DefaultInstance.getTenantContext(CONTEXTS.TENANT_CONTEXTS.TENANT_BILLING);
      testData.centralUserContext = testData.tenantContext.getUserContext(CONTEXTS.USER_CONTEXTS.DEFAULT_ADMIN);
      testData.userContext = testData.tenantContext.getUserContext(CONTEXTS.USER_CONTEXTS.DEFAULT_ADMIN);
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
      const tenant = testData.tenantContext.getTenant();
      if (tenant.id) {
        const tenantBillingSettings = await testData.userService.settingApi.readAll({ 'Identifier': 'billing' });
        expect(tenantBillingSettings.data.count).to.be.eq(1);
        const componentSetting = tenantBillingSettings.data.result[0];
        componentSetting.content.stripe = { ...billingSettings };
        componentSetting.sensitiveData = ['content.stripe.secretKey'];
        await testData.userService.settingApi.update(componentSetting);

        billingSettings.secretKey = Cypher.encrypt(billingSettings.secretKey);
        billingImpl = new StripeBilling(tenant.id, billingSettings);
        expect(billingImpl).to.not.be.null;
      } else {
        throw new Error(`Unable to get Tenant ID for tenant : ${CONTEXTS.TENANT_CONTEXTS.TENANT_BILLING}`);
      }
    });

    it('Should successfully test connection to Billing Provider', async () => {
      const response = await testData.userService.billingApi.testConnection({}, ClientConstants.DEFAULT_PAGING, ClientConstants.DEFAULT_ORDERING);
      expect(response.data).containSubset({ connectionIsValid: true });
      expect(response.data).containSubset(Constants.REST_RESPONSE_SUCCESS);
    });

    it('Should create a user', async () => {
      const fakeUser = {
        ...Factory.user.build(),
        billingData: {
          method: 'immediate'
        }
      } as User;

      const usersBefore = await billingImpl.getUsers();
      expect(usersBefore).to.not.be.null;

      await testData.userService.createEntity(
        testData.userService.userApi,
        fakeUser
      );
      testData.createdUsers.push(fakeUser);

      const usersAfter = await billingImpl.getUsers();
      expect(usersAfter.length).to.be.eq(usersBefore.length + 1);
    });

    it('Should delete a user', async () => {
      const usersBefore = await billingImpl.getUsers();
      expect(usersBefore).to.not.be.null;

      await testData.userService.deleteEntity(
        testData.userService.userApi,
        { id: testData.createdUsers[0].id }
      );
      testData.createdUsers.pop();

      const usersAfter = await billingImpl.getUsers();
      expect(usersAfter.length).to.be.eq(usersBefore.length - 1);
    });

    it('Should synchronize a new user with old billing data', async () => {
      const fakeUser = {
        ...Factory.user.build(),
      } as User;

      const usersInBillingBeforeCreate = await billingImpl.getUsers();
      // Create user in e-Mobility + Billing provider
      const createdUser = await testData.userService.createEntity(
        testData.userService.userApi,
        fakeUser
      );
      const usersInBillingAfterCreate = await billingImpl.getUsers();
      expect(usersInBillingAfterCreate.length).to.be.eq(usersInBillingBeforeCreate.length + 1);

      const userID = createdUser.id;
      const userResponse = await testData.userService.getEntityById(
        testData.userService.userApi,
        { id: userID }
      );

      // Delete user only from Billing provider
      await billingImpl.deleteUser(userResponse);
      const usersInBillingAfterDelete = await billingImpl.getUsers();
      expect(usersInBillingAfterDelete.length).to.be.eq(usersInBillingAfterCreate.length - 1);

      // Synchronize e-Mobility users with Billing provider
      await testData.userService.billingApi.synchronizeUsers(); // Can be very slow
      const usersInBillingAfterSynchronize = await billingImpl.getUsers();
      expect(usersInBillingAfterSynchronize.length).to.be.eq(usersInBillingAfterDelete.length + 1);
    });

    describe('With basic user', () => {
      before(async () => {
        testData.tenantContext = await ContextProvider.DefaultInstance.getTenantContext(CONTEXTS.TENANT_CONTEXTS.TENANT_BILLING);
        testData.centralUserContext = testData.tenantContext.getUserContext(CONTEXTS.USER_CONTEXTS.BASIC_USER);
        testData.userContext = testData.tenantContext.getUserContext(CONTEXTS.USER_CONTEXTS.BASIC_USER);
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
        const tenant = testData.tenantContext.getTenant();
        if (tenant.id) {
          const tenantBillingSettings = await testData.userService.settingApi.readAll({ 'Identifier': 'billing' });
          expect(tenantBillingSettings.data.count).to.be.eq(1);
          const componentSetting = tenantBillingSettings.data.result[0];
          componentSetting.content.stripe = { ...billingSettings };
          componentSetting.sensitiveData = ['content.stripe.secretKey'];
          await testData.userService.settingApi.update(componentSetting);

          billingSettings.secretKey = Cypher.encrypt(billingSettings.secretKey);
          billingImpl = new StripeBilling(tenant.id, billingSettings);
          expect(billingImpl).to.not.be.null;
        } else {
          throw new Error(`Unable to get Tenant ID for tenant : ${CONTEXTS.TENANT_CONTEXTS.TENANT_BILLING}`);
        }
      });

      it('Should not be able to test connection to Billing Provider', async () => {
        const response = await testData.userService.billingApi.testConnection({}, ClientConstants.DEFAULT_PAGING, ClientConstants.DEFAULT_ORDERING);
        expect(response.status).to.be.eq(Constants.HTTP_AUTH_ERROR);
      });

      it('Should not be able to create a user', async () => {
        const fakeUser = {
          ...Factory.user.build(),
          billingData: {
            method: 'immediate'
          }
        } as User;

        const usersBefore = await billingImpl.getUsers();
        expect(usersBefore).to.not.be.null;

        const response = await testData.userService.createEntity(
          testData.userService.userApi,
          fakeUser,
          false
        );
        testData.createdUsers.push(fakeUser);
        expect(response.status).to.be.eq(Constants.HTTP_AUTH_ERROR);

        const usersAfter = await billingImpl.getUsers();
        expect(usersAfter.length).to.be.eq(usersBefore.length);
      });

      it('Should not be able to delete a user', async () => {
        const usersBefore = await billingImpl.getUsers();
        expect(usersBefore).to.not.be.null;

        const response = await testData.userService.deleteEntity(
          testData.userService.userApi,
          { id: 0 },
          false
        );
        testData.createdUsers.pop();
        expect(response.status).to.be.eq(Constants.HTTP_AUTH_ERROR);

        const usersAfter = await billingImpl.getUsers();
        expect(usersAfter.length).to.be.eq(usersBefore.length);
      });
    });
  });
});
