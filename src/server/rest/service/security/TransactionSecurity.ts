import { HttpAssignTransactionsToUserRequest, HttpConsumptionFromTransactionRequest, HttpTransactionRequest, HttpTransactionsRefundRequest, HttpTransactionsRequest } from '../../../../types/requests/HttpTransactionRequest';
import Transaction, { TransactionConsumption } from '../../../../types/Transaction';

import Authorizations from '../../../../authorization/Authorizations';
import Constants from '../../../../utils/Constants';
import Consumption from '../../../../types/Consumption';
import { DataResult } from '../../../../types/DataResult';
import RefundReport from '../../../../types/Refund';
import { TransactionInError } from '../../../../types/InError';
import User from '../../../../types/User';
import UserToken from '../../../../types/UserToken';
import Utils from '../../../../utils/Utils';
import UtilsSecurity from './UtilsSecurity';
import moment from 'moment';
import sanitize from 'mongo-sanitize';

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
    return Utils.convertToInt(sanitize(request.ID));
  }

  public static filterTransactionRequestByIDs(request: any): number[] {
    return request.transactionsIDs.map(sanitize);
  }

  public static filterTransactionSoftStop(request: any): number {
    return Utils.convertToInt(sanitize(request.ID));
  }

  public static filterTransactionRequest(request: any): HttpTransactionRequest {
    return {
      ID: Utils.convertToInt(sanitize(request.ID))
    };
  }

  public static filterTransactionsActiveRequest(request: any): HttpTransactionsRequest {
    const filteredRequest: HttpTransactionsRequest = {} as HttpTransactionsRequest;
    if (request.Issuer) {
      filteredRequest.Issuer = UtilsSecurity.filterBoolean(request.Issuer);
    }
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
    if (request.Issuer) {
      filteredRequest.Issuer = UtilsSecurity.filterBoolean(request.Issuer);
    }
    filteredRequest.ChargeBoxID = sanitize(request.ChargeBoxID);
    filteredRequest.StartDateTime = sanitize(request.StartDateTime);
    filteredRequest.EndDateTime = sanitize(request.EndDateTime);
    filteredRequest.SiteID = sanitize(request.SiteID);
    filteredRequest.SiteAreaID = sanitize(request.SiteAreaID);
    filteredRequest.Search = sanitize(request.Search);
    filteredRequest.InactivityStatus = sanitize(request.InactivityStatus);
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

  static filterTransactionResponse(transaction: Transaction|TransactionInError, loggedUser: UserToken): Transaction {
    let filteredTransaction: Transaction;
    if (!transaction) {
      return null;
    }
    // Check auth
    if (Authorizations.canReadTransaction(loggedUser, transaction)) {
      // Set only necessary info
      filteredTransaction = {} as Transaction;
      filteredTransaction.id = transaction.id;
      if (Utils.objectHasProperty(transaction, 'errorCode')) {
        filteredTransaction.uniqueId = transaction.uniqueId;
        (filteredTransaction as TransactionInError).errorCode = (transaction as TransactionInError).errorCode;
      }
      filteredTransaction.chargeBoxID = transaction.chargeBoxID;
      filteredTransaction.siteID = transaction.siteID;
      filteredTransaction.siteAreaID = transaction.siteAreaID;
      filteredTransaction.connectorId = transaction.connectorId;
      filteredTransaction.meterStart = transaction.meterStart;
      filteredTransaction.timestamp = transaction.timestamp;
      filteredTransaction.timezone = transaction.timezone;
      if (Utils.objectHasProperty(transaction, 'price')) {
        filteredTransaction.price = transaction.price;
        filteredTransaction.roundedPrice = transaction.roundedPrice;
        filteredTransaction.priceUnit = transaction.priceUnit;
        filteredTransaction.pricingSource = transaction.pricingSource;
      }
      if (!transaction.stop) {
        filteredTransaction.currentConsumption = transaction.currentConsumption;
        filteredTransaction.currentTotalConsumption = transaction.currentTotalConsumption;
        filteredTransaction.currentTotalInactivitySecs = transaction.currentTotalInactivitySecs;
        filteredTransaction.currentInactivityStatus = transaction.currentInactivityStatus;
        filteredTransaction.currentTotalDurationSecs =
          moment.duration(moment(transaction.lastMeterValue ? transaction.lastMeterValue.timestamp : new Date())
            .diff(moment(transaction.timestamp))).asSeconds();
        filteredTransaction.currentCumulatedPrice = transaction.currentCumulatedPrice;
        filteredTransaction.currentStateOfCharge = transaction.currentStateOfCharge;
        filteredTransaction.currentSignedData = transaction.currentSignedData;
      }
      if (!transaction.stop && transaction.chargeBox && transaction.chargeBox.connectors) {
        const foundConnector = transaction.chargeBox.connectors.find((connector) => connector.connectorId === transaction.connectorId);
        filteredTransaction.status = foundConnector ? foundConnector.status : null;
      }
      filteredTransaction.stateOfCharge = transaction.stateOfCharge;
      filteredTransaction.signedData = transaction.signedData;
      filteredTransaction.refundData = transaction.refundData;
      if (transaction.ocpiData) {
        filteredTransaction.ocpiData = {
          session: transaction.ocpiData.session,
          sessionCheckedOn: transaction.ocpiData.sessionCheckedOn,
          cdr: transaction.ocpiData.cdr,
          cdrCheckedOn: transaction.ocpiData.cdrCheckedOn
        };
      }
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
        filteredTransaction.stop = {
          tagID: Authorizations.isDemo(loggedUser) ? Constants.ANONYMIZED_VALUE : transaction.stop.tagID,
          meterStop: transaction.stop.meterStop,
          timestamp: transaction.stop.timestamp,
          totalConsumption: transaction.stop.totalConsumption,
          totalInactivitySecs: transaction.stop.totalInactivitySecs + transaction.stop.extraInactivitySecs,
          inactivityStatus: transaction.stop.inactivityStatus,
          totalDurationSecs: transaction.stop.totalDurationSecs,
          stateOfCharge: transaction.stop.stateOfCharge,
          signedData: transaction.stop.signedData,
          userID: transaction.stop.userID,
          user: transaction.stop.user ? TransactionSecurity._filterUserInTransactionResponse(transaction.stop.user, loggedUser) : null
        };
        if (transaction.stop.price) {
          filteredTransaction.stop.price = transaction.stop.price;
          filteredTransaction.stop.roundedPrice = transaction.stop.roundedPrice;
          filteredTransaction.stop.priceUnit = transaction.stop.priceUnit;
          filteredTransaction.stop.pricingSource = transaction.stop.pricingSource;
        }
      }
    }
    return filteredTransaction;
  }

  static filterTransactionsResponse(transactions: DataResult<Transaction|TransactionInError>, loggedUser: UserToken) {
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
    if (Utils.objectHasProperty(request, 'TransactionId')) {
      filteredRequest.TransactionId = Utils.convertToInt(sanitize(request.TransactionId));
    }
    if (Utils.objectHasProperty(request, 'LoadAllConsumptions')) {
      filteredRequest.LoadAllConsumptions = Utils.convertToBoolean(sanitize(request.LoadAllConsumptions));
    }
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

  static filterTransactionConsumptionsResponse(transaction: Transaction, consumptions: Consumption[], loggedUser: UserToken): Transaction {
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
    // Clean
    filteredTransaction.values = consumptions.map((consumption) => {
      const newConsumption: TransactionConsumption = {
        date: consumption.endedAt,
        instantPower: consumption.instantPower,
        instantAmps: consumption.instantAmps,
        cumulatedConsumption: consumption.cumulatedConsumption,
        stateOfCharge: consumption.stateOfCharge,
        cumulatedAmount: consumption.cumulatedAmount,
        limitWatts: consumption.limitWatts,
        limitAmps: consumption.limitAmps
      };
      if (consumption.stateOfCharge) {
        newConsumption.stateOfCharge = consumption.stateOfCharge;
      }
      return newConsumption;
    });
    return filteredTransaction;
  }
}
