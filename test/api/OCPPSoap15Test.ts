const path = require('path');
 import global from'../../src/types/GlobalType';
 
global.appRoot = path.resolve(__dirname, '../../src');
import OCPPCommonTests from './OCPPCommonTests';
import OCPPSoapService15 from './ocpp/soap/OCPPSoapService15';
import CentralServerService from './client/CentralServerService';
import config from '../config';

class TestData {
  public ocpp: OCPPSoapService15;
  public ocppCommonTests: OCPPCommonTests;
}

const testData: TestData = new TestData();

describe('OCPP 1.5 SOAP Tests', function () {
  this.timeout(10000);

  before(async () => {
    // Get Tenant ID
    const tenantID = await CentralServerService.DefaultInstance.authenticatedApi.getTenantID();
    // Create OCPP 1.5
    testData.ocpp = new OCPPSoapService15(
      `${config.get('ocpp.soap.scheme')}://${config.get('ocpp.soap.host')}:${config.get('ocpp.soap.port')}/OCPP15?TenantID=${tenantID}`);
    // Init Common tests
    testData.ocppCommonTests = new OCPPCommonTests(testData.ocpp);
    // Delegate
    await testData.ocppCommonTests.before();
  });

  after(async () => {
    // Delegate
    await testData.ocppCommonTests.after();
  });

  describe('Success cases', () => {
    it('Charging Station should set both of its connectors to Available', async () => {
      // Delegate
      await testData.ocppCommonTests.testConnectorStatus();
    });

    it('Charging Station should send its heartbeat', async () => {
      // Delegate
      await testData.ocppCommonTests.testHeartbeat();
    });

    it('Charging Station should send data transfer', async () => {
      // Delegate
      await testData.ocppCommonTests.testDataTransfer();
    });

    it('Charging Station should authorize both start and stop users', async () => {
      // Delegate
      await testData.ocppCommonTests.testAuthorizeUsers();
    });

    it('Charging Station can change its connector status to Occupied', async () => {
      // Delegate
      await testData.ocppCommonTests.testChangeConnectorStatus();
    });

    it('Start User should be able to start a new transaction', async () => {
      // Delegate
      await testData.ocppCommonTests.testStartTransaction();
    });
    it('Start User should be able to start a second time a new transaction', async () => {
      // Delegate
      await testData.ocppCommonTests.testStartSecondTransaction();
    });
    it('Charging Station should send meter values', async () => {
      // Delegate
      await testData.ocppCommonTests.testSendMeterValues();
    });
    it('User should stop the transaction', async () => {
      // Delegate
      await testData.ocppCommonTests.testStopTransaction();
    });
    it('Transaction must have the right consumption metrics and inactivity', async () => {
      // Delegate
      await testData.ocppCommonTests.testTransactionMetrics();
    });
    it('User should delete his transaction', async () => {
      // Delegate
      await testData.ocppCommonTests.testDeleteTransaction();
    });
    it('Transaction must be stopped by StatusNotification', async () => {
      // Delegate
      await testData.ocppCommonTests.testConnectorStatusToStopTransaction();
    });
  });
});
