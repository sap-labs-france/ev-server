const moment = require('moment');
const {expect} = require('chai');
const chai = require('chai');
const chaiSubset = require('chai-subset');
chai.use(chaiSubset);
const Ocpp15 = require('./api/soap/ocpp15');
const Bootstrap = require('./api/bootstrap');
const TransactionApi = require('./api/client/transaction');
const BaseApi = require('./api/client/utils/baseApi');
const AuthenticatedBaseApi = require('./api/client/utils/authenticatedBaseApi');
const config = require('./config');

describe('Default transaction scenario', function() {
  const ocpp = new Ocpp15();
  const authenticatedBaseApi = new AuthenticatedBaseApi(config.get('admin.user'), config.get('admin.password'), new BaseApi(`${config.get('server.scheme')}://${config.get('server.host')}:${config.get('server.port')}`));
  let transactionApi = new TransactionApi(authenticatedBaseApi);
  let context = null;
  let bootstrap = new Bootstrap(authenticatedBaseApi, ocpp);
  this.timeout(100000);

  before(async () => {
    await ocpp.init('test/api/soap/ocpp15.wsdl', {endpoint: `${config.get('ocpp.scheme')}://${config.get('ocpp.host')}:${config.get('ocpp.port')}/OCPP15`});
  });

  beforeEach(async () => {
    context = await bootstrap.createMinimalContext();
  });

  it('A Charging can notify its status', async () => {
    let currentTime = moment(context.currentTime);
    let chargePointState = {
      connectorId: 1,
      status: 'Available',
      errorCode: 'NoError',
      timestamp: currentTime.toISOString()
    };
    await ocpp.executeStatusNotification(context.chargeBoxIdentity, chargePointState, response => expect(response).to.eql({}));
  });
  it('A Charging can notify its status multiple times', async () => {
    let currentTime = moment(context.currentTime);
    let chargePointState = {
      connectorId: 1,
      status: 'Available',
      errorCode: 'NoError',
      timestamp: currentTime.toISOString()
    };
    await ocpp.executeStatusNotification(context.chargeBoxIdentity, chargePointState, response => expect(response).to.eql({}));
    await ocpp.executeStatusNotification(context.chargeBoxIdentity, chargePointState, response => expect(response).to.eql({}));
    await ocpp.executeStatusNotification(context.chargeBoxIdentity, chargePointState, response => expect(response).to.eql({}));
    await ocpp.executeStatusNotification(context.chargeBoxIdentity, chargePointState, response => expect(response).to.eql({}));
    await ocpp.executeStatusNotification(context.chargeBoxIdentity, chargePointState, response => expect(response).to.eql({}));
  });

  it('A charging can start a new transaction when available', async () => {
    let currentTime = moment(context.currentTime);
    let connectorId = 1;
    let chargePointState = {
      connectorId: connectorId,
      status: 'Available',
      errorCode: 'NoError',
      timestamp: currentTime.toISOString()
    };
    await ocpp.executeStatusNotification(context.chargeBoxIdentity, chargePointState, response => expect(response).to.eql({}));

    let transactionState = {
      connectorId: connectorId,
      idTag: context.user.tagIDs[0],
      meterStart: 10000,
      timestamp: currentTime.toISOString()
    };
    let transactionId = null;
    currentTime.add(1, 'minutes');
    await ocpp.executeStartTransaction(context.chargeBoxIdentity, transactionState, response => {
      expect(response).to.be.a('object');
      expect(response).to.have.nested.property('transactionId');
      expect(response).to.deep.include({
        idTagInfo: {
          status: 'Accepted'
        }
      });
      transactionId = response.transactionId;
    });

    await transactionApi.readById(transactionId, (message) => expect(message.response).to.containSubset(
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
              vendorErrorCode: null
            }
          ]
        }
      }));
  });

  it('A charging can start a new transaction when occupied', async () => {
    let currentTime = moment(context.currentTime);
    let connectorId = 1;
    let chargePointState = {
      connectorId: connectorId,
      status: 'Occupied',
      errorCode: 'NoError',
      timestamp: currentTime.toISOString()
    };
    await ocpp.executeStatusNotification(context.chargeBoxIdentity, chargePointState, response => expect(response).to.eql({}));
    currentTime.add(1, 'minutes');
    let transactionState = {
      connectorId: connectorId,
      idTag: context.user.tagIDs[0],
      meterStart: 10000,
      timestamp: currentTime.toISOString()
    };
    let transactionId = null;
    await ocpp.executeStartTransaction(context.chargeBoxIdentity, transactionState, response => {
      expect(response).to.be.a('object');
      expect(response).to.have.nested.property('transactionId');
      expect(response).to.deep.include({
        idTagInfo: {
          status: 'Accepted'
        }
      });
      transactionId = response.transactionId;
    });
  });

  it('A charging can update and stop a transaction', async () => {
    let currentTime = moment(context.currentTime);
    let connectorId = 1;
    let chargePointState = {
      connectorId: connectorId,
      status: 'Available',
      errorCode: 'NoError',
      timestamp: currentTime.toISOString()
    };
    await ocpp.executeStatusNotification(context.chargeBoxIdentity, chargePointState, response => expect(response).to.eql({}));

    let transactionState = {
      connectorId: connectorId,
      idTag: context.user.tagIDs[0],
      meterStart: 10000,
      timestamp: currentTime.toISOString()
    };
    let transactionId = null;
    currentTime.add(1, 'minutes');
    await ocpp.executeStartTransaction(context.chargeBoxIdentity, transactionState, response => {
      expect(response).to.have.nested.property('transactionId');
      transactionId = response.transactionId;
      expect(response).to.containSubset({
        idTagInfo: {
          status: 'Accepted'
        }
      });
    });
    let expectedTransaction = {
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
            vendorErrorCode: null
          }
        ]
      }
    };
    await transactionApi.readById(transactionId, (message) => expect(message.response).to.containSubset(expectedTransaction));

    chargePointState.status = 'Occupied';
    chargePointState.timestamp = currentTime.add(1, 'minutes');
    await ocpp.executeStatusNotification(context.chargeBoxIdentity, chargePointState, response => expect(response).to.eql({}));

    expectedTransaction.chargeBox.connectors[0].status = 'Occupied';
    await transactionApi.readById(transactionId, (message) => expect(message.response).to.containSubset(expectedTransaction));

    const meterValue = {
      connectorId: connectorId,
      transactionId: transactionId,
      values: {
        timestamp: null,
        value: {
          $attributes: {
            unit: 'Wh',
            location: "Outlet",
            measurand: "Energy.Active.Import.Register",
            format: "Raw",
            context: "Sample.Periodic"
          },
          $value: 10000
        }
      },
    };

    for (value in [...Array(10).keys()]) {
      currentTime.add(1, "minutes").toISOString();
      meterValue.values.timestamp = currentTime.add(1, "minutes").toISOString();
      meterValue.values.value.$value = (200 * value);
      await ocpp.executeMeterValues(context.chargeBoxIdentity, meterValue, response => expect(response).to.eql({}));
      expectedTransaction.chargeBox.connectors[0].currentConsumption = value == 0 ? 0 : 6000;
      expectedTransaction.chargeBox.connectors[0].totalConsumption = 200 * value;
      await transactionApi.readById(transactionId, (message) => expect(message.response).to.containSubset(expectedTransaction));
    }

    transactionState.transactionId = transactionId;
    transactionState.timestamp = currentTime.toISOString();
    await ocpp.executeStopTransaction(context.chargeBoxIdentity, transactionState, response => {
      expect(response.idTagInfo.status).to.eql('Accepted');
    });

  });

});
