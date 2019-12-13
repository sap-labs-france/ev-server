import moment = require('moment');
import sanitize from 'mongo-sanitize';
import Authorizations from '../../../../authorization/Authorizations';
import Constants from '../../../../utils/Constants';
import { HttpAssignTransactionsToUserRequest, HttpConsumptionFromTransactionRequest, HttpTransactionRequest, HttpTransactionsRefundRequest, HttpTransactionsRequest } from '../../../../types/requests/HttpTransactionRequest';
import Transaction from '../../../../types/Transaction';
import User from '../../../../types/User';
import UserToken from '../../../../types/UserToken';
import UtilsSecurity from './UtilsSecurity';
import { DataResult } from '../../../../types/DataResult';
import Consumption from '../../../../types/Consumption';
import Utils from '../../../../utils/Utils';
import RefundReport from '../../../../types/RefundReport';

export default class TransactionSecurity {
  public static filterTransactionsRefund(request: any): HttpTransactionsRefundRequest {
    if (!request.transactionIds) {
      return { transactionIds: [] };
    }
    return { transactionIds: request.transactionIds.map(sanitize) };
  }

  public static filterAssignTransactionsToUser(request: HttpAssignTransactionsToUserRequest): HttpAssignTransactionsToUserRequest {
    return { UserID: request.UserID ? sanitize(request.UserID) : null };
  }

  static filterUnassignedTransactionsCountRequest(request: any) {
    return { UserID: request.UserID ? sanitize(request.UserID) : null };
  }

  public static filterTransactionRequestByID(request: any): number {
    return parseInt(sanitize(request.ID));
  }

  public static filterTransactionSoftStop(request: any): number {
    return parseInt(sanitize(request.ID));
  }

  public static filterTransactionRequest(request: any): HttpTransactionRequest {
    return {
      ID: parseInt(sanitize(request.ID))
    };
  }

  public static filterTransactionsActiveRequest(request: any): HttpTransactionsRequest {
    const filteredRequest: HttpTransactionsRequest = {} as HttpTransactionsRequest;
    filteredRequest.ChargeBoxID = sanitize(request.ChargeBoxID);
    filteredRequest.ConnectorId = sanitize(request.ConnectorId);
    filteredRequest.SiteAreaID = sanitize(request.SiteAreaID);
    filteredRequest.Search = sanitize(request.Search);
    filteredRequest.SiteID = sanitize(request.SiteID);
    filteredRequest.UserID = request.UserID ? sanitize(request.UserID) : null;
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    return filteredRequest;
  }

  public static filterTransactionsRequest(request: any): HttpTransactionsRequest {
    const filteredRequest: HttpTransactionsRequest = {} as HttpTransactionsRequest;
    // Handle picture
    filteredRequest.ChargeBoxID = sanitize(request.ChargeBoxID);
    filteredRequest.StartDateTime = sanitize(request.StartDateTime);
    filteredRequest.EndDateTime = sanitize(request.EndDateTime);
    filteredRequest.SiteID = sanitize(request.SiteID);
    filteredRequest.SiteAreaID = sanitize(request.SiteAreaID);
    filteredRequest.Search = sanitize(request.Search);
    filteredRequest.RefundStatus = sanitize(request.RefundStatus);
    filteredRequest.MinimalPrice = sanitize(request.MinimalPrice);
    if (request.Statistics) {
      filteredRequest.Statistics = sanitize(request.Statistics);
    }
    if (request.UserID) {
      filteredRequest.UserID = sanitize(request.UserID);
    }
    if (request.ReportIDs) {
      filteredRequest.ReportIDs = sanitize(request.ReportIDs);
    }
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    return filteredRequest;
  }

  public static filterTransactionsInErrorRequest(request: any): HttpTransactionsRequest {
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

  static filterTransactionResponse(transaction: Transaction, loggedUser: UserToken) {
    let filteredTransaction;
    if (!transaction) {
      return null;
    }
    // Check auth
    if (Authorizations.canReadTransaction(loggedUser, transaction)) {
      // Set only necessary info
      filteredTransaction = {} as Transaction;
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
      if (transaction.hasOwnProperty('price')) {
        filteredTransaction.price = transaction.price;
        filteredTransaction.roundedPrice = transaction.roundedPrice;
        filteredTransaction.priceUnit = transaction.priceUnit;
        filteredTransaction.pricingSource = transaction.pricingSource;
      }
      if (!transaction.stop) {
        filteredTransaction.currentConsumption = transaction.currentConsumption;
        filteredTransaction.currentTotalConsumption = transaction.currentTotalConsumption;
        filteredTransaction.currentTotalInactivitySecs = transaction.currentTotalInactivitySecs;
        filteredTransaction.currentInactivityStatusLevel = Utils.getUIInactivityStatusLevel(transaction.currentInactivityStatus);
        filteredTransaction.currentInactivityStatus = transaction.currentInactivityStatus;
        filteredTransaction.currentTotalDurationSecs =
          moment.duration(moment(!transaction.stop ? transaction.lastMeterValue.timestamp : transaction.stop.timestamp)
            .diff(moment(transaction.timestamp))).asSeconds();
        filteredTransaction.currentCumulatedPrice = transaction.currentCumulatedPrice;
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
      if (Authorizations.isDemo(loggedUser)) {
        filteredTransaction.tagID = Constants.ANONYMIZED_VALUE;
      } else {
        filteredTransaction.tagID = transaction.tagID;
      }
      // Filter user
      filteredTransaction.user = TransactionSecurity._filterUserInTransactionResponse(
        transaction.user, loggedUser);
      filteredTransaction.userID = transaction.userID;
      // Transaction Stop
      if (transaction.stop) {
        filteredTransaction.stop = {};
        filteredTransaction.stop.meterStop = transaction.stop.meterStop;
        filteredTransaction.stop.timestamp = transaction.stop.timestamp;
        filteredTransaction.stop.totalConsumption = transaction.stop.totalConsumption;
        filteredTransaction.stop.totalInactivitySecs = transaction.stop.totalInactivitySecs + transaction.stop.extraInactivitySecs;
        filteredTransaction.stop.inactivityStatusLevel = Utils.getUIInactivityStatusLevel(transaction.stop.inactivityStatus);
        filteredTransaction.stop.inactivityStatus = transaction.stop.inactivityStatus;
        filteredTransaction.stop.totalDurationSecs = transaction.stop.totalDurationSecs;
        filteredTransaction.stop.stateOfCharge = transaction.stop.stateOfCharge;
        filteredTransaction.stop.signedData = transaction.stop.signedData;
        filteredTransaction.stop.userID = transaction.stop.userID;
        if (transaction.stop.price) {
          filteredTransaction.stop.price = transaction.stop.price;
          filteredTransaction.stop.roundedPrice = transaction.stop.roundedPrice;
          filteredTransaction.stop.priceUnit = transaction.stop.priceUnit;
          filteredTransaction.stop.pricingSource = transaction.stop.pricingSource;
        }
        // Demo user?
        if (Authorizations.isDemo(loggedUser)) {
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

  static filterTransactionsResponse(transactions: DataResult<Transaction>, loggedUser: UserToken) {
    const filteredTransactions = [];
    if (!transactions.result) {
      return null;
    }
    // Filter result
    for (const transaction of transactions.result) {
      const filteredTransaction = TransactionSecurity.filterTransactionResponse(transaction, loggedUser);
      if (filteredTransaction) {
        filteredTransactions.push(filteredTransaction);
      }
    }
    transactions.result = filteredTransactions;
  }

  static filterRefundReportResponse(report: RefundReport, loggedUser: UserToken) {
    let filteredRefundReport;
    if (!report) {
      return null;
    }
    // Check auth
    if (Authorizations.canReadReport(loggedUser)) {
      // Set only necessary info
      filteredRefundReport = {} as RefundReport;
      if (report.id) {
        filteredRefundReport.id = report.id;
      }
      if (report.user) {
        filteredRefundReport.user = report.user;
      }
    }
    return filteredRefundReport;
  }

  static filterRefundReportsResponse(reports: DataResult<RefundReport>, loggedUser: UserToken) {
    const filteredReports = [];
    if (!reports.result) {
      return null;
    }
    // Filter result
    for (const report of reports.result) {
      const filteredReport = TransactionSecurity.filterRefundReportResponse(report, loggedUser);
      if (filteredReport) {
        filteredReports.push(filteredReport);
      }
    }
    reports.result = filteredReports;
  }

  static _filterUserInTransactionResponse(user: User, loggedUser: UserToken) {
    const filteredUser: any = {};
    if (!user) {
      return null;
    }
    // Check auth
    if (Authorizations.canReadUser(loggedUser, user.id)) {
      // Demo user?
      if (Authorizations.isDemo(loggedUser)) {
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

  public static filterConsumptionFromTransactionRequest(request: any): HttpConsumptionFromTransactionRequest {
    const filteredRequest: HttpConsumptionFromTransactionRequest = {} as HttpConsumptionFromTransactionRequest;
    // Set
    if (request.hasOwnProperty('TransactionId')) {
      filteredRequest.TransactionId = parseInt(sanitize(request.TransactionId));
    }
    filteredRequest.StartDateTime = sanitize(request.StartDateTime);
    filteredRequest.EndDateTime = sanitize(request.EndDateTime);
    return filteredRequest;
  }

  public static filterChargingStationTransactionsRequest(request: any): HttpTransactionsRequest {
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

  static filterConsumptionsFromTransactionResponse(transaction: Transaction, consumptions: Consumption[], loggedUser: UserToken): Transaction {
    transaction.values = [];
    if (!consumptions) {
      consumptions = [];
    }
    // Check Authorization
    if (transaction.user) {
      if (!Authorizations.canReadUser(loggedUser, transaction.userID)) {
        return transaction;
      }
    } else if (!transaction.user && !Authorizations.isAdmin(loggedUser)) {
      return transaction;
    }
    const filteredTransaction = TransactionSecurity.filterTransactionResponse(transaction, loggedUser);
    if (consumptions.length === 0) {
      filteredTransaction.values = [];
      return filteredTransaction;
    }
    // Admin?
    let initialSoC;
    if (Authorizations.isAdmin(loggedUser)) {
      // Set them all
      filteredTransaction.values = consumptions.map((consumption) => consumption).map((consumption) => {
        const newConsumption = {
          ...consumption,
          date: consumption.endedAt,
          value: consumption.instantPower,
          cumulated: consumption.cumulatedConsumption
        };
        if (consumption.stateOfCharge === null) {
          delete newConsumption.stateOfCharge;
        }
        if (!initialSoC && consumption.stateOfCharge) {
          initialSoC = consumption.stateOfCharge;
        }
        return newConsumption;
      });
    } else {
      // Clean
      filteredTransaction.values = consumptions.map((consumption) => consumption).map((consumption) => {
        const newConsumption = {
          endedAt: consumption.endedAt,
          instantPower: consumption.instantPower,
          cumulatedConsumption: consumption.cumulatedConsumption,
          stateOfCharge: consumption.stateOfCharge,
          date: consumption.endedAt,
          value: consumption.instantPower,
          cumulated: consumption.cumulatedConsumption
        };
        if (consumption.stateOfCharge) {
          newConsumption.stateOfCharge = consumption.stateOfCharge;
          if (!initialSoC) {
            initialSoC = consumption.stateOfCharge;
          }
        }
        return newConsumption;
      });
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
    if (Authorizations.isAdmin(loggedUser)) {
      initialValue.startedAt = new Date(initialDate.getTime() - 60000);
      initialValue.consumption = 0;
      initialValue.amount = 0;
      initialValue.cumulatedAmount = 0;
      initialValue.roundedAmount = 0;
    }
    if (initialSoC) {
      initialValue.stateOfCharge = initialSoC;
      filteredTransaction.stateOfCharge = initialSoC;
    }
    filteredTransaction.values.splice(0, 0, initialValue);
    return filteredTransaction;
  }
}
