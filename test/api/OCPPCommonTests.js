const path = require('path');
global.appRoot = path.resolve(__dirname, '../../src');
const moment = require('moment');
const {
  expect
} = require('chai');
const chai = require('chai');
const chaiSubset = require('chai-subset');
const faker = require('faker');
chai.use(chaiSubset);
const CentralServerService = require('./client/CentralServerService');
const OCPPBootstrap = require('./OCPPBootstrap');

class OCPPCommonTests {
  constructor(ocpp) {
    this.ocpp = ocpp;
  }

  async before() {
    this.priceKWH = 1;
    // await CentralServerService.pricingApi.update({priceKWH: this.priceKWH, priceUnit: 'EUR'});
    await CentralServerService.updatePriceSetting(this.priceKWH , 'EUR');
    // Create Bootstrap with OCPP
    this.bootstrap = new OCPPBootstrap(this.ocpp);
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
    this.transactionMeterValues = Array.from({length: 10}, () => faker.random.number({
      min: 200,
      max: 500
    })).concat([0, 0, 0, 0]);
    this.transactionMeterSoCValues = Array.from({length: 10}, () => faker.random.number({
      min: 0,
      max: 100
    })).concat([100, 100, 100, 100]).sort((a, b) => (a - b));
    this.transactionMeterValueIntervalSecs = 60;
    this.transactionStartTime = moment().subtract(this.transactionMeterValues.length * this.transactionMeterValueIntervalSecs, "seconds");
    this.transactionTotalConsumption = this.transactionMeterValues.reduce((sum, meterValue) => sum + meterValue);
    this.transactionEndMeterValue = this.transactionStartMeterValue + this.transactionTotalConsumption;
    this.transactionTotalInactivity = this.transactionMeterValues.reduce(
      (sum, meterValue) => (meterValue === 0 ? sum + this.transactionMeterValueIntervalSecs : sum), 0);
    this.totalPrice =  this.priceKWH * (this.transactionTotalConsumption / 1000);
  }

  async after() {
    // Destroy context
    await this.bootstrap.destroyContext(this.context);
  }

  async testConnectorStatus() {
    // Update Status of Connector 1
    let response = await this.ocpp.executeStatusNotification(this.context.newChargingStation.id, this.chargingStationConnector1);
    // Check
    expect(response.data).to.eql({});
    // Check Connector 1
    await CentralServerService.chargingStationApi.checkConnector(
      this.context.newChargingStation, 1, this.chargingStationConnector1);

    // Update Status of Connector 2
    response = await this.ocpp.executeStatusNotification(this.context.newChargingStation.id, this.chargingStationConnector2);
    // Check
    expect(response.data).to.eql({});
    // Check Connector 2
    await CentralServerService.chargingStationApi.checkConnector(
      this.context.newChargingStation, 2, this.chargingStationConnector2);
  }

  async testChangeConnectorStatus() {
    // Set it to Occupied
    this.chargingStationConnector1.status = 'Occupied';
    this.chargingStationConnector1.timestamp = new Date().toISOString();
    // Update
    let response = await this.ocpp.executeStatusNotification(this.context.newChargingStation.id, this.chargingStationConnector1);
    // Check
    expect(response.data).to.eql({});

    // Check Connector 1
    await CentralServerService.chargingStationApi.checkConnector(
      this.context.newChargingStation, 1, this.chargingStationConnector1);

    // Connector 2 should be still available
    await CentralServerService.chargingStationApi.checkConnector(
      this.context.newChargingStation, 2, this.chargingStationConnector2);

    // Reset Status of Connector 1
    this.chargingStationConnector1.status = 'Available';
    this.chargingStationConnector1.timestamp = new Date().toISOString();
    // Update
    response = await this.ocpp.executeStatusNotification(this.context.newChargingStation.id, this.chargingStationConnector1);
    // Check
    expect(response.data).to.eql({});

    // Check Connector 1
    await CentralServerService.chargingStationApi.checkConnector(
      this.context.newChargingStation, 1, this.chargingStationConnector1);
  }

  async testHeartbeat() {
    // Update Status of Connector 1
    const response = await this.ocpp.executeHeartbeat(this.context.newChargingStation.id, {});
    // Check
    expect(response.data).to.have.property('currentTime');
  }

  async testDataTransfer() {
    // Check
    const response = await this.ocpp.executeDataTransfer(this.context.newChargingStation.id, {
      "vendorId": "Schneider Electric",
      "messageId": "Detection loop",
      "data": "{\\\"connectorId\\\":2,\\\"name\\\":\\\"Vehicle\\\",\\\"state\\\":\\\"0\\\",\\\"timestamp\\\":\\\"2018-08-08T10:21:11Z:\\\"}",
      "chargeBoxID": this.context.newChargingStation.id,
      "timestamp": new Date().toDateString()
    });
    // Check
    expect(response.data).to.have.property('status');
    expect(response.data.status).to.equal('Accepted');
  }

  async testAuhtorize() {
    // Check
    let response = await this.ocpp.executeAuthorize(this.context.newChargingStation.id, {
      idTag: this.transactionStartUser.tagIDs[0]
    });
    // Check
    expect(response.data).to.have.property('idTagInfo');
    expect(response.data.idTagInfo.status).to.equal('Accepted');

    // Check
    response = await this.ocpp.executeAuthorize(this.context.newChargingStation.id, {
      idTag: this.transactionStopUser.tagIDs[0]
    });
    // Check
    expect(response.data).to.have.property('idTagInfo');
    expect(response.data.idTagInfo.status).to.equal('Accepted');
  }

  async testStartTransaction() {
    // Start a new Transaction
    this.newTransaction = await CentralServerService.transactionApi.startTransaction(
      this.ocpp,
      this.context.newChargingStation,
      this.chargingStationConnector1,
      this.transactionStartUser,
      this.transactionStartMeterValue,
      this.transactionStartTime);
    // Check on Transaction
    expect(this.newTransaction).to.not.be.null;
  }

  async testStartAgainTransaction() {
    // Check on Transaction
    expect(this.newTransaction).to.not.be.null;
    // Set
    const transactionId = this.newTransaction.id;
    this.transactionStartTime = moment().subtract(1, "h");
    // Clear old one
    this.newTransaction = null;

    // Start the Transaction
    this.newTransaction = await CentralServerService.transactionApi.startTransaction(
      this.ocpp,
      this.context.newChargingStation,
      this.chargingStationConnector1,
      this.transactionStartUser,
      this.transactionStartMeterValue,
      this.transactionStartTime);
    // Check
    expect(this.newTransaction).to.not.be.null;
    expect(this.newTransaction.id).to.not.equal(transactionId);
  }

  async testSendMeterValues(withSoC = false) {
    // Check on Transaction
    expect(this.newTransaction).to.not.be.null;
    // Current Time matches Transaction one
    this.transactionCurrentTime = moment(this.newTransaction.timestamp);
    // Start Meter Value matches Transaction one
    let transactionCurrentMeterValue = this.transactionStartMeterValue;
    // Send Meter Values (except the last one which will be used in Stop Transaction)
    for (let index = 0; index <= this.transactionMeterValues.length - 2; index++) {
      // Set new meter value
      transactionCurrentMeterValue += this.transactionMeterValues[index];
      // Add time
      this.transactionCurrentTime.add(this.transactionMeterValueIntervalSecs, "s");
      if (withSoC) {
        let context = "Sample.Periodic";
        // First Meter Value: Transaction.Begin
        if (index === 0) {
          // First Meter Value: Transaction.Begin
          context = "Transaction.Begin"
        } else if (index === this.transactionMeterValues.length - 2) {
          // Last Meter Value: Transaction.End
          context = "Transaction.End"
        }
        // Send Meter Values
        await CentralServerService.transactionApi.sendTransactionWithSoCMeterValue(
          this.ocpp,
          this.newTransaction,
          this.context.newChargingStation,
          this.transactionStartUser,
          transactionCurrentMeterValue,
          this.transactionMeterSoCValues[index],
          this.transactionCurrentTime,
          this.transactionMeterValues[index] * this.transactionMeterValueIntervalSecs,
          transactionCurrentMeterValue - this.transactionStartMeterValue,
          context);
      } else {
        await CentralServerService.transactionApi.sendTransactionMeterValue(
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
  }

  async testStopTransaction() {
    // Check on Transaction
    expect(this.newTransaction).to.not.be.null;
    expect(this.transactionCurrentTime).to.not.be.null;

    // Set end time
    this.transactionCurrentTime.add(this.transactionMeterValueIntervalSecs, "s");

    // Stop the Transaction
    await CentralServerService.transactionApi.stopTransaction(
      this.ocpp,
      this.newTransaction,
      this.transactionStartUser,
      this.transactionStopUser,
      this.transactionEndMeterValue,
      this.transactionCurrentTime,
      this.chargingStationConnector1,
      this.transactionTotalConsumption,
      this.transactionTotalInactivity,
      this.totalPrice);
  }

  async testTransactionMetrics() {
    // Check on Transaction
    expect(this.newTransaction).to.not.be.null;

    // Get the consumption
    const response = await CentralServerService.transactionApi.readAllConsumption({TransactionId: this.newTransaction.id});
    expect(response.status).to.equal(200);
    // Check Headers
    expect(response.data).to.deep.containSubset({
      "chargeBoxID": this.newTransaction.chargeBoxID,
      "connectorId": this.newTransaction.connectorId,
      "stop": {
        "price": this.totalPrice,
        "pricingSource": "simple",
        "roundedPrice": parseFloat(this.totalPrice.toFixed(2)),
        "tagID": this.newTransaction.tagID,
        "totalConsumption": this.transactionTotalConsumption,
        "totalInactivitySecs": this.transactionTotalInactivity,
        "user": {
          "id": this.transactionStartUser.id,
          "name": this.transactionStartUser.name,
          "firstName": this.transactionStartUser.firstName
        }
      },
      "id": this.newTransaction.id,
      "user": {
        "id": this.transactionStartUser.id,
        "name": this.transactionStartUser.name,
        "firstName": this.transactionStartUser.firstName
      }
    });
    // Init
    const transactionCurrentTime = moment(this.newTransaction.timestamp);
    let transactionCumulatedConsumption = 0;
    // Check Consumption
    for (let i = 0; i < response.data.values.length; i++) {
      // Get the value
      const value = response.data.values[i];
      // Add time
      transactionCurrentTime.add(this.transactionMeterValueIntervalSecs, "s");
      // Sum
      transactionCumulatedConsumption += this.transactionMeterValues[i];
      // Check
      expect(value).to.include({
        "date": transactionCurrentTime.toISOString(),
        "value": this.transactionMeterValues[i] * this.transactionMeterValueIntervalSecs,
        "cumulated": transactionCumulatedConsumption
      });
    }
  }

  async testDeleteTransaction() {
    // Delete the created entity
    await CentralServerService.deleteEntity(
      CentralServerService.transactionApi, this.newTransaction);
  }
}

module.exports = OCPPCommonTests;