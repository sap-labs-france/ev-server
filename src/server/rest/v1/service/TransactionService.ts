import { Action, Entity } from '../../../../types/Authorization';
import ChargingStation, { Connector } from '../../../../types/ChargingStation';
import { HTTPAuthError, HTTPError } from '../../../../types/HTTPError';
import { NextFunction, Request, Response } from 'express';
import Tenant, { TenantComponents } from '../../../../types/Tenant';
import Transaction, { AdvenirConsumptionData, AdvenirEvseData, AdvenirPayload, AdvenirTransactionData, TransactionStatus } from '../../../../types/Transaction';

import { ActionsResponse } from '../../../../types/GlobalType';
import AppAuthError from '../../../../exception/AppAuthError';
import AppError from '../../../../exception/AppError';
import Authorizations from '../../../../authorization/Authorizations';
import BillingFactory from '../../../../integration/billing/BillingFactory';
import { BillingStatus } from '../../../../types/Billing';
import ChargingStationService from './ChargingStationService';
import ChargingStationStorage from '../../../../storage/mongodb/ChargingStationStorage';
import ChargingStationValidatorRest from '../validator/ChargingStationValidatorRest';
import Configuration from '../../../../utils/Configuration';
import Constants from '../../../../utils/Constants';
import Consumption from '../../../../types/Consumption';
import ConsumptionStorage from '../../../../storage/mongodb/ConsumptionStorage';
import CpoOCPIClient from '../../../../client/ocpi/CpoOCPIClient';
import { DataResult } from '../../../../types/DataResult';
import { HttpTransactionsGetRequest } from '../../../../types/requests/HttpTransactionRequest';
import Logging from '../../../../utils/Logging';
import LoggingHelper from '../../../../utils/LoggingHelper';
import OCPIClientFactory from '../../../../client/ocpi/OCPIClientFactory';
import OCPIFacade from '../../../ocpi/OCPIFacade';
import { OCPIRole } from '../../../../types/ocpi/OCPIRole';
import OCPPService from '../../../../server/ocpp/services/OCPPService';
import OCPPUtils from '../../../ocpp/utils/OCPPUtils';
import OICPFacade from '../../../oicp/OICPFacade';
import RefundFactory from '../../../../integration/refund/RefundFactory';
import { RefundStatus } from '../../../../types/Refund';
import RoamingUtils from '../../../../utils/RoamingUtils';
import { ServerAction } from '../../../../types/Server';
import SynchronizeRefundTransactionsTask from '../../../../scheduler/tasks/SynchronizeRefundTransactionsTask';
import TagStorage from '../../../../storage/mongodb/TagStorage';
import TransactionStorage from '../../../../storage/mongodb/TransactionStorage';
import TransactionValidatorRest from '../validator/TransactionValidatorRest';
import User from '../../../../types/User';
import UserStorage from '../../../../storage/mongodb/UserStorage';
import UserToken from '../../../../types/UserToken';
import Utils from '../../../../utils/Utils';
import UtilsService from './UtilsService';
import moment from 'moment-timezone';

const MODULE_NAME = 'TransactionService';

export default class TransactionService {
  public static async handleGetTransactions(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = TransactionValidatorRest.getInstance().validateTransactionsGetReq(req.query);
    // Get Transactions
    const transactions = await TransactionService.getTransactions(req, action, {}, filteredRequest, [
      'id', 'chargeBoxID', 'timestamp', 'issuer', 'stateOfCharge', 'timezone', 'connectorId', 'meterStart', 'siteAreaID', 'siteID', 'companyID',
      'currentTotalDurationSecs', 'currentTotalInactivitySecs', 'currentInstantWatts', 'currentTotalConsumptionWh', 'currentStateOfCharge',
      'currentCumulatedPrice', 'currentInactivityStatus', 'roundedPrice', 'price', 'priceUnit',
      'stop.roundedPrice', 'stop.price', 'stop.priceUnit', 'stop.inactivityStatus', 'stop.stateOfCharge', 'stop.timestamp', 'stop.totalConsumptionWh',
      'stop.totalDurationSecs', 'stop.totalInactivitySecs', 'stop.extraInactivitySecs', 'stop.meterStop',
      'billingData.stop.invoiceNumber', 'stop.reason', 'ocpi', 'ocpiWithCdr', 'tagID', 'stop.tagID', 'tag.visualID', 'tag.description', 'stop.tag.visualID',
      'site.name', 'siteArea.name', 'company.name'
    ]);
    res.json(transactions);
    next();
  }

  public static async handleSynchronizeRefundedTransactions(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.REFUND,
      Action.REFUND_TRANSACTION, Entity.TRANSACTION, MODULE_NAME, 'handleSynchronizeRefundedTransactions');
    try {
      if (!Authorizations.isAdmin(req.user)) {
        throw new AppAuthError({
          errorCode: HTTPAuthError.FORBIDDEN,
          user: req.user,
          action: Action.UPDATE, entity: Entity.TRANSACTION,
          module: MODULE_NAME, method: 'handleSynchronizeRefundedTransactions'
        });
      }
      const task = new SynchronizeRefundTransactionsTask();
      await task.processTenant(req.tenant, null);
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
    const filteredRequest = TransactionValidatorRest.getInstance().validateTransactionsByIDsGetReq(req.body);
    if (!filteredRequest.transactionsIDs) {
      // Not Found!
      throw new AppError({
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Transaction IDs must be provided',
        module: MODULE_NAME, method: 'handleRefundTransactions',
        user: req.user,
        action
      });
    }
    const transactionsToRefund: Transaction[] = [];
    for (const transactionId of filteredRequest.transactionsIDs) {
      const transaction = await TransactionStorage.getTransaction(req.tenant, transactionId, { withUser: true });
      if (!transaction) {
        await Logging.logError({
          tenantID: req.tenant.id,
          user: req.user, actionOnUser: (transaction.user ? transaction.user : null),
          module: MODULE_NAME, method: 'handleRefundTransactions',
          message: `Transaction '${transaction.id}' does not exist`,
          action,
          detailedMessages: { transaction }
        });
        continue;
      }
      if (transaction.refundData && !!transaction.refundData.refundId && transaction.refundData.status !== RefundStatus.CANCELLED) {
        await Logging.logError({
          ...LoggingHelper.getTransactionProperties(transaction),
          tenantID: req.tenant.id,
          user: req.user, actionOnUser: (transaction.user ? transaction.user : null),
          module: MODULE_NAME, method: 'handleRefundTransactions',
          message: `Transaction '${transaction.id}' is already refunded`,
          action,
          detailedMessages: { transaction }
        });
        continue;
      }
      // Check auth
      if (!await Authorizations.canRefundTransaction(req.user, transaction)) {
        throw new AppAuthError({
          ...LoggingHelper.getTransactionProperties(transaction),
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
    const user: User = await UserStorage.getUser(req.tenant, req.user.id);
    UtilsService.assertObjectExists(action, user, `User ID '${req.user.id}' does not exist`,
      MODULE_NAME, 'handleRefundTransactions', req.user);
    const refundConnector = await RefundFactory.getRefundImpl(req.tenant);
    if (!refundConnector) {
      throw new AppError({
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'No Refund Implementation Found',
        module: MODULE_NAME, method: 'handleRefundTransactions',
        user: req.user, action
      });
    }
    // Check user connection
    try {
      await refundConnector.checkConnection(req.user.id);
    } catch (error) {
      throw new AppError({
        errorCode: HTTPError.REFUND_CONNECTION_ERROR,
        message: 'No Refund valid connection found',
        module: MODULE_NAME, method: 'handleRefundTransactions',
        user: req.user, action
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
    // Check if component is active
    if (!Utils.isComponentActiveFromToken(req.user, TenantComponents.OCPI) &&
        !Utils.isComponentActiveFromToken(req.user, TenantComponents.OICP)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        entity: Entity.TRANSACTION, action: Action.UPDATE,
        module: MODULE_NAME, method: 'handlePushTransactionCdr',
        inactiveComponent: `${TenantComponents.OCPI}, ${TenantComponents.OICP}` as TenantComponents,
        user: req.user
      });
    }
    // Filter
    const filteredRequest = TransactionValidatorRest.getInstance().validateTransactionCdrPushReq(req.body);
    // Check Mandatory fields
    UtilsService.assertIdIsProvided(action, filteredRequest.transactionId, MODULE_NAME, 'handlePushTransactionCdr', req.user);
    // Check Transaction
    const transaction = await TransactionStorage.getTransaction(req.tenant, filteredRequest.transactionId, { withUser: true, withTag: true });
    UtilsService.assertObjectExists(action, transaction, `Transaction ID '${filteredRequest.transactionId}' does not exist`,
      MODULE_NAME, 'handlePushTransactionCdr', req.user);
    // Check auth
    if (!await Authorizations.canUpdateTransaction(req.user, transaction)) {
      throw new AppAuthError({
        ...LoggingHelper.getTransactionProperties(transaction),
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.UPDATE, entity: Entity.TRANSACTION,
        module: MODULE_NAME, method: 'handlePushTransactionCdr',
        value: filteredRequest.transactionId.toString()
      });
    }
    // Check Charging Station
    const chargingStation = await ChargingStationStorage.getChargingStation(req.tenant, transaction.chargeBoxID, { withSiteArea: true });
    UtilsService.assertObjectExists(action, chargingStation, `Charging Station ID '${transaction.chargeBoxID}' does not exist`,
      MODULE_NAME, 'handlePushTransactionCdr', req.user);
    // Check Charging Station
    if (!chargingStation.issuer) {
      throw new AppError({
        ...LoggingHelper.getTransactionProperties(transaction),
        errorCode: HTTPError.GENERAL_ERROR,
        message: `${Utils.buildConnectorInfo(transaction.connectorId, transaction.id)} Charging Station belongs to an external organization`,
        module: MODULE_NAME, method: 'handlePushTransactionCdr',
        user: req.user, action
      });
    }
    if (!chargingStation.public) {
      throw new AppError({
        ...LoggingHelper.getTransactionProperties(transaction),
        errorCode: HTTPError.GENERAL_ERROR,
        message: `${Utils.buildConnectorInfo(transaction.connectorId, transaction.id)} Charging Station is not public`,
        module: MODULE_NAME, method: 'handlePushTransactionCdr',
        user: req.user, action
      });
    }
    if (chargingStation.siteArea && !chargingStation.siteArea.accessControl) {
      throw new AppError({
        ...LoggingHelper.getTransactionProperties(transaction),
        errorCode: HTTPError.GENERAL_ERROR,
        message: `${Utils.buildConnectorInfo(transaction.connectorId, transaction.id)} Charging Station access control is inactive on Site Area '${chargingStation.siteArea.name}'`,
        module: MODULE_NAME, method: 'handlePushTransactionCdr',
        user: req.user, action
      });
    }
    // Check Transaction
    if (!transaction.issuer) {
      throw new AppError({
        ...LoggingHelper.getTransactionProperties(transaction),
        errorCode: HTTPError.TRANSACTION_NOT_FROM_TENANT,
        message: `${Utils.buildConnectorInfo(transaction.connectorId, transaction.id)} Transaction belongs to an external organization`,
        module: MODULE_NAME, method: 'handlePushTransactionCdr',
        user: req.user, action
      });
    }
    // No Roaming Cdr to push
    if (!transaction.oicpData?.session && !transaction.ocpiData?.session) {
      throw new AppError({
        ...LoggingHelper.getTransactionProperties(transaction),
        errorCode: HTTPError.TRANSACTION_WITH_NO_OCPI_DATA,
        message: `${Utils.buildConnectorInfo(transaction.connectorId, transaction.id)} No OCPI or OICP Session data`,
        module: MODULE_NAME, method: 'handlePushTransactionCdr',
        user: req.user, action
      });
    }
    // Check OCPI
    if (transaction.ocpiData?.session) {
      // CDR already pushed
      if (transaction.ocpiData.cdr?.id) {
        throw new AppError({
          ...LoggingHelper.getTransactionProperties(transaction),
          errorCode: HTTPError.TRANSACTION_CDR_ALREADY_PUSHED,
          message: `The CDR of the Transaction ID '${transaction.id}' has already been pushed`,
          module: MODULE_NAME, method: 'handlePushTransactionCdr',
          user: req.user, action
        });
      }
      // OCPI: Post the CDR
      const ocpiCdrSent = await OCPIFacade.checkAndSendTransactionCdr(
        req.tenant, transaction, chargingStation, chargingStation.siteArea, action);
      if (!ocpiCdrSent) {
        throw new AppError({
          ...LoggingHelper.getTransactionProperties(transaction),
          errorCode: HTTPError.GENERAL_ERROR,
          message: `The CDR of the Transaction ID '${transaction.id}' has not been sent`,
          module: MODULE_NAME, method: 'handlePushTransactionCdr',
          user: req.user, action
        });
      }
      // Save
      await TransactionStorage.saveTransactionOcpiData(req.tenant, transaction.id, transaction.ocpiData);
      await Logging.logInfo({
        ...LoggingHelper.getTransactionProperties(transaction),
        tenantID: req.tenant.id,
        action, module: MODULE_NAME, method: 'handlePushTransactionCdr',
        user: req.user, actionOnUser: (transaction.user ? transaction.user : null),
        message: `CDR of Transaction ID '${transaction.id}' has been pushed successfully`,
        detailedMessages: { cdr: transaction.ocpiData.cdr }
      });
    }
    // Check OICP
    if (transaction.oicpData?.session) {
      // CDR already pushed
      if (transaction.oicpData.cdr?.SessionID) {
        throw new AppError({
          ...LoggingHelper.getTransactionProperties(transaction),
          errorCode: HTTPError.TRANSACTION_CDR_ALREADY_PUSHED,
          message: `The CDR of the transaction ID '${transaction.id}' has already been pushed`,
          module: MODULE_NAME, method: 'handlePushTransactionCdr',
          user: req.user, action
        });
      }
      // OICP: Post the CDR
      const oicpCdrSent = await OICPFacade.checkAndSendTransactionCdr(
        req.tenant, transaction, chargingStation, chargingStation.siteArea, action);
      if (!oicpCdrSent) {
        throw new AppError({
          ...LoggingHelper.getTransactionProperties(transaction),
          errorCode: HTTPError.GENERAL_ERROR,
          message: `The CDR of the Transaction ID '${transaction.id}' has not been sent`,
          module: MODULE_NAME, method: 'handlePushTransactionCdr',
          user: req.user, action
        });
      }
      // Save
      await TransactionStorage.saveTransactionOicpData(req.tenant, transaction.id, transaction.oicpData);
      await Logging.logInfo({
        ...LoggingHelper.getTransactionProperties(transaction),
        tenantID: req.tenant.id,
        user: req.user, actionOnUser: (transaction.user ?? null),
        action, module: MODULE_NAME, method: 'handlePushTransactionCdr',
        message: `CDR of Transaction ID '${transaction.id}' has been pushed successfully`,
        detailedMessages: { cdr: transaction.ocpiData.cdr }
      });
    }
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleDeleteTransaction(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const transactionID = TransactionValidatorRest.getInstance().validateTransactionDeleteReq(req.query).ID;
    // Check auth
    if (!await Authorizations.canDeleteTransaction(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.DELETE, entity: Entity.TRANSACTION,
        module: MODULE_NAME, method: 'handleDeleteTransaction',
        value: transactionID.toString()
      });
    }
    // Get
    const transaction = await TransactionStorage.getTransaction(req.tenant, transactionID);
    UtilsService.assertObjectExists(action, transaction, `Transaction ID '${transactionID}' does not exist`,
      MODULE_NAME, 'handleDeleteTransaction', req.user);
    // Delete
    const result = await TransactionService.deleteTransactions(action, req.tenant, req.user, [transactionID]);
    res.json({ ...result, ...Constants.REST_RESPONSE_SUCCESS });
    next();
  }

  public static async handleDeleteTransactions(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const transactionsIDs = TransactionValidatorRest.getInstance().validateTransactionsByIDsGetReq(req.body).transactionsIDs;
    // Check auth
    if (!await Authorizations.canDeleteTransaction(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.DELETE, entity: Entity.TRANSACTION,
        module: MODULE_NAME, method: 'handleDeleteTransactions',
        value: transactionsIDs.toString()
      });
    }
    // Delete
    const result = await TransactionService.deleteTransactions(action, req.tenant, req.user, transactionsIDs);
    res.json({ ...result, ...Constants.REST_RESPONSE_SUCCESS });
    next();
  }

  public static async handleTransactionStart(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const remoteStartRequest = ChargingStationValidatorRest.getInstance().validateChargingStationActionTransactionStartReq(req.body);
    // Get data
    const { chargingStation } = await TransactionService.checkAndGetChargingStationConnector(
      action, req.tenant, req.user, remoteStartRequest.chargingStationID, remoteStartRequest.args.connectorId);
    // Handle the routing
    if (chargingStation.issuer) {
      // OCPP Remote Start
      await ChargingStationService.handleOcppAction(
        ServerAction.CHARGING_STATION_REMOTE_START_TRANSACTION, req, res, next);
    } else {
      // OCPI Remote Start
      await ChargingStationService.handleOcpiAction(
        ServerAction.OCPI_EMSP_START_SESSION, req, res, next);
    }
  }

  public static async handleTransactionStop(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const transactionID = TransactionValidatorRest.getInstance().validateTransactionStopReq(req.body).ID;
    UtilsService.assertIdIsProvided(action, transactionID, MODULE_NAME, 'handleTransactionStop', req.user);
    // Get data
    const { transaction, chargingStation, connector } =
      await TransactionService.checkAndGetTransactionChargingStationConnector(action, req.tenant, req.user, transactionID);
    req.body.chargingStationID = transaction.chargeBoxID;
    req.body.args = { transactionId: transaction.id };
    // Handle the routing
    if (chargingStation.issuer) {
      // OCPP Remote Stop
      if (!chargingStation.inactive && connector.currentTransactionID === transaction.id) {
        await ChargingStationService.handleOcppAction(ServerAction.CHARGING_STATION_REMOTE_STOP_TRANSACTION, req, res, next);
      // Transaction Soft Stop
      } else {
        await TransactionService.transactionSoftStop(ServerAction.TRANSACTION_SOFT_STOP,
          transaction, chargingStation, connector, req, res, next);
      }
    } else {
      // eslint-disable-next-line no-lonely-if
      if (connector.currentTransactionID === transaction.id) {
        // OCPI Remote Stop
        await ChargingStationService.handleOcpiAction(ServerAction.OCPI_EMSP_STOP_SESSION, req, res, next);
      } else {
        await TransactionService.transactionSoftStop(ServerAction.TRANSACTION_SOFT_STOP,
          transaction, chargingStation, connector, req, res, next);
      }
    }
  }

  public static async handleTransactionSoftStop(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const transactionID = TransactionValidatorRest.getInstance().validateTransactionStopReq(req.body).ID;
    UtilsService.assertIdIsProvided(action, transactionID, MODULE_NAME, 'handleTransactionSoftStop', req.user);
    // Get data
    const { transaction, chargingStation, connector } =
      await TransactionService.checkAndGetTransactionChargingStationConnector(action, req.tenant, req.user, transactionID);
    // Soft Stop
    await TransactionService.transactionSoftStop(action, transaction, chargingStation, connector, req, res, next);
  }

  public static async handleGetTransactionConsumption(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = TransactionValidatorRest.getInstance().validateTransactionConsumptionsGetReq(req.query);
    // Transaction Id is mandatory
    UtilsService.assertIdIsProvided(action, filteredRequest.TransactionId, MODULE_NAME,
      'handleGetConsumptionFromTransaction', req.user);
    let projectFields = [
      'id', 'chargeBoxID', 'timestamp', 'issuer', 'stateOfCharge', 'timezone', 'connectorId', 'meterStart', 'siteAreaID', 'siteID', 'companyID',
      'currentTotalDurationSecs', 'currentTotalInactivitySecs', 'currentInstantWatts', 'currentTotalConsumptionWh', 'currentStateOfCharge', 'currentInactivityStatus',
      'stop.roundedPrice', 'stop.price', 'stop.priceUnit', 'stop.inactivityStatus', 'stop.stateOfCharge', 'stop.timestamp', 'stop.totalConsumptionWh',
      'stop.totalDurationSecs', 'stop.totalInactivitySecs', 'stop.extraInactivitySecs', 'stop.pricingSource', 'stop.reason',
      'userID', 'priceUnit'
    ];
    // Check Cars
    if (Utils.isComponentActiveFromToken(req.user, TenantComponents.CAR)) {
      if (await Authorizations.canListCars(req.user)) {
        projectFields = [
          ...projectFields,
          'carID' ,'carCatalogID', 'carCatalog.vehicleMake', 'carCatalog.vehicleModel',
          'carCatalog.vehicleModelVersion',
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
        'userID', 'user.id', 'user.name', 'user.firstName', 'user.email', 'tagID', 'tag.visualID',
        'stop.userID', 'stop.user.id', 'stop.user.name', 'stop.user.firstName', 'stop.user.email', 'stop.tagID', 'stop.tag.visualID'
      ];
    }
    // Get Transaction
    const transaction = await TransactionStorage.getTransaction(req.tenant, filteredRequest.TransactionId,
      { withTag: filteredRequest.WithTag, withCar: filteredRequest.WithCar, withUser: filteredRequest.WithUser }, projectFields);
    UtilsService.assertObjectExists(action, transaction, `Transaction ID '${filteredRequest.TransactionId}' does not exist`,
      MODULE_NAME, 'handleGetConsumptionFromTransaction', req.user);
    // Check Transaction
    if (!await Authorizations.canReadTransaction(req.user, transaction)) {
      throw new AppAuthError({
        ...LoggingHelper.getTransactionProperties(transaction),
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
        ...LoggingHelper.getTransactionProperties(transaction),
        errorCode: HTTPError.GENERAL_ERROR,
        message: `The requested start date '${new Date(filteredRequest.StartDateTime).toISOString()}' is after the requested end date '${new Date(filteredRequest.StartDateTime).toISOString()}' `,
        module: MODULE_NAME, method: 'handleGetConsumptionFromTransaction',
        user: req.user, action
      });
    }
    // Get the consumption
    let consumptions: Consumption[];
    if (filteredRequest.LoadAllConsumptions) {
      const consumptionsMDB = await ConsumptionStorage.getTransactionConsumptions(
        req.tenant, { transactionId: transaction.id }, Constants.DB_PARAMS_MAX_LIMIT, [
          'startedAt', 'endedAt', 'cumulatedConsumptionWh', 'cumulatedConsumptionAmps', 'cumulatedAmount',
          'stateOfCharge', 'limitWatts', 'limitAmps',
          'instantVoltsDC', 'instantVolts', 'instantVoltsL1', 'instantVoltsL2', 'instantVoltsL3',
          'instantWattsDC', 'instantWatts', 'instantWattsL1', 'instantWattsL2', 'instantWattsL3',
          'instantAmpsDC', 'instantAmps', 'instantAmpsL1', 'instantAmpsL2', 'instantAmpsL3'
        ]
      );
      consumptions = consumptionsMDB.result;
    } else {
      consumptions = (await ConsumptionStorage.getOptimizedTransactionConsumptions(
        req.tenant, { transactionId: transaction.id }, [
          'startedAt', 'endedAt', 'cumulatedConsumptionWh', 'cumulatedConsumptionAmps', 'cumulatedAmount',
          'stateOfCharge', 'limitWatts', 'limitAmps',
          'instantVoltsDC', 'instantVolts', 'instantVoltsL1', 'instantVoltsL2', 'instantVoltsL3',
          'instantWattsDC', 'instantWatts', 'instantWattsL1', 'instantWattsL2', 'instantWattsL3',
          'instantAmpsDC', 'instantAmps', 'instantAmpsL1', 'instantAmpsL2', 'instantAmpsL3'
        ])).result;
    }
    // Assign
    transaction.values = consumptions;
    // Return the result
    res.json(transaction);
    next();
  }

  public static async handleGetTransactionConsumptionForAdvenir(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.OCPI,
      Action.READ, Entity.TRANSACTION, MODULE_NAME, 'handleGetTransactionConsumptionForAdvenir');
    // Filter
    const filteredRequest = TransactionValidatorRest.getInstance().validateTransactionConsumptionsAdvenirGetReq(req.query);
    // Transaction Id is mandatory
    UtilsService.assertIdIsProvided(action, filteredRequest.TransactionId, MODULE_NAME,
      'handleGetConsumptionFromTransaction', req.user);
    const projectFields = [
      'id', 'chargeBox.issuer', 'chargeBox.id', 'chargeBox.issuer', 'chargeBox.public', 'chargeBox.connectors', 'connectorId',
    ];
    // Get Transaction
    const transaction = await TransactionStorage.getTransaction(req.tenant, filteredRequest.TransactionId,
      { withChargingStation: true }, projectFields);
    UtilsService.assertObjectExists(action, transaction, `Transaction ID '${filteredRequest.TransactionId}' does not exist`,
      MODULE_NAME, 'handleGetTransactionConsumptionForAdvenir', req.user);
    // Check Transaction
    if (!await Authorizations.canReadTransaction(req.user, transaction)) {
      throw new AppAuthError({
        ...LoggingHelper.getTransactionProperties(transaction),
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.READ, entity: Entity.TRANSACTION,
        module: MODULE_NAME, method: 'handleGetTransactionConsumptionForAdvenir',
        value: transaction.id.toString()
      });
    }
    try {
      const ocpiClient = await OCPIClientFactory.getAvailableOcpiClient(req.tenant, OCPIRole.CPO) as CpoOCPIClient;
      if (!ocpiClient) {
        throw new AppError({
          errorCode: HTTPError.GENERAL_ERROR,
          message: 'OCPI component requires at least one CPO endpoint to generate Advenir consumption data',
          module: MODULE_NAME, method: 'handleGetTransactionConsumptionForAdvenir',
          user: req.user, action
        });
      }
      // Build EvseID
      const evseID = RoamingUtils.buildEvseID(ocpiClient.getLocalCountryCode(action), ocpiClient.getLocalPartyID(action), transaction.chargeBox, transaction.connectorId);
      // Get Consumption
      const consumptions = await ConsumptionStorage.getOptimizedTransactionConsumptions(req.tenant,
        { transactionId: transaction.id },
        // ACHTUNG - endedAt must be part of the projection to properly sort the collection result
        ['startedAt', 'endedAt', 'cumulatedConsumptionWh']
      );
      // Convert consumptions to the ADVENIR format
      const advenirValues: AdvenirConsumptionData[] = consumptions.result.map(
        (consumption) => {
          // Unix epoch format expected
          const timestamp = Utils.createDecimal(consumption.startedAt.getTime()).div(1000).toNumber();
          return {
            timestamp,
            value: consumption.cumulatedConsumptionWh
          };
        }
      );
      // Add Advenir user Id if exists
      const userID = filteredRequest.AdvenirUserId ?? '<put-here-the-advenir-cpo-id>';
      // Prepare ADVENIR payload
      const transactionID = `${transaction.id}`;
      const transactionData: AdvenirTransactionData = {
        [transactionID]:
          advenirValues
      };
      const evseData: AdvenirEvseData = {
        [evseID]: transactionData
      };
      const advenirPayload: AdvenirPayload = {
        [userID]: evseData
      };
      res.json(advenirPayload);
    } catch (error) {
      await Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }

  public static async handleGetTransaction(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = TransactionValidatorRest.getInstance().validateTransactionGetReq(req.query);
    UtilsService.assertIdIsProvided(action, filteredRequest.ID, MODULE_NAME, 'handleGetTransaction', req.user);
    // Get Transaction
    const transaction = await TransactionStorage.getTransaction(req.tenant, filteredRequest.ID,
      { withTag: filteredRequest.WithTag, withCar: filteredRequest.WithCar, withUser: filteredRequest.WithUser },
      [
        'id', 'chargeBoxID', 'timestamp', 'issuer', 'stateOfCharge', 'tagID', 'tag.visualID', 'tag.description', 'timezone', 'connectorId', 'meterStart', 'siteAreaID', 'siteID', 'companyID',
        'userID', 'user.id', 'user.name', 'user.firstName', 'user.email', 'roundedPrice', 'price', 'priceUnit',
        'stop.userID', 'stop.user.id', 'stop.user.name', 'stop.user.firstName', 'stop.user.email',
        'currentTotalDurationSecs', 'currentTotalInactivitySecs', 'currentInstantWatts', 'currentTotalConsumptionWh', 'currentStateOfCharge',
        'currentCumulatedPrice', 'currentInactivityStatus', 'signedData', 'stop.reason',
        'stop.roundedPrice', 'stop.price', 'stop.priceUnit', 'stop.inactivityStatus', 'stop.stateOfCharge', 'stop.timestamp', 'stop.totalConsumptionWh', 'stop.meterStop',
        'stop.totalDurationSecs', 'stop.totalInactivitySecs', 'stop.extraInactivitySecs', 'stop.pricingSource', 'stop.signedData',
        'stop.tagID', 'stop.tag.visualID', 'stop.tag.description', 'billingData.stop.status', 'billingData.stop.invoiceID', 'billingData.stop.invoiceItem',
        'billingData.stop.invoiceStatus', 'billingData.stop.invoiceNumber',
        'carID' ,'carCatalogID', 'carCatalog.vehicleMake', 'carCatalog.vehicleModel', 'carCatalog.vehicleModelVersion',
        'pricingModel'
      ]
    );
    UtilsService.assertObjectExists(action, transaction, `Transaction ID '${filteredRequest.ID}' does not exist`,
      MODULE_NAME, 'handleGetTransaction', req.user);
    // Check Transaction
    if (!await Authorizations.canReadTransaction(req.user, transaction)) {
      throw new AppAuthError({
        ...LoggingHelper.getTransactionProperties(transaction),
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.READ, entity: Entity.TRANSACTION,
        module: MODULE_NAME, method: 'handleGetTransaction',
        value: filteredRequest.ID.toString()
      });
    }
    // Check and Get User
    let user: User;
    try {
      user = await UtilsService.checkAndGetUserAuthorization(
        req.tenant, req.user, transaction.userID, Action.READ, action, null, null, true);
    } catch (error) {
      // Ignore
    }
    // Check User
    if (!user) {
      // Remove User
      delete transaction.user;
      delete transaction.userID;
      delete transaction.tag;
      delete transaction.tagID;
      delete transaction.carCatalogID;
      delete transaction.carCatalog;
      delete transaction.carID;
      delete transaction.car;
      delete transaction.billingData;

      if (transaction.stop) {
        delete transaction.stop.user;
        delete transaction.stop.userID;
        delete transaction.stop.tagID;
      }
    }
    res.json(transaction);
    next();
  }

  public static async handleGetChargingStationTransactions(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = TransactionValidatorRest.getInstance().validateTransactionsGetReq(req.query);
    // Get Transactions
    const transactions = await TransactionService.getTransactions(req, action, {}, filteredRequest, [
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
    const transactionsYears = await TransactionStorage.getTransactionYears(req.tenant);
    const result: any = {};
    if (transactionsYears) {
      result.years = [];
      result.years.push(new Date().getFullYear());
    }
    res.json(transactionsYears);
    next();
  }

  public static async handleGetTransactionsActive(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    req.query.Status = TransactionStatus.ACTIVE;
    // Filter
    const filteredRequest = TransactionValidatorRest.getInstance().validateTransactionsGetReq(req.query);
    // Get Transactions
    const transactions = await TransactionService.getTransactions(req, action, {}, filteredRequest, [
      'id', 'chargeBoxID', 'timestamp', 'issuer', 'stateOfCharge', 'timezone', 'connectorId', 'status', 'meterStart', 'siteAreaID', 'siteID', 'companyID',
      'currentTotalDurationSecs', 'currentTotalInactivitySecs', 'currentInstantWatts', 'currentTotalConsumptionWh', 'currentStateOfCharge',
      'currentCumulatedPrice', 'currentInactivityStatus', 'roundedPrice', 'price', 'priceUnit', 'tagID', 'tag.visualID', 'tag.description', 'site.name', 'siteArea.name', 'company.name'
    ]);
    res.json(transactions);
    next();
  }

  public static async handleGetTransactionsCompleted(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Get transaction
    req.query.Status = TransactionStatus.COMPLETED;
    // Filter
    const filteredRequest = TransactionValidatorRest.getInstance().validateTransactionsGetReq(req.query);
    // Get Transactions
    const transactions = await TransactionService.getTransactions(req, action, {}, filteredRequest, [
      'id', 'chargeBoxID', 'timestamp', 'issuer', 'stateOfCharge', 'timezone', 'connectorId', 'meterStart', 'siteAreaID', 'siteID', 'companyID',
      'stop.roundedPrice', 'stop.price', 'stop.priceUnit', 'stop.inactivityStatus', 'stop.stateOfCharge', 'stop.timestamp', 'stop.totalConsumptionWh',
      'stop.totalDurationSecs', 'stop.totalInactivitySecs', 'stop.extraInactivitySecs', 'stop.meterStop',
      'site.name', 'siteArea.name', 'company.name',
      'billingData.stop.invoiceNumber', 'stop.reason', 'ocpi', 'ocpiWithCdr', 'tagID', 'tag.visualID', 'tag.description', 'stop.tagID', 'stop.tag.visualID'
    ]);
    res.json(transactions);
    next();
  }

  public static async handleGetTransactionsToRefund(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.REFUND,
      Action.LIST, Entity.TRANSACTION, MODULE_NAME, 'handleGetTransactionsToRefund');
    // Set filter
    req.query.issuer = 'true';
    req.query.Status = TransactionStatus.COMPLETED;
    // Filter
    const filteredRequest = TransactionValidatorRest.getInstance().validateTransactionsGetReq(req.query);
    // Get Transactions
    const transactions = await TransactionService.getTransactions(req, action, {}, filteredRequest, [
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
      Action.LIST, Entity.TRANSACTION, MODULE_NAME, 'handleGetRefundReports');
    // Check Transaction
    if (!await Authorizations.canListTransactions(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.LIST, entity: Entity.TRANSACTION,
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
    const filteredRequest = TransactionValidatorRest.getInstance().validateTransactionsGetReq(req.query);
    if (Authorizations.isBasic(req.user)) {
      filter.ownerID = req.user.id;
    }
    if (Utils.isComponentActiveFromToken(req.user, TenantComponents.ORGANIZATION)) {
      if (filteredRequest.SiteAreaID) {
        filter.siteAreaIDs = filteredRequest.SiteAreaID.split('|');
      }
      if (filteredRequest.SiteID) {
        filter.siteID = await Authorizations.getAuthorizedSiteAdminIDs(req.tenant, req.user, filteredRequest.SiteID.split('|'));
      }
      filter.siteAdminIDs = await Authorizations.getAuthorizedSiteAdminIDs(req.tenant, req.user);
    }
    // Get Reports
    const reports = await TransactionStorage.getRefundReports(req.tenant, filter, {
      limit: filteredRequest.Limit,
      skip: filteredRequest.Skip,
      sort: filteredRequest.SortFields,
      onlyRecordCount: filteredRequest.OnlyRecordCount
    },
    ['id', ...userProject]);
    res.json(reports);
    next();
  }

  public static async handleExportTransactions(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Force params
    req.query.Limit = Constants.EXPORT_PAGE_SIZE.toString();
    req.query.Status = TransactionStatus.COMPLETED;
    req.query.WithTag = 'true';
    // Filter
    const filteredRequest = TransactionValidatorRest.getInstance().validateTransactionsGetReq(req.query);
    // Export
    await UtilsService.exportToCSV(req, res, 'exported-sessions.csv', filteredRequest,
      TransactionService.getCompletedTransactionsToExport.bind(this),
      TransactionService.convertToCSV.bind(this));
  }

  public static async handleExportTransactionsToRefund(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Force params
    req.query.Limit = Constants.EXPORT_PAGE_SIZE.toString();
    req.query.Status = TransactionStatus.COMPLETED;
    // Filter
    const filteredRequest = TransactionValidatorRest.getInstance().validateTransactionsGetReq(req.query);
    // Export
    await UtilsService.exportToCSV(req, res, 'exported-refund-sessions.csv', filteredRequest,
      TransactionService.getRefundedTransactionsToExport.bind(this),
      TransactionService.convertToCSV.bind(this));
  }

  public static async handleExportTransactionOcpiCdr(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check auth
    if (!await Authorizations.canListTransactions(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.LIST,
        entity: Entity.TRANSACTION,
        module: MODULE_NAME,
        method: 'handleExportTransactionOcpiCdr'
      });
    }
    // Filter
    const filteredRequest = TransactionValidatorRest.getInstance().validateTransactionCdrExportReq(req.query);
    UtilsService.assertIdIsProvided(action, filteredRequest.ID, MODULE_NAME, 'handleExportTransactionOcpiCdr', req.user);
    // Get Transaction
    const transaction = await TransactionStorage.getTransaction(req.tenant, filteredRequest.ID, {}, ['id', 'ocpiData']);
    UtilsService.assertObjectExists(action, transaction, `Transaction ID '${filteredRequest.ID}' does not exist`,
      MODULE_NAME, 'handleExportTransactionOcpiCdr', req.user);
    if (!transaction?.ocpiData) {
      throw new AppError({
        ...LoggingHelper.getTransactionProperties(transaction),
        errorCode: HTTPError.GENERAL_ERROR,
        message: `Transaction ID '${transaction.id}' does not contain roaming data`,
        module: MODULE_NAME, method: 'handleExportTransactionOcpiCdr',
        user: req.user, action
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
        action: Action.IN_ERROR, entity: Entity.TRANSACTION,
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
          'carID' ,'carCatalogID', 'carCatalog.vehicleMake', 'carCatalog.vehicleModel', 'carCatalog.vehicleModelVersion',
        ];
      }
    }
    const filter: any = {};
    // Filter
    const filteredRequest = TransactionValidatorRest.getInstance().validateTransactionsInErrorGetReq(req.query);
    // Site Area
    const transactions = await TransactionStorage.getTransactionsInError(req.tenant,
      {
        ...filter, search: filteredRequest.Search,
        issuer: true,
        errorType: filteredRequest.ErrorType ? filteredRequest.ErrorType.split('|') : UtilsService.getTransactionInErrorTypes(req.user),
        endDateTime: filteredRequest.EndDateTime,
        startDateTime: filteredRequest.StartDateTime,
        chargingStationIDs: filteredRequest.ChargingStationID ? filteredRequest.ChargingStationID.split('|') : null,
        siteAreaIDs: filteredRequest.SiteAreaID ? filteredRequest.SiteAreaID.split('|') : null,
        siteIDs: await Authorizations.getAuthorizedSiteAdminIDs(req.tenant, req.user, filteredRequest.SiteID ? filteredRequest.SiteID.split('|') : null),
        userIDs: filteredRequest.UserID ? filteredRequest.UserID.split('|') : null,
        connectorIDs: filteredRequest.ConnectorID ? filteredRequest.ConnectorID.split('|').map((connectorID) => Utils.convertToInt(connectorID)) : null,
      },
      {
        limit: filteredRequest.Limit,
        skip: filteredRequest.Skip,
        sort: UtilsService.httpSortFieldsToMongoDB(filteredRequest.SortFields)
      },
      projectFields
    );
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
        'visualTagID',
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
        transaction.user ? transaction.user.id : '',
        transaction.user ? Utils.buildUserFullName(transaction.user, false) : '',
        transaction.tagID,
        transaction.tag?.visualID,
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
      const transaction = await TransactionStorage.getTransaction(tenant, transactionID);
      // Not Found
      if (!transaction) {
        result.inError++;
        await Logging.logError({
          tenantID: loggedUser.tenantID,
          user: loggedUser,
          action, module: MODULE_NAME, method: 'handleDeleteTransactions',
          message: `Transaction ID '${transactionID}' does not exist`,
          detailedMessages: { transaction }
        });
        continue;
      }
      // Already Refunded
      if (refundConnector && !refundConnector.canBeDeleted(transaction)) {
        result.inError++;
        await Logging.logError({
          ...LoggingHelper.getTransactionProperties(transaction),
          tenantID: loggedUser.tenantID,
          user: loggedUser,
          action, module: MODULE_NAME, method: 'handleDeleteTransactions',
          message: `Transaction ID '${transactionID}' has been refunded and cannot be deleted`,
          detailedMessages: { transaction }
        });
        continue;
      }
      // Billed
      if (billingImpl && transaction.billingData?.stop?.status === BillingStatus.BILLED) {
        result.inError++;
        await Logging.logError({
          ...LoggingHelper.getTransactionProperties(transaction),
          tenantID: loggedUser.tenantID,
          user: loggedUser,
          action, module: MODULE_NAME, method: 'handleDeleteTransactions',
          message: `Transaction ID '${transactionID}' has been billed and cannot be deleted`,
          detailedMessages: { transaction }
        });
        continue;
      }
      // Transaction in progress
      if (!transaction.stop) {
        if (!transaction.chargeBox) {
          transactionsIDsToDelete.push(transactionID);
        } else {
          // Check connector
          const foundConnector = Utils.getConnectorFromID(transaction.chargeBox, transaction.connectorId);
          if (foundConnector && transaction.id === foundConnector.currentTransactionID) {
            OCPPUtils.clearChargingStationConnectorRuntimeData(transaction.chargeBox, transaction.connectorId);
            await ChargingStationStorage.saveChargingStationConnectors(tenant,
              transaction.chargeBox.id, transaction.chargeBox.connectors);
          }
          // To Delete
          transactionsIDsToDelete.push(transactionID);
        }
        continue;
      }
      transactionsIDsToDelete.push(transactionID);
    }
    // Delete All Transactions
    result.inSuccess = await TransactionStorage.deleteTransactions(tenant, transactionsIDsToDelete);
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

  private static async getTransactions(req: Request, action: ServerAction, params: { completedTransactions?: boolean, withTag?: boolean } = {},
      filteredRequest: HttpTransactionsGetRequest, projectFields): Promise<DataResult<Transaction>> {
    // Check Transactions
    if (!await Authorizations.canListTransactions(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.LIST, entity: Entity.TRANSACTION,
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
          'carID' ,'carCatalogID', 'carCatalog.vehicleMake', 'carCatalog.vehicleModel', 'carCatalog.vehicleModelVersion',
        ];
      }
      if (await Authorizations.canUpdateCar(req.user)) {
        projectFields = [
          ...projectFields,
          'car.licensePlate',
        ];
      }
    }
    // Check projection
    const httpProjectFields = UtilsService.httpFilterProjectToArray(filteredRequest.ProjectFields);
    if (!Utils.isEmptyArray(httpProjectFields)) {
      projectFields = projectFields.filter((projectField) => httpProjectFields.includes(projectField));
    }
    // Get Tag IDs from Visual IDs
    if (filteredRequest.VisualTagID) {
      const tagIDs = await TagStorage.getTags(req.tenant, { visualIDs: filteredRequest.VisualTagID.split('|') }, Constants.DB_PARAMS_MAX_LIMIT, ['id']);
      if (!Utils.isEmptyArray(tagIDs.result)) {
        filteredRequest.TagID = tagIDs.result.map((tag) => tag.id).join('|');
      }
    }
    // Get the transactions
    const transactions = await TransactionStorage.getTransactions(req.tenant,
      {
        status: filteredRequest.Status as TransactionStatus,
        chargingStationIDs: filteredRequest.ChargingStationID ? filteredRequest.ChargingStationID.split('|') : null,
        issuer: Utils.objectHasProperty(filteredRequest, 'Issuer') ? filteredRequest.Issuer : null,
        userIDs: filteredRequest.UserID ? filteredRequest.UserID.split('|') : null,
        tagIDs: filteredRequest.TagID ? filteredRequest.TagID.split('|') : null,
        ownerID: Authorizations.isBasic(req.user) ? req.user.id : null,
        withTag: filteredRequest.WithTag,
        withUser: filteredRequest.WithUser,
        withChargingStation: filteredRequest.WithChargingStation,
        withCar: filteredRequest.WithCar,
        withSite: filteredRequest.WithSite,
        withCompany: filteredRequest.WithCompany,
        siteAreaIDs: filteredRequest.SiteAreaID ? filteredRequest.SiteAreaID.split('|') : null,
        withSiteArea: filteredRequest.WithSiteArea,
        siteIDs: filteredRequest.SiteID ? await Authorizations.getAuthorizedSiteAdminIDs(req.tenant, req.user, filteredRequest.SiteID.split('|')) : null,
        siteAdminIDs: await Authorizations.getAuthorizedSiteAdminIDs(req.tenant, req.user),
        startDateTime: filteredRequest.StartDateTime ? filteredRequest.StartDateTime : null,
        endDateTime: filteredRequest.EndDateTime ? filteredRequest.EndDateTime : null,
        refundStatus: filteredRequest.RefundStatus ? filteredRequest.RefundStatus.split('|') as RefundStatus[] : null,
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

  private static async getCompletedTransactionsToExport(req: Request, filteredRequest: HttpTransactionsGetRequest): Promise<DataResult<Transaction>> {
    // Get Transactions
    return TransactionService.getTransactions(req, ServerAction.TRANSACTIONS_EXPORT, {}, filteredRequest, [
      'id', 'chargeBoxID', 'timestamp', 'issuer', 'stateOfCharge', 'timezone', 'connectorId', 'meterStart', 'siteAreaID', 'siteID', 'companyID',
      'stop.roundedPrice', 'stop.price', 'stop.priceUnit', 'stop.inactivityStatus', 'stop.stateOfCharge', 'stop.timestamp', 'stop.totalConsumptionWh',
      'stop.totalDurationSecs', 'stop.totalInactivitySecs', 'stop.extraInactivitySecs', 'site.name', 'siteArea.name', 'company.name',
      'billingData.stop.invoiceNumber', 'stop.reason', 'ocpi', 'ocpiWithCdr', 'tagID', 'stop.tagID', 'tag.description', 'stop.tag.description', 'tag.visualID', 'stop.tag.visualID'
    ]);
  }

  private static async getRefundedTransactionsToExport(req: Request, filteredRequest: HttpTransactionsGetRequest): Promise<DataResult<Transaction>> {
    // Get Transactions
    return TransactionService.getTransactions(req, ServerAction.TRANSACTIONS_TO_REFUND_EXPORT, {}, filteredRequest, [
      'id', 'chargeBoxID', 'timestamp', 'issuer', 'stateOfCharge', 'timezone', 'connectorId', 'meterStart', 'siteAreaID', 'siteID', 'companyID',
      'refundData.reportId', 'refundData.refundedAt', 'refundData.status', 'site.name', 'siteArea.name', 'company.name',
      'stop.roundedPrice', 'stop.price', 'stop.priceUnit', 'stop.inactivityStatus', 'stop.stateOfCharge', 'stop.timestamp', 'stop.totalConsumptionWh',
      'stop.totalDurationSecs', 'stop.totalInactivitySecs', 'stop.extraInactivitySecs',
      'billingData.stop.invoiceNumber', 'stop.reason', 'tagID', 'stop.tagID',
    ]);
  }

  private static async transactionSoftStop(action: ServerAction, transaction: Transaction, chargingStation: ChargingStation,
      connector: Connector, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if already stopped
    if (transaction.stop) {
      // Clear Connector
      if (connector.currentTransactionID === transaction.id) {
        OCPPUtils.clearChargingStationConnectorRuntimeData(chargingStation, transaction.connectorId);
        await ChargingStationStorage.saveChargingStationConnectors(req.tenant, chargingStation.id, chargingStation.connectors);
      }
      await Logging.logInfo({
        ...LoggingHelper.getTransactionProperties(transaction),
        tenantID: req.tenant.id,
        user: req.user, actionOnUser: transaction.userID,
        action, module: MODULE_NAME, method: 'transactionSoftStop',
        message: `${Utils.buildConnectorInfo(transaction.connectorId, transaction.id)} Transaction has already been stopped`,
      });
    } else {
      // Transaction is still ongoing
      if (!chargingStation.inactive && connector.currentTransactionID === transaction.id) {
        throw new AppError({
          ...LoggingHelper.getTransactionProperties(transaction),
          errorCode: HTTPError.GENERAL_ERROR,
          message: `${Utils.buildConnectorInfo(transaction.connectorId, transaction.id)} Cannot soft stop an ongoing Transaction`,
          module: MODULE_NAME, method: 'transactionSoftStop',
          user: req.user, action
        });
      }
      // Stop Transaction
      const success = await new OCPPService(Configuration.getChargingStationConfig()).softStopTransaction(
        req.tenant, transaction, chargingStation, chargingStation.siteArea);
      if (!success) {
        throw new AppError({
          ...LoggingHelper.getTransactionProperties(transaction),
          errorCode: HTTPError.GENERAL_ERROR,
          message: `${Utils.buildConnectorInfo(transaction.connectorId, transaction.id)} Transaction cannot be stopped`,
          module: MODULE_NAME, method: 'transactionSoftStop',
          user: req.user, action
        });
      }
      await Logging.logInfo({
        ...LoggingHelper.getTransactionProperties(transaction),
        tenantID: req.tenant.id,
        user: req.user, actionOnUser: transaction.userID,
        module: MODULE_NAME, method: 'transactionSoftStop',
        message: `${Utils.buildConnectorInfo(transaction.connectorId, transaction.id)} Transaction has been soft stopped successfully`,
        action, detailedMessages: { transaction }
      });
    }
    res.json(Constants.REST_CHARGING_STATION_COMMAND_RESPONSE_SUCCESS);
    next();
  }

  private static async checkAndGetTransactionChargingStationConnector(action: ServerAction, tenant: Tenant, user: UserToken,
      transactionID: number): Promise<{ transaction: Transaction; chargingStation: ChargingStation; connector: Connector; }> {
    // Get Transaction
    const transaction = await TransactionStorage.getTransaction(tenant, transactionID);
    UtilsService.assertObjectExists(action, transaction, `Transaction ID ${transactionID} does not exist`,
      MODULE_NAME, 'checkAndGetTransactionChargingStationConnector', user);
    // Check auth
    if (!await Authorizations.canUpdateTransaction(user, transaction)) {
      throw new AppAuthError({
        ...LoggingHelper.getTransactionProperties(transaction),
        errorCode: HTTPAuthError.FORBIDDEN,
        user, action: Action.UPDATE, entity: Entity.TRANSACTION,
        module: MODULE_NAME, method: 'checkAndGetTransactionChargingStationConnector',
        value: transactionID.toString()
      });
    }
    const { chargingStation, connector } =
      await TransactionService.checkAndGetChargingStationConnector(action, tenant, user, transaction.chargeBoxID, transaction.connectorId);
    return { transaction, chargingStation, connector };
  }

  private static async checkAndGetChargingStationConnector(action: ServerAction, tenant: Tenant, user: UserToken,
      chargingStationID: string, connectorID: number): Promise<{ chargingStation: ChargingStation; connector: Connector; }> {
    // Get the Charging Station
    const chargingStation = await ChargingStationStorage.getChargingStation(tenant, chargingStationID, { withSiteArea: true });
    UtilsService.assertObjectExists(action, chargingStation, `Charging Station ID '${chargingStationID}' does not exist`,
      MODULE_NAME, 'checkAndGetChargingStationConnector', user);
    // Check connector
    const connector = Utils.getConnectorFromID(chargingStation, connectorID);
    if (!connector) {
      throw new AppError({
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        errorCode: HTTPError.GENERAL_ERROR,
        message: `${Utils.buildConnectorInfo(connectorID)} The Connector ID has not been found`,
        user, action, module: MODULE_NAME, method: 'checkAndGetChargingStationConnector',
      });
    }
    return { chargingStation, connector };
  }
}
