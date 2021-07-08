import { Action, Entity } from '../../../../types/Authorization';
import { HTTPAuthError, HTTPError } from '../../../../types/HTTPError';
import { NextFunction, Request, Response } from 'express';
import Transaction, { TransactionAction } from '../../../../types/Transaction';

import { ActionsResponse } from '../../../../types/GlobalType';
import AppAuthError from '../../../../exception/AppAuthError';
import AppError from '../../../../exception/AppError';
import Authorizations from '../../../../authorization/Authorizations';
import BillingFactory from '../../../../integration/billing/BillingFactory';
import { BillingStatus } from '../../../../types/Billing';
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
import TagStorage from '../../../../storage/mongodb/TagStorage';
import Tenant from '../../../../types/Tenant';
import TenantComponents from '../../../../types/TenantComponents';
import TenantStorage from '../../../../storage/mongodb/TenantStorage';
import TransactionSecurity from './security/TransactionSecurity';
import TransactionStorage from '../../../../storage/mongodb/TransactionStorage';
import TransactionValidator from '../validator/TransactionValidator';
import User from '../../../../types/User';
import UserStorage from '../../../../storage/mongodb/UserStorage';
import UserToken from '../../../../types/UserToken';
import Utils from '../../../../utils/Utils';
import UtilsService from './UtilsService';
import moment from 'moment-timezone';

const MODULE_NAME = 'TransactionService';

export default class TransactionService {

  public static async handleGetTransactions(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    res.json(await TransactionService.getTransactions(req, action, {}, [
      'id', 'chargeBoxID', 'timestamp', 'issuer', 'stateOfCharge', 'timezone', 'connectorId', 'meterStart', 'siteAreaID', 'siteID', 'companyID',
      'currentTotalDurationSecs', 'currentTotalInactivitySecs', 'currentInstantWatts', 'currentTotalConsumptionWh', 'currentStateOfCharge',
      'currentCumulatedPrice', 'currentInactivityStatus', 'roundedPrice', 'price', 'priceUnit', 'tagID',
      'stop.roundedPrice', 'stop.price', 'stop.priceUnit', 'stop.inactivityStatus', 'stop.stateOfCharge', 'stop.timestamp', 'stop.totalConsumptionWh',
      'stop.totalDurationSecs', 'stop.totalInactivitySecs', 'stop.extraInactivitySecs', 'stop.meterStop',
      'billingData.stop.invoiceNumber', 'stop.reason', 'ocpi', 'ocpiWithCdr', 'tagID', 'stop.tagID', 'site.name', 'siteArea.name', 'company.name'
    ]));
    next();
  }

  static async handleSynchronizeRefundedTransactions(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!Authorizations.isAdmin(req.user)) {
        throw new AppAuthError({
          errorCode: HTTPAuthError.FORBIDDEN,
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
      await Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }

  public static async handleRefundTransactions(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.REFUND,
      Action.REFUND_TRANSACTION, Entity.TRANSACTION, MODULE_NAME, 'handleRefundTransactions');
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
        await Logging.logError({
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
        await Logging.logError({
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
      if (!await Authorizations.canRefundTransaction(req.user, transaction)) {
        throw new AppAuthError({
          errorCode: HTTPAuthError.FORBIDDEN,
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
    UtilsService.assertObjectExists(action, user, `User ID '${req.user.id}' does not exist`,
      MODULE_NAME, 'handleRefundTransactions', req.user);
    const refundConnector = await RefundFactory.getRefundImpl(req.tenant);
    if (!refundConnector) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'No Refund Implementation Found',
        module: MODULE_NAME, method: 'handleRefundTransactions',
        user: req.user, action: action
      });
    }
    // Check user connection
    try {
      await refundConnector.checkConnection(req.user.id);
    } catch (error) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.REFUND_CONNECTION_ERROR,
        message: 'No Refund valid connection found',
        module: MODULE_NAME, method: 'handleRefundTransactions',
        user: req.user, action: action
      });
    }
    // Refund
    const refundedTransactions = await refundConnector.refund(user.id, transactionsToRefund);
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
    if (!await Authorizations.canUpdateTransaction(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
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
    // No Roaming Cdr to push
    if (!transaction.oicpData?.session && !transaction.ocpiData?.session) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.TRANSACTION_WITH_NO_OCPI_DATA,
        message: `The transaction ID '${transaction.id}' has no OCPI or OICP session data`,
        module: MODULE_NAME, method: 'handlePushTransactionCdr',
        user: req.user, action: action
      });
    }
    // Check OCPI
    if (transaction.ocpiData?.session) {
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
      const ocpiLock = await LockingHelper.acquireOCPIPushCdrLock(req.user.tenantID, transaction.id);
      if (ocpiLock) {
        try {
          // Roaming
          await OCPPUtils.processTransactionRoaming(req.tenant, transaction, chargingStation, TransactionAction.END);
          // Save
          await TransactionStorage.saveTransaction(req.user.tenantID, transaction);
          // Ok
          await Logging.logInfo({
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
    }
    // Check OICP
    if (transaction.oicpData?.session) {
      // CDR already pushed
      if (transaction.oicpData.cdr?.SessionID) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          errorCode: HTTPError.TRANSACTION_CDR_ALREADY_PUSHED,
          message: `The CDR of the transaction ID '${transaction.id}' has already been pushed`,
          module: MODULE_NAME, method: 'handlePushTransactionCdr',
          user: req.user,
          action: action
        });
      }
      // Get the lock
      const oicpLock = await LockingHelper.acquireOICPPushCdrLock(req.user.tenantID, transaction.id);
      if (oicpLock) {
        try {
          // Post CDR
          await OCPPUtils.processOICPTransaction(req.tenant, transaction, chargingStation, TransactionAction.END);
          // Save
          await TransactionStorage.saveTransaction(req.user.tenantID, transaction);
          // Ok
          await Logging.logInfo({
            tenantID: req.user.tenantID,
            action: action,
            user: req.user, actionOnUser: (transaction.user ? transaction.user : null),
            module: MODULE_NAME, method: 'handlePushTransactionCdr',
            message: `CDR of Transaction ID '${transaction.id}' has been pushed successfully`,
            detailedMessages: { cdr: transaction.ocpiData.cdr }
          });
        } finally {
          // Release the lock
          await LockingManager.release(oicpLock);
        }
      }
    }
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleGetUnassignedTransactionsCount(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check Auth
    if (!await Authorizations.canUpdateTransaction(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
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
    const tag = await TagStorage.getTag(req.user.tenantID, filteredRequest.TagID);
    UtilsService.assertObjectExists(action, tag, `Tag ID '${filteredRequest.TagID}' does not exist`,
      MODULE_NAME, 'handleAssignTransactionsToUser', req.user);
    // Get unassigned transactions
    const count = await TransactionStorage.getUnassignedTransactionsCount(req.user.tenantID, tag.id);
    // Return
    res.json(count);
    next();
  }

  public static async handleRebuildTransactionConsumptions(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check Auth
    if (!await Authorizations.canUpdateTransaction(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
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
    UtilsService.assertObjectExists(action, transaction, `Transaction ID '${filteredRequest.ID}' does not exist`,
      MODULE_NAME, 'handleRebuildTransactionConsumptions', req.user);
    // Get unassigned transactions
    const nbrOfConsumptions = await OCPPUtils.rebuildTransactionConsumptions(req.tenant, transaction);
    // Return
    res.json({ nbrOfConsumptions, ...Constants.REST_RESPONSE_SUCCESS });
    next();
  }

  public static async handleAssignTransactionsToUser(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check auths
    if (!await Authorizations.canUpdateTransaction(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
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
    UtilsService.assertObjectExists(action, user, `User ID '${filteredRequest.UserID}' does not exist`,
      MODULE_NAME, 'handleAssignTransactionsToUser', req.user);
    // Get the tag
    const tag = await TagStorage.getTag(req.user.tenantID, filteredRequest.TagID);
    UtilsService.assertObjectExists(action, tag, `Tag ID '${filteredRequest.TagID}' does not exist`,
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
    if (!await Authorizations.canDeleteTransaction(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.DELETE, entity: Entity.TRANSACTION,
        module: MODULE_NAME, method: 'handleDeleteTransaction',
        value: transactionId.toString()
      });
    }
    // Get
    const transaction = await TransactionStorage.getTransaction(req.user.tenantID, transactionId);
    UtilsService.assertObjectExists(action, transaction, `Transaction ID '${transactionId}' does not exist`,
      MODULE_NAME, 'handleDeleteTransaction', req.user);
    // Delete
    const result = await TransactionService.deleteTransactions(action, req.tenant, req.user, [transactionId]);
    res.json({ ...result, ...Constants.REST_RESPONSE_SUCCESS });
    next();
  }

  public static async handleDeleteTransactions(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const transactionsIds = TransactionSecurity.filterTransactionRequestByIDs(req.body);
    // Check auth
    if (!await Authorizations.canDeleteTransaction(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.DELETE, entity: Entity.TRANSACTION,
        module: MODULE_NAME, method: 'handleDeleteTransactions',
        value: transactionsIds.toString()
      });
    }
    // Delete
    const result = await TransactionService.deleteTransactions(action, req.tenant, req.user, transactionsIds);
    res.json({ ...result, ...Constants.REST_RESPONSE_SUCCESS });
    next();
  }

  public static async handleTransactionSoftStop(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const transactionId = TransactionSecurity.filterTransactionSoftStop(req.body);
    // Transaction Id is mandatory
    UtilsService.assertIdIsProvided(action, transactionId, MODULE_NAME, 'handleTransactionSoftStop', req.user);
    // Check auth
    if (!await Authorizations.canUpdateTransaction(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.UPDATE, entity: Entity.TRANSACTION,
        module: MODULE_NAME, method: 'handleTransactionSoftStop',
        value: transactionId.toString()
      });
    }
    // Get Transaction
    const transaction = await TransactionStorage.getTransaction(req.user.tenantID, transactionId);
    UtilsService.assertObjectExists(action, transaction, `Transaction ID ${transactionId} does not exist`,
      MODULE_NAME, 'handleTransactionSoftStop', req.user);
    // Get the Charging Station
    const chargingStation = await ChargingStationStorage.getChargingStation(req.user.tenantID, transaction.chargeBoxID);
    UtilsService.assertObjectExists(action, chargingStation, `Charging Station ID '${transaction.chargeBoxID}' does not exist`,
      MODULE_NAME, 'handleTransactionSoftStop', req.user);
    // Check User
    let user: User;
    if (!transaction.user && transaction.userID) {
      // Get Transaction User
      user = await UserStorage.getUser(req.user.tenantID, transaction.userID);
      UtilsService.assertObjectExists(action, user, `User ID '${transaction.userID}' does not exist`,
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
    await Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      source: chargingStation.id,
      user: req.user, actionOnUser: user,
      module: MODULE_NAME, method: 'handleTransactionSoftStop',
      message: `${OCPPUtils.buildConnectorInfo(transaction.connectorId, transaction.id)} Transaction has been stopped successfully`,
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
    let projectFields = [
      'id', 'chargeBoxID', 'timestamp', 'issuer', 'stateOfCharge', 'timezone', 'connectorId', 'meterStart', 'siteAreaID', 'siteID', 'companyID',
      'currentTotalDurationSecs', 'currentTotalInactivitySecs', 'currentInstantWatts', 'currentTotalConsumptionWh', 'currentStateOfCharge', 'currentInactivityStatus',
      'stop.roundedPrice', 'stop.price', 'stop.priceUnit', 'stop.inactivityStatus', 'stop.stateOfCharge', 'stop.timestamp', 'stop.totalConsumptionWh',
      'stop.totalDurationSecs', 'stop.totalInactivitySecs', 'stop.extraInactivitySecs', 'stop.pricingSource', 'stop.reason',
      'userID',
    ];
    // Check Cars
    if (Utils.isComponentActiveFromToken(req.user, TenantComponents.CAR)) {
      if (await Authorizations.canListCars(req.user)) {
        projectFields = [
          ...projectFields,
          'carCatalog.vehicleMake', 'carCatalog.vehicleModel',
          'carCatalog.vehicleModelVersion', 'carCatalog.image',
        ];
      }
      if (await Authorizations.canUpdateCar(req.user)) {
        projectFields = [
          ...projectFields,
          'car.licensePlate',
        ];
      }
    }
    if ((await Authorizations.canListUsers(req.user)).authorized) {
      projectFields = [
        ...projectFields,
        'userID', 'user.id', 'user.name', 'user.firstName', 'user.email',
        'stop.userID', 'stop.user.id', 'stop.user.name', 'stop.user.firstName', 'stop.user.email', 'stop.tagID', 'tag.visualID'
      ];
    }
    // Get Transaction
    const transaction = await TransactionStorage.getTransaction(req.user.tenantID, filteredRequest.TransactionId, projectFields);
    UtilsService.assertObjectExists(action, transaction, `Transaction ID '${filteredRequest.TransactionId}' does not exist`,
      MODULE_NAME, 'handleGetConsumptionFromTransaction', req.user);
    // Check Transaction
    if (!await Authorizations.canReadTransaction(req.user, transaction)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.READ, entity: Entity.TRANSACTION,
        module: MODULE_NAME, method: 'handleGetConsumptionFromTransaction',
        value: transaction.id.toString()
      });
    }
    // Check User
    if (!(await Authorizations.canReadUser(req.user, { UserID: transaction.userID })).authorized) {
      // Remove User
      delete transaction.user;
      delete transaction.userID;
      delete transaction.tagID;
      if (transaction.stop) {
        delete transaction.stop.user;
        delete transaction.stop.userID;
        delete transaction.stop.tagID;
      }
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
          'startedAt', 'endedAt', 'cumulatedConsumptionWh', 'cumulatedConsumptionAmps', 'cumulatedAmount',
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
          'consumptions.startedAt', 'consumptions.cumulatedConsumptionWh', 'consumptions.cumulatedConsumptionAmps', 'consumptions.cumulatedAmount',
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
      'id', 'chargeBoxID', 'timestamp', 'issuer', 'stateOfCharge', 'tagID', 'timezone', 'connectorId', 'meterStart', 'siteAreaID', 'siteID', 'companyID',
      'userID', 'user.id', 'user.name', 'user.firstName', 'user.email', 'roundedPrice', 'price', 'priceUnit',
      'stop.userID', 'stop.user.id', 'stop.user.name', 'stop.user.firstName', 'stop.user.email',
      'currentTotalDurationSecs', 'currentTotalInactivitySecs', 'currentInstantWatts', 'currentTotalConsumptionWh', 'currentStateOfCharge',
      'currentCumulatedPrice', 'currentInactivityStatus', 'signedData', 'stop.reason',
      'stop.roundedPrice', 'stop.price', 'stop.priceUnit', 'stop.inactivityStatus', 'stop.stateOfCharge', 'stop.timestamp', 'stop.totalConsumptionWh', 'stop.meterStop',
      'stop.totalDurationSecs', 'stop.totalInactivitySecs', 'stop.extraInactivitySecs', 'stop.pricingSource', 'stop.signedData', 'stop.tagID', 'tag.description',
      'billingData.stop.status', 'billingData.stop.invoiceID', 'billingData.stop.invoiceStatus', 'billingData.stop.invoiceNumber',
    ]);
    UtilsService.assertObjectExists(action, transaction, `Transaction ID '${filteredRequest.ID}' does not exist`,
      MODULE_NAME, 'handleGetTransaction', req.user);
    // Check Transaction
    if (!await Authorizations.canReadTransaction(req.user, transaction)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.READ, entity: Entity.TRANSACTION,
        module: MODULE_NAME, method: 'handleGetTransaction',
        value: filteredRequest.ID.toString()
      });
    }
    // Check User
    if (!(await Authorizations.canReadUser(req.user, { UserID: transaction.userID })).authorized) {
      // Remove User
      delete transaction.user;
      delete transaction.userID;
      delete transaction.tagID;
      if (transaction.stop) {
        delete transaction.stop.user;
        delete transaction.stop.userID;
        delete transaction.stop.tagID;
      }
    }
    // Return
    res.json(transaction);
    next();
  }

  public static async handleGetChargingStationTransactions(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Get transaction
    const transactions = await TransactionService.getTransactions(req, action, {}, [
      'id', 'chargeBoxID', 'timestamp', 'issuer', 'stateOfCharge', 'timezone', 'connectorId', 'meterStart', 'siteAreaID', 'siteID', 'companyID',
      'currentTotalDurationSecs', 'currentTotalInactivitySecs', 'currentInstantWatts', 'currentTotalConsumptionWh', 'currentStateOfCharge', 'currentInactivityStatus',
      'stop.roundedPrice', 'stop.price', 'stop.priceUnit', 'stop.inactivityStatus', 'stop.stateOfCharge', 'stop.timestamp', 'stop.totalConsumptionWh',
      'stop.totalDurationSecs', 'stop.totalInactivitySecs', 'stop.extraInactivitySecs', 'site.name', 'siteArea.name', 'company.name',
      'billingData.stop.invoiceNumber', 'stop.reason', 'ocpi', 'ocpiWithCdr', 'tagID', 'stop.tagID',
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
    req.query.Status = 'active';
    const transactions = await TransactionService.getTransactions(req, action, { withTag: true }, [
      'id', 'chargeBoxID', 'timestamp', 'issuer', 'stateOfCharge', 'timezone', 'connectorId', 'status', 'meterStart', 'siteAreaID', 'siteID', 'companyID',
      'currentTotalDurationSecs', 'currentTotalInactivitySecs', 'currentInstantWatts', 'currentTotalConsumptionWh', 'currentStateOfCharge',
      'currentCumulatedPrice', 'currentInactivityStatus', 'roundedPrice', 'price', 'priceUnit', 'tagID', 'site.name', 'siteArea.name', 'company.name', 'tag.visualID'
    ]);
    res.json(transactions);
    next();
  }

  public static async handleGetTransactionsCompleted(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Get transaction
    req.query.Status = 'completed';
    const transactions = await TransactionService.getTransactions(req, action, { withTag: true }, [
      'id', 'chargeBoxID', 'timestamp', 'issuer', 'stateOfCharge', 'timezone', 'connectorId', 'meterStart', 'siteAreaID', 'siteID', 'companyID',
      'stop.roundedPrice', 'stop.price', 'stop.priceUnit', 'stop.inactivityStatus', 'stop.stateOfCharge', 'stop.timestamp', 'stop.totalConsumptionWh',
      'stop.totalDurationSecs', 'stop.totalInactivitySecs', 'stop.extraInactivitySecs', 'stop.meterStop', 'site.name', 'siteArea.name', 'company.name',
      'billingData.stop.invoiceNumber', 'stop.reason', 'ocpi', 'ocpiWithCdr', 'tagID', 'stop.tagID', 'tag.visualID'
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
    req.query.Status = 'completed';
    const transactions = await TransactionService.getTransactions(req, action, {}, [
      'id', 'chargeBoxID', 'timestamp', 'issuer', 'stateOfCharge', 'timezone', 'connectorId', 'meterStart', 'siteAreaID', 'siteID', 'companyID',
      'refundData.reportId', 'refundData.refundedAt', 'refundData.status', 'site.name', 'siteArea.name', 'company.name',
      'stop.roundedPrice', 'stop.price', 'stop.priceUnit', 'stop.inactivityStatus', 'stop.stateOfCharge', 'stop.timestamp', 'stop.totalConsumptionWh',
      'stop.totalDurationSecs', 'stop.totalInactivitySecs', 'stop.extraInactivitySecs', 'billingData.stop.invoiceNumber',
      'tagID', 'stop.tagID', 'stop.reason',
    ]);
    res.json(transactions);
    next();
  }

  public static async handleGetRefundReports(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.REFUND,
      Action.LIST, Entity.TRANSACTIONS, MODULE_NAME, 'handleGetRefundReports');
    // Check Transaction
    if (!await Authorizations.canListTransactions(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.LIST, entity: Entity.TRANSACTIONS,
        module: MODULE_NAME, method: 'handleGetRefundReports'
      });
    }
    // Check Users
    let userProject: string[] = [];
    if ((await Authorizations.canListUsers(req.user)).authorized) {
      userProject = ['userID', 'user.id', 'user.name', 'user.firstName', 'user.email', 'tagID'];
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
      sort: filteredRequest.SortFields,
      onlyRecordCount: filteredRequest.OnlyRecordCount
    },
    ['id', ...userProject]);
    // Return
    res.json(reports);
    next();
  }

  public static async handleExportTransactions(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Export
    await UtilsService.exportToCSV(req, res, 'exported-sessions.csv',
      TransactionService.getCompletedTransactionsToExport.bind(this),
      TransactionService.convertToCSV.bind(this));
  }

  public static async getCompletedTransactionsToExport(req: Request): Promise<DataResult<Transaction>> {
    // Get transaction
    req.query.Status = 'completed';
    return TransactionService.getTransactions(req, ServerAction.TRANSACTIONS_EXPORT, { withTag: true }, [
      'id', 'chargeBoxID', 'timestamp', 'issuer', 'stateOfCharge', 'timezone', 'connectorId', 'meterStart', 'siteAreaID', 'siteID', 'companyID',
      'stop.roundedPrice', 'stop.price', 'stop.priceUnit', 'stop.inactivityStatus', 'stop.stateOfCharge', 'stop.timestamp', 'stop.totalConsumptionWh',
      'stop.totalDurationSecs', 'stop.totalInactivitySecs', 'stop.extraInactivitySecs', 'site.name', 'siteArea.name', 'company.name',
      'billingData.stop.invoiceNumber', 'stop.reason', 'ocpi', 'ocpiWithCdr', 'tagID', 'stop.tagID', 'tag.description'
    ]);
  }

  public static async handleExportTransactionsToRefund(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Export
    await UtilsService.exportToCSV(req, res, 'exported-refund-sessions.csv',
      TransactionService.getRefundedTransactionsToExport.bind(this),
      TransactionService.convertToCSV.bind(this));
  }

  public static async getRefundedTransactionsToExport(req: Request): Promise<DataResult<Transaction>> {
    req.query.Status = 'completed';
    return await TransactionService.getTransactions(req, ServerAction.TRANSACTIONS_TO_REFUND_EXPORT, {}, [
      'id', 'chargeBoxID', 'timestamp', 'issuer', 'stateOfCharge', 'timezone', 'connectorId', 'meterStart', 'siteAreaID', 'siteID', 'companyID',
      'refundData.reportId', 'refundData.refundedAt', 'refundData.status', 'site.name', 'siteArea.name', 'company.name',
      'stop.roundedPrice', 'stop.price', 'stop.priceUnit', 'stop.inactivityStatus', 'stop.stateOfCharge', 'stop.timestamp', 'stop.totalConsumptionWh',
      'stop.totalDurationSecs', 'stop.totalInactivitySecs', 'stop.extraInactivitySecs',
      'billingData.stop.invoiceNumber', 'stop.reason', 'tagID', 'stop.tagID',
    ]);
  }

  public static async handleExportTransactionOcpiCdr(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check auth
    if (!await Authorizations.canListTransactions(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.LIST,
        entity: Entity.TRANSACTIONS,
        module: MODULE_NAME,
        method: 'handleExportTransactionOcpiCdr'
      });
    }
    // Filter
    const filteredRequest = TransactionSecurity.filterTransactionRequest(req.query);
    UtilsService.assertIdIsProvided(action, filteredRequest.ID, MODULE_NAME, 'handleExportTransactionOcpiCdr', req.user);
    // Get Transaction
    const transaction = await TransactionStorage.getTransaction(req.user.tenantID, filteredRequest.ID, ['id', 'ocpiData']);
    UtilsService.assertObjectExists(action, transaction, `Transaction ID '${filteredRequest.ID}' does not exist`,
      MODULE_NAME, 'handleExportTransactionOcpiCdr', req.user);
    // Check
    if (!transaction?.ocpiData) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: `Transaction ID '${transaction.id}' does not contain roaming data`,
        module: MODULE_NAME, method: 'handleExportTransactionOcpiCdr',
        user: req.user,
        action: action
      });
    }
    // Get Ocpi Data
    res.json(transaction.ocpiData.cdr);
    next();
  }

  public static async handleGetTransactionsInError(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check auth
    if (!await Authorizations.canListTransactionsInError(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.IN_ERROR, entity: Entity.TRANSACTIONS,
        module: MODULE_NAME, method: 'handleGetTransactionsInError'
      });
    }
    let projectFields = [
      'id', 'chargeBoxID', 'timestamp', 'issuer', 'stateOfCharge', 'timezone', 'connectorId',
      'meterStart', 'siteAreaID', 'siteID', 'companyID', 'errorCode', 'uniqueId', 'stop.totalConsumptionWh',
      'stop.totalDurationSecs', 'stop.stateOfCharge'
    ];
    // Check Users
    if ((await Authorizations.canListUsers(req.user)).authorized) {
      if (projectFields) {
        projectFields = [
          ...projectFields,
          'userID', 'user.id', 'user.name', 'user.firstName', 'user.email', 'tagID',
          'stop.userID', 'stop.user.id', 'stop.user.name', 'stop.user.firstName', 'stop.user.email', 'stop.tagID'
        ];
      }
    }
    // Check Cars
    if (Utils.isComponentActiveFromToken(req.user, TenantComponents.CAR)) {
      if (await Authorizations.canListCars(req.user)) {
        projectFields = [
          ...projectFields,
          'carCatalog.vehicleMake', 'carCatalog.vehicleModel', 'carCatalog.vehicleModelVersion',
        ];
      }
    }
    const filter: any = {};
    // Filter
    const filteredRequest = TransactionSecurity.filterTransactionsInErrorRequest(req.query);
    // Site Area
    const transactions = await TransactionStorage.getTransactionsInError(req.user.tenantID,
      {
        ...filter, search: filteredRequest.Search,
        issuer: true,
        errorType: filteredRequest.ErrorType ? filteredRequest.ErrorType.split('|') : UtilsService.getTransactionInErrorTypes(req.user),
        endDateTime: filteredRequest.EndDateTime,
        startDateTime: filteredRequest.StartDateTime,
        chargingStationIDs: filteredRequest.ChargingStationID ? filteredRequest.ChargingStationID.split('|') : null,
        siteAreaIDs: filteredRequest.SiteAreaID ? filteredRequest.SiteAreaID.split('|') : null,
        siteIDs: Authorizations.getAuthorizedSiteAdminIDs(req.user, filteredRequest.SiteID ? filteredRequest.SiteID.split('|') : null),
        userIDs: filteredRequest.UserID ? filteredRequest.UserID.split('|') : null,
        connectorIDs: filteredRequest.ConnectorID ? filteredRequest.ConnectorID.split('|').map((connectorID) => Utils.convertToInt(connectorID)) : null,
      },
      {
        limit: filteredRequest.Limit,
        skip: filteredRequest.Skip,
        sort: filteredRequest.SortFields
      },
      projectFields
    );
    // Return
    res.json(transactions);
    next();
  }

  public static convertToCSV(req: Request, transactions: Transaction[], writeHeader = true): string {
    let headers = null;
    // Header
    if (writeHeader) {
      const headerArray = [
        'id',
        'chargingStationID',
        'connectorID',
        'companyName',
        'siteName',
        'siteAreaName',
        'userID',
        'user',
        'tagID',
        'tagDescription',
        'timezone',
        'startDate',
        'startTime',
        'endDate',
        'endTime',
        'totalConsumptionkWh',
        'totalDurationMins',
        'totalInactivityMins',
        'price',
        'priceUnit'
      ];
      headers = headerArray.join(Constants.CSV_SEPARATOR);
    }
    // Content
    const rows = transactions.map((transaction) => {
      const row = [
        transaction.id,
        transaction.chargeBoxID,
        transaction.connectorId,
        transaction.company?.name,
        transaction.site?.name,
        transaction.siteArea?.name,
        transaction.user ? Cypher.hash(transaction.user.id) : '',
        transaction.user ? Utils.buildUserFullName(transaction.user, false) : '',
        transaction.tagID,
        transaction.tag?.description || '',
        transaction.timezone || 'N/A (UTC by default)',
        (transaction.timezone ? moment(transaction.timestamp).tz(transaction.timezone) : moment.utc(transaction.timestamp)).format('YYYY-MM-DD'),
        (transaction.timezone ? moment(transaction.timestamp).tz(transaction.timezone) : moment.utc(transaction.timestamp)).format('HH:mm:ss'),
        (transaction.stop ? (transaction.timezone ? moment(transaction.stop.timestamp).tz(transaction.timezone) : moment.utc(transaction.stop.timestamp)).format('YYYY-MM-DD') : ''),
        (transaction.stop ? (transaction.timezone ? moment(transaction.stop.timestamp).tz(transaction.timezone) : moment.utc(transaction.stop.timestamp)).format('HH:mm:ss') : ''),
        transaction.stop ?
          (transaction.stop.totalConsumptionWh ? Utils.truncTo(Utils.createDecimal(transaction.stop.totalConsumptionWh).div(1000).toNumber(), 2) : 0) : '',
        transaction.stop ?
          (transaction.stop.totalDurationSecs ? Utils.truncTo(Utils.createDecimal(transaction.stop.totalDurationSecs).div(60).toNumber(), 2) : 0) : '',
        transaction.stop ?
          (transaction.stop.totalInactivitySecs ? Utils.truncTo(Utils.createDecimal(transaction.stop.totalInactivitySecs).div(60).toNumber(), 2) : 0) : '',
        transaction.stop ? transaction.stop.roundedPrice : '',
        transaction.stop ? transaction.stop.priceUnit : ''
      ].map((value) => Utils.escapeCsvValue(value));
      return row;
    }).join(Constants.CR_LF);
    return Utils.isNullOrUndefined(headers) ? Constants.CR_LF + rows : [headers, rows].join(Constants.CR_LF);
  }

  private static async deleteTransactions(action: ServerAction, tenant: Tenant, loggedUser: UserToken, transactionsIDs: number[]): Promise<ActionsResponse> {
    const transactionsIDsToDelete = [];
    const result: ActionsResponse = {
      inSuccess: 0,
      inError: 0
    };
    // Check if transaction has been refunded
    const refundConnector = await RefundFactory.getRefundImpl(tenant);
    const billingImpl = await BillingFactory.getBillingImpl(tenant);
    for (const transactionID of transactionsIDs) {
      // Get
      const transaction = await TransactionStorage.getTransaction(loggedUser.tenantID, transactionID);
      // Not Found
      if (!transaction) {
        result.inError++;
        await Logging.logError({
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
        await Logging.logError({
          tenantID: loggedUser.tenantID,
          user: loggedUser,
          module: MODULE_NAME, method: 'handleDeleteTransactions',
          message: `Transaction ID '${transactionID}' has been refunded and cannot be deleted`,
          action: action,
          detailedMessages: { transaction }
        });
        // Billed
      } else if (billingImpl && transaction.billingData?.stop?.status === BillingStatus.BILLED) {
        result.inError++;
        await Logging.logError({
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
            OCPPUtils.checkAndFreeChargingStationConnector(transaction.chargeBox, transaction.connectorId);
            await ChargingStationStorage.saveChargingStationConnectors(loggedUser.tenantID, transaction.chargeBox.id, transaction.chargeBox.connectors);
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
    await Logging.logActionsResponse(loggedUser.tenantID,
      ServerAction.TRANSACTIONS_DELETE,
      MODULE_NAME, 'deleteTransactions', result,
      '{{inSuccess}} transaction(s) were successfully deleted',
      '{{inError}} transaction(s) failed to be deleted',
      '{{inSuccess}} transaction(s) were successfully deleted and {{inError}} failed to be deleted',
      'No transactions have been deleted', loggedUser
    );
    return result;
  }

  private static async getTransactions(req: Request, action: ServerAction,
      params: { completedTransactions?: boolean, withTag?: boolean } = {}, projectFields): Promise<DataResult<Transaction>> {
    // Check Transactions
    if (!await Authorizations.canListTransactions(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.LIST, entity: Entity.TRANSACTIONS,
        module: MODULE_NAME, method: 'handleGetTransactionsToRefund'
      });
    }
    // Check Users
    if ((await Authorizations.canListUsers(req.user)).authorized) {
      if (projectFields) {
        projectFields = [
          ...projectFields,
          'userID', 'user.id', 'user.name', 'user.firstName', 'user.email',
          'stop.userID', 'stop.user.id', 'stop.user.name', 'stop.user.firstName', 'stop.user.email',
        ];
      }
    }
    // Check Cars
    if (Utils.isComponentActiveFromToken(req.user, TenantComponents.CAR)) {
      if (await Authorizations.canListCars(req.user)) {
        projectFields = [
          ...projectFields,
          'carCatalog.vehicleMake', 'carCatalog.vehicleModel', 'carCatalog.vehicleModelVersion',
        ];
      }
      if (await Authorizations.canUpdateCar(req.user)) {
        projectFields = [
          ...projectFields,
          'car.licensePlate',
        ];
      }
    }
    // Filter
    const filteredRequest = TransactionValidator.getInstance().validateTransactionsGetReq(req.query);
    // Build
    const extrafilters: any = {};
    if (Utils.objectHasProperty(params, 'withTag')) {
      extrafilters.withTag = params.withTag;
    }
    if (filteredRequest.Status === 'completed') {
      extrafilters.stop = { $exists: true };
    }
    if (filteredRequest.Status === 'active') {
      extrafilters.stop = { $exists: false };
    }
    // Check projection
    const httpProjectFields = UtilsService.httpFilterProjectToArray(filteredRequest.ProjectFields);
    if (!Utils.isEmptyArray(httpProjectFields)) {
      projectFields = projectFields.filter((projectField) => httpProjectFields.includes(projectField));
    }
    // Get the transactions
    const transactions = await TransactionStorage.getTransactions(req.user.tenantID,
      {
        ...extrafilters,
        chargeBoxIDs: filteredRequest.ChargingStationID ? filteredRequest.ChargingStationID.split('|') : null,
        issuer: Utils.objectHasProperty(filteredRequest, 'Issuer') ? filteredRequest.Issuer : null,
        userIDs: filteredRequest.UserID ? filteredRequest.UserID.split('|') : null,
        visualTagIDs: filteredRequest.VisualTagID ? filteredRequest.VisualTagID.split('|') : null,
        ownerID: Authorizations.isBasic(req.user) ? req.user.id : null,
        withSite: filteredRequest.WithSite,
        withCompany: filteredRequest.WithCompany,
        siteAreaIDs: filteredRequest.SiteAreaID ? filteredRequest.SiteAreaID.split('|') : null,
        withSiteArea: filteredRequest.WithSiteArea,
        siteIDs: filteredRequest.SiteID ? Authorizations.getAuthorizedSiteAdminIDs(req.user, filteredRequest.SiteID.split('|')) : null,
        siteAdminIDs: Authorizations.getAuthorizedSiteAdminIDs(req.user),
        startDateTime: filteredRequest.StartDateTime ? filteredRequest.StartDateTime : null,
        endDateTime: filteredRequest.EndDateTime ? filteredRequest.EndDateTime : null,
        refundStatus: filteredRequest.RefundStatus ? filteredRequest.RefundStatus.split('|') : null,
        minimalPrice: filteredRequest.MinimalPrice ? filteredRequest.MinimalPrice : null,
        statistics: filteredRequest.Statistics ? filteredRequest.Statistics : null,
        search: filteredRequest.Search ? filteredRequest.Search : null,
        reportIDs: filteredRequest.ReportIDs ? filteredRequest.ReportIDs.split('|') : null,
        connectorIDs: filteredRequest.ConnectorID ? filteredRequest.ConnectorID.split('|').map((connectorID) => Utils.convertToInt(connectorID)) : null,
        inactivityStatus: filteredRequest.InactivityStatus ? filteredRequest.InactivityStatus.split('|') : null,
      },
      { limit: filteredRequest.Limit, skip: filteredRequest.Skip, sort: UtilsService.httpSortFieldsToMongoDB(filteredRequest.SortFields), onlyRecordCount: filteredRequest.OnlyRecordCount },
      projectFields
    );
    return transactions;
  }
}
