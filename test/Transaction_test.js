const moment = require('moment');
const {expect} = require('chai');
const chai = require('chai');
const chaiSubset = require('chai-subset');
chai.use(chaiSubset);
const Ocpp15 = require('./api/soap/ocpp15');
const Bootstrap = require('./api/bootstrap');
const CentralServerService = require('./api/client/CentralServerService');
const config = require('./config');

describe('transaction tests', function() {
  const ocpp = new Ocpp15();
  let context = null;
  let bootstrap = new Bootstrap(ocpp);
  this.timeout(100000);

  before(async () => {
    await ocpp.init('test/api/soap/ocpp15.wsdl', {endpoint: `${config.get('ocpp.scheme')}://${config.get('ocpp.host')}:${config.get('ocpp.port')}/OCPP15`});
  });

  beforeEach(async () => {
    context = await bootstrap.createMinimalContext();
  });

  it('A charging station can notify its status', async () => {
    let currentTime = moment(context.currentTime);
    let chargePointState = {
      connectorId: 1,
      status: 'Available',
      errorCode: 'NoError',
      timestamp: currentTime.toISOString()
    };
    let response = await ocpp.executeStatusNotification(context.chargeBoxIdentity, chargePointState);
    expect(response.data).to.eql({});
  });
  it('A charging station can notify its status multiple times', async () => {
    let currentTime = moment(context.currentTime);
    let chargePointState = {
      connectorId: 1,
      status: 'Available',
      errorCode: 'NoError',
      timestamp: currentTime.toISOString()
    };
    let response = await ocpp.executeStatusNotification(context.chargeBoxIdentity, chargePointState);
    expect(response.data).to.eql({});
    response = await ocpp.executeStatusNotification(context.chargeBoxIdentity, chargePointState);
    expect(response.data).to.eql({});
    response = await ocpp.executeStatusNotification(context.chargeBoxIdentity, chargePointState);
    expect(response.data).to.eql({});
    response = await ocpp.executeStatusNotification(context.chargeBoxIdentity, chargePointState);
    expect(response.data).to.eql({});
    response = await ocpp.executeStatusNotification(context.chargeBoxIdentity, chargePointState);
    expect(response.data).to.eql({});
  });

  it('A charging station can start a new transaction when available', async () => {
    let currentTime = moment(context.currentTime);
    let connectorId = 1;
    let response = await ocpp.executeStatusNotification(context.chargeBoxIdentity,
      {
        connectorId: connectorId,
        status: 'Available',
        errorCode: 'NoError',
        timestamp: currentTime.toISOString()
      });
    expect(response.data).to.eql({});

    let transactionId = null;
    currentTime.add(1, 'minutes');
    response = await ocpp.executeStartTransaction(context.chargeBoxIdentity,
      {
        connectorId: connectorId,
        idTag: context.user.tagIDs[0],
        meterStart: 10000,
        timestamp: currentTime.toISOString()
      });
    expect(response.data).to.be.an('object');
    expect(response.data).to.have.nested.property('transactionId');
    expect(response.data).to.deep.include({
      idTagInfo: {
        status: 'Accepted'
      }
    });
    transactionId = response.data.transactionId;

    response = await CentralServerService.transaction.readById(transactionId);
    expect(response.data).to.containSubset(
      {
        connectorId: connectorId,
        tagID: context.user.tagIDs[0],
        chargeBoxID: context.chargeBoxIdentity,
        chargeBox: {
          id: context.chargeBoxIdentity,
          connectors: [
            {
              activeTransactionID: transactionId,
              connectorId: connectorId,
              currentConsumption: 0,
              totalConsumption: 0,
              status: 'Available',
              errorCode: 'NoError',
              info: null,
              type: null,
              "power": 0,
              vendorErrorCode: null
            }
          ]
        },
        id: transactionId,
        timestamp: currentTime.toISOString(),
        user: {
          firstName: context.user.firstName,
          id: context.user.id,
          name: context.user.name,
        }
      }
    )
  });

  it('A charging station can start a new transaction when occupied', async () => {
    let currentTime = moment(context.currentTime);
    let connectorId = 1;

    let response = await ocpp.executeStatusNotification(context.chargeBoxIdentity,
      {
        connectorId: connectorId,
        status: 'Occupied',
        errorCode: 'NoError',
        timestamp: currentTime.toISOString()
      }
    );

    expect(response.data).to.eql({});
    currentTime.add(1, 'minutes');
    let transactionId = null;

    response = await ocpp.executeStartTransaction(context.chargeBoxIdentity,
      {
        connectorId: connectorId,
        idTag: context.user.tagIDs[0],
        meterStart: 10000,
        timestamp: currentTime.toISOString()
      });
    expect(response.data).to.be.an('object');
    expect(response.data).to.have.nested.property('transactionId');
    expect(response.data).to.deep.include({
      idTagInfo: {
        status: 'Accepted'
      }
    });
    transactionId = response.data.transactionId;

    response = await CentralServerService.transaction.readById(transactionId);
    expect(response.data).to.containSubset(
      {
        connectorId: connectorId,
        tagID: context.user.tagIDs[0],
        chargeBoxID: context.chargeBoxIdentity,
        chargeBox: {
          id: context.chargeBoxIdentity,
          connectors: [
            {
              activeTransactionID: transactionId,
              connectorId: connectorId,
              currentConsumption: 0,
              totalConsumption: 0,
              status: 'Occupied',
              errorCode: 'NoError',
              info: null,
              type: null,
              "power": 0,
              vendorErrorCode: null
            }
          ]
        },
        id: transactionId,
        timestamp: currentTime.toISOString(),
        user: {
          firstName: context.user.firstName,
          id: context.user.id,
          name: context.user.name,
        }
      }
    )
  });

  it('A charging station can create and complete a transaction', async () => {
    let currentTime = moment(context.currentTime);
    let connectorId = 1;

    let response = await ocpp.executeStatusNotification(context.chargeBoxIdentity,
      {
        connectorId: connectorId,
        status: 'Available',
        errorCode: 'NoError',
        timestamp: currentTime.toISOString()
      }
    );

    expect(response.data).to.eql({});

    const transactionStartDate = currentTime.add(1, 'minutes').clone();
    response = await ocpp.executeStartTransaction(context.chargeBoxIdentity,
      {
        connectorId: connectorId,
        idTag: context.user.tagIDs[0],
        meterStart: 10000,
        timestamp: transactionStartDate.toISOString()
      });

    expect(response.data).to.have.nested.property('transactionId');
    let transactionId = response.data.transactionId;
    expect(response.data).to.containSubset({
      idTagInfo: {
        status: 'Accepted'
      }
    });

    response = await CentralServerService.transaction.readById(transactionId);
    expect(response.data).to.containSubset(
      {
        "chargeBox": {
          "connectors": [
            {
              "activeTransactionID": transactionId,
              "connectorId": connectorId,
              "currentConsumption": 0,
              "errorCode": "NoError",
              "info": null,
              "power": 0,
              "status": "Available",
              "totalConsumption": 0,
              "vendorErrorCode": null,
            }
          ],
          "id": context.chargeBoxIdentity,
        },
        connectorId: connectorId,
        tagID: context.user.tagIDs[0],
        chargeBoxID: context.chargeBoxIdentity,
        "id": transactionId,
        "timestamp": transactionStartDate.toISOString(),
        user: {
          firstName: context.user.firstName,
          id: context.user.id,
          name: context.user.name,
        }
      }
    );

    response = await ocpp.executeStatusNotification(context.chargeBoxIdentity,
      {
        connectorId: connectorId,
        status: 'Occupied',
        errorCode: 'NoError',
        timestamp: currentTime.add(1, 'minutes').toISOString()
      }
    );
    expect(response.data).to.eql({});

    response = await CentralServerService.transaction.readById(transactionId);
    expect(response.data).to.containSubset(
      {
        "chargeBox": {
          "connectors": [
            {
              "activeTransactionID": transactionId,
              "connectorId": connectorId,
              "currentConsumption": 0,
              "errorCode": "NoError",
              "info": null,
              "power": 0,
              "status": "Occupied",
              "totalConsumption": 0,
              "vendorErrorCode": null,
            }
          ],
          "id": context.chargeBoxIdentity,
        },
        connectorId: connectorId,
        tagID: context.user.tagIDs[0],
        chargeBoxID: context.chargeBoxIdentity,
        "id": transactionId,
        "timestamp": transactionStartDate.toISOString(),
        user: {
          firstName: context.user.firstName,
          id: context.user.id,
          name: context.user.name,
        }
      }
    );

    for (let value in [...Array(10).keys()]) {
      response = await ocpp.executeMeterValues(context.chargeBoxIdentity,
        {
          connectorId: connectorId,
          transactionId: transactionId,
          values: {
            timestamp: currentTime.add(1, "minutes").toISOString(),
            value: {
              $attributes: {
                unit: 'Wh',
                location: "Outlet",
                measurand: "Energy.Active.Import.Register",
                format: "Raw",
                context: "Sample.Periodic"
              },
              $value: (200 * value)
            }
          },
        }
      );
      expect(response.data).to.eql({});
      response = await CentralServerService.transaction.readById(transactionId);
      expect(response.data).to.containSubset(
        {
          "chargeBox": {
            "connectors": [
              {
                "activeTransactionID": transactionId,
                "connectorId": connectorId,
                "currentConsumption": value == 0 ? 0 : 12000,
                "errorCode": "NoError",
                "info": null,
                "power": 0,
                "status": "Occupied",
                "totalConsumption": 200 * value,
                "vendorErrorCode": null,
              }
            ],
            "id": context.chargeBoxIdentity,
          },
          connectorId: connectorId,
          tagID: context.user.tagIDs[0],
          chargeBoxID: context.chargeBoxIdentity,
          "id": transactionId,
          "timestamp": transactionStartDate.toISOString(),
          "user": {
            "firstName": context.user.firstName,
            "id": context.user.id,
            "name": context.user.name,
          }
        }
      )
    }
    const transactionStopDate = currentTime.clone();

    response = await ocpp.executeStopTransaction(context.chargeBoxIdentity,
      {
        transactionId: transactionId,
        connectorId: connectorId,
        idTag: context.user.tagIDs[0],
        meterStart: 10000,
        timestamp: transactionStopDate.toISOString()
      });
    expect(response.data.idTagInfo.status).to.eql('Accepted');


    response = await CentralServerService.transaction.readById(transactionId);
    expect(response.data).to.containSubset(
      {
        "chargeBox": {
          "connectors": [
            {
              "activeTransactionID": 0,
              "connectorId": connectorId,
              "currentConsumption": 0,
              "errorCode": "NoError",
              "info": null,
              "type": null,
              "power": 0,
              "status": "Occupied",
              "totalConsumption": 0,
              "vendorErrorCode": null
            }
          ],
          "id": context.chargeBoxIdentity
        },
        "chargeBoxID": context.chargeBoxIdentity,
        "connectorId": connectorId,
        "id": transactionId,
        "stop": {
          "tagID": context.user.tagIDs[0],
          "timestamp": transactionStopDate.toISOString(),
          "totalConsumption": 1800,
          "totalInactivitySecs": 0,
          "user": {
            "firstName": context.user.firstName,
            "id": context.user.id,
            "name": context.user.name,
          },
        },
        "tagID": context.user.tagIDs[0],
        "timestamp": transactionStartDate.toISOString(),
        user: {
          firstName: context.user.firstName,
          id: context.user.id,
          name: context.user.name,
        }
      });
    response = await ocpp.executeStatusNotification(context.chargeBoxIdentity,
      {
        connectorId: connectorId,
        status: 'Available',
        errorCode: 'NoError',
        timestamp: currentTime.add(1, "minutes").toISOString()
      }
    );
    expect(response.data).to.eql({});

    response = await CentralServerService.transaction.readById(transactionId);
    expect(response.data).to.containSubset(
      {
        "chargeBox": {
          "connectors": [
            {
              "activeTransactionID": 0,
              "connectorId": connectorId,
              "currentConsumption": 0,
              "errorCode": "NoError",
              "info": null,
              "type": null,
              "power": 0,
              "status": "Available",
              "totalConsumption": 0,
              "vendorErrorCode": null
            }
          ],
          "id": context.chargeBoxIdentity
        },
        "chargeBoxID": context.chargeBoxIdentity,
        "connectorId": connectorId,
        "id": transactionId,
        "stop": {
          "tagID": context.user.tagIDs[0],
          "timestamp": transactionStopDate.toISOString(),
          "totalConsumption": 1800,
          "totalInactivitySecs": 0,
          "user": {
            "firstName": context.user.firstName,
            "id": context.user.id,
            "name": context.user.name,
          },
        },
        "tagID": context.user.tagIDs[0],
        "timestamp": transactionStartDate.toISOString(),
        user: {
          firstName: context.user.firstName,
          id: context.user.id,
          name: context.user.name,
        }
      }
    );
  });

});
