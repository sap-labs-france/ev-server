const sanitize = require('mongo-sanitize');
const Authorizations = require('../../../../authorization/Authorizations');
const Constants = require('../../../../utils/Constants');
const UtilsSecurity = require('./UtilsSecurity');

class TransactionSecurity {
  static filterTransactionRefund(request, loggedUser) {
    const filteredRequest = {};
    // Set
    filteredRequest.id = sanitize(request.id);
    return filteredRequest;
  }

  static filterTransactionDelete(request, loggedUser) {
    const filteredRequest = {};
    // Set
    filteredRequest.ID = sanitize(request.ID);
    return filteredRequest;
  }

  static filterTransactionSoftStop(request, loggedUser) {
    const filteredRequest = {};
    // Set
    filteredRequest.transactionId = sanitize(request.transactionId);
    return filteredRequest;
  }

  static filterTransactionRequest(request, loggedUser) {
    const filteredRequest = {};
    // Set
    filteredRequest.ID = sanitize(request.ID);
    return filteredRequest;
  }

  static filterTransactionsActiveRequest(request, loggedUser) {
    const filteredRequest = {};
    filteredRequest.ChargeBoxID = sanitize(request.ChargeBoxID);
    filteredRequest.ConnectorId = sanitize(request.ConnectorId);
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    return filteredRequest;
  }

  static filterTransactionsCompletedRequest(request, loggedUser) {
    const filteredRequest = {};
    // Handle picture
    filteredRequest.ChargeBoxID = sanitize(request.ChargeBoxID);
    filteredRequest.StartDateTime = sanitize(request.StartDateTime);
    filteredRequest.EndDateTime = sanitize(request.EndDateTime);
    filteredRequest.SiteID = sanitize(request.SiteID);
    filteredRequest.Search = sanitize(request.Search);
    if (request.UserID) {
      filteredRequest.UserID = sanitize(request.UserID);
    }
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    return filteredRequest;
  }

  // Transaction
  static filterTransactionResponse(transaction, loggedUser) {
    let filteredTransaction;

    if (!transaction) {
      return null;
    }
    // Check auth
    if (Authorizations.canReadTransaction(loggedUser, transaction)) {
      // Set only necessary info
      filteredTransaction = {};
      filteredTransaction.id = transaction.id;
      filteredTransaction.chargeBoxID = transaction.chargeBoxID;
      filteredTransaction.connectorId = transaction.connectorId;
      filteredTransaction.meterStart = transaction.meterStart;
      filteredTransaction.currentConsumption = transaction.currentConsumption;
      filteredTransaction.totalConsumption = transaction.totalConsumption;
      filteredTransaction.totalInactivitySecs = transaction.totalInactivitySecs;
      filteredTransaction.totalDurationSecs = transaction.totalDurationSecs;
      filteredTransaction.status = transaction.chargerStatus;
      filteredTransaction.isLoading = transaction.isLoading;

      // retro compatibility ON
      filteredTransaction.transactionId = transaction.id;
      if (transaction.isActive()) {
        if (transaction.chargeBox) {
          filteredTransaction.chargeBox = {};
          filteredTransaction.chargeBox.id = transaction.chargeBox.id;
          filteredTransaction.chargeBox.connectors = [];
          filteredTransaction.chargeBox.connectors[transaction.connectorId - 1] = transaction.chargeBox.connectors[transaction.connectorId - 1];
        }
      } else {
        filteredTransaction.stop = {};
        filteredTransaction.stop.totalConsumption = transaction.totalConsumption;
        filteredTransaction.stop.totalInactivitySecs = transaction.totalInactivitySecs;
        filteredTransaction.stop.totalDurationSecs = transaction.totalDurationSecs;
        if (Authorizations.isAdmin(loggedUser)) {
          filteredTransaction.stop.price = transaction.price;
          filteredTransaction.stop.priceUnit = transaction.priceUnit;
        }
      }
      // retro compatibility OFF
      if (transaction.hasOwnProperty('stateOfCharge')) {
        filteredTransaction.stateOfCharge = transaction.stateOfCharge;
      }

      // Demo user?
      if (Authorizations.isDemo(loggedUser)) {
        filteredTransaction.tagID = Constants.ANONIMIZED_VALUE;
      } else {
        filteredTransaction.tagID = transaction.tagID;
      }
      filteredTransaction.timestamp = transaction.startDate;
      // Filter user
      filteredTransaction.user = TransactionSecurity._filterUserInTransactionResponse(
        transaction.initiator, loggedUser);
      // Transaction Stop
      if (!transaction.isActive()) {
        filteredTransaction.meterStop = transaction.meterStop;
        filteredTransaction.stop.timestamp = transaction.endDate;
        // Demo user?
        if (Authorizations.isDemo(loggedUser)) {
          filteredTransaction.stop.tagID = Constants.ANONIMIZED_VALUE;
        } else {
          filteredTransaction.stop.tagID = transaction.finisherTagId;
        }
        if (transaction.stop.hasOwnProperty('stateOfCharge')) {
          filteredTransaction.stop.stateOfCharge = transaction.stop.stateOfCharge;
        }
        // Admin?
        if (Authorizations.isAdmin(loggedUser)) {
          filteredTransaction.price = transaction.price;
          filteredTransaction.priceUnit = transaction.priceUnit;
        }
        // Stop User
        if (transaction.finisher) {
          // Filter user
          filteredTransaction.stop.user = TransactionSecurity._filterUserInTransactionResponse(
            transaction.finisher, loggedUser);
        }
      }
    }
    return filteredTransaction;
  }

  static filterTransactionsResponse(transactions, loggedUser) {
    const filteredTransactions = [];

    if (!transactions) {
      return null;
    }
    if (!Authorizations.canListTransactions(loggedUser)) {
      return null;
    }
    for (const transaction of transactions) {
      // Filter
      const filteredTransaction = TransactionSecurity.filterTransactionResponse(transaction, loggedUser);
      // Ok?
      if (filteredTransaction) {
        // Add
        filteredTransactions.push(filteredTransaction);
      }
    }
    return filteredTransactions;
  }

  static _filterUserInTransactionResponse(user, loggedUser) {
    const userID = {};

    if (!user) {
      return null;
    }
    // Check auth
    if (Authorizations.canReadUser(loggedUser, user)) {
      // Demo user?
      if (Authorizations.isDemo(loggedUser)) {
        userID.id = null;
        userID.name = Constants.ANONIMIZED_VALUE;
        userID.firstName = Constants.ANONIMIZED_VALUE;
      } else {
        userID.id = user.id;
        userID.name = user.name;
        userID.firstName = user.firstName;
      }
    }
    return userID;
  }

  static filterChargingStationConsumptionFromTransactionRequest(request, loggedUser) {
    const filteredRequest = {};
    // Set
    filteredRequest.TransactionId = sanitize(request.TransactionId);
    filteredRequest.StartDateTime = sanitize(request.StartDateTime);
    filteredRequest.EndDateTime = sanitize(request.EndDateTime);
    return filteredRequest;
  }

  static filterChargingStationTransactionsRequest(request, loggedUser) {
    const filteredRequest = {};
    // Set
    filteredRequest.ChargeBoxID = sanitize(request.ChargeBoxID);
    filteredRequest.ConnectorId = sanitize(request.ConnectorId);
    filteredRequest.StartDateTime = sanitize(request.StartDateTime);
    filteredRequest.EndDateTime = sanitize(request.EndDateTime);
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    return filteredRequest;
  }

  static filterConsumptionsFromTransactionResponse(transaction, consumptions, loggedUser) {
    const filteredConsumption = {};

    if (!consumptions) {
      return null;
    }
    // Check
    if (Authorizations.canReadChargingStation(loggedUser, transaction.chargeBoxID)) {
      filteredConsumption.chargeBoxID = transaction.chargeBoxID;
      filteredConsumption.connectorId = transaction.connectorId;
      // Admin?
      if (Authorizations.isAdmin(loggedUser)) {
        filteredConsumption.priceUnit = transaction.priceUnit;
        filteredConsumption.totalPrice = transaction.price;
      }
      filteredConsumption.totalConsumption = transaction.totalConsumption;
      filteredConsumption.id = transaction.id;
      // Check user
      if (transaction.initiator) {
        if (!Authorizations.canReadUser(loggedUser, transaction.initiator)) {
          return null;
        }
      } else {
        if (!Authorizations.isAdmin(loggedUser)) {
          return null;
        }
      }
      // Set user
      filteredConsumption.user = TransactionSecurity._filterUserInTransactionResponse(
        transaction.initiator, loggedUser);
      // Admin?
      if (Authorizations.isAdmin(loggedUser)) {
        // Set them all
        filteredConsumption.values = consumptions;
      } else {
        // Clean
        filteredConsumption.values = [];
        for (const value of consumptions) {
          // Set
          filteredConsumption.values.push({
            date: value.date,
            value: value.value,
            cumulated: value.cumulated
          });
        }
      }
    }

    return filteredConsumption;
  }
}

module.exports = TransactionSecurity;
