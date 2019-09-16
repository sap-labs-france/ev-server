import { NextFunction, Request, Response } from 'express';
import fs from 'fs';
import moment from 'moment';
import AppAuthError from '../../../exception/AppAuthError';
import AppError from '../../../exception/AppError';
import Authorizations from '../../../authorization/Authorizations';
import ChargingStationStorage from '../../../storage/mongodb/ChargingStationStorage';
import ConcurConnector from '../../../integration/refund/ConcurConnector';
import Constants from '../../../utils/Constants';
import ConsumptionStorage from '../../../storage/mongodb/ConsumptionStorage';
import Cypher from '../../../utils/Cypher';
import Logging from '../../../utils/Logging';
import OCPPService from '../../../server/ocpp/services/OCPPService';
import OCPPUtils from '../../ocpp/utils/OCPPUtils';
import SettingStorage from '../../../storage/mongodb/SettingStorage';
import SynchronizeRefundTransactionsTask from '../../../scheduler/tasks/SynchronizeRefundTransactionsTask';
import TenantStorage from '../../../storage/mongodb/TenantStorage';
import Transaction from '../../../types/Transaction';
import TransactionSecurity from './security/TransactionSecurity';
import TransactionStorage from '../../../storage/mongodb/TransactionStorage';
import User from '../../../types/User';
import UserStorage from '../../../storage/mongodb/UserStorage';
import Utils from '../../../utils/Utils';
import UtilsService from './UtilsService';
import Consumption from '../../../types/Consumption';

export default class TransactionService {
  static async handleSynchronizeRefundedTransactions(action: string, req: Request, res: Response, next: NextFunction) {
    try {
      if (!Authorizations.isAdmin(req.user.role)) {
        throw new AppAuthError(
          Constants.ACTION_UPDATE,
          Constants.ENTITY_TRANSACTION,
          null,
          Constants.HTTP_AUTH_ERROR, 'TransactionService', 'handleSynchronizeRefundedTransactions',
          req.user);
      }

      const tenant = await TenantStorage.getTenant(req.user.tenantID);
      const task = new SynchronizeRefundTransactionsTask();
      await task.processTenant(tenant, null);

      const response: any = {
        ...Constants.REST_RESPONSE_SUCCESS,
      };
      res.json(response);
      next();
    } catch (error) {
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }

  public static async handleRefundTransactions(action: string, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = TransactionSecurity.filterTransactionsRefund(req.body);
    if (!filteredRequest.transactionIds) {
      // Not Found!
      throw new AppError(
        Constants.CENTRAL_SERVER,
        'Transaction IDs must be provided', Constants.HTTP_GENERAL_ERROR,
        'TransactionService', 'handleRefundTransactions', req.user);
    }
    const transactionsToRefund: Transaction[] = [];
    for (const transactionId of filteredRequest.transactionIds) {
      const transaction = await TransactionStorage.getTransaction(req.user.tenantID, transactionId);
      if (!transaction) {
        Logging.logError({
          tenantID: req.user.tenantID,
          user: req.user, actionOnUser: (transaction.user ? transaction.user : null),
          module: 'TransactionService', method: 'handleRefundTransactions',
          message: `Transaction '${transaction.id}' does not exist`,
          action: action, detailedMessages: transaction
        });
        continue;
      }
      if (transaction.refundData && !!transaction.refundData.refundId && transaction.refundData.status !== Constants.REFUND_STATUS_CANCELLED) {
        Logging.logError({
          tenantID: req.user.tenantID,
          user: req.user, actionOnUser: (transaction.user ? transaction.user : null),
          module: 'TransactionService', method: 'handleRefundTransactions',
          message: `Transaction '${transaction.id}' is already refunded`,
          action: action, detailedMessages: transaction
        });
        continue;
      }
      // Check auth
      if (!Authorizations.canRefundTransaction(req.user, transaction)) {
        throw new AppAuthError(
          Constants.ACTION_REFUND_TRANSACTION,
          Constants.ENTITY_TRANSACTION,
          transaction.id,
          Constants.HTTP_AUTH_ERROR, 'TransactionService', 'handleRefundTransactions',
          req.user);
      }
      transactionsToRefund.push(transaction);
    }
    // Get Transaction User
    const user: User = await UserStorage.getUser(req.user.tenantID, req.user.id);
    UtilsService.assertObjectExists(user, `User with ID '${req.user.id}' does not exist`, 'TransactionService', 'handleRefundTransactions', req.user);
    // Check Auth
    if (!transactionsToRefund.every((transaction) => transaction.userID === req.user.id)) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `The User with ID '${req.user.id}' cannot refund another User's transaction`,
        Constants.HTTP_REFUND_SESSION_OTHER_USER_ERROR,
        'TransactionService', 'handleRefundTransactions', req.user);
    }
    // Refund the Transaction
    const setting = await SettingStorage.getSettingByIdentifier(req.user.tenantID, 'refund');
    const connector = new ConcurConnector(req.user.tenantID, setting.content[Constants.SETTING_REFUND_CONTENT_TYPE_CONCUR]);
    const refundedTransactions = await connector.refund(req.user.tenantID, user.id, transactionsToRefund);
    const response: any = {
      ...Constants.REST_RESPONSE_SUCCESS,
      inSuccess: refundedTransactions.length
    };
    // Send result
    const notRefundedTransactions = transactionsToRefund.length - refundedTransactions.length;
    if (notRefundedTransactions > 0) {
      response.inError = notRefundedTransactions;
    }
    res.json(response);
    next();
  }


  public static async handleGetUnassignedTransactionsCount(action: string, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check Auth
    if (!Authorizations.canUpdateTransaction(req.user)) {
      throw new AppAuthError(
        Constants.ACTION_UPDATE,
        Constants.ENTITY_TRANSACTION,
        null,
        Constants.HTTP_AUTH_ERROR, 'TransactionService', 'handleGetUnassignedTransactionsCount',
        req.user);
    }
    // Filter
    const filteredRequest = TransactionSecurity.filterUnassignedTransactionsCountRequest(req.query);
    if (!filteredRequest.UserID) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        'TagIDs must be provided', Constants.HTTP_GENERAL_ERROR,
        'TransactionService', 'handleGetUnassignedTransactionsCount', req.user);
    }
    // Get the user
    const user: User = await UserStorage.getUser(req.user.tenantID, filteredRequest.UserID);
    UtilsService.assertObjectExists(user, `User with ID '${filteredRequest.UserID}' does not exist`, 'TransactionService', 'handleAssignTransactionsToUser', req.user);
    // Get unassigned transactions
    const count = await TransactionStorage.getUnassignedTransactionsCount(req.user.tenantID, user);
    // Return
    res.json(count);
    next();
  }

  public static async handleAssignTransactionsToUser(action: string, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check auths
    if (!Authorizations.canUpdateTransaction(req.user)) {
      throw new AppAuthError(
        Constants.ACTION_UPDATE,
        Constants.ENTITY_TRANSACTION,
        null,
        Constants.HTTP_AUTH_ERROR, 'TransactionService', 'handleAssignTransactionsToUser',
        req.user);
    }
    // Filter
    const filteredRequest = TransactionSecurity.filterAssignTransactionsToUser(req.query);
    // Check
    if (!filteredRequest.UserID) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        'User ID must be provided', Constants.HTTP_GENERAL_ERROR,
        'TransactionService', 'handleAssignTransactionsToUser', req.user);
    }
    // Get the user
    const user = await UserStorage.getUser(req.user.tenantID, filteredRequest.UserID);
    UtilsService.assertObjectExists(user, `User with ID '${filteredRequest.UserID}' does not exist`, 'TransactionService', 'handleAssignTransactionsToUser', req.user);
    // Assign
    await TransactionStorage.assignTransactionsToUser(req.user.tenantID, user);
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleDeleteTransaction(action: string, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const transactionId = TransactionSecurity.filterTransactionRequestByID(req.query);
    // Check auth
    if (!Authorizations.canDeleteTransaction(req.user)) {
      throw new AppAuthError(
        Constants.ACTION_DELETE,
        Constants.ENTITY_TRANSACTION,
        transactionId,
        Constants.HTTP_AUTH_ERROR, 'TransactionService', 'handleDeleteTransaction',
        req.user);
    }
    // Transaction Id is mandatory
    UtilsService.assertIdIsProvided(transactionId, 'TransactionsService', 'handleDeleteTransaction', req.user);
    // Get Transaction
    const transaction = await TransactionStorage.getTransaction(req.user.tenantID, transactionId);
    UtilsService.assertObjectExists(transaction, `Transaction with ID '${transactionId}' does not exist`, 'TransactionService', 'handleDeleteTransaction', req.user);
    // Handle active transactions
    const chargingStation = await ChargingStationStorage.getChargingStation(req.user.tenantID, transaction.chargeBoxID);
    if (!transaction.stop) {
      // Free the Charging Station
      UtilsService.assertObjectExists(chargingStation, `Charging Station with ID '${transaction.chargeBoxID}' does not exist`, 'TransactionService', 'handleDeleteTransaction', req.user);
      const foundConnector = chargingStation.connectors.find((connector) => connector.connectorId === transaction.connectorId);
      if (foundConnector && transaction.id === foundConnector.activeTransactionID) {
        OCPPUtils.checkAndFreeChargingStationConnector(req.user.tenantID, chargingStation, transaction.connectorId);
        await ChargingStationStorage.saveChargingStation(req.user.tenantID, chargingStation);
      }
    }
    // Delete Transaction
    await TransactionStorage.deleteTransaction(req.user.tenantID, transaction);
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user, actionOnUser: (transaction.user ? transaction.user : null),
      module: 'TransactionService', method: 'handleDeleteTransaction',
      message: `Transaction ID '${transactionId}' on '${transaction.chargeBoxID}'-'${transaction.connectorId}' has been deleted successfully`,
      action: action, detailedMessages: transaction
    });
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleTransactionSoftStop(action: string, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const transactionId = TransactionSecurity.filterTransactionSoftStop(req.body);
    // Transaction Id is mandatory
    UtilsService.assertIdIsProvided(transactionId, 'TransactionService', 'handleTransactionSoftStop', req.user);
    // Check auth
    if (!Authorizations.canUpdateTransaction(req.user)) {
      throw new AppAuthError(
        Constants.ACTION_UPDATE, Constants.ENTITY_TRANSACTION, transactionId,
        Constants.HTTP_AUTH_ERROR,
        'TransactionService', 'handleTransactionSoftStop',
        req.user);
    }
    // Get Transaction
    const transaction = await TransactionStorage.getTransaction(req.user.tenantID, transactionId);
    UtilsService.assertObjectExists(transaction, `Transaction with ID ${transactionId} does not exist`, 'TransactionService', 'handleTransactionSoftStop', req.user);
    // Get the Charging Station
    const chargingStation = await ChargingStationStorage.getChargingStation(req.user.tenantID, transaction.chargeBoxID);
    UtilsService.assertObjectExists(chargingStation, `Charging Station with ID '${transaction.chargeBoxID}' does not exist`, 'TransactionService', 'handleTransactionSoftStop', req.user);
    // Check User
    let user: User;
    if (!transaction.user && transaction.userID) {
      // Get Transaction User
      user = await UserStorage.getUser(req.user.tenantID, transaction.userID);
      UtilsService.assertObjectExists(user, `User with ID '${transaction.userID}' does not exist`, 'TransactionService', 'handleTransactionSoftStop', req.user);
    }
    // Stop Transaction
    const result = await new OCPPService().handleStopTransaction(
      {
        chargeBoxIdentity: chargingStation.id,
        tenantID: req.user.tenantID
      },
      {
        transactionId: transactionId,
        idTag: req.user.tagIDs[0],
        timestamp: transaction.lastMeterValue ? transaction.lastMeterValue.timestamp : transaction.timestamp,
        meterStop: transaction.lastMeterValue.value ? transaction.lastMeterValue.value : transaction.meterStart
      },
      true);
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID, source: chargingStation.id,
      user: req.user, actionOnUser: user,
      module: 'TransactionService', method: 'handleTransactionSoftStop',
      message: `Connector '${transaction.connectorId}' > Transaction ID '${transactionId}' has been stopped successfully`,
      action: action, detailedMessages: result
    });
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleGetChargingStationConsumptionFromTransaction(action: string, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = TransactionSecurity.filterChargingStationConsumptionFromTransactionRequest(req.query);
    // Transaction Id is mandatory
    UtilsService.assertIdIsProvided(filteredRequest.TransactionId, 'TransactionService',
      'handleGetChargingStationConsumptionFromTransaction', req.user);
    // Get Transaction
    const transaction = await TransactionStorage.getTransaction(req.user.tenantID, filteredRequest.TransactionId);
    UtilsService.assertObjectExists(transaction, `Transaction with ID '${filteredRequest.TransactionId}' does not exist`,
      'TransactionService', 'handleGetChargingStationConsumptionFromTransaction', req.user);
    // Check auth
    if (!Authorizations.canReadTransaction(req.user, transaction)) {
      throw new AppAuthError(
        Constants.ACTION_READ,
        Constants.ENTITY_TRANSACTION,
        transaction.id,
        Constants.HTTP_AUTH_ERROR, 'TransactionService', 'handleGetChargingStationConsumptionFromTransaction',
        req.user);
    }
    // Check dates
    if (filteredRequest.StartDateTime && filteredRequest.EndDateTime && moment(filteredRequest.StartDateTime).isAfter(moment(filteredRequest.EndDateTime))) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `The requested start date '${new Date(filteredRequest.StartDateTime).toISOString()}' is after the requested end date '${new Date(filteredRequest.StartDateTime).toISOString()}' `, Constants.HTTP_GENERAL_ERROR,
        'TransactionService', 'handleGetChargingStationConsumptionFromTransaction', req.user);
    }
    // Get the consumption
    let consumptions: Consumption[] = await ConsumptionStorage.getConsumptions(req.user.tenantID, { transactionId: transaction.id });
    // Dates provided?
    const startDateTime = filteredRequest.StartDateTime ? filteredRequest.StartDateTime : Constants.MIN_DATE;
    const endDateTime = filteredRequest.EndDateTime ? filteredRequest.EndDateTime : Constants.MAX_DATE;
    // Filter?
    if (consumptions && (filteredRequest.StartDateTime || filteredRequest.EndDateTime)) {
      consumptions = consumptions.filter((consumption) =>
        moment(consumption.endedAt).isBetween(startDateTime, endDateTime, null, '[]'));
    }
    // Return the result
    res.json(TransactionSecurity.filterConsumptionsFromTransactionResponse(transaction, consumptions, req.user));
    next();
  }

  public static async handleGetTransaction(action: string, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = TransactionSecurity.filterTransactionRequest(req.query);
    UtilsService.assertIdIsProvided(filteredRequest.ID, 'TransactionService', 'handleGetTransaction', req.user);
    // Get Transaction
    const transaction = await TransactionStorage.getTransaction(req.user.tenantID, filteredRequest.ID);
    UtilsService.assertObjectExists(transaction, `Transaction with ID '${filteredRequest.ID}' does not exist`, 'TransactionService',
      'handleGetTransaction', req.user);
    // Check auth
    if (!Authorizations.canReadTransaction(req.user, transaction)) {
      throw new AppAuthError(
        Constants.ACTION_READ,
        Constants.ENTITY_TRANSACTION,
        filteredRequest.ID,
        Constants.HTTP_AUTH_ERROR,
        'TransactionService', 'handleGetTransaction',
        req.user);
    }
    // Return
    res.json(
      // Filter
      TransactionSecurity.filterTransactionResponse(
        transaction, req.user)
    );
    next();
  }

  public static async handleGetChargingStationTransactions(action: string, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check auth
    if (!Authorizations.canListTransactions(req.user)) {
      throw new AppAuthError(
        Constants.ACTION_LIST,
        Constants.ENTITY_TRANSACTION,
        null,
        Constants.HTTP_AUTH_ERROR,
        'TransactionService', 'handleGetChargingStationTransactions',
        req.user);
    }
    // Filter
    const filteredRequest = TransactionSecurity.filterChargingStationTransactionsRequest(req.query);
    UtilsService.assertIdIsProvided(filteredRequest.ChargeBoxID, 'TransactionService', 'handleGetChargingStationTransactions:ChargeBoxID', req.user);
    UtilsService.assertIdIsProvided(filteredRequest.ConnectorId, 'TransactionService', 'handleGetChargingStationTransactions:ConnectorId', req.user);
    // Get Charge Box
    const chargingStation = await ChargingStationStorage.getChargingStation(req.user.tenantID, filteredRequest.ChargeBoxID);
    UtilsService.assertObjectExists(chargingStation, `Charging Station with ID '${filteredRequest.ChargeBoxID}' does not exist`, 'TransactionService',
      'handleGetChargingStationTransactions', req.user);
    // Query
    const transactions = await TransactionStorage.getTransactions(req.user.tenantID, {
      chargeBoxIDs: [chargingStation.id], connectorId: filteredRequest.ConnectorId,
      startDateTime: filteredRequest.StartDateTime, endDateTime: filteredRequest.EndDateTime,
      withChargeBoxes: true
    }, {
      limit: filteredRequest.Limit,
      skip: filteredRequest.Skip,
      sort: filteredRequest.Sort,
      onlyRecordCount: filteredRequest.OnlyRecordCount
    });
    // Filter
    TransactionSecurity.filterTransactionsResponse(transactions, req.user);
    // Return
    res.json(transactions);
    next();
  }

  public static async handleGetTransactionYears(action: string, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Get Transactions
    const transactionsYears = await TransactionStorage.getTransactionYears(req.user.tenantID);
    const result: any = {};
    if (transactionsYears) {
      result.years = [];
      result.years.push(new Date().getFullYear());
    }
    // Return
    res.json(transactionsYears);
    next();
  }

  public static async handleGetTransactionsActive(action: string, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check auth
    if (!Authorizations.canListTransactions(req.user)) {
      throw new AppAuthError(
        Constants.ACTION_LIST,
        Constants.ENTITY_TRANSACTION,
        null,
        Constants.HTTP_AUTH_ERROR,
        'TransactionService', 'handleGetTransactionsActive',
        req.user);
    }
    const filter: any = { stop: { $exists: false } };
    // Filter
    const filteredRequest = TransactionSecurity.filterTransactionsActiveRequest(req.query);
    if (filteredRequest.ChargeBoxID) {
      filter.chargeBoxIDs = filteredRequest.ChargeBoxID.split('|');
    }
    if (filteredRequest.SiteAreaID) {
      filter.siteAreaIDs = filteredRequest.SiteAreaID.split('|');
    }
    if (filteredRequest.SiteID) {
      filter.siteID = filteredRequest.SiteID.split('|');
    }
    if (filteredRequest.UserID) {
      filter.userIDs = filteredRequest.UserID.split('|');
    }
    if (Authorizations.isBasic(req.user)) {
      filter.userIDs = [req.user.id];
    }
    if (Utils.isComponentActiveFromToken(req.user, Constants.COMPONENTS.ORGANIZATION) && Authorizations.isSiteAdmin(req.user)) {
      filter.siteAdminIDs = Authorizations.getAuthorizedSiteAdminIDs(req.user);
    }
    if (filteredRequest.ConnectorId) {
      filter.connectorId = filteredRequest.ConnectorId;
    }
    filter.withChargeBoxes = true;
    // Get Transactions
    const transactions = await TransactionStorage.getTransactions(req.user.tenantID, filter,
      {
        limit: filteredRequest.Limit,
        skip: filteredRequest.Skip,
        sort: filteredRequest.Sort,
        onlyRecordCount: filteredRequest.OnlyRecordCount
      });
    // Filter
    TransactionSecurity.filterTransactionsResponse(transactions, req.user);
    // Return
    res.json(transactions);
    next();
  }

  public static async handleGetTransactionsCompleted(action: string, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check auth
    if (!Authorizations.canListTransactions(req.user)) {
      throw new AppAuthError(
        Constants.ACTION_LIST,
        Constants.ENTITY_TRANSACTION,
        null,
        Constants.HTTP_AUTH_ERROR,
        'TransactionService', 'handleGetTransactionsCompleted',
        req.user);
    }
    const filter: any = { stop: { $exists: true } };
    // Filter
    const filteredRequest = TransactionSecurity.filterTransactionsRequest(req.query);
    if (filteredRequest.ChargeBoxID) {
      filter.chargeBoxIDs = filteredRequest.ChargeBoxID.split('|');
    }
    if (filteredRequest.SiteAreaID) {
      filter.siteAreaIDs = filteredRequest.SiteAreaID.split('|');
    }
    if (filteredRequest.SiteID) {
      filter.siteID = filteredRequest.SiteID.split('|');
    }
    if (filteredRequest.UserID) {
      filter.userIDs = filteredRequest.UserID.split('|');
    }
    if (Authorizations.isBasic(req.user)) {
      filter.userIDs = [req.user.id];
    }
    if (Utils.isComponentActiveFromToken(req.user, Constants.COMPONENTS.ORGANIZATION) && Authorizations.isSiteAdmin(req.user)) {
      filter.siteAdminIDs = Authorizations.getAuthorizedSiteAdminIDs(req.user);
    }
    if (filteredRequest.StartDateTime) {
      filter.startDateTime = filteredRequest.StartDateTime;
    }
    if (filteredRequest.EndDateTime) {
      filter.endDateTime = filteredRequest.EndDateTime;
    }
    if (filteredRequest.RefundStatus) {
      filter.refundStatus = filteredRequest.RefundStatus.split('|');
    }
    if (filteredRequest.MinimalPrice) {
      filter.minimalPrice = filteredRequest.MinimalPrice;
    }
    if (filteredRequest.Statistics) {
      filter.statistics = filteredRequest.Statistics;
    }
    if (filteredRequest.Search) {
      filter.search = filteredRequest.Search;
    }
    const transactions = await TransactionStorage.getTransactions(req.user.tenantID, filter,
      {
        limit: filteredRequest.Limit,
        skip: filteredRequest.Skip,
        sort: filteredRequest.Sort,
        onlyRecordCount: filteredRequest.OnlyRecordCount
      });
    // Filter
    TransactionSecurity.filterTransactionsResponse(transactions, req.user);
    // Return
    res.json(transactions);
    next();
  }

  public static async handleGetTransactionsToRefund(action: string, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check auth
    if (!Authorizations.canListTransactions(req.user)) {
      throw new AppAuthError(
        Constants.ACTION_LIST,
        Constants.ENTITY_TRANSACTION,
        null,
        Constants.HTTP_AUTH_ERROR,
        'TransactionService', 'handleGetTransactionsToRefund',
        req.user);
    }
    const filter: any = { stop: { $exists: true } };
    // Filter
    const filteredRequest = TransactionSecurity.filterTransactionsRequest(req.query);
    if (filteredRequest.ChargeBoxID) {
      filter.chargeBoxIDs = filteredRequest.ChargeBoxID.split('|');
    }
    if (filteredRequest.SiteAreaID) {
      filter.siteAreaIDs = filteredRequest.SiteAreaID.split('|');
    }
    if (filteredRequest.SiteID) {
      filter.siteID = filteredRequest.SiteID.split('|');
    }
    if (filteredRequest.UserID) {
      filter.userIDs = filteredRequest.UserID.split('|');
    }
    if (Authorizations.isBasic(req.user) || Authorizations.isAdmin(req.user.role)) {
      filter.userIDs = [req.user.id];
    }
    if (Utils.isComponentActiveFromToken(req.user, Constants.COMPONENTS.ORGANIZATION) && Authorizations.isSiteAdmin(req.user)) {
      filter.siteAdminIDs = Authorizations.getAuthorizedSiteAdminIDs(req.user);
    }
    if (filteredRequest.StartDateTime) {
      filter.startDateTime = filteredRequest.StartDateTime;
    }
    if (filteredRequest.EndDateTime) {
      filter.endDateTime = filteredRequest.EndDateTime;
    }
    if (filteredRequest.RefundStatus) {
      filter.refundStatus = filteredRequest.RefundStatus.split('|');
    }
    if (filteredRequest.MinimalPrice) {
      filter.minimalPrice = filteredRequest.MinimalPrice;
    }
    if (filteredRequest.Statistics) {
      filter.statistics = filteredRequest.Statistics;
    }
    if (filteredRequest.Search) {
      filter.search = filteredRequest.Search;
    }
    const transactions = await TransactionStorage.getTransactions(req.user.tenantID, filter,
      {
        limit: filteredRequest.Limit,
        skip: filteredRequest.Skip,
        sort: filteredRequest.Sort,
        onlyRecordCount: filteredRequest.OnlyRecordCount
      });
    // Filter
    TransactionSecurity.filterTransactionsResponse(transactions, req.user, true);
    // Return
    res.json(transactions);
    next();
  }

  public static async handleGetTransactionsExport(action: string, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check auth
    if (!Authorizations.canListTransactions(req.user)) {
      throw new AppAuthError(
        Constants.ACTION_LIST,
        Constants.ENTITY_TRANSACTIONS,
        null,
        Constants.HTTP_AUTH_ERROR,
        'TransactionService', 'handleGetTransactionsExport',
        req.user);
    }
    const filter: any = { stop: { $exists: true } };
    // Filter
    const filteredRequest = TransactionSecurity.filterTransactionsRequest(req.query);
    if (filteredRequest.ChargeBoxID) {
      filter.chargeBoxIDs = filteredRequest.ChargeBoxID.split('|');
    }
    if (filteredRequest.SiteAreaID) {
      filter.siteAreaIDs = filteredRequest.SiteAreaID.split('|');
    }
    if (filteredRequest.SiteID) {
      filter.siteID = filteredRequest.SiteID.split('|');
    }
    if (filteredRequest.UserID) {
      filter.userIDs = filteredRequest.UserID.split('|');
    }
    if (Authorizations.isBasic(req.user)) {
      filter.userIDs = [req.user.id];
    }
    if (Utils.isComponentActiveFromToken(req.user, Constants.COMPONENTS.ORGANIZATION) && Authorizations.isSiteAdmin(req.user)) {
      filter.siteAdminIDs = Authorizations.getAuthorizedSiteAdminIDs(req.user);
    }
    // Date
    if (filteredRequest.StartDateTime) {
      filter.startDateTime = filteredRequest.StartDateTime;
    }
    if (filteredRequest.EndDateTime) {
      filter.endDateTime = filteredRequest.EndDateTime;
    }
    if (filteredRequest.RefundStatus) {
      filter.refundStatus = filteredRequest.RefundStatus.split('|');
    }
    const transactions = await TransactionStorage.getTransactions(req.user.tenantID,
      { ...filter, search: filteredRequest.Search, siteID: filteredRequest.SiteID },
      {
        limit: filteredRequest.Limit,
        skip: filteredRequest.Skip,
        sort: filteredRequest.Sort,
        onlyRecordCount: filteredRequest.OnlyRecordCount
      });
    // Filter
    TransactionSecurity.filterTransactionsResponse(transactions, req.user);
    // Hash userId and tagId for confidentiality purposes
    for (const transaction of transactions.result) {
      if (transaction.user) {
        transaction.user.id = transaction.user ? Cypher.hash(transaction.user.id) : '';
      }
      transaction.tagID = transaction.tagID ? Cypher.hash(transaction.tagID) : '';
    }
    const filename = 'transactions_export.csv';
    fs.writeFile(filename, TransactionService.convertToCSV(transactions.result), (err) => {
      if (err) {
        throw err;
      }
      res.download(filename, (err2) => {
        if (err2) {
          throw err2;
        }
        fs.unlink(filename, (err3) => {
          if (err3) {
            throw err3;
          }
        });
      });
    });
  }

  public static async handleGetTransactionsInError(action: string, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check auth
    if (!Authorizations.canListTransactionsInError(req.user)) {
      throw new AppAuthError(
        Constants.ACTION_LIST,
        Constants.ENTITY_TRANSACTION,
        null,
        Constants.HTTP_AUTH_ERROR,
        'TransactionService', 'handleGetTransactionsInError',
        req.user);
    }
    const filter: any = {};
    // Filter
    const filteredRequest = TransactionSecurity.filterTransactionsInErrorRequest(req.query);
    if (filteredRequest.ChargeBoxID) {
      filter.chargeBoxIDs = filteredRequest.ChargeBoxID.split('|');
    }
    if (filteredRequest.SiteAreaID) {
      filter.siteAreaIDs = filteredRequest.SiteAreaID.split('|');
    }
    if (filteredRequest.SiteID) {
      filter.siteID = filteredRequest.SiteID.split('|');
    }
    if (filteredRequest.UserID) {
      filter.userIDs = filteredRequest.UserID.split('|');
    }
    if (Utils.isComponentActiveFromToken(req.user, Constants.COMPONENTS.ORGANIZATION) && Authorizations.isSiteAdmin(req.user)) {
      filter.siteAdminIDs = Authorizations.getAuthorizedSiteAdminIDs(req.user);
    }
    // Date
    if (filteredRequest.StartDateTime) {
      filter.startDateTime = filteredRequest.StartDateTime;
    }
    if (filteredRequest.EndDateTime) {
      filter.endDateTime = filteredRequest.EndDateTime;
    }
    if (filteredRequest.ErrorType) {
      filter.errorType = filteredRequest.ErrorType.split('|');
    } else {
      filter.errorType = ['negative_inactivity','negative_duration','average_consumption_greater_than_connector_capacity','incorrect_starting_date','no_consumption'];
    }
    // Site Area
    const transactions = await TransactionStorage.getTransactionsInError(req.user.tenantID,
      { ...filter, search: filteredRequest.Search },
      {
        limit: filteredRequest.Limit,
        skip: filteredRequest.Skip,
        sort: filteredRequest.Sort,
        onlyRecordCount: filteredRequest.OnlyRecordCount
      });
    // Filter
    TransactionSecurity.filterTransactionsResponse(transactions, req.user);
    // Return
    res.json(transactions);
    next();
  }

  public static convertToCSV(transactions: Transaction[]): string {
    let csv = 'id,chargeBoxID,connectorID,userID,tagID,startDate,endDate,meterStart,meterStop,totalConsumption,totalDuration,totalInactivity,price,priceUnit\r\n';
    for (const transaction of transactions) {
      csv += `${transaction.id},`;
      csv += `${transaction.chargeBoxID},`;
      csv += `${transaction.connectorId},`;
      csv += `${transaction.user ? transaction.user.id : ''},`;
      csv += `${transaction.tagID},`;
      csv += `${transaction.timestamp},`;
      csv += `${transaction.stop ? transaction.stop.timestamp : ''},`;
      csv += `${transaction.meterStart},`;
      csv += `${transaction.stop ? transaction.stop.meterStop : ''},`;
      csv += `${transaction.stop ? transaction.stop.totalConsumption : ''},`;
      csv += `${transaction.stop ? transaction.stop.totalDurationSecs : ''},`;
      csv += `${transaction.stop ? transaction.stop.totalInactivitySecs : ''},`;
      csv += `${transaction.stop ? transaction.stop.price : ''},`;
      csv += `${transaction.stop ? transaction.stop.priceUnit : ''}\r\n`;
    }
    return csv;
  }
}
