const OCPPCommonTests = require('./OCPPCommonTests');
const OCPPSoapService15 = require('./ocpp/soap/OCPPSoapService15');
const CentralServerService = require('./client/CentralServerService');
const config = require('../config');

describe('OCPP 1.5 SOAP Tests', function () {
  this.timeout(100000);

  before(async () => {
    // Get Tenant ID
    const tenantID = await CentralServerService.authenticatedApi.getTenantID();
    // Create OCPP 1.5
    this.ocpp = new OCPPSoapService15(
      `${config.get('ocpp.soap.scheme')}://${config.get('ocpp.soap.host')}:${config.get('ocpp.soap.port')}/OCPP15?TenantID=${tenantID}`);
    // Init Common tests
    this.ocppCommonTests = new OCPPCommonTests(this.ocpp);
    // Delegate
    await this.ocppCommonTests.before();
  });

  after(async () => {
    // Delegate
    await this.ocppCommonTests.after();
  });

  describe('Success cases', () => {
    it('Charging Station should set both of its connectors to Available', async () => {
      // Delegate
      await this.ocppCommonTests.testConnectorStatus();
    });

    it('Charging Station should send its heartbeat', async () => {
      // Delegate
      await this.ocppCommonTests.testHeartbeat();
    });

    it('Charging Station should send data transfer', async () => {
      // Delegate
      await this.ocppCommonTests.testDataTransfer();
    });

    it('Charging Station should authorize both start and stop users', async () => {
      // Delegate
      await this.ocppCommonTests.testAuhtorize();
    });

    it('Charging Station can change its connector status to Occupied', async () => {
      // Delegate
      await this.ocppCommonTests.testChangeConnectorStatus();
    });

    it('Start User should be able to start a new transaction', async () => {
      // Delegate
      await this.ocppCommonTests.testStartTransaction();
    });

    it('Start User should be able to start a second time a new transaction', async () => {
      // Delegate
      await this.ocppCommonTests.testStartAgainTransaction();
    });

    it('Charging Station should send meter values', async () => {
      // Delegate
      await this.ocppCommonTests.testSendMeterValues();
    });

    it('User should stop the transaction', async () => {
      // Delegate
      await this.ocppCommonTests.testStopTransaction();
    });

    it('Transaction must have the right consumption metrics and inactivity', async () => {
      // Delegate
      await this.ocppCommonTests.testTransactionMetrics();
    });

    it('User should delete his transaction', async () => {
      // Delegate
      await this.ocppCommonTests.testDeleteTransaction();
    });
  });
});