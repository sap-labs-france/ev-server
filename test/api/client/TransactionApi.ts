import { expect } from 'chai';
// pragma import moment from 'moment';
import Constants from './utils/Constants';
import CrudApi from './utils/CrudApi';
import User from '../../../src/types/User';

export default class TransactionApi extends CrudApi {
  public constructor(authenticatedApi) {
    super(authenticatedApi);
  }

  public readById(id) {
    return super.readById(id, '/client/api/Transaction');
  }

  public readAllActive(params, paging = Constants.DEFAULT_PAGING, ordering = Constants.DEFAULT_ORDERING) {
    return super.readAll(params, paging, ordering, '/client/api/TransactionsActive');
  }

  public readAllCompleted(params, paging = Constants.DEFAULT_PAGING, ordering = Constants.DEFAULT_ORDERING) {
    return super.readAll(params, paging, ordering, '/client/api/TransactionsCompleted');
  }

  public readAllInError(params, paging = Constants.DEFAULT_PAGING, ordering = Constants.DEFAULT_ORDERING) {
    return super.readAll(params, paging, ordering, '/client/api/TransactionsInError');
  }

  public readAllConsumption(params) {
    return super.read(params, '/client/api/ChargingStationConsumptionFromTransaction');
  }

  public readAllYears(params) {
    return super.readAll(params, Constants.DEFAULT_PAGING, Constants.DEFAULT_ORDERING, '/client/api/TransactionYears');
  }

  public delete(id) {
    return super.delete(id, '/client/api/TransactionDelete');
  }

  public async startTransaction(ocpp, chargingStation, chargingStationConnector, user: User, meterStart, startTime, withSoC = false) {
    // Start the transaction
    const responseTransaction = await ocpp.executeStartTransaction(chargingStation.id, {
      connectorId: chargingStationConnector.connectorId,
      idTag: user.tagIDs[0],
      meterStart: meterStart,
      timestamp: startTime.toISOString()
    });
    // Check
    expect(responseTransaction.data).to.have.property('idTagInfo');
    expect(responseTransaction.data.idTagInfo.status).to.equal('Accepted');
    expect(responseTransaction.data).to.have.property('transactionId');
    expect(responseTransaction.data.transactionId).to.not.equal(0);
    // Keep it
    // const transactionId = responseTransaction.data.transactionId;
    // Set Connector Status to Occupied
    chargingStationConnector.status = 'Occupied';
    chargingStationConnector.timestamp = new Date().toISOString();
    // Update
    const response = await ocpp.executeStatusNotification(chargingStation.id, chargingStationConnector);
    // Check
    expect(response.data).to.eql({});
    return responseTransaction;
    // // Check if the Transaction exists
    // response = await this.readById(transactionId);
    // // Check
    // expect(response.status).to.equal(200);
    // expect(response.data).to.deep.include({
    //   id: transactionId,
    //   timestamp: startTime.toISOString(),
    //   connectorId: chargingStationConnector.connectorId,
    //   // currentConsumption: 0,
    //   // currentCumulatedPrice: 0,
    //   // currentStateOfCharge: 0,
    //   // currentTotalConsumption: 0,
    //   // currentTotalInactivitySecs: 0,
    //   isLoading: false,
    //   meterStart: meterStart,
    //   price: 0,
    //   roundedPrice: 0,
    //   tagID: user.tagIDs[0],
    //   chargeBoxID: chargingStation.id,
    //   // stateOfCharge: 0,
    //   user: {
    //     id: user.id,
    //     firstName: user.firstName,
    //     name: user.name,
    //   }
    // });
    // return response.data;
  }

  public async sendTransactionMeterValue(ocpp, transaction, chargingStation, user: User, meterValue, currentTime, currentConsumption, totalConsumption) {
    let response;
    // OCPP 1.6?
    if (ocpp.getVersion() === '1.6') {
      // Yes
      response = await ocpp.executeMeterValues(chargingStation.id, {
        connectorId: transaction.connectorId,
        transactionId: transaction.id,
        meterValue: {
          timestamp: currentTime.toISOString(),
          sampledValue: [{
            value: meterValue,
            format: 'Raw',
            measurand: 'Energy.Active.Import.Register',
            unit: 'Wh',
            location: 'Outlet',
            context: 'Sample.Periodic'
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
              location: 'Outlet',
              measurand: 'Energy.Active.Import.Register',
              format: 'Raw',
              context: 'Sample.Periodic'
            },
            $value: meterValue
          }
        },
      });
    }
    // Check
    expect(response.data).to.eql({});
    return response;
    // // Check the Transaction
    // response = await this.readById(transaction.id);
    // // Check Consumption
    // expect(response.status).to.equal(200);
    // expect(response.data).to.deep.include({
    //   id: transaction.id,
    //   timestamp: transaction.timestamp,
    //   connectorId: transaction.connectorId,
    //   tagID: transaction.tagID,
    //   chargeBoxID: transaction.chargeBoxID,
    //   meterStart: transaction.meterStart,
    //   currentConsumption: currentConsumption,
    //   currentTotalConsumption: totalConsumption,
    //   user: {
    //     id: user.id,
    //     firstName: user.firstName,
    //     name: user.name,
    //   }
    // });
  }

  public async sendBeginMeterValue(ocpp, transaction, chargingStation, user,
    meterValue, meterSocValue, signedValue, currentTime, withSoC = false, withSignedData = false) {
    let response;
    // OCPP 1.6?
    if (ocpp.getVersion() === '1.6') {
      // Yes
      if (withSoC) {
        // With State of Charge ?
        response = await ocpp.executeMeterValues(chargingStation.id, {
          connectorId: transaction.connectorId,
          transactionId: transaction.id,
          meterValue: {
            timestamp: currentTime.toISOString(),
            sampledValue: [{
              'unit': 'Wh',
              'context': 'Transaction.Begin',
              'value': meterValue
            }, {
              'unit': 'Percent',
              'context': 'Transaction.Begin',
              'measurand': 'SoC',
              'location': 'EV',
              'value': meterSocValue
            }]
          },
        });
      } else if (withSignedData) {
        // With SignedData ?
        response = await ocpp.executeMeterValues(chargingStation.id, {
          connectorId: transaction.connectorId,
          transactionId: transaction.id,
          meterValue: {
            timestamp: currentTime.toISOString(),
            sampledValue: [{
              'unit': 'Wh',
              'context': 'Transaction.Begin',
              'value': signedValue,
              'format': 'SignedData'
            }, {
              'unit': 'Wh',
              'context': 'Transaction.Begin',
              'value': meterValue
            }]
          },
        });
      } else {
        // Regular case
        response = await ocpp.executeMeterValues(chargingStation.id, {
          connectorId: transaction.connectorId,
          transactionId: transaction.id,
          meterValue: {
            timestamp: currentTime.toISOString(),
            sampledValue: [{
              'unit': 'Wh',
              'context': 'Transaction.Begin',
              'value': meterValue
            }]
          },
        });
      }
      // Check
      expect(response.data).to.eql({});
      return response;
      // // Check the Transaction
      // response = await this.readById(transaction.id);
      // // Check Consumption
      // expect(response.status).to.equal(200);
      // expect(response.data).to.deep.include({
      //   id: transaction.id,
      //   timestamp: transaction.timestamp,
      //   connectorId: transaction.connectorId,
      //   tagID: transaction.tagID,
      //   chargeBoxID: transaction.chargeBoxID,
      //   meterStart: transaction.meterStart,
      //   // stateOfCharge: meterSocValue,
      //   user: {
      //     id: user.id,
      //     firstName: user.firstName,
      //     name: user.name,
      //   }
      // });
    }
    return response;
  }

  public async sendTransactionWithSoCMeterValue(ocpp, transaction, chargingStation, user: User,
    meterValue, meterSocValue, currentTime, currentConsumption, totalConsumption) {
    let response;
    // OCPP 1.6?
    if (ocpp.getVersion() === '1.6') {
      // Yes
      response = await ocpp.executeMeterValues(chargingStation.id, {
        connectorId: transaction.connectorId,
        transactionId: transaction.id,
        meterValue: {
          timestamp: currentTime.toISOString(),
          sampledValue: [{
            'unit': 'Wh',
            'context': 'Sample.Periodic',
            'value': meterValue
          }, {
            'unit': 'Percent',
            'context': 'Sample.Periodic',
            'measurand': 'SoC',
            'location': 'EV',
            'value': meterSocValue
          }]
        },
      });
      // Check
      expect(response.data).to.eql({});
      // Check the Transaction
      response = await this.readById(transaction.id);
      return response;
      // // Check Consumption
      // expect(response.status).to.equal(200);
      // expect(response.data).to.deep.include({
      //   id: transaction.id,
      //   timestamp: transaction.timestamp,
      //   connectorId: transaction.connectorId,
      //   tagID: transaction.tagID,
      //   chargeBoxID: transaction.chargeBoxID,
      //   meterStart: transaction.meterStart,
      //   currentConsumption: currentConsumption,
      //   currentTotalConsumption: totalConsumption,
      //   currentStateOfCharge: meterSocValue,
      //   user: {
      //     id: user.id,
      //     firstName: user.firstName,
      //     name: user.name,
      //   }
      // });
    }
  }

  public async sendEndMeterValue(ocpp, transaction, chargingStation, user,
    meterValue, meterSocValue, signedValue, currentTime, withSoC = false, withSignedData = false) {
    let response;
    // OCPP 1.6?
    if (ocpp.getVersion() === '1.6') {
      // Yes
      if (withSoC) {
        // With State of Charge ?
        response = await ocpp.executeMeterValues(chargingStation.id, {
          connectorId: transaction.connectorId,
          transactionId: transaction.id,
          meterValue: {
            timestamp: currentTime.toISOString(),
            sampledValue: [{
              'unit': 'Wh',
              'context': 'Transaction.End',
              'value': meterValue
            }, {
              'unit': 'Percent',
              'context': 'Transaction.End',
              'measurand': 'SoC',
              'location': 'EV',
              'value': meterSocValue
            }]
          },
        });
      } else if (withSignedData) {
        // With SignedData ?
        response = await ocpp.executeMeterValues(chargingStation.id, {
          connectorId: transaction.connectorId,
          transactionId: transaction.id,
          meterValue: {
            timestamp: currentTime.toISOString(),
            sampledValue: [{
              'unit': 'Wh',
              'context': 'Transaction.End',
              'value': signedValue,
              'format': 'SignedData'
            }]
          },
        });
      } else {
        // Regular case
        response = await ocpp.executeMeterValues(chargingStation.id, {
          connectorId: transaction.connectorId,
          transactionId: transaction.id,
          meterValue: {
            timestamp: currentTime.toISOString(),
            sampledValue: [{
              'unit': 'Wh',
              'context': 'Transaction.End',
              'value': meterValue
            }]
          },
        });
      }
      // Check
      expect(response.data).to.eql({});
      // // Check the Transaction
      // response = await this.readById(transaction.id);
      // // Check Consumption
      // expect(response.status).to.equal(200);
      // expect(response.data).to.deep.include({
      //   id: transaction.id,
      //   timestamp: transaction.timestamp,
      //   connectorId: transaction.connectorId,
      //   tagID: transaction.tagID,
      //   chargeBoxID: transaction.chargeBoxID,
      //   meterStart: transaction.meterStart,
      //   stateOfCharge: transaction.stateOfCharge,
      //   user: {
      //     id: user.id,
      //     firstName: user.firstName,
      //     name: user.name,
      //   }
      // });
      // if (withSoC) {
      //   expect(response.data).to.deep.include({
      //     currentStateOfCharge: meterSocValue
      //   });
      // }
      return response;
    }
  }

  public async stopTransaction(ocpp, transaction, userStart: User, userStop: User, meterStop, stopTime,
    chargingStationConnector, totalConsumption, totalInactivity, totalPrice, stateOfCharge) {
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

    // // Check the Transaction
    // response = await this.readById(transaction.id);
    // // Check Transaction
    // expect(response.status).to.equal(200);
    // expect(response.data).to.deep.include({
    //   id: transaction.id,
    //   timestamp: transaction.timestamp,
    //   chargeBoxID: transaction.chargeBoxID,
    //   connectorId: transaction.connectorId,
    //   tagID: transaction.tagID,
    //   isLoading: false,
    //   meterStart: transaction.meterStart,
    //   stateOfCharge: transaction.stateOfCharge,
    //   stop: {
    //     meterStop: meterStop,
    //     totalConsumption: totalConsumption,
    //     totalInactivitySecs: totalInactivity,
    //     totalDurationSecs: moment.duration(moment(stopTime).diff(transaction.timestamp)).asSeconds(),
    //     price: totalPrice,
    //     priceUnit: 'EUR',
    //     pricingSource: 'simple',
    //     roundedPrice: parseFloat(totalPrice.toFixed(2)),
    //     stateOfCharge: stateOfCharge,
    //     tagID: userStop.tagIDs[0],
    //     timestamp: stopTime.toISOString(),
    //     user: {
    //       id: userStop.id,
    //       name: userStop.name,
    //       firstName: userStop.firstName
    //     },
    //   },
    //   user: {
    //     id: userStart.id,
    //     name: userStart.name,
    //     firstName: userStart.firstName
    //   }
    // });
  }
}

