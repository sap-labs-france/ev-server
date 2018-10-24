const CrudApi = require('./utils/CrudApi');
const Constants = require('./utils/Constants');
const { expect } = require('chai');

class TransactionApi extends CrudApi {
  constructor(authenticatedApi) {
    super(authenticatedApi);
  }

  readById(id) {
    return super.readById('/client/api/Transaction', id);
  }

  readAllActive(params, paging = Constants.DEFAULT_PAGING, ordering = Constants.DEFAULT_ORDERING) {
    return super.readAll('/client/api/TransactionsActive', params, paging, ordering);
  }

  readAllCompleted(params, paging = Constants.DEFAULT_PAGING, ordering = Constants.DEFAULT_ORDERING) {
    return super.readAll('/client/api/TransactionsCompleted', params, paging, ordering);
  }

  readAllYears(params) {
    return super.readAll('/client/api/TransactionYears', params);
  }

  delete(id) {
    return super.delete('/client/api/TransactionDelete', id);
  }

  async startTransaction(ocpp, chargingStation, chargingStationConnector, user, meterStart, startTime) {
    // Start the transaction
    let response = await ocpp.executeStartTransaction(chargingStation.id, {
      connectorId: chargingStationConnector.connectorId,
      idTag: user.tagIDs[0],
      meterStart: meterStart,
      timestamp: startTime.toISOString()
    });
    // Check
    expect(response.data).to.be.an('object');
    expect(response.data).to.have.property('transactionId');
    expect(response.data.transactionId).to.not.equal(0);
    expect(response.data).to.have.property('idTagInfo');
    expect(response.data.idTagInfo.status).to.equal('Accepted');
    // Keep it
    let transactionId = response.data.transactionId;

    // Set Connector Status to Occupied
    chargingStationConnector.status = 'Occupied';
    chargingStationConnector.timestamp = new Date().toISOString();
    // Update
    response = await ocpp.executeStatusNotification(chargingStation.id, chargingStationConnector);
    // Check
    expect(response.data).to.eql({});

    // Check if the Transaction exists
    response = await this.readById(transactionId);
    // Check
    expect(response.data).to.deep.include({
      id: transactionId,
      timestamp: startTime.toISOString(),
      connectorId: chargingStationConnector.connectorId,
      tagID: user.tagIDs[0],
      chargeBoxID: chargingStation.id,
      meterStart: meterStart,
      chargeBox: {
        id: chargingStation.id,
        connectors: [{
          activeTransactionID: transactionId,
          connectorId: chargingStationConnector.connectorId,
          currentConsumption: 0,
          totalConsumption: 0,
          status: 'Occupied',
          errorCode: 'NoError',
          vendorErrorCode: '',
          info: '',
          type: null,
          power: 0
        }]
      },
      user: {
        id: user.id,
        firstName: user.firstName,
        name: user.name,
      }
    })
    return response.data;
  }
}

module.exports = TransactionApi;