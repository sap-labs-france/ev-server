// Goal : Checks related to settings
// Note : These unit tests use the tenant utall. This tenant should exist prior running these tests.
//        Run npm run test:createContext to create the needed utall if not present.

import chai, { expect } from 'chai';

import CentralServerService from './client/CentralServerService';
import Constants from '../../src/utils/Constants';
import ContextDefinition from './context/ContextDefinition';
import TestData from './client/utils/TestData';
import chaiSubset from 'chai-subset';
import config from '../config';
import responseHelper from '../helpers/responseHelper';
import SmartChargingIntegration from '../integration/smart-charging/SmartChargingIntegration';
import { SapSmartChargingSetting, SmartChargingSetting } from '../types/Setting';
import TenantContext from './context/TenantContext';
import ChargingStationContext from './context/ChargingStationContext';

chai.use(chaiSubset);
chai.use(responseHelper);

let smartChargingImpl: SmartChargingIntegration<SmartChargingSetting>;

class TestData {
  public tenantContext: TenantContext;
  public centralUserContext: any;
  public centralUserService: CentralServerService;
  public userService: CentralServerService;
  public siteAreaContext: any;
  public chargingStationContext: ChargingStationContext;


  public static async setSmartChargingValidCredentials(testData) {
    const stripeSettings = TestData.getSmartChargingSettings();
    await TestData.saveSmartChargingSettings(testData, stripeSettings);
    stripeSettings.secretKey = Cypher.encrypt(stripeSettings.secretKey);
    smartChargingImpl = new StripeBillingIntegration(testData.tenantContext.getTenant().id, stripeSettings);
    expect(smartChargingImpl).to.not.be.null;
  }

  public static async setSmartChargingCredentials(testData) {
    const stripeSettings = TestData.getStripeSettings();
    stripeSettings.secretKey = Cypher.encrypt('sk_test_invalid_credentials');
    await TestData.saveBillingSettings(testData, stripeSettings);
    billingImpl = new StripeBillingIntegration(testData.tenantContext.getTenant().id, stripeSettings);
    expect(billingImpl).to.not.be.null;
  }

  public static async saveSmartChargingSettings(testData, stripeSettings: SapSmartChargingSetting) {
    const tenantBillingSettings = await testData.userService.settingApi.readAll({ 'Identifier': 'billing' });
    expect(tenantBillingSettings.data.count).to.be.eq(1);
    const componentSetting: SettingDB = tenantBillingSettings.data.result[0];
    componentSetting.content.type = BillingSettingsType.STRIPE;
    componentSetting.content.stripe = stripeSettings;
    componentSetting.sensitiveData = ['content.stripe.secretKey'];
    await testData.userService.settingApi.update(componentSetting);
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
}

describe('Smart Charging Test', function() {
  this.timeout(30000);

  before(async function() {
    // Init values
    testData.superCentralService = new CentralServerService(null, { email: config.get('superadmin.username'), password: config.get('superadmin.password') });
    testData.centralService = new CentralServerService('utsmartcharg', { email: config.get('admin.username'), password: config.get('admin.password') });
    testData.credentials.email = config.get('admin.username');
    // Retrieve the tenant id from the name
    const response = await testData.superCentralService.tenantApi.readAll({ 'Search' : ContextDefinition.TENANT_CONTEXTS.TENANT_SMART_CHARGING }, { limit: Constants.UNLIMITED, skip: 0 });
    testData.credentials.tenantId = response ? response.data.result[0].id : '';
  });

  after(async function() {
  });


  describe('Success cases (tenant utsmartcharg)', () => {
    it('Should connect to Smart Charging Provider', async () => {
      const response = await testData.centralService.smartChargingApi.testConnection();
      expect(response.data.connectionIsValid).to.be.true;
      expect(response.data).containSubset({ status: 'Success' });
    });
  });
});
