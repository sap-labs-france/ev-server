const CentralRestServerAuthorization = require('./CentralRestServerAuthorization');

require('source-map-support').install();

class SecurityRestObjectFiltering {
  // Charging Station
  static filterChargingStation(chargingStation, user) {
    let filteredChargingStation;
    // Admin?
    if (CentralRestServerAuthorization.isAdmin(user)) {
      // Yes: set all params
      filteredChargingStation = chargingStation;
    } else {
      // Set only necessary info
      filteredChargingStation = {};
      filteredChargingStation.id = chargingStation.id;
      filteredChargingStation.chargeBoxIdentity = chargingStation.chargeBoxIdentity;
      filteredChargingStation.connectors = chargingStation.connectors;
      filteredChargingStation.lastHeartBeat = chargingStation.lastHeartBeat;
    }
    return filteredChargingStation;
  }

  static filterChargingStations(chargingStations, user) {
    let filteredChargingStations = [];
    chargingStations.forEach(chargingStation => {
      // Filter
      filteredChargingStations.push(this.filterChargingStation(chargingStation, user));
    });
    return filteredChargingStations;
  }

  // Transaction
  static filterTransaction(transaction, user) {
    let filteredTransaction;

    // Set only necessary info
    filteredTransaction = {};
    filteredTransaction.id = transaction.id;
    filteredTransaction.transactionId = transaction.transactionId;
    filteredTransaction.connectorId = transaction.connectorId;
    filteredTransaction.timestamp = transaction.timestamp;
    // User
    filteredTransaction.userID = {};
    filteredTransaction.userID.id = transaction.userID.id;
    filteredTransaction.userID.name = transaction.userID.name;
    filteredTransaction.userID.firstName = transaction.userID.firstName;
    // Transaction Stop
    if (transaction.stop) {
      filteredTransaction.stop = {};
      filteredTransaction.stop.timestamp = transaction.stop.timestamp;
      filteredTransaction.stop.totalConsumption = transaction.stop.totalConsumption;
      // Stop User
      if (transaction.stop.userID) {
        filteredTransaction.stop.userID = {};
        filteredTransaction.stop.userID.id = transaction.stop.userID.id;
        filteredTransaction.stop.userID.name = transaction.stop.userID.name;
        filteredTransaction.stop.userID.firstName = transaction.stop.userID.firstName;
      }
    }
    // Charging Station
    filteredTransaction.chargeBoxID = {};
    filteredTransaction.chargeBoxID.id = transaction.chargeBoxID.id;
    filteredTransaction.chargeBoxID.chargeBoxIdentity = transaction.chargeBoxID.chargeBoxIdentity;

    return filteredTransaction;
  }

  static filterTransactions(transactions, user) {
    let filteredTransactions = [];
    transactions.forEach(transaction => {
      // Filter
      filteredTransactions.push(this.filterTransaction(transaction, user));
    });
    return filteredTransactions;
  }
}

module.exports = SecurityRestObjectFiltering;
