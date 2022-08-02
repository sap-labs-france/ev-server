// Goal : Checks related to security - checking if all sensitive data is anonymized in logs.
// Note : These unit tests use the tenant utall. This tenant should exist prior running these tests.
//        Run npm run mochatest:createContext to create the needed utall if not present.

import CentralServerService from './client/CentralServerService';
import Constants from '../../src/utils/Constants';
import ContextDefinition from './context/ContextDefinition';
import Logging from '../../src/utils/Logging';
import MongoDBStorage from '../../src/storage/mongodb/MongoDBStorage';
import { ServerAction } from '../../src/types/Server';
import { StatusCodes } from 'http-status-codes';
import Tenant from '../../src/types/Tenant';
import TestConstants from './client/utils/TestConstants';
import TestData from './client/utils/TestData';
import config from '../config';
import { expect } from 'chai';
import global from '../../src/types/GlobalType';

const testData: TestData = new TestData();
let initialTenant: Tenant;
const wsRegex = /^(?:(?:ws|wss):\/\/)(.*)$/ig;

/**
 * @param message
 */
function checkSensitiveDataIsObfuscated(message: any): void {
  // If the message is a string
  if (typeof message === 'string') {
    // WS URL with registration token?
    const matchingURLParts = wsRegex.exec(message);
    if (matchingURLParts && matchingURLParts.length > 0) {
      // Split matching part by /
      const urlParts = matchingURLParts[1].split('/');
      expect(urlParts.length).to.greaterThan(4);
      expect(urlParts[3]).to.equal(Constants.ANONYMIZED_VALUE);
      return;
    }
    const dataParts: string[] = message.split('&');
    // Check if it is a query string
    if (dataParts.length > 1) {
      for (const dataPart of dataParts) {
        let queryParamKey = dataPart.split('=')[0];
        const queryParamKeyParts = queryParamKey.split('?');
        queryParamKey = queryParamKeyParts.length > 1 ? queryParamKeyParts[1] : queryParamKeyParts[0];
        for (const sensitiveData of Constants.SENSITIVE_DATA) {
          if (queryParamKey.toLowerCase().startsWith(sensitiveData.toLocaleLowerCase())) {
            // Check each query string part anonymized
            const posSensitiveData = dataPart.search(sensitiveData);
            expect(dataPart).to.equal(dataPart.substring(0, posSensitiveData + sensitiveData.length + 1) + Constants.ANONYMIZED_VALUE);
            break;
          }
        }
      }
    } else {
      // In case it is a string, but not a query string, it should not contain any sensitive data
      for (const sensitiveData of Constants.SENSITIVE_DATA) {
        expect(message.toLowerCase().indexOf(sensitiveData.toLowerCase())).to.equal(-1);
        break;
      }
    }
  }
  // In case of an array, check every item anonymized
  if (Array.isArray(message)) {
    for (const item of message) {
      checkSensitiveDataIsObfuscated(item);
    }
  }
  // In case of object
  if (typeof message === 'object') {
    for (const key of Object.keys(message)) {
      if (Constants.SENSITIVE_DATA.filter((sensitiveData) => key.toLowerCase() === sensitiveData.toLowerCase()).length > 0) {
        // If the key indicates sensitive data and the value is a string, check value anonymized
        expect(message[key]).to.equal(Constants.ANONYMIZED_VALUE);
      } else { // Otherwise, apply the whole check to the value
        checkSensitiveDataIsObfuscated(message[key]);
      }
    }
  }
}

describe('Security', () => {
  jest.setTimeout(120000);

  beforeAll(async () => {
    global.database = new MongoDBStorage(config.get('storage'));
    await global.database.start();
    // Init values
    testData.superCentralService = new CentralServerService(null, { email: config.get('superadmin.username'), password: config.get('superadmin.password') });
    testData.centralService = new CentralServerService(ContextDefinition.TENANT_CONTEXTS.TENANT_WITH_ALL_COMPONENTS, { email: config.get('admin.username'), password: config.get('admin.password') });
    testData.credentials.email = config.get('admin.username');
    // Retrieve the tenant id from the name
    const response = await testData.superCentralService.tenantApi.readAll({ 'Search': ContextDefinition.TENANT_CONTEXTS.TENANT_WITH_ALL_COMPONENTS }, TestConstants.DEFAULT_PAGING);
    testData.credentials.tenantId = response ? response.data.result[0].id : '';
    initialTenant = (await testData.superCentralService.tenantApi.readById(testData.credentials.tenantId)).data;
  });

  afterAll(async () => {
    // Housekeeping
    // Reset components before leaving
    const res = await testData.superCentralService.updateEntity(
      testData.centralService.tenantApi, initialTenant);
    expect(res.status).to.equal(StatusCodes.OK);
    // Close DB connection
    await global.database.stop();
  });

  describe('Success cases (utall)', () => {
    it(
      'Check that sensitive data string (containing "=") is anonymized',
      async () => {
        const logId: string = await Logging.logDebug({
          tenantID: testData.credentials.tenantId,
          action: ServerAction.HTTP_REQUEST,
          message: 'Just a test',
          module: 'test',
          method: 'test',
          detailedMessages: 'repeatPassword=MyDummyPass'
        });
        const read = await testData.centralService.logsApi.readById(logId.toString());
        expect(read.status).to.equal(StatusCodes.OK);
        checkSensitiveDataIsObfuscated(JSON.parse(read.data.detailedMessages));
      }
    );
    it(
      'Check that sensitive data string (containing ":") is anonymized',
      async () => {
        const logId: string = await Logging.logDebug({
          tenantID: testData.credentials.tenantId,
          action: ServerAction.HTTP_REQUEST,
          message: 'Just a test',
          module: 'test',
          method: 'test',
          detailedMessages: 'firstName:MyName'
        });
        const read = await testData.centralService.logsApi.readById(logId.toString());
        expect(read.status).to.equal(StatusCodes.OK);
        checkSensitiveDataIsObfuscated(JSON.parse(read.data.detailedMessages));
      }
    );
    it(
      'Check that sensitive data string (containing ",") is anonymized',
      async () => {
        const logId: string = await Logging.logDebug({
          tenantID: testData.credentials.tenantId,
          action: ServerAction.HTTP_REQUEST,
          message: 'Just a test',
          module: 'test',
          method: 'test',
          detailedMessages: 'name,MyName'
        });
        const read = await testData.centralService.logsApi.readById(logId.toString());
        expect(read.status).to.equal(StatusCodes.OK);
        checkSensitiveDataIsObfuscated(JSON.parse(read.data.detailedMessages));
      }
    );
    it(
      'Check that sensitive data string (containing ";") is anonymized',
      async () => {
        const logId: string = await Logging.logDebug({
          tenantID: testData.credentials.tenantId,
          action: ServerAction.HTTP_REQUEST,
          message: 'Just a test',
          module: 'test',
          method: 'test',
          detailedMessages: 'password;MyPass'
        });
        const read = await testData.centralService.logsApi.readById(logId.toString());
        expect(read.status).to.equal(StatusCodes.OK);
        checkSensitiveDataIsObfuscated(JSON.parse(read.data.detailedMessages));
      }
    );
    it(
      'Check that sensitive data string (containing spaces and =) is anonymized',
      async () => {
        const logId: string = await Logging.logDebug({
          tenantID: testData.credentials.tenantId,
          action: ServerAction.HTTP_REQUEST,
          message: 'Just a test',
          module: 'test',
          method: 'test',
          detailedMessages: 'password = MyPass'
        });
        const read = await testData.centralService.logsApi.readById(logId.toString());
        expect(read.status).to.equal(StatusCodes.OK);
        checkSensitiveDataIsObfuscated(JSON.parse(read.data.detailedMessages));
      }
    );
    it(
      'Check that sensitive data string (containing spaces and :) is anonymized',
      async () => {
        const logId: string = await Logging.logDebug({
          tenantID: testData.credentials.tenantId,
          action: ServerAction.HTTP_REQUEST,
          message: 'Just a test',
          module: 'test',
          method: 'test',
          detailedMessages: 'password: MyPass'
        });
        const read = await testData.centralService.logsApi.readById(logId.toString());
        expect(read.status).to.equal(StatusCodes.OK);
        checkSensitiveDataIsObfuscated(JSON.parse(read.data.detailedMessages));
      }
    );
    it(
      'Check that sensitive data string (containing spaces and ,) is anonymized',
      async () => {
        const logId: string = await Logging.logDebug({
          tenantID: testData.credentials.tenantId,
          action: ServerAction.HTTP_REQUEST,
          message: 'Just a test',
          module: 'test',
          method: 'test',
          detailedMessages: 'password, MyPass'
        });
        const read = await testData.centralService.logsApi.readById(logId.toString());
        expect(read.status).to.equal(StatusCodes.OK);
        checkSensitiveDataIsObfuscated(JSON.parse(read.data.detailedMessages));
      }
    );
    it(
      'Check that sensitive data string (containing spaces and ;) is anonymized',
      async () => {
        const logId: string = await Logging.logDebug({
          tenantID: testData.credentials.tenantId,
          action: ServerAction.HTTP_REQUEST,
          message: 'Just a test',
          module: 'test',
          method: 'test',
          detailedMessages: 'password ; MyPass'
        });
        const read = await testData.centralService.logsApi.readById(logId.toString());
        expect(read.status).to.equal(StatusCodes.OK);
        checkSensitiveDataIsObfuscated(JSON.parse(read.data.detailedMessages));
      }
    );
    it(
      'Check that sensitive data string matching a ws url with registration token is anonymized',
      async () => {
        const logId: string = await Logging.logDebug({
          tenantID: testData.credentials.tenantId,
          action: ServerAction.HTTP_REQUEST,
          message: 'Just a test',
          module: 'test',
          method: 'test',
          detailedMessages: 'ws://localhost:8010/OCPP16/0be7fb271014d90008992f19/015b4c8ffaeb8d44e2a98315/CS-TEST'
        });
        const read = await testData.centralService.logsApi.readById(logId.toString());
        expect(read.status).to.equal(StatusCodes.OK);
        checkSensitiveDataIsObfuscated(JSON.parse(read.data.detailedMessages));
      }
    );
    it('Check that sensitive data query string is anonymized', async () => {
      const logId: string = await Logging.logDebug({
        tenantID: testData.credentials.tenantId,
        action: ServerAction.HTTP_REQUEST,
        message: 'Just a test',
        module: 'test',
        method: 'test',
        detailedMessages: 'name=MyPass&firstName=MyPass'
      });
      const read = await testData.centralService.logsApi.readById(logId.toString());
      expect(read.status).to.equal(StatusCodes.OK);
      checkSensitiveDataIsObfuscated(JSON.parse(read.data.detailedMessages));
    });
    it('Check that client_id field is anonymized', async () => {
      const logId: string = await Logging.logDebug({
        tenantID: testData.credentials.tenantId,
        action: ServerAction.HTTP_REQUEST,
        message: 'Just a test',
        module: 'test',
        method: 'test',
        detailedMessages: 'client_id=clientIDForTest'
      });
      const read = await testData.centralService.logsApi.readById(logId.toString());
      expect(read.status).to.equal(StatusCodes.OK);
      checkSensitiveDataIsObfuscated(JSON.parse(read.data.detailedMessages));
    });
    it('Check that client_secret field is anonymized', async () => {
      const logId: string = await Logging.logDebug({
        tenantID: testData.credentials.tenantId,
        action: ServerAction.HTTP_REQUEST,
        message: 'Just a test',
        module: 'test',
        method: 'test',
        detailedMessages: 'client_secret=clientSecretForTest'
      });
      const read = await testData.centralService.logsApi.readById(logId.toString());
      expect(read.status).to.equal(StatusCodes.OK);
      checkSensitiveDataIsObfuscated(JSON.parse(read.data.detailedMessages));
    });
    it(
      'Check that client_id and client_secret are anonymized in object',
      async () => {
        const logId: string = await Logging.logDebug({
          tenantID: testData.credentials.tenantId,
          action: ServerAction.HTTP_REQUEST,
          message: 'Just a test',
          module: 'test',
          method: 'test',
          detailedMessages: {
            client_id: 'tuyebgforijgetighdsf;gjdrpoighj',
            client_secret: 'fuahsrgoiuarhgpiorhg'
          }
        });
        const read = await testData.centralService.logsApi.readById(logId.toString());
        expect(read.status).to.equal(StatusCodes.OK);
        checkSensitiveDataIsObfuscated(JSON.parse(read.data.detailedMessages));
      }
    );
    it(
      'Check that sensitive data is anonymized in object with string fields',
      async () => {
        const logId: string = await Logging.logDebug({
          tenantID: testData.credentials.tenantId,
          action: ServerAction.HTTP_REQUEST,
          message: 'Just a test',
          module: 'test',
          method: 'test',
          detailedMessages: {
            'name': 'test',
            'firstName': 'test',
            'password': 'test',
            'repeatPassword': 'test',
            'captcha': 'test',
            'email': 'test',
            'coordinates': 'test',
            'latitude': 'test',
            'longitude': 'test',
            'Authorization': 'test',
            'client_id': 'test',
            'client_secret': 'test',
            'refresh_token': 'test',
            'localToken': 'test',
            'Bearer': 'test',
            'auth_token': 'test',
            'token': 'test',
          }
        });
        const read = await testData.centralService.logsApi.readById(logId.toString());
        expect(read.status).to.equal(StatusCodes.OK);
        checkSensitiveDataIsObfuscated(JSON.parse(read.data.detailedMessages));
      }
    );
    it(
      'Check that sensitive data is anonymized in object with query string fields',
      async () => {
        const logId: string = await Logging.logDebug({
          tenantID: testData.credentials.tenantId,
          action: ServerAction.HTTP_REQUEST,
          message: 'Just a test',
          module: 'test',
          method: 'test',
          detailedMessages: {
            'message1': 'name=test&firstName=testtest',
            'message2': 'text that is ok',
            'password': 'password=testtesttest',
            'message3': 'text?auth_token=test&id=text is ok'
          }
        });
        const read = await testData.centralService.logsApi.readById(logId.toString());
        expect(read.status).to.equal(StatusCodes.OK);
        checkSensitiveDataIsObfuscated(JSON.parse(read.data.detailedMessages));
      }
    );
    it(
      'Check that sensitive data is anonymized in array with strings',
      async () => {
        const logId: string = await Logging.logDebug({
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
        expect(read.status).to.equal(StatusCodes.OK);
        checkSensitiveDataIsObfuscated(JSON.parse(read.data.detailedMessages));
      }
    );
  });
});
