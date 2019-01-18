const sanitize = require('mongo-sanitize');
const Authorizations = require('../../../../authorization/Authorizations');
const Constants = require('../../../../utils/Constants');
const UtilsSecurity = require('./UtilsSecurity');

class TransactionSecurity {
  // eslint-disable-next-line no-unused-vars
  static filterTransactionsRefund(request, loggedUser) {
    const filteredRequest = {};
    // Set
    filteredRequest.transactionIds = request.transactionIds.map(id => sanitize(id));
    return filteredRequest;
  }

  // eslint-disable-next-line no-unused-vars
  static filterTransactionDelete(request, loggedUser) {
    const filteredRequest = {};
    // Set
    filteredRequest.ID = sanitize(request.ID);
    return filteredRequest;
  }

  // eslint-disable-next-line no-unused-vars
  static filterTransactionSoftStop(request, loggedUser) {
    const filteredRequest = {};
    // Set
    filteredRequest.transactionId = sanitize(request.transactionId);
    return filteredRequest;
  }

  // eslint-disable-next-line no-unused-vars
  static filterTransactionRequest(request, loggedUser) {
    const filteredRequest = {};
    // Set
    filteredRequest.ID = sanitize(request.ID);
    return filteredRequest;
  }

  // eslint-disable-next-line no-unused-vars
  static filterTransactionsActiveRequest(request, loggedUser) {
    const filteredRequest = {};
    filteredRequest.ChargeBoxID = sanitize(request.ChargeBoxID);
    filteredRequest.ConnectorId = sanitize(request.ConnectorId);
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    return filteredRequest;
  }

  // eslint-disable-next-line no-unused-vars
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

  static filterTransactionsInErrorRequest(request) {
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
  /**
   *
   * @param transaction {Transaction}
   * @param loggedUser
   * @returns {*}
   */
  static filterTransactionResponse(transaction, loggedUser) {
    let filteredTransaction;

    if (!transaction) {
      return null;
    }
    // Check auth
    if (Authorizations.canReadTransaction(loggedUser, transaction)) {
      // Set only necessary info
      filteredTransaction = {};
      filteredTransaction.id = transaction.getID();
      filteredTransaction.chargeBoxID = transaction.getChargeBoxID();
      filteredTransaction.connectorId = transaction.getConnectorId();
      filteredTransaction.meterStart = transaction.getMeterStart();
      filteredTransaction.timestamp = transaction.getStartDate();
      // Runime Data
      if (transaction.isActive()) {
        filteredTransaction.currentConsumption = transaction.getCurrentConsumption();
        filteredTransaction.currentTotalConsumption = transaction.getCurrentTotalConsumption();
        filteredTransaction.currentTotalInactivitySecs = transaction.getCurrentTotalInactivitySecs();
        filteredTransaction.currentTotalDurationSecs = transaction.getCurrentTotalDurationSecs();
        filteredTransaction.currentStateOfCharge = transaction.getCurrentStateOfCharge();
      }
      filteredTransaction.status = transaction.getChargerStatus();
      filteredTransaction.isLoading = transaction.isLoading();
      filteredTransaction.stateOfCharge = transaction.getStateOfCharge();
      filteredTransaction.refundId = transaction.getRefundId();
      // Demo user?
      if (Authorizations.isDemo(loggedUser)) {
        filteredTransaction.tagID = Constants.ANONIMIZED_VALUE;
      } else {
        filteredTransaction.tagID = transaction.getTagID();
      }
      // Filter user
      filteredTransaction.user = TransactionSecurity._filterUserInTransactionResponse(
        transaction.getUserJson(), loggedUser);
      // Transaction Stop
      if (transaction.isFinished()) {
        filteredTransaction.stop = {};
        filteredTransaction.stop.meterStop = transaction.getMeterStop();
        filteredTransaction.stop.timestamp = transaction.getEndDate();
        filteredTransaction.stop.totalConsumption = transaction.getTotalConsumption();
        filteredTransaction.stop.totalInactivitySecs = transaction.getTotalInactivitySecs();
        filteredTransaction.stop.totalDurationSecs = transaction.getTotalDurationSecs();
        filteredTransaction.stop.stateOfCharge = transaction.getEndStateOfCharge();
        if (Authorizations.isAdmin(loggedUser) && transaction.hasPrice()) {
          filteredTransaction.stop.price = transaction.getPrice();
          filteredTransaction.stop.priceUnit = transaction.getPriceUnit();
        }
        // Demo user?
        if (Authorizations.isDemo(loggedUser)) {
          filteredTransaction.stop.tagID = Constants.ANONIMIZED_VALUE;
        } else {
          filteredTransaction.stop.tagID = transaction.getStoppedTagID();
        }
        // Stop User
        if (transaction.getStoppedUserJson()) {
          // Filter user
          filteredTransaction.stop.user = TransactionSecurity._filterUserInTransactionResponse(
            transaction.getStoppedUserJson(), loggedUser);
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

  // eslint-disable-next-line no-unused-vars
  static filterChargingStationConsumptionFromTransactionRequest(request, loggedUser) {
    const filteredRequest = {};
    // Set
    filteredRequest.TransactionId = sanitize(request.TransactionId);
    filteredRequest.StartDateTime = sanitize(request.StartDateTime);
    filteredRequest.EndDateTime = sanitize(request.EndDateTime);
    return filteredRequest;
  }

  // eslint-disable-next-line no-unused-vars
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
    if (!consumptions) {
      return null;
    }
    // Check Authorisation
    if (transaction.getUserJson()) {
      if (!Authorizations.canReadUser(loggedUser, transaction.getUserJson())) {
        return null;
      }
    } else {
      if (!Authorizations.isAdmin(loggedUser)) {
        return null;
      }
    }
    const filteredTransaction = this.filterTransactionResponse(transaction, loggedUser);
    // Admin?
    if (Authorizations.isAdmin(loggedUser)) {
      // Set them all
      filteredTransaction.values = consumptions;
    } else {
      // Clean
      filteredTransaction.values = [];
      for (const value of consumptions) {
        // Set
        const filteredValue = {
          date: value.date,
          value: value.value,
          cumulated: value.cumulated,
          stateOfCharge: value.stateOfCharge
        };
        filteredTransaction.values.push(filteredValue);
      }
    }
    return filteredTransaction;
  }
}

module.exports = TransactionSecurity;
