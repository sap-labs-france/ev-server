const sanitize = require('mongo-sanitize');
const Authorizations = require('../../../../authorization/Authorizations');
const Constants = require('../../../../utils/Constants');
const UtilsSecurity = require('./UtilsSecurity');

class TransactionSecurity {
  static filterTransactionRefund(request, loggedUser) {
    let filteredRequest = {};
    // Set
    filteredRequest.id = sanitize(request.id);
    return filteredRequest;
  }

  static filterTransactionDelete(request, loggedUser) {
    let filteredRequest = {};
    // Set
    filteredRequest.ID = sanitize(request.ID);
    return filteredRequest;
  }

  static filterTransactionSoftStop(request, loggedUser) {
    let filteredRequest = {};
    // Set
    filteredRequest.transactionId = sanitize(request.transactionId);
    return filteredRequest;
  }

  static filterTransactionRequest(request, loggedUser) {
    let filteredRequest = {};
    // Set
    filteredRequest.ID = sanitize(request.ID);
    return filteredRequest;
  }

  static filterTransactionsActiveRequest(request, loggedUser) {
    let filteredRequest = {};
    filteredRequest.ChargeBoxID = sanitize(request.ChargeBoxID);
    filteredRequest.ConnectorId = sanitize(request.ConnectorId);
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    return filteredRequest;
  }

  static filterTransactionsCompletedRequest(request, loggedUser) {
    let filteredRequest = {};
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
      filteredTransaction.transactionId = transaction.id;
      filteredTransaction.chargeBoxID = transaction.chargeBoxID;
      filteredTransaction.connectorId = transaction.connectorId;
      filteredTransaction.meterStart = transaction.meterStart;
      filteredTransaction.currentConsumption = transaction.currentConsumption;
      filteredTransaction.totalConsumption = transaction.totalConsumption;
      filteredTransaction.totalInactivitySecs = transaction.totalInactivitySecs;

      if (transaction.hasOwnProperty('totalDurationSecs')) {
        filteredTransaction.totalDurationSecs = transaction.totalDurationSecs;
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
        filteredTransaction.stop = {};
        filteredTransaction.meterStop = transaction.meterStop;
        filteredTransaction.stop.timestamp = transaction.endDate;
        // Demo user?
        if (Authorizations.isDemo(loggedUser)) {
          filteredTransaction.stop.tagID = Constants.ANONIMIZED_VALUE;
        } else {
          filteredTransaction.stop.tagID = transaction.finisherTagId;
        }
        // Admin?
        if (Authorizations.isAdmin(loggedUser)) {
          filteredTransaction.stop.price = transaction.stop.price;
          filteredTransaction.stop.priceUnit = transaction.stop.priceUnit;
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

  static filterTransactionsResponse(transactions, loggedUser, withConnector = false) {
    let filteredTransactions = [];

    if (!transactions) {
      return null;
    }
    if (!Authorizations.canListTransactions(loggedUser)) {
      return null;
    }
    for (const transaction of transactions) {
      // Filter
      let filteredTransaction = TransactionSecurity.filterTransactionResponse(transaction, loggedUser);
      // Ok?
      if (filteredTransaction) {
        // Add
        filteredTransactions.push(filteredTransaction);
      }
    }
    return filteredTransactions;
  }

  static _filterUserInTransactionResponse(user, loggedUser) {
    let userID = {};

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
    let filteredRequest = {};
    // Set
    filteredRequest.TransactionId = sanitize(request.TransactionId);
    filteredRequest.StartDateTime = sanitize(request.StartDateTime);
    filteredRequest.EndDateTime = sanitize(request.EndDateTime);
    return filteredRequest;
  }

  static filterChargingStationTransactionsRequest(request, loggedUser) {
    let filteredRequest = {};
    // Set
    filteredRequest.ChargeBoxID = sanitize(request.ChargeBoxID);
    filteredRequest.ConnectorId = sanitize(request.ConnectorId);
    filteredRequest.StartDateTime = sanitize(request.StartDateTime);
    filteredRequest.EndDateTime = sanitize(request.EndDateTime);
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    return filteredRequest;
  }

  static filterConsumptionsFromTransactionResponse(transaction,consumptions, loggedUser) {
    let filteredConsumption = {};

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
        filteredConsumption.totalPrice = transaction.totalPrice;
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
