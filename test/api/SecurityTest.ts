// Goal : Checks related to security - checking if all sensitive data is anonymized in logs.
// Note : These unit tests use the tenant utall. This tenant should exist prior running these tests.
//        Run npm run mochatest:createContext to create the needed utall if not present.

import CentralServerService from './client/CentralServerService';
import Constants from '../../src/utils/Constants';
import ContextDefinition from './context/ContextDefinition';
import Logging from '../../src/utils/Logging';
import MongoDBStorage from '../../src/storage/mongodb/MongoDBStorage';
import { ObjectID } from 'mongodb';
import { ServerAction } from '../../src/types/Server';
import Tenant from '../types/Tenant';
import TestConstants from './client/utils/TestConstants';
import TestData from './client/utils/TestData';
import config from '../config';
import { expect } from 'chai';
import global from '../../src/types/GlobalType';

const testData: TestData = new TestData();
let initialTenant: Tenant;

function checkSensitiveDataIsObfuscated(message:any): void {
  if (typeof message === 'string') { // If the message is a string
    const dataParts: string[] = message.split('&');
    // Check if it is a query string
    if (dataParts.length > 1) {
      for (let i = 0; i < dataParts.length; i++) {
        const dataPart = dataParts[i];
        for (const sensitiveData of Constants.SENSITIVE_DATA) {
          if (dataPart.toLowerCase().startsWith(sensitiveData.toLocaleLowerCase())) { // Check each query string part anonymized
            expect(dataPart).to.equal(dataPart.substring(0, sensitiveData.length + 1) + Constants.ANONYMIZED_VALUE);
            break;
          }
        }
      }
    } else {
    // If it is a string, but not a query string
      for (const sensitiveData of Constants.SENSITIVE_DATA) {
        if (new RegExp(sensitiveData + '(\\s*)[:=,;](\\s*)(.*)', 'gi').test(message)) { // If it contains sensitive data and it matches the RegExp, check data anonymized
          expect(message).to.equal(message.toString().substring(0, sensitiveData.length + 1) + Constants.ANONYMIZED_VALUE);
          break;
        }
      }
    }
  } else if (Array.isArray(message)) { // In case of an array, check every item anonymized
    for (const item of message) {
      checkSensitiveDataIsObfuscated(item);
    }
  } else if (typeof message === 'object') { // In case of object
    for (const key of Object.keys(message)) {
      if (typeof message[key] === 'string' && Constants.SENSITIVE_DATA.filter((sensitiveData) => key.toLocaleLowerCase() === sensitiveData.toLocaleLowerCase()).length > 0) {
        // If the key indicates sensitive data and the value is a string, check value anonymized
        expect(message[key]).to.equal(Constants.ANONYMIZED_VALUE);
      } else { // Otherwise, apply the whole check to the value
        checkSensitiveDataIsObfuscated(message[key]);
      }
    }
  }
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
    it('Check that sensitive data string (containing "=")  is anonymized', async () => { // Will fail
      const logId:ObjectID = await Logging.logDebug({
        source: 'test',
        tenantID: testData.credentials.tenantId,
        action: ServerAction.HTTP_REQUEST,
        message: 'Just a test',
        module: 'test',
        method: 'test',
        detailedMessages: 'repeatPassword=MyDummyPass'
      });
      const read = await testData.centralService.logsApi.readById(logId.toString());
      expect(read.status).to.equal(200);
      checkSensitiveDataIsObfuscated(JSON.parse(read.data.detailedMessages));
    });
    it('Check that sensitive data string (containing ":") is anonymized', async () => { // Will fail
      const logId:ObjectID = await Logging.logDebug({
        source: 'test',
        tenantID: testData.credentials.tenantId,
        action: ServerAction.HTTP_REQUEST,
        message: 'Just a test',
        module: 'test',
        method: 'test',
        detailedMessages: 'firstName:MyName'
      });
      const read = await testData.centralService.logsApi.readById(logId.toString());
      expect(read.status).to.equal(200);
      checkSensitiveDataIsObfuscated(JSON.parse(read.data.detailedMessages));
    });
    it('Check that sensitive data string (containing ",") is anonymized', async () => { // Will fail
      const logId:ObjectID = await Logging.logDebug({
        source: 'test',
        tenantID: testData.credentials.tenantId,
        action: ServerAction.HTTP_REQUEST,
        message: 'Just a test',
        module: 'test',
        method: 'test',
        detailedMessages: 'name,MyName'
      });
      const read = await testData.centralService.logsApi.readById(logId.toString());
      expect(read.status).to.equal(200);
      checkSensitiveDataIsObfuscated(JSON.parse(read.data.detailedMessages));
    });
    it('Check that sensitive data string (containing ";") is anonymized', async () => { // Will fail
      const logId:ObjectID = await Logging.logDebug({
        source: 'test',
        tenantID: testData.credentials.tenantId,
        action: ServerAction.HTTP_REQUEST,
        message: 'Just a test',
        module: 'test',
        method: 'test',
        detailedMessages: 'password;MyPass'
      });
      const read = await testData.centralService.logsApi.readById(logId.toString());
      expect(read.status).to.equal(200);
      checkSensitiveDataIsObfuscated(JSON.parse(read.data.detailedMessages));
    });
    it('Check that sensitive data string (containing spaces) is anonymized', async () => { // Will fail
      const logId:ObjectID = await Logging.logDebug({
        source: 'test',
        tenantID: testData.credentials.tenantId,
        action: ServerAction.HTTP_REQUEST,
        message: 'Just a test',
        module: 'test',
        method: 'test',
        detailedMessages: 'password = MyPass'
      });
      const read = await testData.centralService.logsApi.readById(logId.toString());
      expect(read.status).to.equal(200);
      checkSensitiveDataIsObfuscated(JSON.parse(read.data.detailedMessages));
    });
    it('Check that sensitive data is anonymized in object with string fields', async () => {
      const logId:ObjectID = await Logging.logDebug({
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
      const read = await testData.centralService.logsApi.readById(logId.toString());
      expect(read.status).to.equal(200);
      checkSensitiveDataIsObfuscated(JSON.parse(read.data.detailedMessages));
    });
    it('Check that sensitive data is anonymized in object with query string fields', async () => { // Passes because query strings are treated correctly in object fields
      const logId:ObjectID = await Logging.logDebug({
        source: 'test',
        tenantID: testData.credentials.tenantId,
        action: ServerAction.HTTP_REQUEST,
        message: 'Just a test',
        module: 'test',
        method: 'test',
        detailedMessages: {
          'message1': 'name=test&firstName=testtest',
          'message2': 'text that is ok',
          'password': 'password=testtesttest'
        }
      });
      const read = await testData.centralService.logsApi.readById(logId.toString());
      expect(read.status).to.equal(200);
      checkSensitiveDataIsObfuscated(JSON.parse(read.data.detailedMessages));
    });
    it('Check that sensitive data is anonymized in array with strings', async () => { // Will fail
      const logId:ObjectID = await Logging.logDebug({
        source: 'test',
        tenantID: testData.credentials.tenantId,
        action: ServerAction.HTTP_REQUEST,
        message: 'Just a test',
        module: 'test',
        method: 'test',
        detailedMessages: [
          'name=test',
          'firstName = test',
          'password= test',
          'repeatPassword =test',
          'captcha:test',
          'email: test',
          'coordinates : test',
          'latitude :test',
          'longitude,test',
          'Authorization , test',
          'client_id, test',
          'client_secret ,test',
          'refresh_token;test',
          'localToken ; test',
          'token; test',
          'token ;test2'
        ]
      });
      const read = await testData.centralService.logsApi.readById(logId.toString());
      expect(read.status).to.equal(200);
      console.log(read.data.detailedMessages);
      checkSensitiveDataIsObfuscated(JSON.parse(read.data.detailedMessages));
    });
  });
});
