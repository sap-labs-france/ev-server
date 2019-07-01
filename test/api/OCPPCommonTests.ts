import chai, { expect } from 'chai';
import chaiSubset from 'chai-subset';
import faker from 'faker';
import moment from 'moment';
import CentralServerService from '../api/client/CentralServerService';
import OCPPBootstrap from './OCPPBootstrap';
import OCPPService from './ocpp/OCPPService';

chai.use(chaiSubset);

export default class OCPPCommonTests {

  public ocpp: OCPPService;
  public bootstrap: OCPPBootstrap;
  public priceKWH = 1;
  public context: any;
  public chargingStationConnector1: any;
  public chargingStationConnector2: any;
  public transactionStartUser: any;
  public transactionStopUser: any;
  public transactionStartMeterValue: any;
  public transactionStartSoC: any;
  public transactionMeterValues: any;
  public transactionMeterSoCValues: any;
  public transactionMeterValueIntervalSecs: any;
  public transactionStartTime: any;
  public transactionTotalConsumption: any;
  public transactionEndMeterValue: any;
  public transactionEndSoC: any;
  public transactionTotalInactivity: any;
  public totalPrice: any;
  public newTransaction: any;
  public transactionCurrentTime: any;

  public constructor(ocpp) {
    this.ocpp = ocpp;
    // Create Bootstrap with OCPP
    this.bootstrap = new OCPPBootstrap(this.ocpp);
  }

  public async before() {
    // pragma await CentralServerService.DefaultInstance.pricingApi.update({priceKWH: OCPPCommonTests.priceKWH, priceUnit: 'EUR'});
    await CentralServerService.DefaultInstance.updatePriceSetting(this.priceKWH , 'EUR');
    // Create data
    this.context = await this.bootstrap.createContext();
    // Default Connector values
    this.chargingStationConnector1 = {
      connectorId: 1,
      status: 'Available',
      errorCode: 'NoError',
      timestamp: new Date().toISOString()
    };
    this.chargingStationConnector2 = {
      connectorId: 2,
      status: 'Available',
      errorCode: 'NoError',
      timestamp: new Date().toISOString()
    };
    // Set meter value start
    this.transactionStartUser = this.context.newUser;
    this.transactionStopUser = this.context.newUser;
    this.transactionStartMeterValue = 0;
    this.transactionMeterValues = Array.from({ length: 12 }, () => {
      return faker.random.number({
        min: 200,
        max: 500
      });
    }).concat([0, 0]);
    this.transactionMeterSoCValues = Array.from({ length: 10 }, () => {
      return faker.random.number({
        min: 0,
        max: 90
      });
    }).concat([98, 99, 100, 100]).sort((a, b) => {
      return (a - b);
    });
    this.transactionStartSoC = this.transactionMeterSoCValues[0];
    this.transactionMeterValueIntervalSecs = 60;
    this.transactionStartTime = moment().subtract(this.transactionMeterValues.length * this.transactionMeterValueIntervalSecs + 1, 'seconds');
    this.transactionTotalConsumption = this.transactionMeterValues.reduce((sum, meterValue) => {
      return sum + meterValue;
    });
    this.transactionEndMeterValue = this.transactionStartMeterValue + this.transactionTotalConsumption;
    this.transactionEndSoC = 100;
    this.transactionTotalInactivity = this.transactionMeterValues.reduce(
      (sum, meterValue) => {
        return (meterValue === 0 ? sum + this.transactionMeterValueIntervalSecs : sum);
      }, 0);
    this.totalPrice = this.priceKWH * (this.transactionTotalConsumption / 1000);
  }

  public async after() {
    // Destroy context
    if (this.context) {
      await this.bootstrap.destroyContext(this.context);
    }
  }

  public async testConnectorStatus() {
    // Update Status of Connector 1
    let response = await this.ocpp.executeStatusNotification(this.context.newChargingStation.id, this.chargingStationConnector1);
    // Check
    expect(response.data).to.eql({});
    // Check Connector 1
    await CentralServerService.DefaultInstance.chargingStationApi.checkConnector(
      this.context.newChargingStation, 1, this.chargingStationConnector1);

    // Update Status of Connector 2
    response = await this.ocpp.executeStatusNotification(this.context.newChargingStation.id, this.chargingStationConnector2);
    // Check
    expect(response.data).to.eql({});
    // Check Connector 2
    await CentralServerService.DefaultInstance.chargingStationApi.checkConnector(
      this.context.newChargingStation, 2, this.chargingStationConnector2);
  }

  public async testChangeConnectorStatus() {
    // Set it to Occupied
    this.chargingStationConnector1.status = 'Occupied';
    this.chargingStationConnector1.timestamp = new Date().toISOString();
    // Update
    let response = await this.ocpp.executeStatusNotification(this.context.newChargingStation.id, this.chargingStationConnector1);
    // Check
    expect(response.data).to.eql({});

    // Check Connector 1
    await CentralServerService.DefaultInstance.chargingStationApi.checkConnector(
      this.context.newChargingStation, 1, this.chargingStationConnector1);

    // Connector 2 should be still available
    await CentralServerService.DefaultInstance.chargingStationApi.checkConnector(
      this.context.newChargingStation, 2, this.chargingStationConnector2);

    // Reset Status of Connector 1
    this.chargingStationConnector1.status = 'Available';
    this.chargingStationConnector1.timestamp = new Date().toISOString();
    // Update
    response = await this.ocpp.executeStatusNotification(this.context.newChargingStation.id, this.chargingStationConnector1);
    // Check
    expect(response.data).to.eql({});

    // Check Connector 1
    await CentralServerService.DefaultInstance.chargingStationApi.checkConnector(
      this.context.newChargingStation, 1, this.chargingStationConnector1);
  }

  public async testHeartbeat() {
    // Update Status of Connector 1
    const response = await this.ocpp.executeHeartbeat(this.context.newChargingStation.id, {});
    // Check
    expect(response.data).to.have.property('currentTime');
  }

  public async testDataTransfer() {
    // Check
    const response = await this.ocpp.executeDataTransfer(this.context.newChargingStation.id, {
      'vendorId': 'Schneider Electric',
      'messageId': 'Detection loop',
      'data': '{\\"connectorId\\":2,\\"name\\":\\"Vehicle\\",\\"state\\":\\"0\\",\\"timestamp\\":\\"2018-08-08T10:21:11Z:\\"}',
      'chargeBoxID': this.context.newChargingStation.id,
      'timestamp': new Date().toDateString()
    });
    // Check
    expect(response.data).to.have.property('status');
    expect(response.data.status).to.equal('Accepted');
  }

  async testAuthorizeUsers() {
    // Asserts that the start user is authorized.
    await this.testAuthorize(this.transactionStartUser.tagIDs[0], 'Accepted');
    // Asserts that the stop user is authorized.
    await this.testAuthorize(this.transactionStopUser.tagIDs[0], 'Accepted');
    // Asserts that the user with a too long tag is not authorized.
    await this.testAuthorize('ThisIsATooTooTooLongTag', 'Invalid');
  }

  public async testAuthorize(tagId, expectedStatus) {
    const response = await this.ocpp.executeAuthorize(this.context.newChargingStation.id, {
      idTag: tagId
    });
    // Check
    expect(response.data).to.have.property('idTagInfo');
    expect(response.data.idTagInfo.status).to.equal(expectedStatus);
  }

  public async testStartTransaction(withSoC = false) {
    // Start a new Transaction
    const response = await CentralServerService.DefaultInstance.transactionApi.startTransaction(
      this.ocpp,
      this.context.newChargingStation,
      this.chargingStationConnector1,
      this.transactionStartUser,
      this.transactionStartMeterValue,
      this.transactionStartTime,
      withSoC);
    this.newTransaction = (await CentralServerService.DefaultInstance.transactionApi.readById(response.data.transactionId)).data;
    // Check on Transaction
    expect(this.newTransaction).to.not.be.null;
  }

  public async testStartSecondTransaction(withSoC = false) {
    // Check on Transaction
    expect(this.newTransaction).to.not.be.null;
    // Set
    const transactionId = this.newTransaction.id;
    this.transactionStartTime = moment().subtract(1, 'h');
    // Clear old one
    this.newTransaction = null;

    // Start the Transaction
    const response = await CentralServerService.DefaultInstance.transactionApi.startTransaction(
      this.ocpp,
      this.context.newChargingStation,
      this.chargingStationConnector1,
      this.transactionStartUser,
      this.transactionStartMeterValue,
      this.transactionStartTime,
      withSoC);

    // Check if the Transaction exists
    this.newTransaction = (await CentralServerService.DefaultInstance.transactionApi.readById(response.data.transactionId)).data;
    // Check
    expect(this.newTransaction).to.not.be.null;
    expect(this.newTransaction.id).to.not.equal(transactionId);
  }

  public async testSendMeterValues(withSoC = false) {
    // Check on Transaction
    expect(this.newTransaction).to.not.be.null;
    // Current Time matches Transaction one
    this.transactionCurrentTime = moment(this.newTransaction.timestamp);
    // Start Meter Value matches Transaction one
    let transactionCurrentMeterValue = this.transactionStartMeterValue;
    // Send Transaction.Begin
    await CentralServerService.DefaultInstance.transactionApi.sendBeginMeterValue(
      this.ocpp,
      this.newTransaction,
      this.context.newChargingStation,
      this.transactionStartUser,
      transactionCurrentMeterValue,
      this.transactionStartSoC,
      this.transactionCurrentTime,
      withSoC);
    // Send Meter Values (except the last one which will be used in Stop Transaction)
    for (let index = 0; index <= this.transactionMeterValues.length - 2; index++) {
      // Set new meter value
      transactionCurrentMeterValue += this.transactionMeterValues[index];
      // Add time
      this.transactionCurrentTime.add(this.transactionMeterValueIntervalSecs, 's');
      if (withSoC) {
        // Send Meter Values
        await CentralServerService.DefaultInstance.transactionApi.sendTransactionWithSoCMeterValue(
          this.ocpp,
          this.newTransaction,
          this.context.newChargingStation,
          this.transactionStartUser,
          transactionCurrentMeterValue,
          this.transactionMeterSoCValues[index],
          this.transactionCurrentTime,
          this.transactionMeterValues[index] * this.transactionMeterValueIntervalSecs,
          transactionCurrentMeterValue - this.transactionStartMeterValue);
      } else {
        await CentralServerService.DefaultInstance.transactionApi.sendTransactionMeterValue(
          this.ocpp,
          this.newTransaction,
          this.context.newChargingStation,
          this.transactionStartUser,
          transactionCurrentMeterValue,
          this.transactionCurrentTime,
          this.transactionMeterValues[index] * this.transactionMeterValueIntervalSecs,
          transactionCurrentMeterValue - this.transactionStartMeterValue);
      }
    }
    // Send Transaction.End
    await CentralServerService.DefaultInstance.transactionApi.sendEndMeterValue(
      this.ocpp,
      this.newTransaction,
      this.context.newChargingStation,
      this.transactionStartUser,
      this.transactionEndMeterValue,
      this.transactionEndSoC,
      moment(this.transactionCurrentTime),
      withSoC);
  }

  public async testStopTransaction(withSoC = false) {
    // Check on Transaction
    expect(this.newTransaction).to.not.be.null;
    expect(this.transactionCurrentTime).to.not.be.null;

    // Set end time
    this.transactionCurrentTime.add(this.transactionMeterValueIntervalSecs, 's');

    // Stop the Transaction
    await CentralServerService.DefaultInstance.transactionApi.stopTransaction(
      this.ocpp,
      this.newTransaction,
      this.transactionStartUser,
      this.transactionStopUser,
      this.transactionEndMeterValue,
      this.transactionCurrentTime,
      this.chargingStationConnector1,
      this.transactionTotalConsumption,
      this.transactionTotalInactivity,
      this.totalPrice,
      (withSoC ? this.transactionEndSoC : 0));
  }

  public async testTransactionMetrics(withSoC = false) {
    // Check on Transaction
    expect(this.newTransaction).to.not.be.null;

    // Get the consumption
    const response = await CentralServerService.DefaultInstance.transactionApi.readAllConsumption({ TransactionId: this.newTransaction.id });
    expect(response.status).to.equal(200);
    // Check Headers
    expect(response.data).to.deep['containSubset']({
      'chargeBoxID': this.newTransaction.chargeBoxID,
      'connectorId': this.newTransaction.connectorId,
      'stateOfCharge': (withSoC ? this.transactionStartSoC : 0),
      'stop': {
        'price': this.totalPrice,
        'pricingSource': 'simple',
        'roundedPrice': parseFloat(this.totalPrice.toFixed(2)),
        'tagID': this.newTransaction.tagID,
        'totalConsumption': this.transactionTotalConsumption,
        'totalInactivitySecs': this.transactionTotalInactivity,
        'stateOfCharge': (withSoC ? this.transactionEndSoC : 0),
        'user': {
          'id': this.transactionStartUser.id,
          'name': this.transactionStartUser.name,
          'firstName': this.transactionStartUser.firstName
        }
      },
      'id': this.newTransaction.id,
      'user': {
        'id': this.transactionStartUser.id,
        'name': this.transactionStartUser.name,
        'firstName': this.transactionStartUser.firstName
      }
    });
    // Init
    const transactionCurrentTime = moment(this.newTransaction.timestamp);
    let transactionCumulatedConsumption = this.transactionStartMeterValue;
    // Check Consumption
    for (let i = 0; i < response.data.values.length; i++) {
      // Get the value
      const value = response.data.values[i];
      // Check
      expect(value).to.include({
        'chargeBoxID': this.newTransaction.chargeBoxID,
        'connectorId': this.newTransaction.connectorId,
        'date': transactionCurrentTime.toISOString(),
        'value': (i > 0 ? this.transactionMeterValues[i - 1] * this.transactionMeterValueIntervalSecs : this.transactionStartMeterValue),
        'cumulated': transactionCumulatedConsumption
      });
      if (withSoC) {
        // Check
        expect(value).to.include({
          'stateOfCharge': (i > 0 ? this.transactionMeterSoCValues[i - 1] : this.transactionStartSoC)
        });
      }
      // Add time
      transactionCurrentTime.add(this.transactionMeterValueIntervalSecs, 's');
      // Sum
      transactionCumulatedConsumption += this.transactionMeterValues[i];
    }
  }

  public async testDeleteTransaction() {
    // Delete the created entity
    await CentralServerService.DefaultInstance.deleteEntity(
      CentralServerService.DefaultInstance.transactionApi, this.newTransaction);
    this.newTransaction = null;
  }

  public async testConnectorStatusToStopTransaction() {
    // Check on Transaction
    expect(this.newTransaction).to.be.null;
    expect(this.chargingStationConnector1.status).to.eql('Available');

    // Start a new Transaction
    const response = await CentralServerService.DefaultInstance.transactionApi.startTransaction(
      this.ocpp,
      this.context.newChargingStation,
      this.chargingStationConnector1,
      this.transactionStartUser,
      this.transactionStartMeterValue,
      this.transactionStartTime,
      false);
    // Check on Transaction
    expect(response).to.not.be.null;
    this.newTransaction = (await CentralServerService.DefaultInstance.transactionApi.readById(response.data.transactionId)).data;
    expect(this.newTransaction).to.not.be.null;

    this.chargingStationConnector1.status = 'Available';
    this.chargingStationConnector1.errorCode = 'NoError';
    this.chargingStationConnector1.timestamp = new Date().toISOString();
    // Update Status of Connector 1
    const responseStatusNotification = await this.ocpp.executeStatusNotification(this.context.newChargingStation.id, this.chargingStationConnector1);
    // Check
    expect(responseStatusNotification.data).to.eql({});
    // Check Connector 1
    await CentralServerService.DefaultInstance.chargingStationApi.checkConnector(
      this.context.newChargingStation, 1, this.chargingStationConnector1);

  }
}
