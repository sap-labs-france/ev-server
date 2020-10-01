// Goal : Checks related to settings
// Note : These unit tests use the tenant utall. This tenant should exist prior running these tests.
//        Run npm run mochatest:createContext to create the needed utall if not present.

import chai, { expect } from 'chai';

import CentralServerService from './client/CentralServerService';
import ContextDefinition from './context/ContextDefinition';
import TestConstants from './client/utils/TestConstants';
import TestData from './client/utils/TestData';
import chaiSubset from 'chai-subset';
import config from '../config';
import responseHelper from '../helpers/responseHelper';

chai.use(chaiSubset);
chai.use(responseHelper);

const testData: TestData = new TestData();

describe('Setting tests', function() {
  this.timeout(30000);

  before(async function() {
    // Init values
    testData.superCentralService = new CentralServerService(null, { email: config.get('superadmin.username'), password: config.get('superadmin.password') });
    testData.centralService = new CentralServerService('utall', { email: config.get('admin.username'), password: config.get('admin.password') });
    testData.credentials.email = config.get('admin.username');
    // Retrieve the tenant id from the name
    const response = await testData.superCentralService.tenantApi.readAll({ 'Search' : ContextDefinition.TENANT_CONTEXTS.TENANT_WITH_ALL_COMPONENTS }, { limit: TestConstants.UNLIMITED, skip: 0 });
    testData.credentials.tenantId = response ? response.data.result[0].id : '';
  });

  after(async function() {
    // Housekeeping
    // Reset components before leaving
    testData.data = JSON.parse(`{"id":"${testData.credentials.tenantId}","name": "${ContextDefinition.TENANT_CONTEXTS.TENANT_WITH_ALL_COMPONENTS}","email": "${testData.credentials.email}","subdomain":"utall","components":{"ocpi":{"active":true,"type":"gireve"},"organization":{"active":true,"type":null},"pricing":{"active":true,"type":"simple"},"refund":{"active":true,"type":"concur"},"statistics":{"active":true,"type":null},"analytics":{"active":true,"type":null}}}`);
    const res = await testData.superCentralService.updateEntity(
      testData.centralService.tenantApi, testData.data);
    expect(res.status).to.equal(200);
  });


  describe('Success cases (tenant utall)', () => {
    it('Check that retrieving refund settings filtered by identifier returns just one result', async () => {
      // Retrieve the setting id
      const read = await testData.centralService.settingApi.readAll({ 'Identifier' : 'refund' }, { limit: TestConstants.UNLIMITED, skip: 0 });
      expect(read.status).to.equal(200);
      expect(read.data.count).to.equal(1);
    });
    it('Check that retrieving pricing settings filtered by identifier returns just one result', async () => {
      // Retrieve the setting id
      const read = await testData.centralService.settingApi.readAll({ 'Identifier' : 'pricing' }, { limit: TestConstants.UNLIMITED, skip: 0 });
      expect(read.status).to.equal(200);
      expect(read.data.count).to.equal(1);
    });
    it('Check that retrieving organization settings filtered by identifier returns just one result', async () => {
      // Retrieve the setting id
      const read = await testData.centralService.settingApi.readAll({ 'Identifier' : 'organization' }, { limit: TestConstants.UNLIMITED, skip: 0 });
      expect(read.status).to.equal(200);
      expect(read.data.count).to.equal(1);
    });
    it('Check that retrieving analytics settings filtered by identifier returns just one result', async () => {
      // Retrieve the setting id
      const read = await testData.centralService.settingApi.readAll({ 'Identifier' : 'analytics' }, { limit: TestConstants.UNLIMITED, skip: 0 });
      expect(read.status).to.equal(200);
      expect(read.data.count).to.equal(1);
    });
    it('Check that retrieving ocpi settings filtered by identifier returns just one result', async () => {
      // Retrieve the setting id
      const read = await testData.centralService.settingApi.readAll({ 'Identifier' : 'ocpi' }, { limit: TestConstants.UNLIMITED, skip: 0 });
      expect(read.status).to.equal(200);
      expect(read.data.count).to.equal(1);
    });
    it('Check that retrieving statistics settings filtered by identifier returns just one result', async () => {
      // Retrieve the setting id
      const read = await testData.centralService.settingApi.readAll({ 'Identifier' : 'statistics' }, { limit: TestConstants.UNLIMITED, skip: 0 });
      expect(read.status).to.equal(200);
      expect(read.data.count).to.equal(1);
    });
    it('Check that retrieving setting by id is working', async () => {
      // Retrieve the setting id
      const read = await testData.centralService.settingApi.readAll({ 'Identifier' : 'pricing' }, { limit: TestConstants.UNLIMITED, skip: 0 });
      expect(read.status).to.equal(200);
      const response = await testData.centralService.settingApi.readById(read.data.result[0].id);
      expect(response.status).to.equal(200);
    });
    it('Check that changing the pricing component from simple to convergent charging back and forth works', async () => {
      // Retrieve the setting id
      const read = await testData.centralService.settingApi.readAll({ 'Identifier': 'pricing' }, {
        limit: TestConstants.UNLIMITED,
        skip: 0
      });
      expect(read.status).to.equal(200);
      expect(read.data.count).to.equal(1);
      // Store the old setting
      const oldSetting = read.data.result[0];
      // Activate convergent charging
      testData.data = JSON.parse(`{"id":"${testData.credentials.tenantId}","name":"${ContextDefinition.TENANT_CONTEXTS.TENANT_WITH_ALL_COMPONENTS}","email":"${testData.credentials.email}","subdomain":"utall","components":{"ocpi":{"active":true,"type":"gireve"},"organization":{"active":true,"type":null},"pricing":{"active":true,"type":"convergentCharging"},"refund":{"active":true,"type":"concur"},"statistics":{"active":true,"type":null},"analytics":{"active":true,"type":null}}}`);
      let activation = await testData.superCentralService.updateEntity(testData.centralService.tenantApi, testData.data);
      expect(activation.status).to.equal(200);
      // Update convergent charging setting
      testData.data = JSON.parse(`{
          "id":"${read.data.result[0].id}",
          "identifier":"pricing",
          "sensitiveData":["content.convergentCharging.password"],
          "content":{
              "type":"convergentCharging",
              "convergentCharging":{
                  "url":"http://test.com",
                  "chargeableItemName":"IN",
                  "user":"HarryPotter",
                  "password":"Th1sI5aFakePa55*"
              }
          }
      }`);
      let update = await testData.centralService.updateEntity(testData.centralService.settingApi, testData.data);
      expect(update.status).to.equal(200);
      // Activate back simple pricing
      testData.data = JSON.parse(`{"id":"${testData.credentials.tenantId}","name":"${ContextDefinition.TENANT_CONTEXTS.TENANT_WITH_ALL_COMPONENTS}","email":"${testData.credentials.email}","subdomain":"utall","components":{"ocpi":{"active":true,"type":"gireve"},"organization":{"active":true,"type":null},"pricing":{"active":true,"type":"simple"},"refund":{"active":true,"type":"concur"},"statistics":{"active":true,"type":null},"analytics":{"active":true,"type":null}}}`);
      activation = await testData.superCentralService.updateEntity(testData.centralService.tenantApi, testData.data);
      expect(activation.status).to.equal(200);
      // Restore default simple pricing setting
      update = await testData.centralService.updateEntity(testData.centralService.settingApi, oldSetting);
      expect(update.status).to.equal(200);
    });
  });
});
