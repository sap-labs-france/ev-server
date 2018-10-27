const OCPPCommonTests = require('./OCPPCommonTests');
const OCPPJsonService16 = require('./ocpp/json/OCPPJsonService16');
const config = require('../config');

describe('OCPP 1.6 JSON Tests', function () {
  this.timeout(100000);

  before(async () => {
    // Create OCPP 1.5
    this.ocpp = new OCPPJsonService16(`${config.get('ocpp.json.scheme')}://${config.get('ocpp.json.host')}:${config.get('ocpp.json.port')}/OCPP16`);
    // Init Common tests
    this.ocppCommonTests = new OCPPCommonTests(this.ocpp);
    // Delegate
    await this.ocppCommonTests.before();
  });

  after(async () => {
    // Delegate
    await this.ocppCommonTests.after();
    // Close WS
    this.ocpp.closeConnection();
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

    it('Stop User should stop the transaction', async () => {
      // Delegate
      await this.ocppCommonTests.testStopTransaction();
    });

    it('Transaction must have the same consumption metrics', async () => {
      // Delegate
      await this.ocppCommonTests.testTransactionMetrics();
    });

    it('User should delete the transaction', async () => {
      // Delegate
      await this.ocppCommonTests.testDeleteTransaction();
    });
  });
});