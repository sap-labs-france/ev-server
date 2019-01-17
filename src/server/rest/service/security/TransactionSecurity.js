const sanitize = require('mongo-sanitize');
const Authorizations = require('../../../../authorization/Authorizations');
const Constants = require('../../../../utils/Constants');
const UtilsSecurity = require('./UtilsSecurity');

class TransactionSecurity {
  static filterTransactionsRefund(request, loggedUser) {
    const filteredRequest = {};
    // Set
    filteredRequest.transactionIds = request.transactionIds.map(id => sanitize(id));
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
      filteredTransaction.currentConsumption = transaction.getCurrentConsumption();
      filteredTransaction.totalConsumption = transaction.getTotalConsumption();
      filteredTransaction.totalInactivitySecs = transaction.getTotalInactivitySecs();
      filteredTransaction.totalDurationSecs = transaction.getTotalDurationSecs();
      filteredTransaction.status = transaction.getChargerStatus();
      filteredTransaction.isLoading = transaction.isLoading();
      filteredTransaction.refundId = transaction.getRefundId();

      // retro compatibility ON
      filteredTransaction.transactionId = transaction.getID();
      if (transaction.getChargeBox()) {
        filteredTransaction.chargeBox = {};
        filteredTransaction.chargeBox.id = transaction.getChargeBox().id;
        filteredTransaction.chargeBox.connectors = [];
        filteredTransaction.chargeBox.connectors[transaction.getConnectorId() - 1] = transaction.getChargeBox().connectors[transaction.getConnectorId() - 1];
      }
      if (!transaction.isActive()) {
        filteredTransaction.stop = {};
        filteredTransaction.stop.meterStop = transaction.getMeterStop();
        filteredTransaction.stop.totalConsumption = transaction.getTotalConsumption();
        filteredTransaction.stop.totalInactivitySecs = transaction.getTotalInactivitySecs();
        filteredTransaction.stop.totalDurationSecs = transaction.getTotalDurationSecs();
        if (Authorizations.isAdmin(loggedUser) && transaction.hasPricing()) {
          filteredTransaction.stop.price = transaction.getPrice();
          filteredTransaction.stop.priceUnit = transaction.getPriceUnit();
        }
      }
      // retro compatibility OFF
      if (transaction.hasStateOfCharges()) {
        filteredTransaction.stateOfCharge = transaction.getStateOfCharge();
        filteredTransaction.currentStateOfCharge = transaction.getCurrentStateOfCharge();
      }

      // Demo user?
      if (Authorizations.isDemo(loggedUser)) {
        filteredTransaction.tagID = Constants.ANONIMIZED_VALUE;
      } else {
        filteredTransaction.tagID = transaction.getTagID();
      }
      filteredTransaction.timestamp = transaction.getStartDate();
      // Filter user
      filteredTransaction.user = TransactionSecurity._filterUserInTransactionResponse(
        transaction.getUser(), loggedUser);
      // Transaction Stop
      if (!transaction.isActive()) {
        filteredTransaction.meterStop = transaction.getMeterStop();
        filteredTransaction.stop.timestamp = transaction.getEndDate();
        // Demo user?
        if (Authorizations.isDemo(loggedUser)) {
          filteredTransaction.stop.tagID = Constants.ANONIMIZED_VALUE;
        } else {
          filteredTransaction.stop.tagID = transaction.getFinisherTagId();
        }
        if (transaction.getEndStateOfCharge()) {
          filteredTransaction.stop.stateOfCharge = transaction.getEndStateOfCharge();
        }
        // Admin?
        if (Authorizations.isAdmin(loggedUser) && transaction.hasPricing()) {
          filteredTransaction.price = transaction.getPrice();
          filteredTransaction.priceUnit = transaction.getPriceUnit();
        }
        // Stop User
        if (transaction.getFinisher()) {
          // Filter user
          filteredTransaction.stop.user = TransactionSecurity._filterUserInTransactionResponse(
            transaction.getFinisher(), loggedUser);
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
    filteredConsumption.chargeBoxID = transaction.getChargeBoxID();
    filteredConsumption.connectorId = transaction.getConnectorId();
    // Admin?
    if (Authorizations.isAdmin(loggedUser)) {
      filteredConsumption.priceUnit = transaction.getPriceUnit();
      filteredConsumption.totalPrice = transaction.getPrice();
    }
    filteredConsumption.totalConsumption = transaction.getTotalConsumption();
    filteredConsumption.id = transaction.getID();
    if (transaction.hasStateOfCharges()) {
      filteredConsumption.stateOfCharge = transaction.getStateOfCharge();
    }
    // Check user
    if (transaction.getUser()) {
      if (!Authorizations.canReadUser(loggedUser, transaction.getUser())) {
        return null;
      }
    } else {
      if (!Authorizations.isAdmin(loggedUser)) {
        return null;
      }
    }
    // Set user
    filteredConsumption.user = TransactionSecurity._filterUserInTransactionResponse(
      transaction.getUser(), loggedUser);
    // Admin?
    if (Authorizations.isAdmin(loggedUser)) {
      // Set them all
      filteredConsumption.values = consumptions;
    } else {
      // Clean
      filteredConsumption.values = [];
      for (const value of consumptions) {
        // Set
        const filteredValue = {
          date: value.date,
          value: value.value,
          cumulated: value.cumulated
        };
        if (value.hasOwnProperty('stateOfCharge')) {
          filteredValue.stateOfCharge = value.stateOfCharge;
        }
        filteredConsumption.values.push(filteredValue);
      }
    }

    return filteredConsumption;
  }
}

module.exports = TransactionSecurity;
