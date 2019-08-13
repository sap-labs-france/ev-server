import sanitize from 'mongo-sanitize';
import Authorizations from '../../../../authorization/Authorizations';
import Constants from '../../../../utils/Constants';
import User from '../../../../types/User';
import UserToken from '../../../../types/UserToken';
import { HttpTransactionRequest, HttpTransactionsRefundRequest, HttpTransactionsRequest, HttpConsumptionFromTransactionRequest } from '../../../../types/requests/HttpTransactionRequest';
import UtilsSecurity from './UtilsSecurity';
import Transaction from '../../../../types/Transaction';
import moment = require('moment');

export default class TransactionSecurity {
  public static filterTransactionsRefund(request: Partial<HttpTransactionsRefundRequest>): HttpTransactionsRefundRequest {
    if(! request.transactionIds) {
      return {transactionIds: []};
    }
    return {transactionIds: request.transactionIds.map(id => sanitize(id))};
  }

  public static filterTransactionDelete(request: Partial<HttpTransactionRequest>): number {
    return sanitize(request.ID);
  }

  public static filterTransactionSoftStop(request: Partial<HttpTransactionRequest>): number {
    return sanitize(request.ID);
  }

  public static filterTransactionRequest(request: Partial<HttpTransactionRequest>): number {
    return sanitize(request.ID);
  }

  public static filterTransactionsActiveRequest(request: Partial<HttpTransactionsRequest>): HttpTransactionsRequest {
    let filtered: HttpTransactionsRequest = {} as HttpTransactionsRequest;
    filtered.ChargeBoxID = sanitize(request.ChargeBoxID);
    filtered.ConnectorId = sanitize(request.ConnectorId);
    filtered.SiteAreaID = sanitize(request.SiteAreaID);
    filtered.UserID = request.UserID?sanitize(request.UserID):null;
    UtilsSecurity.filterSkipAndLimit(request, filtered);
    UtilsSecurity.filterSort(request, filtered);
    return filtered;
  }

  public static filterTransactionsCompletedRequest(request: HttpTransactionsRequest): HttpTransactionsRequest {
    const filteredRequest: HttpTransactionsRequest = {} as HttpTransactionsRequest;
    // Handle picture
    filteredRequest.ChargeBoxID = sanitize(request.ChargeBoxID);
    filteredRequest.StartDateTime = sanitize(request.StartDateTime);
    filteredRequest.EndDateTime = sanitize(request.EndDateTime);
    filteredRequest.SiteID = sanitize(request.SiteID);
    filteredRequest.SiteAreaID = sanitize(request.SiteAreaID);
    filteredRequest.Search = sanitize(request.Search);
    filteredRequest.Type = sanitize(request.Type);
    filteredRequest.MinimalPrice = sanitize(request.MinimalPrice);
    if (request.Statistics) {
      filteredRequest.Statistics = sanitize(request.Statistics);
    }
    if (request.UserID) {
      filteredRequest.UserID = sanitize(request.UserID);
    }
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    return filteredRequest;
  }

  public static filterTransactionsInErrorRequest(request: HttpTransactionsRequest): HttpTransactionsRequest {
    const filteredRequest: HttpTransactionsRequest = {} as HttpTransactionsRequest;
    // Handle picture
    filteredRequest.ChargeBoxID = sanitize(request.ChargeBoxID);
    filteredRequest.StartDateTime = sanitize(request.StartDateTime);
    filteredRequest.EndDateTime = sanitize(request.EndDateTime);
    filteredRequest.SiteID = sanitize(request.SiteID);
    filteredRequest.SiteAreaID = sanitize(request.SiteAreaID);
    filteredRequest.Search = sanitize(request.Search);
    filteredRequest.ErrorType = sanitize(request.ErrorType);
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
  static filterTransactionResponse(transaction: Transaction, loggedUser: UserToken) {
    let filteredTransaction;

    if (!transaction) {
      return null;
    }
    // Check auth
    if (Authorizations.canReadTransaction(loggedUser, transaction)) {
      // Set only necessary info
      filteredTransaction = {};
      filteredTransaction.id = transaction.id;
      if (transaction.errorCode) {
        filteredTransaction.uniqueId = transaction.uniqueId;
        filteredTransaction.errorCode = transaction.errorCode;
      }
      filteredTransaction.chargeBoxID = transaction.chargeBoxID;
      filteredTransaction.siteID = transaction.siteID;
      filteredTransaction.siteAreaID = transaction.siteAreaID;
      filteredTransaction.connectorId = transaction.connectorId;
      filteredTransaction.meterStart = transaction.meterStart;
      filteredTransaction.timestamp = transaction.timestamp;
      filteredTransaction.timezone = transaction.timezone;
      // If (Authorizations.isAdmin(loggedUser) && transaction.hasOwnProperty('price')) {
      if (transaction.price) {
        filteredTransaction.price = transaction.price;
        filteredTransaction.roundedPrice = transaction.roundedPrice;
        filteredTransaction.priceUnit = transaction.priceUnit;
        filteredTransaction.pricingSource = transaction.pricingSource;
      }
      // Runtime Data
      if (!transaction.stop) {
        filteredTransaction.currentConsumption = transaction.currentConsumption;
        filteredTransaction.currentTotalConsumption = transaction.currentTotalConsumption;
        filteredTransaction.currentTotalInactivitySecs = transaction.currentTotalInactivitySecs;
        filteredTransaction.currentTotalDurationSecs =
          moment.duration(moment(!transaction.stop ? transaction.lastMeterValue.timestamp : transaction.stop.timestamp).diff(moment(transaction.timestamp))).asSeconds()
        filteredTransaction.currentCumulatedPrice = transaction.currentCumulatedPrice;
        filteredTransaction.currentStateOfCharge = transaction.currentStateOfCharge;
        filteredTransaction.currentStateOfCharge = transaction.currentStateOfCharge;
        filteredTransaction.currentSignedData = transaction.currentSignedData;
      }
      if (!transaction.stop && transaction.chargeBox && transaction.chargeBox.connectors) {
        const foundConnector = transaction.chargeBox.connectors.find((connector) => connector.connectorId === transaction.connectorId);
        filteredTransaction.status = foundConnector ? foundConnector.status : null;
      }
      filteredTransaction.isLoading = !transaction.stop && transaction.currentTotalInactivitySecs > 60;
      filteredTransaction.stateOfCharge = transaction.stateOfCharge;
      filteredTransaction.signedData = transaction.signedData;
      filteredTransaction.refundData = transaction.refundData;
      // Demo user?
      if (Authorizations.isDemo(loggedUser.role)) {
        filteredTransaction.tagID = Constants.ANONYMIZED_VALUE;
      } else {
        filteredTransaction.tagID = transaction.tagID;
      }
      // Filter user
      filteredTransaction.user = TransactionSecurity._filterUserInTransactionResponse(
        transaction.user, loggedUser);
      // Transaction Stop
      if (transaction.stop) {
        filteredTransaction.stop = {};
        filteredTransaction.stop.meterStop = transaction.stop.meterStop;
        filteredTransaction.stop.timestamp = transaction.stop.timestamp;
        filteredTransaction.stop.totalConsumption = transaction.stop.totalConsumption;
        filteredTransaction.stop.totalInactivitySecs = transaction.stop.totalInactivitySecs + transaction.stop.extraInactivitySecs;
        filteredTransaction.stop.totalDurationSecs = transaction.stop.totalDurationSecs;
        filteredTransaction.stop.stateOfCharge = transaction.stop.stateOfCharge;
        filteredTransaction.stop.signedData = transaction.stop.signedData;
        // pragma if (Authorizations.isAdmin(loggedUser) && transaction.hasStopPrice()) {
        if (transaction.stop.price) {
          filteredTransaction.stop.price = transaction.stop.price;
          filteredTransaction.stop.roundedPrice = transaction.stop.roundedPrice;
          filteredTransaction.stop.priceUnit = transaction.stop.priceUnit;
          filteredTransaction.stop.pricingSource = transaction.stop.pricingSource;
        }
        // Demo user?
        if (Authorizations.isDemo(loggedUser.role)) {
          filteredTransaction.stop.tagID = Constants.ANONYMIZED_VALUE;
        } else {
          filteredTransaction.stop.tagID = transaction.stop.tagID;
        }
        // Stop User
        if (transaction.stop.user) {
          // Filter user
          filteredTransaction.stop.user = TransactionSecurity._filterUserInTransactionResponse(
            transaction.stop.user, loggedUser);
        }
      }
    }
    return filteredTransaction;
  }

  static filterTransactionsResponse(transactions, loggedUser: UserToken) {
    const filteredTransactions = [];
    if (!transactions.result) {
      return null;
    }
    // Filter result
    for (const transaction of transactions.result) {
      // Filter
      const filteredTransaction = TransactionSecurity.filterTransactionResponse(transaction, loggedUser);
      // Ok?
      if (filteredTransaction) {
        filteredTransactions.push(filteredTransaction);
      }
    }
    transactions.result = filteredTransactions;
  }

  static _filterUserInTransactionResponse(user: User, loggedUser: UserToken) {
    const filteredUser: any = {};

    if (!user) {
      return null;
    }
    // Check auth
    if (Authorizations.canReadUser(loggedUser, user.id)) {
      // Demo user?
      if (Authorizations.isDemo(loggedUser.role)) {
        filteredUser.id = null;
        filteredUser.name = Constants.ANONYMIZED_VALUE;
        filteredUser.firstName = Constants.ANONYMIZED_VALUE;
      } else {
        filteredUser.id = user.id;
        filteredUser.name = user.name;
        filteredUser.firstName = user.firstName;
      }
    }
    return filteredUser;
  }

  public static filterChargingStationConsumptionFromTransactionRequest(request: HttpConsumptionFromTransactionRequest): HttpConsumptionFromTransactionRequest {
    const filteredRequest: HttpConsumptionFromTransactionRequest = {} as HttpConsumptionFromTransactionRequest;
    // Set
    filteredRequest.TransactionId = sanitize(request.TransactionId);
    filteredRequest.StartDateTime = sanitize(request.StartDateTime);
    filteredRequest.EndDateTime = sanitize(request.EndDateTime);
    return filteredRequest;
  }

  public static filterChargingStationTransactionsRequest(request: HttpTransactionsRequest): HttpTransactionsRequest {
    const filteredRequest: HttpTransactionsRequest = {} as HttpTransactionsRequest;
    // Set
    filteredRequest.ChargeBoxID = sanitize(request.ChargeBoxID);
    filteredRequest.ConnectorId = sanitize(request.ConnectorId);
    filteredRequest.StartDateTime = sanitize(request.StartDateTime);
    filteredRequest.EndDateTime = sanitize(request.EndDateTime);
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    return filteredRequest;
  }

  /**
   *
   * @param transaction {Transaction}
   * @param consumptions {Consumption[]}
   * @param loggedUser
   * @returns {*}
   */
  static filterConsumptionsFromTransactionResponse(transaction: Transaction, consumptions, loggedUser: UserToken) {
    if (!consumptions) {
      consumptions = [];
    }
    // Check Authorisation
    if (transaction.user) {
      if (!Authorizations.canReadUser(loggedUser, transaction.userID)) {
        return null;
      }
    } else if (!transaction.user && !Authorizations.isAdmin(loggedUser.role)) {
      return null;
    }
    const filteredTransaction = TransactionSecurity.filterTransactionResponse(transaction, loggedUser);
    if (consumptions.length === 0) {
      filteredTransaction.values = [];
      return filteredTransaction;
    }

    // Admin?
    if (Authorizations.isAdmin(loggedUser.role)) {
      // Set them all
      filteredTransaction.values = consumptions.map((consumption) => consumption.getModel()).map((consumption) => ({
        ...consumption,
        date: consumption.endedAt,
        value: consumption.instantPower,
        cumulated: consumption.cumulatedConsumption
      }));
    } else {
      // Clean
      filteredTransaction.values = consumptions.map((consumption) => consumption.getModel()).map((consumption) => ({
        endedAt: consumption.endedAt,
        instantPower: consumption.instantPower,
        cumulatedConsumption: consumption.cumulatedConsumption,
        stateOfCharge: consumption.stateOfCharge,
        date: consumption.endedAt,
        value: consumption.instantPower,
        cumulated: consumption.cumulatedConsumption
      }));
    }
    for (let i = 1; i < filteredTransaction.values.length; i++) {
      if (filteredTransaction.values[i].instantPower === 0 && filteredTransaction.values[i - 1] !== 0) {
        const addedValue = JSON.parse(JSON.stringify(filteredTransaction.values[i]));
        const newDate = new Date(filteredTransaction.values[i - 1].endedAt.getTime() + 60000);
        addedValue.endedAt = newDate;
        addedValue.date = newDate;
        filteredTransaction.values.splice(i, 0, addedValue);
        i++;
      }
    }
    const initialValue = JSON.parse(JSON.stringify(filteredTransaction.values[0]));
    const initialDate = new Date(filteredTransaction.values[0].endedAt.getTime() - 60000);
    initialValue.endedAt = initialDate;
    initialValue.date = initialDate;
    initialValue.value = 0;
    initialValue.cumulated = 0;
    initialValue.instantPower = 0;
    initialValue.cumulatedConsumption = 0;
    if (Authorizations.isAdmin(loggedUser.role)) {
      initialValue.startedAt = new Date(initialDate.getTime() - 60000);
      initialValue.consumption = 0;
      initialValue.amount = 0;
      initialValue.cumulatedAmount = 0;
      initialValue.roundedAmount = 0;
    }
    filteredTransaction.values.splice(0, 0, initialValue);
    return filteredTransaction;
  }
}

