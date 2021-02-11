// Goal : Checks related to settings
// Note : These unit tests use the tenant utall. This tenant should exist prior running these tests.
//        Run npm run mochatest:createContext to create the needed utall if not present.

import CentralServerService from './client/CentralServerService';
import Constants from '../../src/utils/Constants';
import ContextDefinition from './context/ContextDefinition';
import Logging from '../../src/utils/Logging';
import MongoDBStorage from '../../src/storage/mongodb/MongoDBStorage';
import { ServerAction } from '../../src/types/Server';
import Tenant from '../types/Tenant';
import TestConstants from './client/utils/TestConstants';
import TestData from './client/utils/TestData';
import config from '../config';
import { expect } from 'chai';
import global from '../../src/types/GlobalType';

const testData: TestData = new TestData();
let initialTenant: Tenant;

function checkSensitiveDataIsObfuscated(message): boolean {
  const bCheck = true;

  // If (typeof message === 'string') { // Check string -  I don't know how to check this scenario
  // for (const sensitiveData of Constants.SENSITIVE_DATA) {
  // Check anonimized string

  // Anonymize
  // message.replace(new RegExp(sensitiveData, 'gi'), Constants.ANONYMIZED_VALUE);
  // }
  // } else

  if (Array.isArray(message)) { // In case of an array, check every item
    for (const item of message) {
      checkSensitiveDataIsObfuscated(item);
    }
  } else if (typeof message === 'object') { // In case of object, check every field
    for (const key of Object.keys(message)) {
      if (typeof message[key] === 'string') { // If the field value is a string, we directly if it is anonymized
        for (const sensitiveData of Constants.SENSITIVE_DATA) {
          if (key.toLocaleLowerCase() === sensitiveData.toLocaleLowerCase()) {
            expect(message[key]).to.equal(Constants.ANONYMIZED_VALUE);
          }
        }

        const dataParts: string[] = message[key].split('&'); // Check for query string
        if (dataParts.length > 1) {
          for (let i = 0; i < dataParts.length; i++) {
            const dataPart = dataParts[i];
            for (const sensitiveData of Constants.SENSITIVE_DATA) {
              if (dataPart.toLowerCase().startsWith(sensitiveData.toLocaleLowerCase())) {
                expect(dataPart.substring(sensitiveData.length + 1, dataPart.length)).to.equal(Constants.ANONYMIZED_VALUE);
                // BCheck = dataPart.substring(sensitiveData.length + 1, dataPart.length) === Constants.ANONYMIZED_VALUE;
              }
            }
          }
        }
      } else {
        checkSensitiveDataIsObfuscated(message[key]); // Otherwise we apply the method to the field value
      }
    }
  }

  return bCheck;
}


describe('Security tests', function() {
  this.timeout(30000);

  before(async function() {
    global.database = new MongoDBStorage(config.get('storage'));
    await global.database.start();

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
    it.only('Check that sensitive data is anonymized in object with string fields', async () => {
      const logId = await Logging.logDebug({
        source: 'test',
        tenantID: testData.credentials.tenantId,
        action: ServerAction.HTTP_REQUEST,
        message: 'Just a test',
        module: 'test',
        method: 'test',
        detailedMessages: {
          'name':'test',
          'firstName':'test',
          'password':'test',
          'repeatPassword':'test',
          'captcha':'test',
          'email':'test',
          'coordinates':'test',
          'latitude':'test',
          'longitude':'test',
          'Authorization':'test',
          'client_id':'test',
          'client_secret':'test',
          'refresh_token':'test',
          'localToken':'test',
          'token':'test'
        }
      });

      const read = await testData.centralService.logsApi.readById(logId);
      expect(read.status).to.equal(200);

      const bDataObfuscated = checkSensitiveDataIsObfuscated(JSON.parse(read.data.detailedMessages));
      expect(bDataObfuscated).to.equal(true);
    });
    it.only('Check that sensitive data is anonymized in object with query string fields', async () => {
      const logId = await Logging.logDebug({
        source: 'test',
        tenantID: testData.credentials.tenantId,
        action: ServerAction.HTTP_REQUEST,
        message: 'Just a test',
        module: 'test',
        method: 'test',
        detailedMessages: {
          'message1': 'name=test&firstName=testtest',
          'message2': 'text that is ok'
        }
      });

      const read = await testData.centralService.logsApi.readById(logId);
      expect(read.status).to.equal(200);

      checkSensitiveDataIsObfuscated(JSON.parse(read.data.detailedMessages));
    });
    it.only('Check that sensitive data is anonymized in array with objects', async () => {
      const logId = await Logging.logDebug({
        source: 'test',
        tenantID: testData.credentials.tenantId,
        action: ServerAction.HTTP_REQUEST,
        message: 'Just a test',
        module: 'test',
        method: 'test',
        detailedMessages: [
          { 'name':'test' },
          { 'firstName':'test', },
          {
            'password':'test',
            'repeatPassword':'test'
          },
          { 'captcha':'test' },
          { 'email':'test' },
          { 'coordinates':'test' },
          { 'latitude':'test' },
          { 'longitude':'test' },
          { 'Authorization':'test' },
          { 'client_id':'test' },
          { 'client_secret':'test' },
          {
            'refresh_token':'test',
            'localToken':'test',
            'token':'test'
          }]
      });

      const read = await testData.centralService.logsApi.readById(logId);
      expect(read.status).to.equal(200);

      checkSensitiveDataIsObfuscated(JSON.parse(read.data.detailedMessages));
    });
  });
});
