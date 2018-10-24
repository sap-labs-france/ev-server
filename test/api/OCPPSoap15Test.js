const moment = require('moment');
const { expect } = require('chai');
const chai = require('chai');
const chaiSubset = require('chai-subset');
chai.use(chaiSubset);
const OCPPSoapService15 = require('./soap/OCPPSoapService15');
const OCPPBootstrap = require('./OCPPBootstrap');
const CentralServerService = require('./client/CentralServerService');
const config = require('../config');

describe('OCPP Transaction tests', function () {
  this.timeout(100000);

  before(async () => {
    // Create OCPP 1.5
    this.ocpp = new OCPPSoapService15(`${config.get('ocpp.scheme')}://${config.get('ocpp.host')}:${config.get('ocpp.port')}/OCPP15`);
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
    this.transactionStartTime = moment().subtract(1, "h")
    this.transactionStartMeterValue = 10000;
    this.transactionCurrentMeterValue = this.transactionStartMeterValue;
    this.meterValueStep = 200;
  });

  after(async () => {
    // Destroy context
    await this.bootstrap.destroyContext(this.context);
  });

  it('Both connectors of the charging station are set to Available', async () => {
    // Update Status of Connector 1
    let response = await this.ocpp.executeStatusNotification(this.context.newChargingStation.id, this.chargingStationConnector1);
    // Check
    expect(response.data).to.eql({});

    // Update Status of Connector 2
    response = await this.ocpp.executeStatusNotification(this.context.newChargingStation.id, this.chargingStationConnector2);
    // Check
    expect(response.data).to.eql({});

    // Check Connector 1
    await CentralServerService.chargingStationApi.checkConnector(
      this.context.newChargingStation, 1, this.chargingStationConnector1);

      // Check Connector 2
    await CentralServerService.chargingStationApi.checkConnector(
      this.context.newChargingStation, 2, this.chargingStationConnector2);
  });

  it('Change the connector status', async () => {
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
  });

  it('Start a new transaction', async () => {
    // Connector 2 should be still available
    this.newTransaction = await CentralServerService.transactionApi.startTransaction(
      this.ocpp,
      this.context.newChargingStation,
      this.chargingStationConnector1, 
      this.context.newUser,
      this.transactionStartMeterValue,
      this.transactionStartTime);

    // Check on Transaction
    expect(this.newTransaction).to.not.be.null;
  });

  it('Start again a new transaction', async () => {
    // Check on Transaction
    expect(this.newTransaction).to.not.be.null;

    // Set
    let transactionConnectorId = this.newTransaction.connectorId;
    let transactionId = this.newTransaction.id;
    this.transactionStartTime = moment().subtract(1, "h");
    // Clear old one
    this.newTransaction = null;

    // Connector 2 should be still available
    this.newTransaction = await CentralServerService.transactionApi.startTransaction(
      this.ocpp,
      this.context.newChargingStation,
      this.chargingStationConnector1, 
      this.context.newUser,
      this.transactionStartMeterValue,
      this.transactionStartTime);
    // Check
    expect(this.newTransaction).to.not.be.null;
    expect(this.newTransaction.id).to.not.equal(transactionId);
  });

  it('Send meter values', async () => {
    // Check on Transaction
    expect(this.newTransaction).to.not.be.null;
    // Init
    this.transactionCurrentTime = moment(this.newTransaction.timestamp);
    // Send Meter Values
    for (let index = 1; index <= 10; index++) {
      // Compute
      this.transactionCurrentMeterValue += this.meterValueStep;
      // Call OCPP
      response = await this.ocpp.executeMeterValues(this.context.newChargingStation.id, {
        connectorId: this.newTransaction.connectorId,
        transactionId: this.newTransaction.id,
        values: {
          timestamp: this.transactionCurrentTime.add(1, "m").toISOString(),
          value: {
            $attributes: {
              unit: 'Wh',
              location: "Outlet",
              measurand: "Energy.Active.Import.Register",
              format: "Raw",
              context: "Sample.Periodic"
            },
            $value: this.transactionCurrentMeterValue
          }
        },
      });
      // Check
      expect(response.data).to.eql({});
      // Check the Transaction
      response = await CentralServerService.transactionApi.readById(this.newTransaction.id);
      // Check Consumption
      expect(response.data).to.deep.include({
        id: this.newTransaction.id,
        timestamp: this.newTransaction.timestamp,
        connectorId: this.newTransaction.connectorId,
        tagID: this.context.newUser.tagIDs[0],
        chargeBoxID: this.context.newChargingStation.id,
        meterStart: this.transactionStartMeterValue,
        chargeBox: {
          id: this.context.newChargingStation.id,
          connectors: [{
            activeTransactionID: this.newTransaction.id,
            connectorId: this.newTransaction.connectorId,
            currentConsumption: this.meterValueStep * 60,
            totalConsumption: (this.transactionCurrentMeterValue - this.transactionStartMeterValue),
            status: 'Occupied',
            errorCode: 'NoError',
            vendorErrorCode: '',
            info: '',
            type: null,
            power: 0
          }]
        },
        user: {
          id: this.context.newUser.id,
          firstName: this.context.newUser.firstName,
          name: this.context.newUser.name,
        }
      })
    }
  });

  it('Stop the transaction', async () => {
    // Check on Transaction
    expect(this.newTransaction).to.not.be.null;
    expect(this.transactionCurrentTime).to.not.be.null;
    // Init
    // Compute last meter value
    this.transactionCurrentMeterValue += this.meterValueStep;
    // Stop the transaction
    let response = await this.ocpp.executeStopTransaction(this.context.newChargingStation.id, {
      transactionId: this.newTransaction.id,
      idTag: this.context.newUser.tagIDs[0],
      meterStop: this.transactionCurrentMeterValue,
      timestamp: this.transactionCurrentTime.add(1, "m").toISOString()
    });
    // Check
    expect(response.data).to.have.property('idTagInfo');
    expect(response.data.idTagInfo.status).to.equal('Accepted');

    // Set the connector to Available
    this.chargingStationConnector1.status = 'Available';
    this.chargingStationConnector1.timestamp = new Date().toISOString();
    // Update
    response = await this.ocpp.executeStatusNotification(this.context.newChargingStation.id, this.chargingStationConnector1);
    // Check
    expect(response.data).to.eql({});

    // Check the Transaction
    response = await CentralServerService.transactionApi.readById(this.newTransaction.id);
    // Check Consumption
    expect(response.data).to.deep.include({
      id: this.newTransaction.id,
      timestamp: this.newTransaction.timestamp,
      connectorId: this.newTransaction.connectorId,
      tagID: this.context.newUser.tagIDs[0],
      chargeBoxID: this.context.newChargingStation.id,
      meterStart: this.transactionStartMeterValue,
      "stop": {
        "tagID": this.context.newUser.tagIDs[0],
        "timestamp": this.transactionCurrentTime.toISOString(),
        "totalConsumption": (this.transactionCurrentMeterValue - this.transactionStartMeterValue),
        "totalInactivitySecs": 0,
        "user": {
          "firstName": this.context.newUser.firstName,
          "id": this.context.newUser.id,
          "name": this.context.newUser.name,
        },
      },
      chargeBox: {
        id: this.context.newChargingStation.id,
        connectors: [{
          activeTransactionID: 0,
          connectorId: this.newTransaction.connectorId,
          currentConsumption: 0,
          totalConsumption: 0,
          status: 'Available',
          errorCode: 'NoError',
          vendorErrorCode: '',
          info: '',
          type: null,
          power: 0
        }]
      },
      user: {
        id: this.context.newUser.id,
        firstName: this.context.newUser.firstName,
        name: this.context.newUser.name,
      }
    })
  });

  it('Delete the transaction', async () => {
    // Delete the created entity
    await CentralServerService.deleteEntity(
      CentralServerService.transactionApi, this.newTransaction);
  });
});