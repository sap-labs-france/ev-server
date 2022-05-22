import ChargingStation, { Connector } from '../../../../../types/ChargingStation';
import { NextFunction, Request, Response } from 'express';
import { OCPICommandResponse, OCPICommandResponseType } from '../../../../../types/ocpi/OCPICommandResponse';

import AppError from '../../../../../exception/AppError';
import AxiosFactory from '../../../../../utils/AxiosFactory';
import { ChargePointStatus } from '../../../../../types/ocpp/OCPPServer';
import ChargingStationClientFactory from '../../../../../client/ocpp/ChargingStationClientFactory';
import ChargingStationStorage from '../../../../../storage/mongodb/ChargingStationStorage';
import Logging from '../../../../../utils/Logging';
import LoggingHelper from '../../../../../utils/LoggingHelper';
import { OCPICommandType } from '../../../../../types/ocpi/OCPICommandType';
import OCPIEndpoint from '../../../../../types/ocpi/OCPIEndpoint';
import { OCPIResponse } from '../../../../../types/ocpi/OCPIResponse';
import { OCPIStartSession } from '../../../../../types/ocpi/OCPIStartSession';
import { OCPIStatusCode } from '../../../../../types/ocpi/OCPIStatusCode';
import { OCPIStopSession } from '../../../../../types/ocpi/OCPIStopSession';
import OCPIUtils from '../../../OCPIUtils';
import OCPIUtilsService from '../../OCPIUtilsService';
import { OCPPRemoteStartStopStatus } from '../../../../../types/ocpp/OCPPClient';
import { ServerAction } from '../../../../../types/Server';
import { StatusCodes } from 'http-status-codes';
import TagStorage from '../../../../../storage/mongodb/TagStorage';
import Tenant from '../../../../../types/Tenant';
import TransactionStorage from '../../../../../storage/mongodb/TransactionStorage';
import Utils from '../../../../../utils/Utils';
import moment from 'moment';

const MODULE_NAME = 'CPOCommandsService';

export default class CPOCommandsService {
  public static async handleCommand(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    const { tenant, ocpiEndpoint } = req;
    // Split URL Segments
    // /ocpi/cpo/2.0/commands/{command}
    // eslint-disable-next-line no-case-declarations
    const urlSegment = req.path.substring(1).split('/');
    // Remove action
    urlSegment.shift();
    // Get filters
    // eslint-disable-next-line no-case-declarations
    const command = urlSegment.shift();
    if (!command) {
      throw new AppError({
        module: MODULE_NAME, method: 'handleCommand', action,
        errorCode: StatusCodes.BAD_REQUEST,
        message: 'OCPI Command is not provided',
        ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR
      });
    }
    switch (command) {
      case OCPICommandType.START_SESSION:
        res.json(await CPOCommandsService.remoteStartSession(action, req, res, next, tenant, ocpiEndpoint));
        break;
      case OCPICommandType.STOP_SESSION:
        res.json(await CPOCommandsService.remoteStopSession(action, req, res, next, tenant, ocpiEndpoint));
        break;
      case OCPICommandType.RESERVE_NOW:
      case OCPICommandType.UNLOCK_CONNECTOR:
        res.json(CPOCommandsService.buildOCPIResponse(OCPICommandResponseType.NOT_SUPPORTED));
        break;
      default:
        throw new AppError({
          module: MODULE_NAME, method: 'handleCommand', action,
          errorCode: StatusCodes.BAD_REQUEST,
          message: `OCPI Command '${command}' is unknown`,
          ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR
        });
    }
    next();
  }

  private static async remoteStartSession(action: ServerAction, req: Request, res: Response,
      next: NextFunction, tenant: Tenant, ocpiEndpoint: OCPIEndpoint): Promise<OCPIResponse> {
    const startSession = req.body as OCPIStartSession;
    if (!CPOCommandsService.validateStartSession(startSession)) {
      throw new AppError({
        module: MODULE_NAME, method: 'remoteStartSession', action,
        errorCode: StatusCodes.BAD_REQUEST,
        message: 'Start Session command body is invalid',
        detailedMessages: { startSession },
        ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR
      });
    }
    let localToken = await TagStorage.getTag(
      tenant, startSession.token.uid, { withUser: true });
      // Create it on the fly
    if (!localToken) {
      // Check eMSP user
      const emspUser = await OCPIUtils.checkAndCreateEMSPUserFromToken(
        tenant, ocpiEndpoint.countryCode, ocpiEndpoint.partyId, startSession.token);
      localToken = await OCPIUtilsService.updateCreateTagWithEmspToken(tenant, startSession.token, localToken, emspUser, action);
    }
    if (!localToken?.active || !localToken.ocpiToken?.valid) {
      await Logging.logError({
        tenantID: tenant.id,
        module: MODULE_NAME, method: 'remoteStartSession', action,
        message: `Token ID '${startSession.token.uid}' is either not active or invalid`,
        detailedMessages: { localToken, startSession }
      });
      return CPOCommandsService.buildOCPIResponse(OCPICommandResponseType.REJECTED);
    }
    if (Utils.isNullOrUndefined(localToken.user) || localToken.user?.issuer) {
      await Logging.logError({
        tenantID: tenant.id,
        module: MODULE_NAME, method: 'remoteStartSession', action,
        message: `Invalid user associated to Token ID '${startSession.token.uid}'`,
        detailedMessages: { localToken, startSession }
      });
      return CPOCommandsService.buildOCPIResponse(OCPICommandResponseType.REJECTED);
    }
    // Get the Charging Station
    const chargingStation = await ChargingStationStorage.getChargingStationByOcpiLocationEvseUid(
      tenant, startSession.location_id, startSession.evse_uid);
    if (!chargingStation) {
      await Logging.logError({
        tenantID: tenant.id,
        module: MODULE_NAME, method: 'remoteStartSession', action,
        message: `Charging Station with EVSE ID '${startSession.evse_uid}' and Location ID '${startSession.location_id}' does not exist`,
        detailedMessages: { startSession }
      });
      return CPOCommandsService.buildOCPIResponse(OCPICommandResponseType.REJECTED);
    }
    // Find the connector
    const connectorID = Utils.convertToInt(OCPIUtils.getConnectorIDFromEvseID(startSession.evse_uid));
    const connector = Utils.getConnectorFromID(chargingStation, connectorID);
    if (!connector) {
      await Logging.logError({
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        tenantID: tenant.id,
        module: MODULE_NAME, method: 'remoteStartSession', action,
        message: `${Utils.buildConnectorInfo(connectorID)} Connector not found`,
        detailedMessages: { connectorID, chargingStation, startSession }
      });
      return CPOCommandsService.buildOCPIResponse(OCPICommandResponseType.REJECTED);
    }
    if (!chargingStation.issuer || !chargingStation.public) {
      await Logging.logError({
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        tenantID: tenant.id,
        module: MODULE_NAME, method: 'remoteStartSession', action,
        message: `Charging Station ID '${startSession.evse_uid}' is either not public or local to the tenant`,
        detailedMessages: { chargingStation, startSession }
      });
      return CPOCommandsService.buildOCPIResponse(OCPICommandResponseType.REJECTED);
    }
    if (connector.status !== ChargePointStatus.AVAILABLE &&
        connector.status !== ChargePointStatus.PREPARING) {
      await Logging.logError({
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        tenantID: tenant.id,
        module: MODULE_NAME, method: 'remoteStartSession', action,
        message: `Charging Station ID '${chargingStation.id}' is not available (status is '${connector.status}')`,
        detailedMessages: { chargingStation, startSession }
      });
      return CPOCommandsService.buildOCPIResponse(OCPICommandResponseType.REJECTED);
    }
    if (!chargingStation.remoteAuthorizations) {
      chargingStation.remoteAuthorizations = [];
    }
    const existingAuthorization = chargingStation.remoteAuthorizations.find(
      (authorization) => authorization.connectorId === connector.connectorId);
    if (existingAuthorization) {
      if (OCPIUtils.isAuthorizationValid(existingAuthorization.timestamp)) {
        await Logging.logError({
          ...LoggingHelper.getChargingStationProperties(chargingStation),
          tenantID: tenant.id,
          module: MODULE_NAME, method: 'remoteStartSession', action,
          message: `Remote authorization already exists for Charging Station '${chargingStation.id}' and Connector ID ${connector.connectorId}`,
          detailedMessages: { existingAuthorization, chargingStation, startSession }
        });
        return CPOCommandsService.buildOCPIResponse(OCPICommandResponseType.REJECTED);
      }
      existingAuthorization.timestamp = moment().toDate();
      existingAuthorization.id = startSession.authorization_id;
      existingAuthorization.tagId = startSession.token.uid;
    } else {
      chargingStation.remoteAuthorizations.push({
        id: startSession.authorization_id,
        connectorId: connector.connectorId,
        timestamp: new Date(),
        tagId: startSession.token.uid
      });
    }
    // Save Auth
    await ChargingStationStorage.saveChargingStationRemoteAuthorizations(
      tenant, chargingStation.id, chargingStation.remoteAuthorizations);
    // Called Async as the response to the eMSP is sent asynchronously and this request has to finish before the command returns
    void CPOCommandsService.remoteStartTransaction(action, tenant, chargingStation, connector, startSession, ocpiEndpoint);
    return CPOCommandsService.buildOCPIResponse(OCPICommandResponseType.ACCEPTED);
  }

  private static async remoteStopSession(action: ServerAction, req: Request, res: Response, next: NextFunction, tenant: Tenant, ocpiEndpoint: OCPIEndpoint): Promise<OCPIResponse> {
    const stopSession = req.body as OCPIStopSession;
    if (!CPOCommandsService.validateStopSession(stopSession)) {
      throw new AppError({
        module: MODULE_NAME, method: 'remoteStopSession', action,
        errorCode: StatusCodes.BAD_REQUEST,
        message: 'StopSession command body is invalid',
        detailedMessages: { stopSession },
        ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR
      });
    }
    const transaction = await TransactionStorage.getOCPITransactionBySessionID(tenant, stopSession.session_id);
    if (!transaction) {
      await Logging.logError({
        tenantID: tenant.id,
        module: MODULE_NAME, method: 'remoteStopSession', action,
        message: `Transaction with Session ID '${stopSession.session_id}' does not exists`,
        detailedMessages: { stopSession },
      });
      return CPOCommandsService.buildOCPIResponse(OCPICommandResponseType.REJECTED);
    }
    if (!transaction.issuer) {
      await Logging.logError({
        ...LoggingHelper.getTransactionProperties(transaction),
        tenantID: tenant.id,
        module: MODULE_NAME, method: 'remoteStopSession', action,
        message: `Transaction with Session ID '${stopSession.session_id}' is local to the tenant`,
        detailedMessages: { stopSession, transaction },
      });
      return CPOCommandsService.buildOCPIResponse(OCPICommandResponseType.REJECTED);
    }
    if (transaction.stop) {
      await Logging.logError({
        ...LoggingHelper.getTransactionProperties(transaction),
        tenantID: tenant.id,
        module: MODULE_NAME, method: 'remoteStopSession', action,
        message: `Transaction with Session ID '${stopSession.session_id}' is already stopped`,
        detailedMessages: { stopSession, transaction },
      });
      return CPOCommandsService.buildOCPIResponse(OCPICommandResponseType.REJECTED);
    }
    const chargingStation = await ChargingStationStorage.getChargingStation(tenant, transaction.chargeBoxID);
    if (!chargingStation) {
      await Logging.logError({
        ...LoggingHelper.getTransactionProperties(transaction),
        tenantID: tenant.id,
        module: MODULE_NAME, method: 'remoteStopSession', action,
        message: `Charging Station ID '${transaction.chargeBoxID}' has not been found`,
        detailedMessages: { stopSession, transaction },
      });
      return CPOCommandsService.buildOCPIResponse(OCPICommandResponseType.REJECTED);
    }
    // Called Async as the response to the eMSP is sent asynchronously and this request has to finish before the command returns
    void CPOCommandsService.remoteStopTransaction(action, tenant, chargingStation, transaction.id, stopSession, ocpiEndpoint);
    return CPOCommandsService.buildOCPIResponse(OCPICommandResponseType.ACCEPTED);
  }

  private static buildOCPIResponse(responseType: OCPICommandResponseType): OCPIResponse {
    return OCPIUtils.success({ result: responseType });
  }

  private static validateStartSession(startSession: OCPIStartSession): boolean {
    if (!startSession
      || !startSession.response_url
      || !startSession.evse_uid
      || !startSession.location_id
      || !startSession.token
      || !startSession.authorization_id
    ) {
      return false;
    }
    return OCPIUtilsService.validateCpoToken(startSession.token);
  }

  private static validateStopSession(stopSession: OCPIStopSession): boolean {
    if (!stopSession ||
        !stopSession.response_url ||
        !stopSession.session_id) {
      return false;
    }
    return true;
  }

  private static async remoteStartTransaction(action: ServerAction, tenant: Tenant, chargingStation: ChargingStation,
      connector: Connector, startSession: OCPIStartSession, ocpiEndpoint: OCPIEndpoint): Promise<void> {
    try {
      const chargingStationClient = await ChargingStationClientFactory.getChargingStationClient(tenant, chargingStation);
      if (!chargingStationClient) {
        await Logging.logError({
          ...LoggingHelper.getChargingStationProperties(chargingStation),
          tenantID: tenant.id,
          module: MODULE_NAME, method: 'remoteStartTransaction', action,
          message: 'Charging Station is not connected to the backend',
          detailedMessages: { startSession, chargingStation },
        });
      }
      const result = await chargingStationClient.remoteStartTransaction({
        connectorId: connector.connectorId,
        idTag: startSession.token.uid
      });
      if (result?.status === OCPPRemoteStartStopStatus.ACCEPTED) {
        await CPOCommandsService.sendCommandResponse(tenant, action, startSession.response_url, OCPICommandResponseType.ACCEPTED, ocpiEndpoint);
      } else {
        await CPOCommandsService.sendCommandResponse(tenant, action, startSession.response_url, OCPICommandResponseType.REJECTED, ocpiEndpoint);
      }
    } catch (error) {
      await Logging.logError({
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        tenantID: tenant.id,
        module: MODULE_NAME, method: 'remoteStartTransaction', action,
        message: `Error while trying to Start a Transaction remotely: ${error.message as string}`,
        detailedMessages: { startSession, chargingStation },
      });
    }
  }

  private static async remoteStopTransaction(action: ServerAction, tenant: Tenant, chargingStation: ChargingStation, transactionId: number,
      stopSession: OCPIStopSession, ocpiEndpoint: OCPIEndpoint): Promise<void> {
    try {
      const chargingStationClient = await ChargingStationClientFactory.getChargingStationClient(tenant, chargingStation);
      if (!chargingStationClient) {
        await Logging.logError({
          ...LoggingHelper.getChargingStationProperties(chargingStation),
          tenantID: tenant.id,
          module: MODULE_NAME, method: 'remoteStopTransaction', action,
          message: 'Charging Station is not connected to the backend',
          detailedMessages: { transactionId, stopSession, chargingStation },
        });
      }
      const result = await chargingStationClient.remoteStopTransaction({
        transactionId: transactionId
      });
      if (result?.status === OCPPRemoteStartStopStatus.ACCEPTED) {
        await CPOCommandsService.sendCommandResponse(tenant, action, stopSession.response_url, OCPICommandResponseType.ACCEPTED, ocpiEndpoint);
      } else {
        await CPOCommandsService.sendCommandResponse(tenant, action, stopSession.response_url, OCPICommandResponseType.REJECTED, ocpiEndpoint);
      }
    } catch (error) {
      await Logging.logError({
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        tenantID: tenant.id,
        module: MODULE_NAME, method: 'remoteStopTransaction', action,
        message: `Error while trying to Stop a Transaction remotely: ${error.message as string}`,
        detailedMessages: { transactionId, stopSession, chargingStation },
      });
    }
  }

  private static async sendCommandResponse(tenant: Tenant, action: ServerAction, responseUrl: string, responseType: OCPICommandResponseType, ocpiEndpoint: OCPIEndpoint) {
    // Build payload
    const payload: OCPICommandResponse = {
      result: responseType
    };
    await Logging.logDebug({
      tenantID: tenant.id,
      module: MODULE_NAME, method: 'sendCommandResponse', action,
      message: `Post command response at ${responseUrl}`,
      detailedMessages: { payload }
    });
    await AxiosFactory.getAxiosInstance(tenant).post(responseUrl, payload,
      {
        headers: {
          Authorization: `Token ${ocpiEndpoint.token}`,
          'Content-Type': 'application/json'
        },
      });
  }
}
