const CrudApi = require('./utils/CrudApi');
const Constants = require('./utils/Constants');
const moment = require('moment');
const {expect} = require('chai');

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

  readAllConsumption(params) {
    return super.read('/client/api/ChargingStationConsumptionFromTransaction', params);
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
    expect(response.data).to.have.property('idTagInfo');
    expect(response.data.idTagInfo.status).to.equal('Accepted');
    expect(response.data).to.have.property('transactionId');
    expect(response.data.transactionId).to.not.equal(0);
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
    expect(response.status).to.equal(200);
    expect(response.data).to.deep.include({
      id: transactionId,
      timestamp: startTime.toISOString(),
      connectorId: chargingStationConnector.connectorId,
      tagID: user.tagIDs[0],
      chargeBoxID: chargingStation.id,
      currentConsumption: 0,
      totalConsumption: 0,
      meterStart: meterStart,
      user: {
        id: user.id,
        firstName: user.firstName,
        name: user.name,
      }
    });
    return response.data;
  }

  async sendTransactionMeterValue(ocpp, transaction, chargingStation, user, meterValue, currentTime, currentConsumption, totalConsumption) {
    let response;
    // OCPP 1.6?
    if (ocpp.getVersion() === "1.6") {
      // Yes
      response = await ocpp.executeMeterValues(chargingStation.id, {
        connectorId: transaction.connectorId,
        transactionId: transaction.id,
        meterValue: {
          timestamp: currentTime.toISOString(),
          sampledValue: [{
            value: meterValue,
            format: "Raw",
            measurand: "Energy.Active.Import.Register",
            unit: 'Wh',
            location: "Outlet",
            context: "Sample.Periodic"
          }]
        },
      });
      // OCPP 1.5
    } else {
      response = await ocpp.executeMeterValues(chargingStation.id, {
        connectorId: transaction.connectorId,
        transactionId: transaction.id,
        values: {
          timestamp: currentTime.toISOString(),
          value: {
            $attributes: {
              unit: 'Wh',
              location: "Outlet",
              measurand: "Energy.Active.Import.Register",
              format: "Raw",
              context: "Sample.Periodic"
            },
            $value: meterValue
          }
        },
      });
    }
    // Check
    expect(response.data).to.eql({});
    // Check the Transaction
    response = await this.readById(transaction.id);
    // Check Consumption
    expect(response.status).to.equal(200);
    expect(response.data).to.deep.include({
      id: transaction.id,
      timestamp: transaction.timestamp,
      connectorId: transaction.connectorId,
      tagID: transaction.tagID,
      chargeBoxID: transaction.chargeBoxID,
      meterStart: transaction.meterStart,
      currentConsumption: currentConsumption,
      totalConsumption: totalConsumption,
      user: {
        id: user.id,
        firstName: user.firstName,
        name: user.name,
      }
    })
  }

  async stopTransaction(ocpp, transaction, userStart, userStop, meterStop, stopTime, chargingStationConnector, totalConsumption, totalInactivity, totalPrice) {
    // Stop the transaction
    let response = await ocpp.executeStopTransaction(transaction.chargeBoxID, {
      transactionId: transaction.id,
      idTag: userStop.tagIDs[0],
      meterStop: meterStop,
      timestamp: stopTime.toISOString()
    });
    // Check
    expect(response.data).to.have.property('idTagInfo');
    expect(response.data.idTagInfo.status).to.equal('Accepted');

    // Set the connector to Available
    chargingStationConnector.status = 'Available';
    chargingStationConnector.timestamp = new Date().toISOString();
    // Update
    response = await ocpp.executeStatusNotification(transaction.chargeBoxID, chargingStationConnector);
    // Check
    expect(response.data).to.eql({});

    // Check the Transaction
    response = await this.readById(transaction.id);
    // Check Transaction
    expect(response.status).to.equal(200);
    expect(response.data).to.deep.include({
      id: transaction.id,
      price: totalPrice,
      timestamp: transaction.timestamp,
      connectorId: transaction.connectorId,
      tagID: transaction.tagID,
      chargeBoxID: transaction.chargeBoxID,
      meterStart: transaction.meterStart,
      totalConsumption: totalConsumption,
      totalInactivitySecs: totalInactivity,
      totalDurationSecs: moment.duration(moment(stopTime).diff(transaction.timestamp)).asSeconds(),
      stop: {
        price: totalPrice,
        priceUnit: 'EUR',
        totalConsumption: totalConsumption,
        totalInactivitySecs: totalInactivity,
        totalDurationSecs: moment.duration(moment(stopTime).diff(transaction.timestamp)).asSeconds(),
        tagID: userStop.tagIDs[0],
        timestamp: stopTime.toISOString(),
        user: {
          id: userStop.id,
          name: userStop.name,
          firstName: userStop.firstName
        },
      },
      user: {
        id: userStart.id,
        name: userStart.name,
        firstName: userStart.firstName
      }
    })
  }
}

module.exports = TransactionApi;