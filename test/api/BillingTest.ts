import Billing, { BillingUserData } from '../../src/integration/billing/Billing';
import CONTEXTS from './contextProvider/ContextConstants';
import CentralServerService from './client/CentralServerService';
import ContextProvider from './contextProvider/ContextProvider';
import Cypher from '../../src/utils/Cypher';
import Factory from '../factories/Factory';
import SiteContext from './contextProvider/SiteContext';
import StripeBilling from '../../src/integration/billing/stripe/StripeBilling';
import TenantContext from './contextProvider/TenantContext';
import User from '../../src/types/User';
import config from '../config';
import { expect } from 'chai';
import { StripeBillingSettings } from '../../src/types/Setting';

const billingSettings = {
  url: config.get('billing.url'),
  publicKey: config.get('billing.publicKey'),
  secretKey: Cypher.encrypt(config.get('billing.secretKey')),
  noCardAllowed: config.get('billing.noCardAllowed'),
  advanceBillingAllowed: config.get('billing.advanceBillingAllowed'),
  currency: config.get('billing.currency'),
  immediateBillingAllowed: config.get('billing.immediateBillingAllowed'),
  periodicBillingAllowed: config.get('billing.periodicBillingAllowed')
} as StripeBillingSettings;

let billingImpl: Billing<StripeBillingSettings>;

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
      const settingsMDB = await testData.userService.settingApi.readAll({ 'Identifier': 'billing' });
      expect(settingsMDB.data.count).to.be.eq(1);
      const componentSetting = settingsMDB.data.result[0];
      componentSetting.content.stripe = { ...billingSettings };

      await testData.userService.settingApi.update(componentSetting);
      billingImpl = new StripeBilling(tenant.id, billingSettings, config.get('billing.currency'));
      expect(billingImpl).to.not.be.null;
    } else {
      throw new Error(`Unable to get Tenant ID for tenant : ${CONTEXTS.TENANT_CONTEXTS.TENANT_WITH_ALL_COMPONENTS}`);
    }
  });

  it('Should connect to Billing Provider', async () => {
    const response = await billingImpl.checkConnection(billingSettings.secretKey);
    expect(response.success).to.be.eq(true);
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

    const newBillingData: BillingUserData = await billingImpl.synchronizeUser(fakeUser);
    if (newBillingData.customerID) {
      fakeUser.billingData = newBillingData;
      testData.createdUsers.push(fakeUser);
    }
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
});
