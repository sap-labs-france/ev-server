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
  });

  after(async () => {
    // Destroy context
    await this.bootstrap.destroyContext(this.context);
  });

  it('A charging station can notify its status', async () => {
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

  it('A charging station can notify its status multiple times', async () => {
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
    let currentTime = moment().subtract(1, "h");
    let connectorId = 1;

    // Start the transaction
    let response = await this.ocpp.executeStartTransaction(this.context.newChargingStation.id, {
      connectorId: connectorId,
      idTag: this.context.newUser.tagIDs[0],
      meterStart: 10000,
      timestamp: currentTime.toISOString()
    });
    // Check
    expect(response.data).to.be.an('object');
    expect(response.data).to.have.property('transactionId');
    expect(response.data.transactionId).to.not.equal(0);
    expect(response.data).to.have.property('idTagInfo');
    expect(response.data.idTagInfo.status).to.equal('Accepted');
    // Keep it
    let transactionId = response.data.transactionId;
    // Check if the Transaction exists
    response = await CentralServerService.transactionApi.readById(transactionId);
    // Check
    expect(response.data).to.deep.include({
      id: transactionId,
      timestamp: currentTime.toISOString(),
      connectorId: connectorId,
      tagID: this.context.newUser.tagIDs[0],
      chargeBoxID: this.context.newChargingStation.id,
      chargeBox: {
        id: this.context.newChargingStation.id,
        connectors: [{
          activeTransactionID: transactionId,
          connectorId: connectorId,
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

  // it('A charging station can start a new transaction when occupied', async () => {
  //   let currentTime = moment(context.currentTime);
  //   let connectorId = 1;

  //   let response = await this.ocpp.executeStatusNotification(this.context.newChargingStation.id, {
  //     connectorId: connectorId,
  //     status: 'Occupied',
  //     errorCode: 'NoError',
  //     timestamp: currentTime.toISOString()
  //   });

  //   expect(response.data).to.eql({});
  //   currentTime.add(1, 'minutes');
  //   let transactionId = null;

  //   response = await this.ocpp.executeStartTransaction(this.context.newChargingStation.id, {
  //     connectorId: connectorId,
  //     idTag: this.context.newUser.tagIDs[0],
  //     meterStart: 10000,
  //     timestamp: currentTime.toISOString()
  //   });
  //   expect(response.data).to.be.an('object');
  //   expect(response.data).to.have.nested.property('transactionId');
  //   expect(response.data).to.deep.include({
  //     idTagInfo: {
  //       status: 'Accepted'
  //     }
  //   });
  //   transactionId = response.data.transactionId;

  //   response = await CentralServerService.transaction.readById(transactionId);
  //   expect(response.data).to.containSubset({
  //     connectorId: connectorId,
  //     tagID: this.context.newUser.tagIDs[0],
  //     chargeBoxID: this.context.newChargingStation.id,
  //     chargeBox: {
  //       id: this.context.newChargingStation.id,
  //       connectors: [{
  //         activeTransactionID: transactionId,
  //         connectorId: connectorId,
  //         currentConsumption: 0,
  //         totalConsumption: 0,
  //         status: 'Occupied',
  //         errorCode: 'NoError',
  //         info: null,
  //         type: null,
  //         "power": 0,
  //         vendorErrorCode: null
  //       }]
  //     },
  //     id: transactionId,
  //     timestamp: currentTime.toISOString(),
  //     user: {
  //       firstName: this.context.newUser.firstName,
  //       id: this.context.newUser.id,
  //       name: this.context.newUser.name,
  //     }
  //   })
  // });

  // it('A charging station can create and complete a transaction', async () => {
  //   let currentTime = moment(context.currentTime);
  //   let connectorId = 1;

  //   let response = await this.ocpp.executeStatusNotification(this.context.newChargingStation.id, {
  //     connectorId: connectorId,
  //     status: 'Available',
  //     errorCode: 'NoError',
  //     timestamp: currentTime.toISOString()
  //   });

  //   expect(response.data).to.eql({});

  //   const transactionStartDate = currentTime.add(1, 'minutes').clone();
  //   response = await this.ocpp.executeStartTransaction(this.context.newChargingStation.id, {
  //     connectorId: connectorId,
  //     idTag: this.context.newUser.tagIDs[0],
  //     meterStart: 10000,
  //     timestamp: transactionStartDate.toISOString()
  //   });

  //   expect(response.data).to.have.nested.property('transactionId');
  //   let transactionId = response.data.transactionId;
  //   expect(response.data).to.containSubset({
  //     idTagInfo: {
  //       status: 'Accepted'
  //     }
  //   });

  //   response = await CentralServerService.transaction.readById(transactionId);
  //   expect(response.data).to.containSubset({
  //     "chargeBox": {
  //       "connectors": [{
  //         "activeTransactionID": transactionId,
  //         "connectorId": connectorId,
  //         "currentConsumption": 0,
  //         "errorCode": "NoError",
  //         "info": null,
  //         "power": 0,
  //         "status": "Available",
  //         "totalConsumption": 0,
  //         "vendorErrorCode": null,
  //       }],
  //       "id": this.context.newChargingStation.id,
  //     },
  //     connectorId: connectorId,
  //     tagID: this.context.newUser.tagIDs[0],
  //     chargeBoxID: this.context.newChargingStation.id,
  //     "id": transactionId,
  //     "timestamp": transactionStartDate.toISOString(),
  //     user: {
  //       firstName: this.context.newUser.firstName,
  //       id: this.context.newUser.id,
  //       name: this.context.newUser.name,
  //     }
  //   });

  //   response = await this.ocpp.executeStatusNotification(this.context.newChargingStation.id, {
  //     connectorId: connectorId,
  //     status: 'Occupied',
  //     errorCode: 'NoError',
  //     timestamp: currentTime.add(1, 'minutes').toISOString()
  //   });
  //   expect(response.data).to.eql({});

  //   response = await CentralServerService.transaction.readById(transactionId);
  //   expect(response.data).to.containSubset({
  //     "chargeBox": {
  //       "connectors": [{
  //         "activeTransactionID": transactionId,
  //         "connectorId": connectorId,
  //         "currentConsumption": 0,
  //         "errorCode": "NoError",
  //         "info": null,
  //         "power": 0,
  //         "status": "Occupied",
  //         "totalConsumption": 0,
  //         "vendorErrorCode": null,
  //       }],
  //       "id": this.context.newChargingStation.id,
  //     },
  //     connectorId: connectorId,
  //     tagID: this.context.newUser.tagIDs[0],
  //     chargeBoxID: this.context.newChargingStation.id,
  //     "id": transactionId,
  //     "timestamp": transactionStartDate.toISOString(),
  //     user: {
  //       firstName: this.context.newUser.firstName,
  //       id: this.context.newUser.id,
  //       name: this.context.newUser.name,
  //     }
  //   });

  //   for (let value in [...Array(10).keys()]) {
  //     response = await this.ocpp.executeMeterValues(this.context.newChargingStation.id, {
  //       connectorId: connectorId,
  //       transactionId: transactionId,
  //       values: {
  //         timestamp: currentTime.add(1, "minutes").toISOString(),
  //         value: {
  //           $attributes: {
  //             unit: 'Wh',
  //             location: "Outlet",
  //             measurand: "Energy.Active.Import.Register",
  //             format: "Raw",
  //             context: "Sample.Periodic"
  //           },
  //           $value: (200 * value)
  //         }
  //       },
  //     });
  //     expect(response.data).to.eql({});
  //     response = await CentralServerService.transaction.readById(transactionId);
  //     expect(response.data).to.containSubset({
  //       "chargeBox": {
  //         "connectors": [{
  //           "activeTransactionID": transactionId,
  //           "connectorId": connectorId,
  //           "currentConsumption": value == 0 ? 0 : 12000,
  //           "errorCode": "NoError",
  //           "info": null,
  //           "power": 0,
  //           "status": "Occupied",
  //           "totalConsumption": 200 * value,
  //           "vendorErrorCode": null,
  //         }],
  //         "id": this.context.newChargingStation.id,
  //       },
  //       connectorId: connectorId,
  //       tagID: this.context.newUser.tagIDs[0],
  //       chargeBoxID: this.context.newChargingStation.id,
  //       "id": transactionId,
  //       "timestamp": transactionStartDate.toISOString(),
  //       "user": {
  //         "firstName": this.context.newUser.firstName,
  //         "id": this.context.newUser.id,
  //         "name": this.context.newUser.name,
  //       }
  //     })
  //   }
  //   const transactionStopDate = currentTime.clone();

  //   response = await this.ocpp.executeStopTransaction(this.context.newChargingStation.id, {
  //     transactionId: transactionId,
  //     connectorId: connectorId,
  //     idTag: this.context.newUser.tagIDs[0],
  //     meterStart: 10000,
  //     timestamp: transactionStopDate.toISOString()
  //   });
  //   expect(response.data.idTagInfo.status).to.eql('Accepted');


  //   response = await CentralServerService.transaction.readById(transactionId);
  //   expect(response.data).to.containSubset({
  //     "chargeBox": {
  //       "connectors": [{
  //         "activeTransactionID": 0,
  //         "connectorId": connectorId,
  //         "currentConsumption": 0,
  //         "errorCode": "NoError",
  //         "info": null,
  //         "type": null,
  //         "power": 0,
  //         "status": "Occupied",
  //         "totalConsumption": 0,
  //         "vendorErrorCode": null
  //       }],
  //       "id": this.context.newChargingStation.id
  //     },
  //     "chargeBoxID": this.context.newChargingStation.id,
  //     "connectorId": connectorId,
  //     "id": transactionId,
  //     "stop": {
  //       "tagID": this.context.newUser.tagIDs[0],
  //       "timestamp": transactionStopDate.toISOString(),
  //       "totalConsumption": 1800,
  //       "totalInactivitySecs": 0,
  //       "user": {
  //         "firstName": this.context.newUser.firstName,
  //         "id": this.context.newUser.id,
  //         "name": this.context.newUser.name,
  //       },
  //     },
  //     "tagID": this.context.newUser.tagIDs[0],
  //     "timestamp": transactionStartDate.toISOString(),
  //     user: {
  //       firstName: this.context.newUser.firstName,
  //       id: this.context.newUser.id,
  //       name: this.context.newUser.name,
  //     }
  //   });
  //   response = await this.ocpp.executeStatusNotification(this.context.newChargingStation.id, {
  //     connectorId: connectorId,
  //     status: 'Available',
  //     errorCode: 'NoError',
  //     timestamp: currentTime.add(1, "minutes").toISOString()
  //   });
  //   expect(response.data).to.eql({});

  //   response = await CentralServerService.transaction.readById(transactionId);
  //   expect(response.data).to.containSubset({
  //     "chargeBox": {
  //       "connectors": [{
  //         "activeTransactionID": 0,
  //         "connectorId": connectorId,
  //         "currentConsumption": 0,
  //         "errorCode": "NoError",
  //         "info": null,
  //         "type": null,
  //         "power": 0,
  //         "status": "Available",
  //         "totalConsumption": 0,
  //         "vendorErrorCode": null
  //       }],
  //       "id": this.context.newChargingStation.id
  //     },
  //     "chargeBoxID": this.context.newChargingStation.id,
  //     "connectorId": connectorId,
  //     "id": transactionId,
  //     "stop": {
  //       "tagID": this.context.newUser.tagIDs[0],
  //       "timestamp": transactionStopDate.toISOString(),
  //       "totalConsumption": 1800,
  //       "totalInactivitySecs": 0,
  //       "user": {
  //         "firstName": this.context.newUser.firstName,
  //         "id": this.context.newUser.id,
  //         "name": this.context.newUser.name,
  //       },
  //     },
  //     "tagID": this.context.newUser.tagIDs[0],
  //     "timestamp": transactionStartDate.toISOString(),
  //     user: {
  //       firstName: this.context.newUser.firstName,
  //       id: this.context.newUser.id,
  //       name: this.context.newUser.name,
  //     }
  //   });
  // });

});