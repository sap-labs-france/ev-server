import path from 'path';
import TSGlobal from '../../src/types/GlobalType';
declare const global: TSGlobal;
global.appRoot = path.resolve(__dirname, '../../src');
import OCPPCommonTests from './OCPPCommonTests';
import OCPPJsonService16 from './ocpp/json/OCPPJsonService16';
import CentralServerService from './client/CentralServerService';
import config from '../config';

class TestData {
  public ocpp: OCPPJsonService16;
  public ocppCommonTests: OCPPCommonTests;
}

const testData: TestData = new TestData();

describe('OCPP 1.6 JSON Tests', function() {
  this.timeout(10000);

  before(async () => {
    // Get Tenant ID
    const tenantID = await CentralServerService.DefaultInstance.authenticatedApi.getTenantID();
    // Create OCPP 1.6
    testData.ocpp = new OCPPJsonService16(
      `${config.get('ocpp.json.scheme')}://${config.get('ocpp.json.host')}:${config.get('ocpp.json.port')}/OCPP16/${tenantID}`, null);
    // Init Common tests
    testData.ocppCommonTests = new OCPPCommonTests(testData.ocpp);
    // Delegate
    await testData.ocppCommonTests.before();
  });

  after(async () => {
    // Delegate
    await testData.ocppCommonTests.after();
    // Close WS
    testData.ocpp.closeConnection();
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

    it('Start User should be able to start a new transaction (with SoC)', async () => {
      // Delegate
      await testData.ocppCommonTests.testStartTransaction(true);
    });
    it('Charging Station should send meter values (with SoC)', async () => {
      await testData.ocppCommonTests.testSendMeterValues(true);
    });
    it('User should stop the transaction (with SoC)', async () => {
      // Delegate
      await testData.ocppCommonTests.testStopTransaction(true);
    });
    it('Transaction must have the right consumption metrics and inactivity (with SoC)', async () => {
      // Delegate
      await testData.ocppCommonTests.testTransactionMetrics(true);
    });
    it('User should delete his transaction (with SoC)', async () => {
      // Delegate
      await testData.ocppCommonTests.testDeleteTransaction();
    });
  });

  describe('Error cases', () => {
  });
});
