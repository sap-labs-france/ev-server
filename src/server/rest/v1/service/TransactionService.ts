import { Action, Entity } from '../../../../types/Authorization';
import ChargingStation, { Connector } from '../../../../types/ChargingStation';
import { HTTPAuthError, HTTPError } from '../../../../types/HTTPError';
import { NextFunction, Request, Response } from 'express';
import Tenant, { TenantComponents } from '../../../../types/Tenant';
import Transaction, { AdvenirConsumptionData, AdvenirEvseData, AdvenirPayload, AdvenirTransactionData, TransactionStatus } from '../../../../types/Transaction';

import { ActionsResponse } from '../../../../types/GlobalType';
import AppAuthError from '../../../../exception/AppAuthError';
import AppError from '../../../../exception/AppError';
import AuthorizationService from './AuthorizationService';
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
    const transactions = await TransactionService.getTransactions(req, filteredRequest);
    res.json(transactions);
    next();
  }

  public static async handleSynchronizeRefundedTransactions(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.REFUND,
      Action.REFUND_TRANSACTION, Entity.TRANSACTION, MODULE_NAME, 'handleSynchronizeRefundedTransactions');
    // Check dynamic auth
    await AuthorizationService.checkAndGetTransactionsAuthorizations(req.tenant, req.user, Action.SYNCHRONIZE_REFUNDED_TRANSACTION);
    try {
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
    const transactionsToRefund: Transaction[] = [];
    for (const transactionId of filteredRequest.transactionsIDs) {
      // Check dynamic auth
      const transaction = await UtilsService.checkAndGetTransactionAuthorization(req.tenant, req.user, transactionId,
        Action.REFUND_TRANSACTION, action, null, { withUser: true }, true);
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
      transactionsToRefund.push(transaction);
    }
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
    const refundedTransactions = await refundConnector.refund(req.user.id, transactionsToRefund);
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
        entity: Entity.TRANSACTION, action: Action.PUSH_TRANSACTION_CDR,
        module: MODULE_NAME, method: 'handlePushTransactionCdr',
        inactiveComponent: `${TenantComponents.OCPI}, ${TenantComponents.OICP}` as TenantComponents,
        user: req.user
      });
    }
    // Filter
    const filteredRequest = TransactionValidatorRest.getInstance().validateTransactionCdrPushReq(req.body);
    // Check Transaction
    const transaction = await UtilsService.checkAndGetTransactionAuthorization(req.tenant, req.user, filteredRequest.transactionId,
      Action.PUSH_TRANSACTION_CDR, action, null, { withUser: true, withTag: true });
    // Check Charging Station
    const chargingStation = await UtilsService.checkAndGetChargingStationAuthorization(
      req.tenant, req.user, transaction.chargeBoxID, Action.PUSH_TRANSACTION_CDR, action, null, { withSiteArea: true });
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
    // Delete
    const result = await TransactionService.deleteTransactions(action, req.tenant, req.user, [transactionID]);
    res.json({ ...result, ...Constants.REST_RESPONSE_SUCCESS });
    next();
  }

  public static async handleDeleteTransactions(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const transactionsIDs = TransactionValidatorRest.getInstance().validateTransactionsByIDsGetReq(req.body).transactionsIDs;
    // Delete
    const result = await TransactionService.deleteTransactions(action, req.tenant, req.user, transactionsIDs);
    res.json({ ...result, ...Constants.REST_RESPONSE_SUCCESS });
    next();
  }

  public static async handleTransactionStart(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const remoteStartRequest = ChargingStationValidatorRest.getInstance().validateChargingStationActionTransactionStartReq(req.body);
    // Check dynamic auth
    const { chargingStation } = await TransactionService.checkAndGetChargingStationConnector(
      action, req.tenant, req.user, remoteStartRequest.chargingStationID, remoteStartRequest.args.connectorId, Action.REMOTE_START_TRANSACTION);
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
    // Get data
    const { transaction, chargingStation, connector } =
      await TransactionService.checkAndGetTransactionChargingStationConnector(action, req.tenant, req.user, transactionID, Action.REMOTE_STOP_TRANSACTION);
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
    // Get data
    const { transaction, chargingStation, connector } =
      await TransactionService.checkAndGetTransactionChargingStationConnector(action, req.tenant, req.user, transactionID, Action.REMOTE_STOP_TRANSACTION);
    // Soft Stop
    await TransactionService.transactionSoftStop(action, transaction, chargingStation, connector, req, res, next);
  }

  public static async handleGetTransactionConsumption(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = TransactionValidatorRest.getInstance().validateTransactionConsumptionsGetReq(req.query);
    // Check dynamic auth
    const transaction = await UtilsService.checkAndGetTransactionAuthorization(req.tenant, req.user, filteredRequest.TransactionId, Action.READ,
      action, null, { withTag: filteredRequest.WithTag, withCar: filteredRequest.WithCar, withUser: filteredRequest.WithUser }, true);
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
    // Check consumption dynamic auth
    const authorizations = await AuthorizationService.checkAndGetConsumptionsAuthorizations(req.tenant, req.user, Action.LIST, null, true);
    let consumptions: Consumption[];
    if (filteredRequest.LoadAllConsumptions) {
      const consumptionsMDB = await ConsumptionStorage.getTransactionConsumptions(
        req.tenant,
        {
          transactionId: transaction.id
        },
        Constants.DB_PARAMS_MAX_LIMIT,
        authorizations.projectFields
      );
      consumptions = consumptionsMDB.result;
    } else {
      consumptions = (await ConsumptionStorage.getOptimizedTransactionConsumptions(
        req.tenant,
        {
          transactionId: transaction.id
        },
        authorizations.projectFields
      )).result;
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
    // Get dynamic auth
    const transaction = await UtilsService.checkAndGetTransactionAuthorization(req.tenant, req.user, filteredRequest.TransactionId, Action.GET_ADVENIR_CONSUMPTION,
      action, null, { withChargingStation: true }, true);
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
      // Check consumption dynamic auth
      const authorizations = await AuthorizationService.checkAndGetConsumptionsAuthorizations(req.tenant, req.user, Action.GET_ADVENIR_CONSUMPTION, null, true);
      // Get Consumption
      const consumptions = await ConsumptionStorage.getOptimizedTransactionConsumptions(req.tenant,
        { transactionId: transaction.id },
        // ACHTUNG - endedAt must be part of the projection to properly sort the collection result
        authorizations.projectFields
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
    // Check dynamic auth
    const transaction = await UtilsService.checkAndGetTransactionAuthorization(req.tenant, req.user, filteredRequest.ID, Action.READ,
      action, null, { withTag: filteredRequest.WithTag, withCar: filteredRequest.WithCar, withUser: filteredRequest.WithUser }, true);
    res.json(transaction);
    next();
  }

  public static async handleGetChargingStationTransactions(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = TransactionValidatorRest.getInstance().validateTransactionsGetReq(req.query);
    // Get Transactions
    const transactions = await TransactionService.getTransactions(req, filteredRequest, Action.GET_CHARGING_STATION_TRANSACTIONS);
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
    const transactions = await TransactionService.getTransactions(req, filteredRequest, Action.GET_ACTIVE_TRANSACTION);
    res.json(transactions);
    next();
  }

  public static async handleGetTransactionsCompleted(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Get transaction
    req.query.Status = TransactionStatus.COMPLETED;
    // Filter
    const filteredRequest = TransactionValidatorRest.getInstance().validateTransactionsGetReq(req.query);
    // Get Transactions
    const transactions = await TransactionService.getTransactions(req, filteredRequest, Action.GET_COMPLETED_TRANSACTION);
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
    const transactions = await TransactionService.getTransactions(req, filteredRequest, Action.GET_TO_REFUND_TRANSACTION);
    res.json(transactions);
    next();
  }

  public static async handleGetRefundReports(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.REFUND,
      Action.LIST, Entity.TRANSACTION, MODULE_NAME, 'handleGetRefundReports');

    // Filter request
    const filteredRequest = TransactionValidatorRest.getInstance().validateTransactionsGetReq(req.query);
    // Check dyna;ic auth
    const authorizations = await AuthorizationService.checkAndGetTransactionsAuthorizations(req.tenant, req.user, Action.GET_REFUND_REPORT, filteredRequest);


    // Get Reports
    const reports = await TransactionStorage.getRefundReports(
      req.tenant,
      {
        siteIDs: (filteredRequest.SiteID ? filteredRequest.SiteID.split('|') : null),
        siteAreaIDs: filteredRequest.SiteAreaID ? filteredRequest.SiteAreaID.split('|') : null,
        ...authorizations.filters
      },
      {
        limit: filteredRequest.Limit,
        skip: filteredRequest.Skip,
        sort: filteredRequest.SortFields,
        onlyRecordCount: filteredRequest.OnlyRecordCount
      },
      authorizations.projectFields);
    // Add Auth flags
    await AuthorizationService.addRefundReportsAuthorizations(
      req.tenant, req.user, reports.result, authorizations);
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
      TransactionService.getTransactions_new.bind(this, req, filteredRequest, Action.EXPORT_COMPLETED_TRANSACTION),
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
      TransactionService.getTransactions_new.bind(this, req, filteredRequest, Action.GET_TO_REFUND_TRANSACTION),
      TransactionService.convertToCSV.bind(this));
  }

  public static async handleExportTransactionOcpiCdr(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = TransactionValidatorRest.getInstance().validateTransactionCdrExportReq(req.query);
    // Get Transaction
    const transaction = await UtilsService.checkAndGetTransactionAuthorization(req.tenant, req.user, filteredRequest.ID, Action.EXPORT_OCPI_CDR, action);
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
    const authorizations = await AuthorizationService.checkAndGetTransactionsAuthorizations(req.tenant, req.user, Action.IN_ERROR);
    // Filter
    const filteredRequest = TransactionValidatorRest.getInstance().validateTransactionsInErrorGetReq(req.query);
    // Site Area
    const transactions = await TransactionStorage.getTransactionsInError(req.tenant,
      {
        search: filteredRequest.Search,
        issuer: true,
        errorType: filteredRequest.ErrorType ? filteredRequest.ErrorType.split('|') : UtilsService.getTransactionInErrorTypes(req.user),
        endDateTime: filteredRequest.EndDateTime,
        startDateTime: filteredRequest.StartDateTime,
        chargingStationIDs: filteredRequest.ChargingStationID ? filteredRequest.ChargingStationID.split('|') : null,
        siteAreaIDs: filteredRequest.SiteAreaID ? filteredRequest.SiteAreaID.split('|') : null,
        siteIDs: await Authorizations.getAuthorizedSiteAdminIDs(req.tenant, req.user, filteredRequest.SiteID ? filteredRequest.SiteID.split('|') : null),
        userIDs: filteredRequest.UserID ? filteredRequest.UserID.split('|') : null,
        connectorIDs: filteredRequest.ConnectorID ? filteredRequest.ConnectorID.split('|').map((connectorID) => Utils.convertToInt(connectorID)) : null,
        ...authorizations.filters
      },
      {
        limit: filteredRequest.Limit,
        skip: filteredRequest.Skip,
        sort: UtilsService.httpSortFieldsToMongoDB(filteredRequest.SortFields)
      },
      authorizations.projectFields
    );
    // Assign projected fields
    if (authorizations.projectFields) {
      transactions.projectFields = authorizations.projectFields;
    }
    // Add Auth flags
    await AuthorizationService.addTransactionsInErrorAuthorizations(req.tenant, req.user, transactions, authorizations);

    res.json(transactions);
    next();
  }

  private static convertToCSV(req: Request, transactions: Transaction[], writeHeader = true): string {
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
    // Check dynamic auth for each transaction before initiating delete operations
    for (const transactionID of transactionsIDs) {
      await UtilsService.checkAndGetTransactionAuthorization(tenant, loggedUser, transactionID, Action.DELETE, action);
    }
    const refundConnector = await RefundFactory.getRefundImpl(tenant);
    const billingImpl = await BillingFactory.getBillingImpl(tenant);
    // Check if transaction can be deleted
    for (const transactionID of transactionsIDs) {
      // Get transaction
      const transaction = await UtilsService.checkAndGetTransactionAuthorization(tenant, loggedUser, transactionID, Action.DELETE, action);
      // Transaction refunded
      if (refundConnector && !refundConnector.canBeDeleted(transaction)) {
        result.inError++;
        await Logging.logError({
          ...LoggingHelper.getTransactionProperties(transaction),
          tenantID: loggedUser.tenantID,
          user: loggedUser,
          action, module: MODULE_NAME, method: 'handleDeleteTransactions',
          message: `Transaction ID '${transaction.id}' has been refunded and cannot be deleted`,
          detailedMessages: { transaction }
        });
        continue;
      }
      // Transaction billed
      if (billingImpl && transaction.billingData?.stop?.status === BillingStatus.BILLED) {
        result.inError++;
        await Logging.logError({
          ...LoggingHelper.getTransactionProperties(transaction),
          tenantID: loggedUser.tenantID,
          user: loggedUser,
          action, module: MODULE_NAME, method: 'handleDeleteTransactions',
          message: `Transaction ID '${transaction.id}' has been billed and cannot be deleted`,
          detailedMessages: { transaction }
        });
        continue;
      }
      // Transaction in progress
      if (!transaction.stop) {
        if (!transaction.chargeBox) {
          transactionsIDsToDelete.push(transaction.id);
        } else {
          // Check connector
          const foundConnector = Utils.getConnectorFromID(transaction.chargeBox, transaction.connectorId);
          if (foundConnector && transaction.id === foundConnector.currentTransactionID) {
            OCPPUtils.clearChargingStationConnectorRuntimeData(transaction.chargeBox, transaction.connectorId);
            await ChargingStationStorage.saveChargingStationConnectors(tenant,
              transaction.chargeBox.id, transaction.chargeBox.connectors);
          }
          // To Delete
          transactionsIDsToDelete.push(transaction.id);
        }
        continue;
      }
      transactionsIDsToDelete.push(transaction.id);
    }
    // Delete only valid transactions, and log the ones we skipped / failed to delete
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

  private static async getTransactions(req: Request, filteredRequest: HttpTransactionsGetRequest,
      authAction: Action = Action.LIST, additionalFilters: Record<string, any> = {}): Promise<DataResult<Transaction>> {

    // Get authorization filters
    const authorizations = await AuthorizationService.checkAndGetTransactionsAuthorizations(
      req.tenant, req.user, authAction, filteredRequest, false);
    if (!authorizations.authorized) {
      return Constants.DB_EMPTY_DATA_RESULT;
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
        search: filteredRequest.Search ? filteredRequest.Search : null,
        status: filteredRequest.Status ,
        chargingStationIDs: filteredRequest.ChargingStationID ? filteredRequest.ChargingStationID.split('|') : null,
        issuer: Utils.objectHasProperty(filteredRequest, 'Issuer') ? filteredRequest.Issuer : null,
        userIDs: filteredRequest.UserID ? filteredRequest.UserID.split('|') : null,
        tagIDs: filteredRequest.TagID ? filteredRequest.TagID.split('|') : null,
        withTag: filteredRequest.WithTag,
        withUser: filteredRequest.WithUser,
        withChargingStation: filteredRequest.WithChargingStation,
        withCar: filteredRequest.WithCar,
        withSite: filteredRequest.WithSite,
        withCompany: filteredRequest.WithCompany,
        withSiteArea: filteredRequest.WithSiteArea,
        siteIDs: (filteredRequest.SiteID ? filteredRequest.SiteID.split('|') : null),
        siteAreaIDs: filteredRequest.SiteAreaID ? filteredRequest.SiteAreaID.split('|') : null,
        startDateTime: filteredRequest.StartDateTime ? filteredRequest.StartDateTime : null,
        endDateTime: filteredRequest.EndDateTime ? filteredRequest.EndDateTime : null,
        refundStatus: filteredRequest.RefundStatus ? filteredRequest.RefundStatus.split('|') as RefundStatus[] : null,
        minimalPrice: filteredRequest.MinimalPrice ? filteredRequest.MinimalPrice : null,
        statistics: filteredRequest.Statistics ? filteredRequest.Statistics : null,
        reportIDs: filteredRequest.ReportIDs ? filteredRequest.ReportIDs.split('|') : null,
        connectorIDs: filteredRequest.ConnectorID ? filteredRequest.ConnectorID.split('|').map((connectorID) => Utils.convertToInt(connectorID)) : null,
        inactivityStatus: filteredRequest.InactivityStatus ? filteredRequest.InactivityStatus.split('|') : null,
        ...authorizations.filters
      },
      {
        limit: filteredRequest.Limit,
        skip: filteredRequest.Skip,
        sort: UtilsService.httpSortFieldsToMongoDB(filteredRequest.SortFields),
        onlyRecordCount: filteredRequest.OnlyRecordCount,
      },
      authorizations.projectFields
    );
    // Assign projected fields
    if (authorizations.projectFields) {
      transactions.projectFields = authorizations.projectFields;
    }
    // Add Auth flags
    await AuthorizationService.addTransactionsAuthorizations(
      req.tenant, req.user, transactions, authorizations);

    return transactions;
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
      transactionID: number, authAction: Action): Promise<{ transaction: Transaction; chargingStation: ChargingStation; connector: Connector; }> {
    // Check dynamic auth
    const transaction = await UtilsService.checkAndGetTransactionAuthorization(tenant, user, transactionID, authAction, action);
    const { chargingStation, connector } = await TransactionService.checkAndGetChargingStationConnector(action, tenant, user,
      transaction.chargeBoxID, transaction.connectorId, authAction);
    return { transaction, chargingStation, connector };
  }

  private static async checkAndGetChargingStationConnector(action: ServerAction, tenant: Tenant, user: UserToken,
      chargingStationID: string, connectorID: number, authAction: Action): Promise<{ chargingStation: ChargingStation; connector: Connector; }> {
    // Get the Charging Station
    const chargingStation = await UtilsService.checkAndGetChargingStationAuthorization(tenant, user, chargingStationID, authAction, action, null, { withSiteArea: true });
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
