import path from 'path';
import global from '../../src/types/GlobalType';
global.appRoot = path.resolve(__dirname, '../../src');
import chai, { expect } from 'chai';
import chaiSubset from 'chai-subset';
import CentralServerService from '../api/client/CentralServerService';
import Constants from './client/utils/Constants';
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
}

const testData: TestData = new TestData();

describe('Tenant Settings test', function() {
  this.timeout(10000); // Not mandatory will automatically stop the unit test after that period of time

  before( async function() {
    // Init values
    testData.superAdminCentralService = new CentralServerService(null, { email: config.get('superadmin.username'), password: config.get('superadmin.password') });
    testData.centralService = new CentralServerService('utnothing', { email: config.get('admin.username'), password: config.get('admin.password') });
    testData.credentials.email = config.get('admin.username');
    // Retrieve the tenant id from the name
    const response = await testData.superAdminCentralService.tenantApi.readAll({ "Search" : "ut-nothing" },{ limit: Constants.UNLIMITED, skip: 0 })
    testData.credentials.tenantId = response ? response.data.result[0].id : '';
  });

  after( async function() {
    // Reset components before leaving
    testData.data = JSON.parse(`{"id":"${testData.credentials.tenantId}","name":"ut-nothing","email":"${testData.credentials.email}","subdomain":"utnothing","components":{"ocpi":{"active":false,"type":null},"organization":{"active":false,"type":null},"pricing":{"active":false,"type":null},"refund":{"active":false,"type":null},"statistics":{"active":false,"type":null},"analytics":{"active":false,"type":null}}}`);
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
      testData.data = JSON.parse(`{"id":"${testData.credentials.tenantId}","name":"ut-nothing","email":"${testData.credentials.email}","subdomain":"utnothing","components":{"ocpi":{"active":true,"type":"gireve"},"organization":{"active":false,"type":null},"pricing":{"active":false,"type":null},"refund":{"active":false,"type":null},"statistics":{"active":false,"type":null},"analytics":{"active":false,"type":null}}}`);
      const res = await testData.superAdminCentralService.updateEntity(
        testData.centralService.tenantApi, testData.data);
      expect(res.status).to.equal(200);
      const settings = await testData.centralService.settingApi.readAll({});
      expect(settings.data.count).to.equal(1);
      expect(settings.data.result[0]).to.be.validatedSetting('ocpi','gireve');
    });

    it('Pricing/Simple : Check that the setting has been created in the tenant after activation', async function() {
      // Fill in the data
      testData.data = JSON.parse(`{"id":"${testData.credentials.tenantId}","name":"ut-nothing","email":"${testData.credentials.email}","subdomain":"utnothing","components":{"ocpi":{"active":false,"type":null},"organization":{"active":false,"type":null},"pricing":{"active":true,"type":"simple"},"refund":{"active":false,"type":null},"statistics":{"active":false,"type":null},"analytics":{"active":false,"type":null}}}`);
      const res = await testData.superAdminCentralService.updateEntity(testData.centralService.tenantApi, testData.data);
      expect(res.status).to.equal(200);
      const settings = await testData.centralService.settingApi.readAll({});
      expect(settings.data.count).to.equal(1);
      expect(settings.data.result[0]).to.be.validatedSetting('pricing','simple');
    });

    it('Refund : Check that the setting has been created in the tenant after activation', async function() {
      // Fill in the data
      testData.data = JSON.parse(`{"id":"${testData.credentials.tenantId}","name":"ut-nothing","email":"${testData.credentials.email}","subdomain":"utnothing","components":{"ocpi":{"active":false,"type":null},"organization":{"active":false,"type":null},"pricing":{"active":false,"type":null},"refund":{"active":true,"type":"concur"},"statistics":{"active":false,"type":null},"analytics":{"active":false,"type":null}}}`);
      const res = await testData.superAdminCentralService.updateEntity(testData.centralService.tenantApi, testData.data);
      expect(res.status).to.equal(200);
      const settings = await testData.centralService.settingApi.readAll({});
      expect(settings.data.count).to.equal(1);
      expect(settings.data.result[0]).to.be.validatedSetting('refund','concur');
    });

    it('Pricing/Convergent : Check that the setting has been created in the tenant after activation', async function() {
      // Fill in the data
      testData.data = JSON.parse(`{"id":"${testData.credentials.tenantId}","name":"ut-nothing","email":"${testData.credentials.email}","subdomain":"utnothing","components":{"ocpi":{"active":false,"type":null},"organization":{"active":false,"type":null},"pricing":{"active":true,"type":"convergentCharging"},"refund":{"active":false,"type":null},"statistics":{"active":false,"type":null},"analytics":{"active":false,"type":null}}}`);
      const res = await testData.superAdminCentralService.updateEntity(testData.centralService.tenantApi, testData.data);
      expect(res.status).to.equal(200);
      const settings = await testData.centralService.settingApi.readAll({});
      expect(settings.data.count).to.equal(1);
      expect(settings.data.result[0]).to.be.validatedSetting('pricing','convergentCharging');
    });

    it('Analytics : Check that the setting has been created in the tenant after activation', async function() {
      // Fill in the data
      testData.data = JSON.parse(`{"id":"${testData.credentials.tenantId}","name":"ut-nothing","email":"${testData.credentials.email}","subdomain":"utnothing","components":{"ocpi":{"active":false,"type":null},"organization":{"active":false,"type":null},"pricing":{"active":false,"type":null},"refund":{"active":false,"type":null},"statistics":{"active":false,"type":null},"analytics":{"active":true,"type":"sac"}}}`);
      const res = await testData.superAdminCentralService.updateEntity(testData.centralService.tenantApi, testData.data);
      expect(res.status).to.equal(200);
      const settings = await testData.centralService.settingApi.readAll({});
      expect(settings.data.count).to.equal(1);
      expect(settings.data.result[0]).to.be.validatedSetting('analytics','sac');
    });

  });

});
