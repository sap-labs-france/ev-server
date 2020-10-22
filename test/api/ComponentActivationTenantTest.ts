import { AnalyticsSettingsType, BillingSettingsType, PricingSettingsType, RefundSettingsType, RoamingSettingsType } from '../../src/types/Setting';
import chai, { expect } from 'chai';

import CentralServerService from './client/CentralServerService';
import ContextDefinition from './context/ContextDefinition';
import TenantComponents from '../../src/types/TenantComponents';
import TestConstants from './client/utils/TestConstants';
import chaiSubset from 'chai-subset';
import config from '../config';
import responseHelper from '../helpers/responseHelper';

chai.use(chaiSubset);
chai.use(responseHelper);

// Goal : Test the creation of settings following a component activation
// Usage : these unit tests use the tenant utnothing

class TestData {
  public data: any;
  public superAdminCentralService: any;
  public centralService: any;
  public credentials: any = {};

  public connectUser(): void {
    this.centralService = new CentralServerService(ContextDefinition.TENANT_CONTEXTS.TENANT_WITH_NO_COMPONENTS, {
      email: config.get('admin.username'),
      password: config.get('admin.password')
    });
  }
}

const testData: TestData = new TestData();

describe('Tenant Settings test', function() {
  this.timeout(3000000); // Not mandatory will automatically stop the unit test after that period of time

  before(async function() {
    // Init values
    testData.superAdminCentralService = new CentralServerService(null, {
      email: config.get('superadmin.username'),
      password: config.get('superadmin.password')
    });
    testData.connectUser();
    testData.credentials.email = config.get('admin.username');
    // Retrieve the tenant id from the name
    const response = await testData.superAdminCentralService.tenantApi.readAll({ 'Search': ContextDefinition.TENANT_CONTEXTS.TENANT_WITH_NO_COMPONENTS }, {
      limit: TestConstants.UNLIMITED,
      skip: 0
    });
    testData.credentials.tenantId = response ? response.data.result[0].id : '';
  });

  after(async function() {
    // Reset components before leaving
    testData.data = {
      id: testData.credentials.tenantId,
      name: ContextDefinition.TENANT_CONTEXTS.TENANT_WITH_NO_COMPONENTS,
      email: testData.credentials.email,
      subdomain: ContextDefinition.TENANT_CONTEXTS.TENANT_WITH_NO_COMPONENTS,
      components: {
        ocpi: { active: false, type: null },
        organization: { active: false, type: null },
        pricing: { active: false, type: null },
        refund: { active: false, type: null },
        billing: { active: false, type: null },
        smartCharging: { active: false, type: null },
        statistics: { active: false, type: null },
        analytics: { active: false, type: null },
        asset: { active: false, type: null }
      }
    };
    const res = await testData.superAdminCentralService.updateEntity(
      testData.centralService.tenantApi, testData.data);
    expect(res.status).to.equal(200);
  });

  describe('Success cases', function() {
    it('General : Check that the connection to tenant works', function() {
      expect(testData.credentials.tenantId).to.not.equal('');
    });

    it('OCPI : Check that the setting has been created in the tenant after activation', async function() {
      // Fill in the data
      testData.data = {
        id: testData.credentials.tenantId,
        name: ContextDefinition.TENANT_CONTEXTS.TENANT_WITH_NO_COMPONENTS,
        email: testData.credentials.email,
        subdomain: ContextDefinition.TENANT_CONTEXTS.TENANT_WITH_NO_COMPONENTS,
        components: {
          ocpi: { active: true, type: RoamingSettingsType.GIREVE },
          organization: { active: false, type: null },
          pricing: { active: false, type: null },
          refund: { active: false, type: null },
          billing: { active: false, type: null },
          smartCharging: { active: false, type: null },
          statistics: { active: false, type: null },
          analytics: { active: false, type: null },
          asset: { active: false, type: null }
        }
      };
      const res = await testData.superAdminCentralService.updateEntity(
        testData.centralService.tenantApi, testData.data);
      expect(res.status).to.equal(200);
      testData.connectUser();
      const settings = await testData.centralService.settingApi.readAll({});
      expect(settings.data.count).to.equal(1);
      expect(settings.data.result[0]).to.be.validatedSetting(TenantComponents.OCPI, RoamingSettingsType.GIREVE);
    });

    it('Pricing/Simple : Check that the setting has been created in the tenant after activation', async function() {
      // Fill in the data
      testData.data = {
        id: testData.credentials.tenantId,
        name: ContextDefinition.TENANT_CONTEXTS.TENANT_WITH_NO_COMPONENTS,
        email: testData.credentials.email,
        subdomain: ContextDefinition.TENANT_CONTEXTS.TENANT_WITH_NO_COMPONENTS,
        components: {
          ocpi: { active: false, type: null },
          organization: { active: false, type: null },
          pricing: { active: true, type: PricingSettingsType.SIMPLE },
          refund: { active: false, type: null },
          billing: { active: false, type: null },
          smartCharging: { active: false, type: null },
          statistics: { active: false, type: null },
          analytics: { active: false, type: null },
          asset: { active: false, type: null }
        }
      };
      const res = await testData.superAdminCentralService.updateEntity(
        testData.centralService.tenantApi, testData.data);
      expect(res.status).to.equal(200);
      testData.connectUser();
      const settings = await testData.centralService.settingApi.readAll({});
      expect(settings.status).to.equal(200);
      expect(settings.data.count).to.equal(1);
      expect(settings.data.result[0]).to.be.validatedSetting(TenantComponents.PRICING, PricingSettingsType.SIMPLE);
    });

    it('Billing : Check that the setting has been created in the tenant after activation', async function() {
      // Fill in the data
      testData.data = {
        id: testData.credentials.tenantId,
        name: ContextDefinition.TENANT_CONTEXTS.TENANT_WITH_NO_COMPONENTS,
        email: testData.credentials.email,
        subdomain: ContextDefinition.TENANT_CONTEXTS.TENANT_WITH_NO_COMPONENTS,
        components: {
          ocpi: { active: false, type: null },
          organization: { active: false, type: null },
          pricing: { active: false, type: null },
          refund: { active: false, type: null },
          billing: { active: true, type: BillingSettingsType.STRIPE },
          smartCharging: { active: false, type: null },
          statistics: { active: false, type: null },
          analytics: { active: false, type: null },
          asset: { active: false, type: null }
        }
      };
      let res = await testData.superAdminCentralService.updateEntity(
        testData.centralService.tenantApi, testData.data, false);
      expect(res.status).to.equal(500);

      // Fill in the data
      testData.data = {
        id: testData.credentials.tenantId,
        name: ContextDefinition.TENANT_CONTEXTS.TENANT_WITH_NO_COMPONENTS,
        email: testData.credentials.email,
        subdomain: ContextDefinition.TENANT_CONTEXTS.TENANT_WITH_NO_COMPONENTS,
        components: {
          ocpi: { active: false, type: null },
          organization: { active: false, type: null },
          pricing: { active: true, type: PricingSettingsType.SIMPLE },
          refund: { active: false, type: null },
          billing: { active: true, type: BillingSettingsType.STRIPE },
          smartCharging: { active: false, type: null },
          statistics: { active: false, type: null },
          analytics: { active: false, type: null },
          asset: { active: false, type: null }
        }
      };
      res = await testData.superAdminCentralService.updateEntity(
        testData.centralService.tenantApi, testData.data);
      expect(res.status).to.equal(200);
      testData.connectUser();
      const settings = await testData.centralService.settingApi.readAll({});
      expect(settings.status).to.equal(200);
      expect(settings.data.count).to.equal(2);
      expect(settings.data.result[0]).to.be.validatedSetting(TenantComponents.BILLING, BillingSettingsType.STRIPE);
      expect(settings.data.result[1]).to.be.validatedSetting(TenantComponents.PRICING, PricingSettingsType.SIMPLE);
    });

    it('Refund : Check that the setting has been created in the tenant after activation', async function() {
      // Test only Refund (should fail)
      testData.data = {
        id: testData.credentials.tenantId,
        name: ContextDefinition.TENANT_CONTEXTS.TENANT_WITH_NO_COMPONENTS,
        email: testData.credentials.email,
        subdomain: ContextDefinition.TENANT_CONTEXTS.TENANT_WITH_NO_COMPONENTS,
        components: {
          ocpi: { active: false, type: null },
          organization: { active: false, type: null },
          pricing: { active: false, type: null },
          refund: { active: true, type: RefundSettingsType.CONCUR },
          billing: { active: false, type: null },
          smartCharging: { active: false, type: null },
          statistics: { active: false, type: null },
          analytics: { active: false, type: null },
          asset: { active: false, type: null }
        }
      };
      let res = await testData.superAdminCentralService.updateEntity(
        testData.centralService.tenantApi, testData.data, false);
      expect(res.status).to.equal(500);

      // Test Refund with Pricing
      testData.data = {
        id: testData.credentials.tenantId,
        name: ContextDefinition.TENANT_CONTEXTS.TENANT_WITH_NO_COMPONENTS,
        email: testData.credentials.email,
        subdomain: ContextDefinition.TENANT_CONTEXTS.TENANT_WITH_NO_COMPONENTS,
        components: {
          ocpi: { active: false, type: null },
          organization: { active: false, type: null },
          pricing: { active: true, type: PricingSettingsType.SIMPLE },
          refund: { active: true, type: RefundSettingsType.CONCUR },
          billing: { active: false, type: null },
          smartCharging: { active: false, type: null },
          statistics: { active: false, type: null },
          analytics: { active: false, type: null },
          asset: { active: false, type: null }
        }
      };
      res = await testData.superAdminCentralService.updateEntity(testData.centralService.tenantApi, testData.data);
      expect(res.status).to.equal(200);
      testData.connectUser();
      const settings = await testData.centralService.settingApi.readAll({});
      expect(settings.status).to.equal(200);
      expect(settings.data.count).to.equal(2);
      expect(settings.data.result[0]).to.be.validatedSetting(TenantComponents.PRICING, PricingSettingsType.SIMPLE);
      expect(settings.data.result[1]).to.be.validatedSetting(TenantComponents.REFUND, RefundSettingsType.CONCUR);
    });

    it('SmartCharging : Check that the setting has been created in the tenant after activation', async function() {
      // Test only Smart Charging (should fail)
      testData.data = {
        id: testData.credentials.tenantId,
        name: ContextDefinition.TENANT_CONTEXTS.TENANT_WITH_NO_COMPONENTS,
        email: testData.credentials.email,
        subdomain: ContextDefinition.TENANT_CONTEXTS.TENANT_WITH_NO_COMPONENTS,
        components: {
          ocpi: { active: false, type: null },
          organization: { active: false, type: null },
          pricing: { active: false, type: null },
          refund: { active: false, type: null },
          billing: { active: false, type: null },
          smartCharging: { active: true, type: 'sapSmartCharging' },
          statistics: { active: false, type: null },
          analytics: { active: false, type: null },
          asset: { active: false, type: null }
        }
      };
      let res = await testData.superAdminCentralService.updateEntity(
        testData.centralService.tenantApi, testData.data, false);
      expect(res.status).to.equal(500);
      // Test Smart Charging with Pricing
      testData.data = {
        id: testData.credentials.tenantId,
        name: ContextDefinition.TENANT_CONTEXTS.TENANT_WITH_NO_COMPONENTS,
        email: testData.credentials.email,
        subdomain: ContextDefinition.TENANT_CONTEXTS.TENANT_WITH_NO_COMPONENTS,
        components: {
          ocpi: { active: false, type: null },
          organization: { active: true, type: null },
          pricing: { active: false, type: null },
          refund: { active: false, type: null },
          billing: { active: false, type: null },
          smartCharging: { active: true, type: 'sapSmartCharging' },
          statistics: { active: false, type: null },
          analytics: { active: false, type: null },
          asset: { active: false, type: null }
        }
      };
      res = await testData.superAdminCentralService.updateEntity(testData.centralService.tenantApi, testData.data);
      expect(res.status).to.equal(200);
      testData.connectUser();
      const settings = await testData.centralService.settingApi.readAll({});
      expect(settings.status).to.equal(200);
      expect(settings.data.count).to.equal(1);
      expect(settings.data.result[0]).to.be.validatedSetting('smartCharging', 'sapSmartCharging');
    });

    it('Pricing/Convergent : Check that the setting has been created in the tenant after activation', async function() {
      // Test SAP CC with Pricing
      testData.data = {
        id: testData.credentials.tenantId,
        name: ContextDefinition.TENANT_CONTEXTS.TENANT_WITH_NO_COMPONENTS,
        email: testData.credentials.email,
        subdomain: ContextDefinition.TENANT_CONTEXTS.TENANT_WITH_NO_COMPONENTS,
        components: {
          ocpi: { active: false, type: null },
          organization: { active: false, type: null },
          pricing: { active: true, type: 'convergentCharging' },
          refund: { active: false, type: null },
          billing: { active: false, type: null },
          smartCharging: { active: false, type: null },
          statistics: { active: false, type: null },
          analytics: { active: false, type: null },
          asset: { active: false, type: null }
        }
      };
      const res = await testData.superAdminCentralService.updateEntity(testData.centralService.tenantApi, testData.data);
      expect(res.status).to.equal(200);
      testData.connectUser();
      const settings = await testData.centralService.settingApi.readAll({});
      expect(settings.status).to.equal(200);
      expect(settings.data.count).to.equal(1);
      expect(settings.data.result[0]).to.be.validatedSetting(TenantComponents.PRICING, PricingSettingsType.CONVERGENT_CHARGING);
    });

    it('Analytics : Check that the setting has been created in the tenant after activation', async function() {
      // Fill in the data
      // Test SAP CC with Pricing
      testData.data = {
        id: testData.credentials.tenantId,
        name: ContextDefinition.TENANT_CONTEXTS.TENANT_WITH_NO_COMPONENTS,
        email: testData.credentials.email,
        subdomain: ContextDefinition.TENANT_CONTEXTS.TENANT_WITH_NO_COMPONENTS,
        components: {
          ocpi: { active: false, type: null },
          organization: { active: false, type: null },
          pricing: { active: false, type: null },
          refund: { active: false, type: null },
          billing: { active: false, type: null },
          smartCharging: { active: false, type: null },
          statistics: { active: false, type: null },
          analytics: { active: true, type: 'sac' },
          asset: { active: false, type: null }
        }
      };
      const res = await testData.superAdminCentralService.updateEntity(testData.centralService.tenantApi, testData.data);
      expect(res.status).to.equal(200);
      testData.connectUser();
      const settings = await testData.centralService.settingApi.readAll({});
      expect(settings.status).to.equal(200);
      expect(settings.data.count).to.equal(1);
      expect(settings.data.result[0]).to.be.validatedSetting(TenantComponents.ANALYTICS, AnalyticsSettingsType.SAC);
    });

    it('Asset : Check that the setting has been created in the tenant after activation', async function() {
      // Test only Asset (should fail)
      testData.data = {
        id: testData.credentials.tenantId,
        name: ContextDefinition.TENANT_CONTEXTS.TENANT_WITH_NO_COMPONENTS,
        email: testData.credentials.email,
        subdomain: ContextDefinition.TENANT_CONTEXTS.TENANT_WITH_NO_COMPONENTS,
        components: {
          ocpi: { active: false, type: null },
          organization: { active: false, type: null },
          pricing: { active: false, type: null },
          refund: { active: false, type: null },
          billing: { active: false, type: null },
          smartCharging: { active: false, type: null },
          statistics: { active: false, type: null },
          analytics: { active: false, type: null },
          asset: { active: true, type: null }
        }
      };
      let res = await testData.superAdminCentralService.updateEntity(
        testData.centralService.tenantApi, testData.data, false);
      expect(res.status).to.equal(500);
      // Test Asset with Organization
      testData.data = {
        id: testData.credentials.tenantId,
        name: ContextDefinition.TENANT_CONTEXTS.TENANT_WITH_NO_COMPONENTS,
        email: testData.credentials.email,
        subdomain: ContextDefinition.TENANT_CONTEXTS.TENANT_WITH_NO_COMPONENTS,
        components: {
          ocpi: { active: false, type: null },
          organization: { active: true, type: null },
          pricing: { active: false, type: null },
          refund: { active: false, type: null },
          billing: { active: false, type: null },
          smartCharging: { active: false, type: null },
          statistics: { active: false, type: null },
          analytics: { active: false, type: null },
          asset: { active: true, type: null }
        }
      };
      res = await testData.superAdminCentralService.updateEntity(
        testData.centralService.tenantApi, testData.data);
      expect(res.status).to.equal(200);
      testData.connectUser();
      const settings = await testData.centralService.settingApi.readAll({});
      expect(settings.data.count).to.equal(1);
      expect(settings.data.result[0]).to.be.validatedSetting(TenantComponents.ASSET, null);
    });
  });
});
