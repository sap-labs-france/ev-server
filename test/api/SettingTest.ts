// Goal : Checks related to settings
// Note : These unit tests use the tenant utall. This tenant should exist prior running these tests.
//        Run npm run mochatest:createContext to create the needed utall if not present.

import chai, { expect } from 'chai';

import CentralServerService from './client/CentralServerService';
import ContextDefinition from './context/ContextDefinition';
import Tenant from '../types/Tenant';
import TestConstants from './client/utils/TestConstants';
import TestData from './client/utils/TestData';
import Utils from '../../src/utils/Utils';
import chaiSubset from 'chai-subset';
import config from '../config';
import responseHelper from '../helpers/responseHelper';

chai.use(chaiSubset);
chai.use(responseHelper);

const testData: TestData = new TestData();
let initialTenant: Tenant;

describe('Setting tests', function() {
  this.timeout(30000);

  before(async function() {
    // Init values
    testData.superCentralService = new CentralServerService(null, { email: config.get('superadmin.username'), password: config.get('superadmin.password') });
    testData.centralService = new CentralServerService(ContextDefinition.TENANT_CONTEXTS.TENANT_WITH_ALL_COMPONENTS, { email: config.get('admin.username'), password: config.get('admin.password') });
    testData.credentials.email = config.get('admin.username');
    // Retrieve the tenant id from the name
    const response = await testData.superCentralService.tenantApi.readAll({ 'Search' : ContextDefinition.TENANT_CONTEXTS.TENANT_WITH_ALL_COMPONENTS }, { limit: TestConstants.UNLIMITED, skip: 0 });
    testData.credentials.tenantId = response ? response.data.result[0].id : '';
    initialTenant = (await testData.superCentralService.tenantApi.readById(testData.credentials.tenantId)).data;
  });

  after(async function() {
    // Housekeeping
    // Reset components before leaving
    const res = await testData.superCentralService.updateEntity(
      testData.centralService.tenantApi, initialTenant);
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
      // Updating Tenant's components will trigger a logout
      let activation = await testData.superCentralService.updateEntity(testData.centralService.tenantApi, testData.data);
      expect(activation.status).to.equal(200);
      // Login again
      testData.centralService = new CentralServerService(ContextDefinition.TENANT_CONTEXTS.TENANT_WITH_ALL_COMPONENTS, { email: config.get('admin.username'), password: config.get('admin.password') });
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
    it('Check that retrieving crypto settings filtered by identifier returns one result', async () => {
      const read = await testData.centralService.settingApi.readAll({ 'Identifier': 'crypto' }, { limit: TestConstants.UNLIMITED, skip: 0 });
      expect(read.status).to.equal(200);
      expect(read.data.count).to.equal(1);
    });
    it('Check crypto settings update', async () => {
      // Update pricing setting to have sensitive data to test on it
      const readTEST = await testData.centralService.settingApi.readAll({ 'Identifier': 'refund' }, {
        limit: TestConstants.UNLIMITED,
        skip: 0
      });
      expect(readTEST.status).to.equal(200);
      expect(readTEST.data.count).to.equal(1);
      const clientSecret = 'a8242e0ed0fa70aee7c802e41e1c7c3b';
      testData.data = JSON.parse(`{
          "id":"${readTEST.data.result[0].id}",
          "identifier":"refund",
          "sensitiveData":["content.concur.clientSecret"],
          "content":{
            "type" : "concur",
            "concur" : {
                "authenticationUrl" : "https://url.com",
                "apiUrl" : "https://url.com",
                "appUrl" : "https://url.com",
                "clientId" : "6cf707fb-9161-48fa-94fe-9e003be680df",
                "clientSecret" : "${clientSecret}",
                "paymentTypeId" : "gWtUBRXx$s3h0bNdgyv9gwiHLnCGMF",
                "expenseTypeCode" : "01104",
                "policyId" : "1119",
                "reportName" : "E-Car Charging"
            }
        }
      }`);
      const updateTEST = await testData.centralService.updateEntity(testData.centralService.settingApi, testData.data);
      expect(updateTEST.status).to.equal(200);

      // Retrieve the crypto setting id
      const read = await testData.centralService.settingApi.readAll({ 'Identifier': 'crypto' }, {
        limit: TestConstants.UNLIMITED,
        skip: 0
      });
      expect(read.status).to.equal(200);
      expect(read.data.count).to.equal(1);

      // Update crypto setting
      testData.data = JSON.parse(`{
          "id":"${read.data.result[0].id}",
          "identifier":"${read.data.result[0].identifier}",
          "sensitiveData":[],
          "content":{
            "type":"crypto",
            "crypto" : {
              "key" : "${Utils.generateKey()}",
              "keyProperties" : {
                  "blockCypher" : "${read.data.result[0].content.crypto.keyProperties.blockCypher}",
                  "blockSize" : "${read.data.result[0].content.crypto.keyProperties.blockSize}",
                  "operationMode" : "${read.data.result[0].content.crypto.keyProperties.operationMode}"
              },
              "formerKey" : "${read.data.result[0].content.crypto.key}",
              "formerKeyProperties" : {
                  "blockCypher" : "${read.data.result[0].content.crypto.keyProperties.blockCypher}",
                  "blockSize" : "${read.data.result[0].content.crypto.keyProperties.blockSize}",
                  "operationMode" : "${read.data.result[0].content.crypto.keyProperties.operationMode}"
              },
              "migrationToBeDone" : true
            }
          }
      }`);
      const update = await testData.centralService.updateEntity(testData.centralService.settingApi, testData.data);
      expect(update.status).to.equal(200);

      // Get setting with sensitive data after crypto setting update
      const readSettingAfter = await testData.centralService.settingApi.readAll({ 'Identifier': 'refund' }, {
        limit: TestConstants.UNLIMITED,
        skip: 0
      });
      expect(readSettingAfter.status).to.equal(200);
      expect(readSettingAfter.data.count).to.equal(1);
    });
  });
});
