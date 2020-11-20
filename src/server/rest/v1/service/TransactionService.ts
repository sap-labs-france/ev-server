import { Action, Entity } from '../../../../types/Authorization';
import { HTTPAuthError, HTTPError } from '../../../../types/HTTPError';
import { NextFunction, Request, Response } from 'express';
import Transaction, { TransactionAction } from '../../../../types/Transaction';

import { ActionsResponse } from '../../../../types/GlobalType';
import AppAuthError from '../../../../exception/AppAuthError';
import AppError from '../../../../exception/AppError';
import Authorizations from '../../../../authorization/Authorizations';
import BillingFactory from '../../../../integration/billing/BillingFactory';
import ChargingStationStorage from '../../../../storage/mongodb/ChargingStationStorage';
import Configuration from '../../../../utils/Configuration';
import Constants from '../../../../utils/Constants';
import Consumption from '../../../../types/Consumption';
import ConsumptionStorage from '../../../../storage/mongodb/ConsumptionStorage';
import Cypher from '../../../../utils/Cypher';
import { DataResult } from '../../../../types/DataResult';
import LockingHelper from '../../../../locking/LockingHelper';
import LockingManager from '../../../../locking/LockingManager';
import Logging from '../../../../utils/Logging';
import OCPPService from '../../../../server/ocpp/services/OCPPService';
import OCPPUtils from '../../../ocpp/utils/OCPPUtils';
import RefundFactory from '../../../../integration/refund/RefundFactory';
import { RefundStatus } from '../../../../types/Refund';
import { ServerAction } from '../../../../types/Server';
import SynchronizeRefundTransactionsTask from '../../../../scheduler/tasks/SynchronizeRefundTransactionsTask';
import TenantComponents from '../../../../types/TenantComponents';
import TenantStorage from '../../../../storage/mongodb/TenantStorage';
import { TransactionInErrorType } from '../../../../types/InError';
import TransactionSecurity from './security/TransactionSecurity';
import TransactionStorage from '../../../../storage/mongodb/TransactionStorage';
import User from '../../../../types/User';
import UserStorage from '../../../../storage/mongodb/UserStorage';
import UserToken from '../../../../types/UserToken';
import Utils from '../../../../utils/Utils';
import UtilsService from './UtilsService';
import moment from 'moment';

const MODULE_NAME = 'TransactionService';

export default class TransactionService {
  static async handleSynchronizeRefundedTransactions(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!Authorizations.isAdmin(req.user)) {
        throw new AppAuthError({
          errorCode: HTTPAuthError.ERROR,
          user: req.user,
          action: Action.UPDATE, entity: Entity.TRANSACTION,
          module: MODULE_NAME, method: 'handleSynchronizeRefundedTransactions'
        });
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

  public static async handleRefundTransactions(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = TransactionSecurity.filterTransactionsRefund(req.body);
    if (!filteredRequest.transactionIds) {
      // Not Found!
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Transaction IDs must be provided',
        module: MODULE_NAME, method: 'handleRefundTransactions',
        user: req.user,
        action: action
      });
    }
    const transactionsToRefund: Transaction[] = [];
    for (const transactionId of filteredRequest.transactionIds) {
      const transaction = await TransactionStorage.getTransaction(req.user.tenantID, transactionId);
      if (!transaction) {
        Logging.logError({
          tenantID: req.user.tenantID,
          user: req.user, actionOnUser: (transaction.user ? transaction.user : null),
          module: MODULE_NAME, method: 'handleRefundTransactions',
          message: `Transaction '${transaction.id}' does not exist`,
          action: action,
          detailedMessages: { transaction }
        });
        continue;
      }
      if (transaction.refundData && !!transaction.refundData.refundId && transaction.refundData.status !== RefundStatus.CANCELLED) {
        Logging.logError({
          tenantID: req.user.tenantID,
          user: req.user, actionOnUser: (transaction.user ? transaction.user : null),
          module: MODULE_NAME, method: 'handleRefundTransactions',
          message: `Transaction '${transaction.id}' is already refunded`,
          action: action,
          detailedMessages: { transaction }
        });
        continue;
      }
      // Check auth
      if (!Authorizations.canRefundTransaction(req.user, transaction)) {
        throw new AppAuthError({
          errorCode: HTTPAuthError.ERROR,
          user: req.user,
          action: Action.REFUND_TRANSACTION, entity: Entity.TRANSACTION,
          module: MODULE_NAME, method: 'handleRefundTransactions',
          value: transaction.id.toString()
        });
      }
      transactionsToRefund.push(transaction);
    }
    // Get Transaction User
    const user: User = await UserStorage.getUser(req.user.tenantID, req.user.id);
    UtilsService.assertObjectExists(action, user, `User with ID '${req.user.id}' does not exist`,
      MODULE_NAME, 'handleRefundTransactions', req.user);
    const refundConnector = await RefundFactory.getRefundImpl(req.user.tenantID);
    if (!refundConnector) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'No Refund Implementation Found',
        module: MODULE_NAME, method: 'handleRefundTransactions',
        user: req.user, action: action
      });
    }
    const refundedTransactions = await refundConnector.refund(req.user.tenantID, user.id, transactionsToRefund);
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

  public static async handlePushTransactionCdr(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = TransactionSecurity.filterPushTransactionCdrRequest(req.body);
    // Check Mandatory fields
    UtilsService.assertIdIsProvided(action, filteredRequest.transactionId, MODULE_NAME, 'handlePushTransactionCdr', req.user);
    // Check auth
    if (!Authorizations.canUpdateTransaction(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.UPDATE, entity: Entity.TRANSACTION,
        module: MODULE_NAME, method: 'handlePushTransactionCdr',
        value: filteredRequest.transactionId.toString()
      });
    }
    // Check Transaction
    const transaction = await TransactionStorage.getTransaction(req.user.tenantID, filteredRequest.transactionId);
    UtilsService.assertObjectExists(action, transaction, `Transaction ID '${filteredRequest.transactionId}' does not exist`,
      MODULE_NAME, 'handlePushTransactionCdr', req.user);
    // Check Charging Station
    const chargingStation = await ChargingStationStorage.getChargingStation(req.user.tenantID, transaction.chargeBoxID);
    UtilsService.assertObjectExists(action, chargingStation, `Charging Station ID '${transaction.chargeBoxID}' does not exist`,
      MODULE_NAME, 'handlePushTransactionCdr', req.user);
    // Check Issuer
    if (!transaction.issuer) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.TRANSACTION_NOT_FROM_TENANT,
        message: `The transaction ID '${transaction.id}' belongs to an external organization`,
        module: MODULE_NAME, method: 'handlePushTransactionCdr',
        user: req.user, action: action
      });
    }
    // Check OCPI
    if (!transaction.ocpiData) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.TRANSACTION_WITH_NO_OCPI_DATA,
        message: `The transaction ID '${transaction.id}' has no OCPI data`,
        module: MODULE_NAME, method: 'handlePushTransactionCdr',
        user: req.user, action: action
      });
    }
    // CDR already pushed
    if (transaction.ocpiData.cdr?.id) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.TRANSACTION_CDR_ALREADY_PUSHED,
        message: `The CDR of the transaction ID '${transaction.id}' has already been pushed`,
        module: MODULE_NAME, method: 'handlePushTransactionCdr',
        user: req.user, action: action
      });
    }
    // Get the lock
    const ocpiLock = await LockingHelper.createOCPIPushCpoCdrLock(req.user.tenantID, transaction.id);
    if (ocpiLock) {
      try {
        // Post CDR
        await OCPPUtils.processOCPITransaction(req.user.tenantID, transaction, chargingStation, TransactionAction.END);
        // Save
        await TransactionStorage.saveTransaction(req.user.tenantID, transaction);
        // Ok
        Logging.logInfo({
          tenantID: req.user.tenantID,
          action: action,
          user: req.user, actionOnUser: (transaction.user ? transaction.user : null),
          module: MODULE_NAME, method: 'handlePushTransactionCdr',
          message: `CDR of Transaction ID '${transaction.id}' has been pushed successfully`,
          detailedMessages: { cdr: transaction.ocpiData.cdr }
        });
      } finally {
        // Release the lock
        await LockingManager.release(ocpiLock);
      }
    }
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleGetUnassignedTransactionsCount(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check Auth
    if (!Authorizations.canUpdateTransaction(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.UPDATE, entity: Entity.TRANSACTION,
        module: MODULE_NAME, method: 'handleGetUnassignedTransactionsCount'
      });
    }
    // Filter
    const filteredRequest = TransactionSecurity.filterUnassignedTransactionsCountRequest(req.query);
    if (!filteredRequest.TagID) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Tag ID must be provided',
        module: MODULE_NAME, method: 'handleGetUnassignedTransactionsCount',
        user: req.user, action: action
      });
    }
    // Get the user
    const tag = await UserStorage.getTag(req.user.tenantID, filteredRequest.TagID);
    UtilsService.assertObjectExists(action, tag, `Tag with ID '${filteredRequest.TagID}' does not exist`,
      MODULE_NAME, 'handleAssignTransactionsToUser', req.user);
    // Get unassigned transactions
    const count = await TransactionStorage.getUnassignedTransactionsCount(req.user.tenantID, tag.id);
    // Return
    res.json(count);
    next();
  }

  public static async handleRebuildTransactionConsumptions(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check Auth
    if (!Authorizations.canUpdateTransaction(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.UPDATE, entity: Entity.TRANSACTION,
        module: MODULE_NAME, method: 'handleRebuildTransactionConsumptions'
      });
    }
    // Filter
    const filteredRequest = TransactionSecurity.filterTransactionRequest(req.query);
    UtilsService.assertIdIsProvided(action, filteredRequest.ID.toString(), MODULE_NAME, 'handleRebuildTransactionConsumptions', req.user);
    // Get Transaction
    const transaction = await TransactionStorage.getTransaction(req.user.tenantID, filteredRequest.ID);
    UtilsService.assertObjectExists(action, transaction, `Transaction with ID '${filteredRequest.ID}' does not exist`,
      MODULE_NAME, 'handleRebuildTransactionConsumptions', req.user);
    // Get unassigned transactions
    const nbrOfConsumptions = await OCPPUtils.rebuildTransactionConsumptions(req.user.tenantID, filteredRequest.ID);
    // Return
    res.json({ nbrOfConsumptions, ...Constants.REST_RESPONSE_SUCCESS });
    next();
  }

  public static async handleAssignTransactionsToUser(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check auths
    if (!Authorizations.canUpdateTransaction(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.UPDATE, entity: Entity.TRANSACTION,
        module: MODULE_NAME, method: 'handleAssignTransactionsToUser'
      });
    }
    // Filter
    const filteredRequest = TransactionSecurity.filterAssignTransactionsToUser(req.query);
    // Check
    if (!filteredRequest.TagID) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Tag ID must be provided',
        module: MODULE_NAME, method: 'handleAssignTransactionsToUser',
        user: req.user, action: action
      });
    }
    if (!filteredRequest.UserID) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'User ID must be provided',
        module: MODULE_NAME, method: 'handleAssignTransactionsToUser',
        user: req.user, action: action
      });
    }
    // Get the user
    const user: User = await UserStorage.getUser(req.user.tenantID, filteredRequest.UserID);
    UtilsService.assertObjectExists(action, user, `User with ID '${filteredRequest.UserID}' does not exist`,
      MODULE_NAME, 'handleAssignTransactionsToUser', req.user);
    // Get the tag
    const tag = await UserStorage.getTag(req.user.tenantID, filteredRequest.TagID);
    UtilsService.assertObjectExists(action, tag, `Tag with ID '${filteredRequest.TagID}' does not exist`,
      MODULE_NAME, 'handleAssignTransactionsToUser', req.user);
    if (!user.issuer) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'User not issued by the organization',
        module: MODULE_NAME, method: 'handleAssignTransactionsToUser',
        user: req.user, action: action
      });
    }
    if (!tag.issuer) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Tag not issued by the organization',
        module: MODULE_NAME, method: 'handleAssignTransactionsToUser',
        user: req.user, action: action
      });
    }
    // Assign
    await TransactionStorage.assignTransactionsToUser(req.user.tenantID, user.id, tag.id);
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleDeleteTransaction(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const transactionId = TransactionSecurity.filterTransactionRequestByID(req.query);
    // Check auth
    if (!Authorizations.canDeleteTransaction(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.DELETE, entity: Entity.TRANSACTION,
        module: MODULE_NAME, method: 'handleDeleteTransaction',
        value: transactionId.toString()
      });
    }
    // Get
    const transaction = await TransactionStorage.getTransaction(req.user.tenantID, transactionId);
    UtilsService.assertObjectExists(action, transaction, `Transaction with ID '${transactionId}' does not exist`,
      MODULE_NAME, 'handleDeleteTransaction', req.user);
    // Delete
    const result = await TransactionService.deleteTransactions(action, req.user, [transactionId]);
    res.json({ ...result, ...Constants.REST_RESPONSE_SUCCESS });
    next();
  }

  public static async handleDeleteTransactions(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const transactionsIds = TransactionSecurity.filterTransactionRequestByIDs(req.body);
    // Check auth
    if (!Authorizations.canDeleteTransaction(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.DELETE, entity: Entity.TRANSACTION,
        module: MODULE_NAME, method: 'handleDeleteTransactions',
        value: transactionsIds.toString()
      });
    }
    // Delete
    const result = await TransactionService.deleteTransactions(action, req.user, transactionsIds);
    res.json({ ...result, ...Constants.REST_RESPONSE_SUCCESS });
    next();
  }

  public static async handleTransactionSoftStop(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const transactionId = TransactionSecurity.filterTransactionSoftStop(req.body);
    // Transaction Id is mandatory
    UtilsService.assertIdIsProvided(action, transactionId, MODULE_NAME, 'handleTransactionSoftStop', req.user);
    // Check auth
    if (!Authorizations.canUpdateTransaction(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.UPDATE, entity: Entity.TRANSACTION,
        module: MODULE_NAME, method: 'handleTransactionSoftStop',
        value: transactionId.toString()
      });
    }
    // Get Transaction
    const transaction = await TransactionStorage.getTransaction(req.user.tenantID, transactionId);
    UtilsService.assertObjectExists(action, transaction, `Transaction with ID ${transactionId} does not exist`,
      MODULE_NAME, 'handleTransactionSoftStop', req.user);
    // Get the Charging Station
    const chargingStation = await ChargingStationStorage.getChargingStation(req.user.tenantID, transaction.chargeBoxID);
    UtilsService.assertObjectExists(action, chargingStation, `Charging Station with ID '${transaction.chargeBoxID}' does not exist`,
      MODULE_NAME, 'handleTransactionSoftStop', req.user);
    // Check User
    let user: User;
    if (!transaction.user && transaction.userID) {
      // Get Transaction User
      user = await UserStorage.getUser(req.user.tenantID, transaction.userID);
      UtilsService.assertObjectExists(action, user, `User with ID '${transaction.userID}' does not exist`,
        MODULE_NAME, 'handleTransactionSoftStop', req.user);
    }
    // Stop Transaction
    const result = await new OCPPService(Configuration.getChargingStationConfig()).handleStopTransaction(
      {
        chargeBoxIdentity: chargingStation.id,
        tenantID: req.user.tenantID
      },
      {
        transactionId: transactionId,
        chargeBoxID: chargingStation.id,
        idTag: req.user.tagIDs[0],
        timestamp: Utils.convertToDate(transaction.lastConsumption ? transaction.lastConsumption.timestamp : transaction.timestamp).toISOString(),
        meterStop: transaction.lastConsumption ? transaction.lastConsumption.value : transaction.meterStart
      },
      true
    );
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      source: chargingStation.id,
      user: req.user, actionOnUser: user,
      module: MODULE_NAME, method: 'handleTransactionSoftStop',
      message: `Connector ID '${transaction.connectorId}' > Transaction ID '${transactionId}' has been stopped successfully`,
      action: action,
      detailedMessages: { result }
    });
    // Ok
    res.json(result);
    next();
  }

  public static async handleGetTransactionConsumption(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = TransactionSecurity.filterConsumptionFromTransactionRequest(req.query);
    // Transaction Id is mandatory
    UtilsService.assertIdIsProvided(action, filteredRequest.TransactionId, MODULE_NAME,
      'handleGetConsumptionFromTransaction', req.user);
    // Get Transaction
    const transaction = await TransactionStorage.getTransaction(req.user.tenantID, filteredRequest.TransactionId, [
      'id', 'chargeBoxID', 'timestamp', 'issuer', 'stateOfCharge', 'tagID', 'timezone', 'connectorId', 'meterStart', 'siteAreaID', 'siteID',
      'userID', 'user.id', 'user.name', 'user.firstName', 'user.email',
      'stop.userID', 'stop.user.id', 'stop.user.name', 'stop.user.firstName', 'stop.user.email',
      'currentTotalDurationSecs', 'currentTotalInactivitySecs', 'currentInstantWatts', 'currentTotalConsumptionWh', 'currentStateOfCharge',
      'stop.price', 'stop.priceUnit', 'stop.inactivityStatus', 'stop.stateOfCharge', 'stop.timestamp', 'stop.totalConsumptionWh',
      'stop.totalDurationSecs', 'stop.totalInactivitySecs', 'stop.pricingSource', 'stop.roundedPrice', 'stop.tagID'
    ]);
    UtilsService.assertObjectExists(action, transaction, `Transaction with ID '${filteredRequest.TransactionId}' does not exist`,
      MODULE_NAME, 'handleGetConsumptionFromTransaction', req.user);
    // Check Transaction
    if (!Authorizations.canReadTransaction(req.user, transaction)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.READ, entity: Entity.TRANSACTION,
        module: MODULE_NAME, method: 'handleGetConsumptionFromTransaction',
        value: transaction.id.toString()
      });
    }
    // Check User
    if (transaction && !Authorizations.canReadUser(req.user, transaction.userID)) {
      // Remove User
      delete transaction.user;
      delete transaction.userID;
      delete transaction.stop.user;
      delete transaction.stop.userID;
    }
    // Check Dates
    if (filteredRequest.StartDateTime && filteredRequest.EndDateTime &&
        moment(filteredRequest.StartDateTime).isAfter(moment(filteredRequest.EndDateTime))) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: `The requested start date '${new Date(filteredRequest.StartDateTime).toISOString()}' is after the requested end date '${new Date(filteredRequest.StartDateTime).toISOString()}' `,
        module: MODULE_NAME, method: 'handleGetConsumptionFromTransaction',
        user: req.user, action: action
      });
    }
    // Get the consumption
    let consumptions: Consumption[];
    if (filteredRequest.LoadAllConsumptions) {
      const consumptionsMDB = await ConsumptionStorage.getTransactionConsumptions(
        req.user.tenantID, { transactionId: transaction.id }, Constants.DB_PARAMS_MAX_LIMIT, [
          // TODO: To remove the 'date' when new version of Mobile App will be released (> V1.3.22)
          'date', 'startedAt', 'cumulatedConsumptionWh', 'cumulatedConsumptionAmps', 'cumulatedAmount',
          'stateOfCharge', 'limitWatts', 'limitAmps',
          'instantVoltsDC', 'instantVolts', 'instantVoltsL1', 'instantVoltsL2', 'instantVoltsL3',
          'instantWattsDC', 'instantWatts', 'instantWattsL1', 'instantWattsL2', 'instantWattsL3',
          'instantAmpsDC', 'instantAmps', 'instantAmpsL1', 'instantAmpsL2', 'instantAmpsL3'
        ]
      );
      consumptions = consumptionsMDB.result;
    } else {
      consumptions = await ConsumptionStorage.getOptimizedTransactionConsumptions(
        req.user.tenantID, { transactionId: transaction.id }, [
          // TODO: To remove the 'consumptions.date' when new version of Mobile App will be released (> V1.3.22)
          'consumptions.date', 'consumptions.startedAt', 'consumptions.cumulatedConsumptionWh', 'consumptions.cumulatedConsumptionAmps', 'consumptions.cumulatedAmount',
          'consumptions.stateOfCharge', 'consumptions.limitWatts', 'consumptions.limitAmps', 'consumptions.startedAt', 'consumptions.endedAt',
          'consumptions.instantVoltsDC', 'consumptions.instantVolts', 'consumptions.instantVoltsL1', 'consumptions.instantVoltsL2', 'consumptions.instantVoltsL3',
          'consumptions.instantWattsDC', 'consumptions.instantWatts', 'consumptions.instantWattsL1', 'consumptions.instantWattsL2', 'consumptions.instantWattsL3',
          'consumptions.instantAmpsDC', 'consumptions.instantAmps', 'consumptions.instantAmpsL1', 'consumptions.instantAmpsL2', 'consumptions.instantAmpsL3'
        ]);
    }
    // Assign
    transaction.values = consumptions;
    // Return the result
    res.json(transaction);
    next();
  }

  public static async handleGetTransaction(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = TransactionSecurity.filterTransactionRequest(req.query);
    UtilsService.assertIdIsProvided(action, filteredRequest.ID, MODULE_NAME, 'handleGetTransaction', req.user);
    // Get Transaction
    const transaction = await TransactionStorage.getTransaction(req.user.tenantID, filteredRequest.ID, [
      'id', 'chargeBoxID', 'timestamp', 'issuer', 'stateOfCharge', 'tagID', 'timezone', 'connectorId', 'meterStart', 'siteAreaID', 'siteID',
      'userID', 'user.id', 'user.name', 'user.firstName', 'user.email',
      'stop.userID', 'stop.user.id', 'stop.user.name', 'stop.user.firstName', 'stop.user.email',
      'currentTotalDurationSecs', 'currentTotalInactivitySecs', 'currentInstantWatts', 'currentTotalConsumptionWh', 'currentStateOfCharge',
      'currentCumulatedPrice', 'currentInactivityStatus', 'price', 'roundedPrice', 'signedData',
      'stop.price', 'stop.priceUnit', 'stop.inactivityStatus', 'stop.stateOfCharge', 'stop.timestamp', 'stop.totalConsumptionWh', 'stop.meterStop',
      'stop.totalDurationSecs', 'stop.totalInactivitySecs', 'stop.pricingSource', 'stop.roundedPrice', 'stop.signedData', 'stop.tagID'
    ]);
    UtilsService.assertObjectExists(action, transaction, `Transaction with ID '${filteredRequest.ID}' does not exist`,
      MODULE_NAME, 'handleGetTransaction', req.user);
    // Check Transaction
    if (!Authorizations.canReadTransaction(req.user, transaction)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.READ, entity: Entity.TRANSACTION,
        module: MODULE_NAME, method: 'handleGetTransaction',
        value: filteredRequest.ID.toString()
      });
    }
    // Check User
    if (transaction && !Authorizations.canReadUser(req.user, transaction.userID)) {
      // Remove User
      delete transaction.user;
      delete transaction.userID;
      delete transaction.stop.user;
      delete transaction.stop.userID;
    }
    // Return
    res.json(transaction);
    next();
  }

  public static async handleGetChargingStationTransactions(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Get transaction
    const transactions = await TransactionService.getTransactions(req, action, { completedTransactions: true }, [
      'id', 'chargeBoxID', 'timestamp', 'issuer', 'stateOfCharge', 'tagID', 'timezone', 'connectorId', 'meterStart', 'siteAreaID', 'siteID',
      'currentTotalDurationSecs', 'currentTotalInactivitySecs', 'currentInstantWatts', 'currentTotalConsumptionWh', 'currentStateOfCharge',
      'stop.price', 'stop.priceUnit', 'stop.inactivityStatus', 'stop.stateOfCharge', 'stop.timestamp', 'stop.totalConsumptionWh',
      'stop.totalDurationSecs', 'stop.totalInactivitySecs', 'billingData.invoiceID', 'ocpiWithNoCdr'
    ]);
    res.json(transactions);
    next();
  }

  public static async handleGetTransactionYears(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
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

  public static async handleGetTransactionsActive(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    const transactions = await TransactionService.getTransactions(req, action, { completedTransactions: false }, [
      'id', 'chargeBoxID', 'timestamp', 'issuer', 'stateOfCharge', 'tagID', 'timezone', 'connectorId', 'status', 'meterStart', 'siteAreaID', 'siteID',
      'currentTotalDurationSecs', 'currentTotalInactivitySecs', 'currentInstantWatts', 'currentTotalConsumptionWh', 'currentStateOfCharge',
      'currentCumulatedPrice', 'currentInactivityStatus', 'price', 'roundedPrice'
    ]);
    res.json(transactions);
    next();
  }

  public static async handleGetTransactionsCompleted(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Get transaction
    const transactions = await TransactionService.getTransactions(req, action, { completedTransactions: true }, [
      'id', 'chargeBoxID', 'timestamp', 'issuer', 'stateOfCharge', 'tagID', 'timezone', 'connectorId', 'meterStart', 'siteAreaID', 'siteID',
      'stop.price', 'stop.priceUnit', 'stop.inactivityStatus', 'stop.stateOfCharge', 'stop.timestamp', 'stop.totalConsumptionWh',
      'stop.totalDurationSecs', 'stop.totalInactivitySecs', 'stop.tagID', 'stop.meterStop', 'billingData.invoiceID', 'ocpiWithNoCdr'
    ]);
    res.json(transactions);
    next();
  }

  public static async handleGetTransactionsToRefund(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.REFUND,
      Action.LIST, Entity.TRANSACTIONS, MODULE_NAME, 'handleGetTransactionsToRefund');
    // Only e-Mobility transactions
    req.query.issuer = 'true';
    // Call
    const transactions = await TransactionService.getTransactions(req, action, { completedTransactions: true }, [
      'id', 'chargeBoxID', 'timestamp', 'issuer', 'stateOfCharge', 'tagID', 'timezone', 'connectorId', 'meterStart', 'siteAreaID', 'siteID',
      'refundData.reportId', 'refundData.refundedAt', 'refundData.status', 'siteID',
      'stop.price', 'stop.priceUnit', 'stop.inactivityStatus', 'stop.stateOfCharge', 'stop.timestamp', 'stop.totalConsumptionWh',
      'stop.totalDurationSecs', 'stop.totalInactivitySecs', 'billingData.invoiceID'
    ]);
    res.json(transactions);
    next();
  }

  public static async handleGetRefundReports(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.REFUND,
      Action.LIST, Entity.TRANSACTIONS, MODULE_NAME, 'handleGetRefundReports');
    // Check Transaction
    if (!Authorizations.canListTransactions(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.LIST, entity: Entity.TRANSACTIONS,
        module: MODULE_NAME, method: 'handleGetRefundReports'
      });
    }
    // Check Users
    let userProject: string[] = [];
    if (Authorizations.canListUsers(req.user)) {
      userProject = [ 'userID', 'user.id', 'user.name', 'user.firstName', 'user.email' ];
    }
    const filter: any = { stop: { $exists: true } };
    // Filter
    const filteredRequest = TransactionSecurity.filterTransactionsRequest(req.query);
    if (Authorizations.isBasic(req.user)) {
      filter.ownerID = req.user.id;
    }
    if (Utils.isComponentActiveFromToken(req.user, TenantComponents.ORGANIZATION)) {
      if (filteredRequest.SiteAreaID) {
        filter.siteAreaIDs = filteredRequest.SiteAreaID.split('|');
      }
      if (filteredRequest.SiteID) {
        filter.siteID = Authorizations.getAuthorizedSiteAdminIDs(req.user, filteredRequest.SiteID.split('|'));
      }
      filter.siteAdminIDs = Authorizations.getAuthorizedSiteAdminIDs(req.user);
    }
    // Get Reports
    const reports = await TransactionStorage.getRefundReports(req.user.tenantID, filter, {
      limit: filteredRequest.Limit,
      skip: filteredRequest.Skip,
      sort: filteredRequest.Sort,
      onlyRecordCount: filteredRequest.OnlyRecordCount
    }, [
      'id',
      ...userProject
    ]);
    // Return
    res.json(reports);
    next();
  }

  public static async handleExportTransactions(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Export
    await UtilsService.exportToCSV(req, res, 'exported-sessions.csv',
      TransactionService.getCompletedTransactionsToExport.bind(this), TransactionService.convertToCSV.bind(this));
  }

  public static async getCompletedTransactionsToExport(req: Request): Promise<DataResult<Transaction>> {
    // Get transaction
    return TransactionService.getTransactions(req, ServerAction.TRANSACTIONS_EXPORT, { completedTransactions: true }, [
      'id', 'chargeBoxID', 'timestamp', 'issuer', 'stateOfCharge', 'tagID', 'timezone', 'connectorId', 'meterStart', 'siteAreaID', 'siteID',
      'stop.price', 'stop.priceUnit', 'stop.inactivityStatus', 'stop.stateOfCharge', 'stop.timestamp', 'stop.totalConsumptionWh',
      'stop.totalDurationSecs', 'stop.totalInactivitySecs', 'billingData.invoiceID', 'ocpiWithNoCdr'
    ]);
  }

  public static async handleExportTransactionsToRefund(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Export
    await UtilsService.exportToCSV(req, res, 'exported-refund-sessions.csv',
      TransactionService.getRefundedTransactionsToExport.bind(this), TransactionService.convertToCSV.bind(this));
  }

  public static async getRefundedTransactionsToExport(req: Request): Promise<DataResult<Transaction>> {
    return await TransactionService.getTransactions(req, ServerAction.TRANSACTIONS_TO_REFUND_EXPORT, { completedTransactions: true }, [
      'id', 'chargeBoxID', 'timestamp', 'issuer', 'stateOfCharge', 'tagID', 'timezone', 'connectorId', 'meterStart', 'siteAreaID', 'siteID',
      'refundData.reportId', 'refundData.refundedAt', 'refundData.status', 'siteID',
      'stop.price', 'stop.priceUnit', 'stop.inactivityStatus', 'stop.stateOfCharge', 'stop.timestamp', 'stop.totalConsumptionWh',
      'stop.totalDurationSecs', 'stop.totalInactivitySecs', 'billingData.invoiceID'
    ]);
  }

  public static async handleGetTransactionsInError(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check auth
    if (!Authorizations.canListTransactionsInError(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.LIST, entity: Entity.TRANSACTIONS,
        module: MODULE_NAME, method: 'handleGetTransactionsInError'
      });
    }
    const filter: any = {};
    // Filter
    const filteredRequest = TransactionSecurity.filterTransactionsInErrorRequest(req.query);
    // For only charging station in e-Mobility (not the ones from the roaming)
    filter.issuer = true;
    if (filteredRequest.ChargeBoxID) {
      filter.chargeBoxIDs = filteredRequest.ChargeBoxID.split('|');
    }
    if (filteredRequest.UserID) {
      filter.userIDs = filteredRequest.UserID.split('|');
    }
    if (Utils.isComponentActiveFromToken(req.user, TenantComponents.ORGANIZATION)) {
      if (filteredRequest.SiteAreaID) {
        filter.siteAreaIDs = filteredRequest.SiteAreaID.split('|');
      }
      filter.siteIDs = Authorizations.getAuthorizedSiteAdminIDs(req.user, filteredRequest.SiteID ? filteredRequest.SiteID.split('|') : null);
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
      const types = [
        TransactionInErrorType.LONG_INACTIVITY,
        TransactionInErrorType.NEGATIVE_ACTIVITY,
        TransactionInErrorType.NEGATIVE_DURATION,
        // TransactionInErrorType.OVER_CONSUMPTION,
        TransactionInErrorType.INVALID_START_DATE,
        TransactionInErrorType.NO_CONSUMPTION,
        TransactionInErrorType.MISSING_USER
      ];
      if (Utils.isComponentActiveFromToken(req.user, TenantComponents.PRICING)) {
        types.push(TransactionInErrorType.MISSING_PRICE);
      }
      if (Utils.isComponentActiveFromToken(req.user, TenantComponents.BILLING)) {
        types.push(TransactionInErrorType.NO_BILLING_DATA);
      }
      filter.errorType = types;
    }
    // Site Area
    const transactions = await TransactionStorage.getTransactionsInError(req.user.tenantID,
      { ...filter, search: filteredRequest.Search }, [
        'id', 'chargeBoxID', 'timestamp', 'issuer', 'stateOfCharge', 'tagID', 'timezone', 'connectorId',
        'meterStart', 'siteAreaID', 'siteID', 'errorCode', 'uniqueId'
      ]);
    // Return
    res.json(transactions);
    next();
  }

  public static convertToCSV(loggedUser: UserToken, transactions: Transaction[], writeHeader = true): string {
    let csv = '';
    // Header
    if (writeHeader) {
      csv = `ID${Constants.CSV_SEPARATOR}Charging Station${Constants.CSV_SEPARATOR}Connector${Constants.CSV_SEPARATOR}User ID${Constants.CSV_SEPARATOR}User${Constants.CSV_SEPARATOR}Start Date${Constants.CSV_SEPARATOR}Start Time${Constants.CSV_SEPARATOR}End Date${Constants.CSV_SEPARATOR}End Time${Constants.CSV_SEPARATOR}Total Consumption (kW.h)${Constants.CSV_SEPARATOR}Total Duration (Mins)${Constants.CSV_SEPARATOR}Total Inactivity (Mins)${Constants.CSV_SEPARATOR}Price${Constants.CSV_SEPARATOR}Price Unit\r\n`;
    }
    // Content
    for (const transaction of transactions) {
      csv += `${transaction.id}` + Constants.CSV_SEPARATOR;
      csv += `${transaction.chargeBoxID}` + Constants.CSV_SEPARATOR;
      csv += `${transaction.connectorId}` + Constants.CSV_SEPARATOR;
      csv += `${transaction.user ? Cypher.hash(transaction.user.id) : ''}` + Constants.CSV_SEPARATOR;
      csv += `${transaction.user ? Utils.buildUserFullName(transaction.user, false) : ''}` + Constants.CSV_SEPARATOR;
      csv += `${moment(transaction.timestamp).format('YYYY-MM-DD')}` + Constants.CSV_SEPARATOR;
      csv += `${moment(transaction.timestamp).format('HH:mm:ss')}` + Constants.CSV_SEPARATOR;
      csv += `${transaction.stop ? `${moment(transaction.stop.timestamp).format('YYYY-MM-DD')}` : ''}` + Constants.CSV_SEPARATOR;
      csv += `${transaction.stop ? `${moment(transaction.stop.timestamp).format('HH:mm:ss')}` : ''}` + Constants.CSV_SEPARATOR;
      csv += `${transaction.stop ? Math.round(transaction.stop.totalConsumptionWh ? transaction.stop.totalConsumptionWh / 1000 : 0) : ''}` + Constants.CSV_SEPARATOR;
      csv += `${transaction.stop ? Math.round(transaction.stop.totalDurationSecs ? transaction.stop.totalDurationSecs / 60 : 0) : ''}` + Constants.CSV_SEPARATOR;
      csv += `${transaction.stop ? Math.round(transaction.stop.totalInactivitySecs ? transaction.stop.totalInactivitySecs / 60 : 0) : ''}` + Constants.CSV_SEPARATOR;
      csv += `${transaction.stop ? Math.round(transaction.stop.price * 100) / 100 : ''}` + Constants.CSV_SEPARATOR;
      csv += `${transaction.stop ? transaction.stop.priceUnit : ''}\r\n`;
    }
    return csv;
  }

  private static async deleteTransactions(action: ServerAction, loggedUser: UserToken, transactionsIDs: number[]): Promise<ActionsResponse> {
    const transactionsIDsToDelete = [];
    const result: ActionsResponse = {
      inSuccess: 0,
      inError: 0
    };
    // Check if transaction has been refunded
    const refundConnector = await RefundFactory.getRefundImpl(loggedUser.tenantID);
    const billingImpl = await BillingFactory.getBillingImpl(loggedUser.tenantID);
    for (const transactionID of transactionsIDs) {
      // Get
      const transaction = await TransactionStorage.getTransaction(loggedUser.tenantID, transactionID);
      // Not Found
      if (!transaction) {
        result.inError++;
        Logging.logError({
          tenantID: loggedUser.tenantID,
          user: loggedUser,
          module: MODULE_NAME, method: 'handleDeleteTransactions',
          message: `Transaction ID '${transactionID}' does not exist`,
          action: action,
          detailedMessages: { transaction }
        });
        // Already Refunded
      } else if (refundConnector && !refundConnector.canBeDeleted(transaction)) {
        result.inError++;
        Logging.logError({
          tenantID: loggedUser.tenantID,
          user: loggedUser,
          module: MODULE_NAME, method: 'handleDeleteTransactions',
          message: `Transaction ID '${transactionID}' has been refunded and cannot be deleted`,
          action: action,
          detailedMessages: { transaction }
        });
      // Billed
      } else if (billingImpl && transaction.billingData && transaction.billingData.invoiceID) {
        result.inError++;
        Logging.logError({
          tenantID: loggedUser.tenantID,
          user: loggedUser,
          module: MODULE_NAME, method: 'handleDeleteTransactions',
          message: `Transaction ID '${transactionID}' has been billed and cannot be deleted`,
          action: action,
          detailedMessages: { transaction }
        });
      // Transaction in progress
      } else if (!transaction.stop) {
        if (!transaction.chargeBox) {
          transactionsIDsToDelete.push(transactionID);
        } else {
          // Check connector
          const foundConnector = Utils.getConnectorFromID(transaction.chargeBox, transaction.connectorId);
          if (foundConnector && transaction.id === foundConnector.currentTransactionID) {
            // Clear connector
            OCPPUtils.checkAndFreeChargingStationConnector(transaction.chargeBox, transaction.connectorId);
            await ChargingStationStorage.saveChargingStation(loggedUser.tenantID, transaction.chargeBox);
          }
          // To Delete
          transactionsIDsToDelete.push(transactionID);
        }
      // Ok
      } else {
        transactionsIDsToDelete.push(transactionID);
      }
    }
    // Delete All Transactions
    result.inSuccess = await TransactionStorage.deleteTransactions(loggedUser.tenantID, transactionsIDsToDelete);
    // Log
    // Log
    Utils.logActionsResponse(loggedUser.tenantID,
      ServerAction.TRANSACTIONS_DELETE,
      MODULE_NAME, 'synchronizeCarCatalogs', result,
      '{{inSuccess}} transaction(s) were successfully deleted',
      '{{inError}} transaction(s) failed to be deleted',
      '{{inSuccess}} transaction(s) were successfully deleted and {{inError}} failed to be deleted',
      'No transactions have been deleted'
    );
    return result;
  }

  private static async getTransactions(req: Request, action: ServerAction, params: { completedTransactions?: boolean } = {}, projectFields): Promise<DataResult<Transaction>> {
    // Check Transactions
    if (!Authorizations.canListTransactions(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.LIST, entity: Entity.TRANSACTIONS,
        module: MODULE_NAME, method: 'handleGetTransactionsToRefund'
      });
    }
    // Check Users
    if (Authorizations.canListUsers(req.user)) {
      if (projectFields) {
        projectFields = [
          ...projectFields,
          'userID', 'user.id', 'user.name', 'user.firstName', 'user.email',
          'stop.userID', 'stop.user.id', 'stop.user.name', 'stop.user.firstName', 'stop.user.email',
        ];
      }
    }
    // Filter
    const filteredRequest = TransactionSecurity.filterTransactionsRequest(req.query);
    // Build
    const extrafilters: any = {};
    if (Utils.objectHasProperty(params, 'completedTransactions')) {
      extrafilters.stop = params.completedTransactions ? { $exists: true } : { $exists: false };
    }
    // Get the transactions
    const transactions = await TransactionStorage.getTransactions(req.user.tenantID,
      {
        ...extrafilters,
        chargeBoxIDs: filteredRequest.ChargeBoxID ? filteredRequest.ChargeBoxID.split('|') : null,
        issuer: Utils.objectHasProperty(filteredRequest, 'Issuer') ? filteredRequest.Issuer : null,
        userIDs: filteredRequest.UserID ? filteredRequest.UserID.split('|') : null,
        tagIDs: filteredRequest.TagID ? filteredRequest.TagID.split('|') : null,
        ownerID: Authorizations.isBasic(req.user) ? req.user.id : null,
        siteAreaIDs: filteredRequest.SiteAreaID ? filteredRequest.SiteAreaID.split('|') : null,
        siteIDs: filteredRequest.SiteID ? Authorizations.getAuthorizedSiteAdminIDs(req.user, filteredRequest.SiteID.split('|')) : null,
        siteAdminIDs: Authorizations.getAuthorizedSiteAdminIDs(req.user),
        startDateTime: filteredRequest.StartDateTime ? filteredRequest.StartDateTime : null,
        endDateTime: filteredRequest.EndDateTime ? filteredRequest.EndDateTime : null,
        refundStatus: filteredRequest.RefundStatus ? filteredRequest.RefundStatus.split('|') : null,
        minimalPrice: filteredRequest.MinimalPrice ? filteredRequest.MinimalPrice : null,
        statistics: filteredRequest.Statistics ? filteredRequest.Statistics : null,
        search: filteredRequest.Search ? filteredRequest.Search : null,
        reportIDs: filteredRequest.ReportIDs ? filteredRequest.ReportIDs.split('|') : null,
        connectorId: filteredRequest.ConnectorId ? filteredRequest.ConnectorId : null,
        inactivityStatus: filteredRequest.InactivityStatus ? filteredRequest.InactivityStatus.split('|') : null,
      },
      { limit: filteredRequest.Limit, skip: filteredRequest.Skip, sort: filteredRequest.Sort, onlyRecordCount: filteredRequest.OnlyRecordCount },
      projectFields
    );
    return transactions;
  }
}
