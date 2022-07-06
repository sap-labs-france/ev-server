import { AnalyticsSettingsType, BillingSettingsType, PricingSettingsType, RefundSettingsType, RoamingSettingsType } from '../../src/types/Setting';
import chai, { expect } from 'chai';

import CentralServerService from './client/CentralServerService';
import ContextDefinition from './context/ContextDefinition';
import { StatusCodes } from 'http-status-codes';
import { TenantComponents } from '../../src/types/Tenant';
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

describe('Tenant Settings', () => {
  jest.setTimeout(60000); // Not mandatory will automatically stop the unit test after that period of time

  beforeAll(async () => {
    // Init values
    testData.superAdminCentralService = new CentralServerService(null, {
      email: config.get('superadmin.username'),
      password: config.get('superadmin.password')
    });
    testData.connectUser();
    testData.credentials.email = config.get('admin.username');
    // Retrieve the tenant id from the name
    const response = await testData.superAdminCentralService.tenantApi.readAll(
      { 'Search': ContextDefinition.TENANT_CONTEXTS.TENANT_WITH_NO_COMPONENTS },
      TestConstants.DEFAULT_PAGING
    );
    testData.credentials.tenantId = response ? response.data.result[0].id : '';
  });

  afterAll(async () => {
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
        billingPlatform: { active: false, type: null },
        smartCharging: { active: false, type: null },
        statistics: { active: false, type: null },
        analytics: { active: false, type: null },
        asset: { active: false, type: null }
      }
    };
    const res = await testData.superAdminCentralService.updateEntity(
      testData.centralService.tenantApi, testData.data);
    expect(res.status).to.equal(StatusCodes.OK);
  });

  describe('Success cases', () => {
    it('General : Check that the connection to tenant works', () => {
      expect(testData.credentials.tenantId).to.not.equal('');
    });

    it(
      'OCPI : Check that the setting has been created in the tenant after activation',
      async () => {
        // Fill in the data
        testData.data = {
          id: testData.credentials.tenantId,
          name: ContextDefinition.TENANT_CONTEXTS.TENANT_WITH_NO_COMPONENTS,
          email: testData.credentials.email,
          subdomain: ContextDefinition.TENANT_CONTEXTS.TENANT_WITH_NO_COMPONENTS,
          components: {
            ocpi: { active: true, type: RoamingSettingsType.OCPI },
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
        expect(res.status).to.equal(StatusCodes.OK);
        testData.connectUser();
        const settings = await testData.centralService.settingApi.readAll({});
        expect(settings.data.count).to.equal(3);
        expect(settings.data.result[1]).to.be.validatedSetting(TenantComponents.OCPI, RoamingSettingsType.OCPI);
      }
    );

    it(
      'Pricing/Simple : Check that the setting has been created in the tenant after activation',
      async () => {
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
        expect(res.status).to.equal(StatusCodes.OK);
        testData.connectUser();
        const settings = await testData.centralService.settingApi.readAll({});
        expect(settings.status).to.equal(StatusCodes.OK);
        expect(settings.data.count).to.equal(3);
        expect(settings.data.result[1]).to.be.validatedSetting(TenantComponents.PRICING, PricingSettingsType.SIMPLE);
      }
    );

    it(
      'Billing : Check that the setting has been created in the tenant after activation',
      async () => {
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
        expect(res.status).to.equal(StatusCodes.INTERNAL_SERVER_ERROR);

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
        expect(res.status).to.equal(StatusCodes.OK);
        testData.connectUser();
        const settings = await testData.centralService.settingApi.readAll({});
        expect(settings.status).to.equal(StatusCodes.OK);
        expect(settings.data.count).to.equal(4);
        expect(settings.data.result[0]).to.be.validatedSetting(TenantComponents.BILLING, BillingSettingsType.STRIPE);
        expect(settings.data.result[2]).to.be.validatedSetting(TenantComponents.PRICING, PricingSettingsType.SIMPLE);
      }
    );

    it(
      'Billing accounts : Check that the setting has been created in the tenant after activation',
      async () => {
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
            billing: { active: false, type: null },
            billingPlatform: { active: true, type: null },
            smartCharging: { active: false, type: null },
            statistics: { active: false, type: null },
            analytics: { active: false, type: null },
            asset: { active: false, type: null }
          }
        };
        let res = await testData.superAdminCentralService.updateEntity(
          testData.centralService.tenantApi, testData.data, false);
        expect(res.status).to.equal(StatusCodes.INTERNAL_SERVER_ERROR);

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
            billingPlatform: { active: true, type: null },
            smartCharging: { active: false, type: null },
            statistics: { active: false, type: null },
            analytics: { active: false, type: null },
            asset: { active: false, type: null }
          }
        };
        res = await testData.superAdminCentralService.updateEntity(
          testData.centralService.tenantApi, testData.data);
        expect(res.status).to.equal(StatusCodes.OK);
        testData.connectUser();
        const tenant = await testData.superAdminCentralService.tenantApi.readById(testData.data.id);
        expect(tenant.status).to.equal(StatusCodes.OK);
        expect(tenant.data.components.billingPlatform).to.exist;
        expect(tenant.data.components.billingPlatform.active).to.be.true;
      }
    );

    it(
      'Refund : Check that the setting has been created in the tenant after activation',
      async () => {
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
        expect(res.status).to.equal(StatusCodes.INTERNAL_SERVER_ERROR);

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
        expect(res.status).to.equal(StatusCodes.OK);
        testData.connectUser();
        const settings = await testData.centralService.settingApi.readAll({});
        expect(settings.status).to.equal(StatusCodes.OK);
        expect(settings.data.count).to.equal(4);
        expect(settings.data.result[1]).to.be.validatedSetting(TenantComponents.PRICING, PricingSettingsType.SIMPLE);
        expect(settings.data.result[2]).to.be.validatedSetting(TenantComponents.REFUND, RefundSettingsType.CONCUR);
      }
    );

    it(
      'SmartCharging : Check that the setting has been created in the tenant after activation',
      async () => {
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
        expect(res.status).to.equal(StatusCodes.INTERNAL_SERVER_ERROR);
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
        expect(res.status).to.equal(StatusCodes.OK);
        testData.connectUser();
        const settings = await testData.centralService.settingApi.readAll({});
        expect(settings.status).to.equal(StatusCodes.OK);
        expect(settings.data.count).to.equal(3);
        expect(settings.data.result[1]).to.be.validatedSetting('smartCharging', 'sapSmartCharging');
      }
    );

    it(
      'Analytics : Check that the setting has been created in the tenant after activation',
      async () => {
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
        expect(res.status).to.equal(StatusCodes.OK);
        testData.connectUser();
        const settings = await testData.centralService.settingApi.readAll({});
        expect(settings.status).to.equal(StatusCodes.OK);
        expect(settings.data.count).to.equal(3);
        expect(settings.data.result[0]).to.be.validatedSetting(TenantComponents.ANALYTICS, AnalyticsSettingsType.SAC);
      }
    );

    it(
      'Asset : Check that the setting has been created in the tenant after activation',
      async () => {
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
        expect(res.status).to.equal(StatusCodes.INTERNAL_SERVER_ERROR);
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
        expect(res.status).to.equal(StatusCodes.OK);
        testData.connectUser();
        const settings = await testData.centralService.settingApi.readAll({});
        expect(settings.data.count).to.equal(3);
        expect(settings.data.result[0]).to.be.validatedSetting(TenantComponents.ASSET, null);
      }
    );
  });
});
