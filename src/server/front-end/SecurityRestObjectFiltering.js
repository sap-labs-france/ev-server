const CentralRestServerAuthorization = require('./CentralRestServerAuthorization');

require('source-map-support').install();

class SecurityRestObjectFiltering {
  // Pricing
  static filterPricing(pricing, loggedUser) {
    let filteredPricing = {};
    // Set
    filteredPricing.timestamp = pricing.timestamp;
    filteredPricing.priceKWH = pricing.priceKWH;
    filteredPricing.priceUnit = pricing.priceUnit;
    // Return
    return filteredPricing;
  }

  // User
  static filterUser(user, loggedUser, withPicture=false) {
    let filteredUser;
    // Check auth
    if (CentralRestServerAuthorization.canReadUser(loggedUser, user)) {
      // Admin?
      if (CentralRestServerAuthorization.isAdmin(loggedUser)) {
        // Yes: set all params
        filteredUser = user;
        filteredUser.password = "";
      } else {
        // Set only necessary info
        filteredUser = {};
        filteredUser.id = user.id;
        filteredUser.name = user.name;
        filteredUser.firstName = user.firstName;
        filteredUser.email = user.email;
        if (withPicture) {
          filteredUser.image = user.image;
        }
        filteredUser.locale = user.locale;
        // filteredUser. = user.;
        // filteredUser. = user.;
      }
    }

    return filteredUser;
  }

  static filterUsers(users, loggedUser, withPicture=false) {
    let filteredUsers = [];
    users.forEach(user => {
      // Filter
      let filteredUser = this.filterUser(user, loggedUser);
      // Ok?
      if (filteredUser) {
        // Add
        filteredUsers.push(filteredUser);
      }
    });
    return filteredUsers;
  }

  // Charging Station
  static filterChargingStation(chargingStation, loggedUser) {
    let filteredChargingStation;

    // Check auth
    if (CentralRestServerAuthorization.canReadChargingStation(loggedUser, chargingStation)) {
      // Admin?
      if (CentralRestServerAuthorization.isAdmin(loggedUser)) {
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
    }

    return filteredChargingStation;
  }

  static filterChargingStations(chargingStations, loggedUser) {
    let filteredChargingStations = [];
    chargingStations.forEach(chargingStation => {
      // Filter
      let filteredChargingStation = this.filterChargingStation(chargingStation, loggedUser);
      // Ok?
      if (filteredChargingStation) {
        // Add
        filteredChargingStations.push(filteredChargingStation);
      }
    });
    return filteredChargingStations;
  }

  // Transaction
  static filterTransaction(transaction, loggedUser, withPicture=false, withConnector=false) {
    let filteredTransaction;

    // Check auth
    if (CentralRestServerAuthorization.canReadUser(loggedUser, transaction.userID) &&
        CentralRestServerAuthorization.canReadChargingStation(loggedUser, transaction.chargeBoxID)) {
      // Set only necessary info
      filteredTransaction = {};
      filteredTransaction.id = transaction.id;
      filteredTransaction.transactionId = transaction.transactionId;
      filteredTransaction.connectorId = transaction.connectorId;
      filteredTransaction.timestamp = transaction.timestamp;
      // Filter user
      filteredTransaction.userID =
        SecurityRestObjectFiltering.filterUserInTransaction(
          transaction.userID, loggedUser, withPicture);
      // Transaction Stop
      if (transaction.stop) {
        filteredTransaction.stop = {};
        filteredTransaction.stop.timestamp = transaction.stop.timestamp;
        filteredTransaction.stop.totalConsumption = transaction.stop.totalConsumption;
        // Admin?
        if (CentralRestServerAuthorization.isAdmin(loggedUser)) {
          filteredTransaction.stop.price = transaction.stop.price;
          filteredTransaction.stop.priceUnit = transaction.stop.priceUnit;
        }
        // Stop User
        if (transaction.stop.userID) {
          // Filter user
          filteredTransaction.stop.userID =
            SecurityRestObjectFiltering.filterUserInTransaction(
              transaction.stop.userID, loggedUser, withPicture);
        }
      }
      // Charging Station
      filteredTransaction.chargeBoxID = {};
      filteredTransaction.chargeBoxID.id = transaction.chargeBoxID.id;
      filteredTransaction.chargeBoxID.chargeBoxIdentity = transaction.chargeBoxID.chargeBoxIdentity;
      if (withConnector) {
        filteredTransaction.chargeBoxID.connectors = [];
        filteredTransaction.chargeBoxID.connectors[transaction.connectorId-1] = transaction.chargeBoxID.connectors[transaction.connectorId-1];
      }
    }

    return filteredTransaction;
  }

  static filterUserInTransaction(user, loggedUser, withPicture) {
    let userID = {};
    // Check auth
    if (CentralRestServerAuthorization.canReadUser(loggedUser, user)) {
      // Demo user?
      if (CentralRestServerAuthorization.isDemo(loggedUser)) {
        userID.name = "####";
        userID.firstName = "####";
      } else {
        userID.name = user.name;
        userID.firstName = user.firstName;
        if (withPicture) {
          userID.image = user.image;
        }
      }
    }
    return userID;
  }

  static filterTransactions(transactions, loggedUser, withPicture=false, withConnector=false) {
    let filteredTransactions = [];
    transactions.forEach(transaction => {
      // Filter
      let filteredTransaction = this.filterTransaction(transaction, loggedUser, withPicture, withConnector);
      // Ok?
      if (filteredTransaction) {
        // Add
        filteredTransactions.push(filteredTransaction);
      }
    });
    return filteredTransactions;
  }
}

module.exports = SecurityRestObjectFiltering;
