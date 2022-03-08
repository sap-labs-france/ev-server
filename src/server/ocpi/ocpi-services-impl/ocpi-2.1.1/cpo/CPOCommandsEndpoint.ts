import ChargingStation, { Connector, RemoteAuthorization } from '../../../../../types/ChargingStation';
import { NextFunction, Request, Response } from 'express';
import { OCPICommandResponse, OCPICommandResponseType } from '../../../../../types/ocpi/OCPICommandResponse';

import AbstractEndpoint from '../../AbstractEndpoint';
import AbstractOCPIService from '../../../AbstractOCPIService';
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
import OCPIUtilsService from '../OCPIUtilsService';
import { OCPPRemoteStartStopStatus } from '../../../../../types/ocpp/OCPPClient';
import { ServerAction } from '../../../../../types/Server';
import { StatusCodes } from 'http-status-codes';
import TagStorage from '../../../../../storage/mongodb/TagStorage';
import Tenant from '../../../../../types/Tenant';
import TransactionStorage from '../../../../../storage/mongodb/TransactionStorage';
import Utils from '../../../../../utils/Utils';
import moment from 'moment';

const MODULE_NAME = 'CPOCommandsEndpoint';

export default class CPOCommandsEndpoint extends AbstractEndpoint {
  public constructor(ocpiService: AbstractOCPIService) {
    super(ocpiService, 'commands');
  }

  public async process(req: Request, res: Response, next: NextFunction, tenant: Tenant, ocpiEndpoint: OCPIEndpoint): Promise<OCPIResponse> {
    switch (req.method) {
      case 'POST':
        // Split URL Segments
        //    /ocpi/cpo/2.0/commands/{command}
        // eslint-disable-next-line no-case-declarations
        const urlSegment = req.path.substring(1).split('/');
        // Remove action
        urlSegment.shift();
        // Get filters
        // eslint-disable-next-line no-case-declarations
        const command = urlSegment.shift();
        if (!command) {
          throw new AppError({
            action: ServerAction.OCPI_COMMAND,
            module: MODULE_NAME, method: 'getToken',
            errorCode: StatusCodes.BAD_REQUEST,
            message: 'OCPI Command is not provided',
            ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR
          });
        }
        switch (command) {
          case OCPICommandType.START_SESSION:
            return this.remoteStartSessionRequest(req, res, next, tenant, ocpiEndpoint);
          case OCPICommandType.STOP_SESSION:
            return this.remoteStopSessionRequest(req, res, next, tenant, ocpiEndpoint);
          case OCPICommandType.RESERVE_NOW:
          case OCPICommandType.UNLOCK_CONNECTOR:
            return this.buildOCPIResponse(OCPICommandResponseType.NOT_SUPPORTED);
          default:
            throw new AppError({
              action: ServerAction.OCPI_COMMAND,
              module: MODULE_NAME, method: 'getToken',
              errorCode: StatusCodes.BAD_REQUEST,
              message: `OCPI Command '${command}' is unknown`,
              ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR
            });
        }
    }
  }

  private async remoteStartSessionRequest(req: Request, res: Response, next: NextFunction, tenant: Tenant, ocpiEndpoint: OCPIEndpoint): Promise<OCPIResponse> {
    const startSession = req.body as OCPIStartSession;
    if (!this.validateStartSession(startSession)) {
      throw new AppError({
        module: MODULE_NAME, method: 'remoteStartSession',
        action: ServerAction.OCPI_START_SESSION,
        errorCode: StatusCodes.BAD_REQUEST,
        message: 'Start Session command body is invalid',
        detailedMessages: { startSession },
        ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR
      });
    }
    const localToken = await TagStorage.getTag(
      tenant, startSession.token.uid, { withUser: true });
    if (!localToken?.active || !localToken.ocpiToken?.valid) {
      await Logging.logError({
        tenantID: tenant.id,
        action: ServerAction.OCPI_START_SESSION,
        message: `Token ID '${startSession.token.uid}' is either not active or invalid`,
        module: MODULE_NAME, method: 'remoteStartSession',
        detailedMessages: { localToken, startSession }
      });
      return this.buildOCPIResponse(OCPICommandResponseType.REJECTED);
    }
    if (Utils.isNullOrUndefined(localToken.user) || localToken.user?.issuer) {
      await Logging.logError({
        tenantID: tenant.id,
        action: ServerAction.OCPI_START_SESSION,
        message: `Invalid user associated to Token ID '${startSession.token.uid}'`,
        module: MODULE_NAME, method: 'remoteStartSession',
        detailedMessages: { localToken, startSession }
      });
      return this.buildOCPIResponse(OCPICommandResponseType.REJECTED);
    }
    // Get the Charging Station
    const chargingStation = await ChargingStationStorage.getChargingStationByOcpiLocationEvseUid(
      tenant, startSession.location_id, startSession.evse_uid);
    if (!chargingStation) {
      await Logging.logError({
        tenantID: tenant.id,
        action: ServerAction.OCPI_START_SESSION,
        message: `Charging Station with EVSE ID '${startSession.evse_uid}' and Location ID '${startSession.location_id}' does not exist`,
        module: MODULE_NAME, method: 'remoteStartSession',
        detailedMessages: { startSession }
      });
      return this.buildOCPIResponse(OCPICommandResponseType.REJECTED);
    }
    // Find the connector
    const connectorID = Utils.convertToInt(OCPIUtils.getConnectorIDFromEvseID(startSession.evse_uid));
    const connector = Utils.getConnectorFromID(chargingStation, connectorID);
    if (!connector) {
      await Logging.logError({
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        tenantID: tenant.id,
        action: ServerAction.OCPI_START_SESSION,
        message: `${Utils.buildConnectorInfo(connectorID)} Connector not found`,
        module: MODULE_NAME, method: 'remoteStartSession',
        detailedMessages: { connectorID, chargingStation, startSession }
      });
      return this.buildOCPIResponse(OCPICommandResponseType.REJECTED);
    }
    if (!chargingStation.issuer || !chargingStation.public) {
      await Logging.logError({
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        tenantID: tenant.id,
        action: ServerAction.OCPI_START_SESSION,
        message: `Charging Station ID '${startSession.evse_uid}' is either not public or local to the tenant`,
        module: MODULE_NAME, method: 'remoteStartSession',
        detailedMessages: { chargingStation, startSession }
      });
      return this.buildOCPIResponse(OCPICommandResponseType.REJECTED);
    }
    if (connector.status !== ChargePointStatus.AVAILABLE &&
        connector.status !== ChargePointStatus.PREPARING) {
      await Logging.logError({
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        tenantID: tenant.id,
        action: ServerAction.OCPI_STOP_SESSION,
        message: `Charging Station ID '${chargingStation.id}' is not available (status is '${connector.status}')`,
        module: MODULE_NAME, method: 'remoteStartSession',
        detailedMessages: { chargingStation, startSession }
      });
      return this.buildOCPIResponse(OCPICommandResponseType.REJECTED);
    }
    if (!chargingStation.remoteAuthorizations) {
      chargingStation.remoteAuthorizations = [];
    }
    const existingAuthorization: RemoteAuthorization = chargingStation.remoteAuthorizations.find(
      (authorization) => authorization.connectorId === connector.connectorId);
    if (existingAuthorization) {
      if (OCPIUtils.isAuthorizationValid(existingAuthorization.timestamp)) {
        await Logging.logError({
          ...LoggingHelper.getChargingStationProperties(chargingStation),
          tenantID: tenant.id,
          action: ServerAction.OCPI_START_SESSION,
          message: `Remote authorization already exists for Charging Station '${chargingStation.id}' and Connector ID ${connector.connectorId}`,
          module: MODULE_NAME, method: 'remoteStartSession',
          detailedMessages: { existingAuthorization, chargingStation, startSession }
        });
        return this.buildOCPIResponse(OCPICommandResponseType.REJECTED);
      }
      existingAuthorization.timestamp = moment().toDate();
      existingAuthorization.id = startSession.authorization_id;
      existingAuthorization.tagId = startSession.token.uid;
    } else {
      chargingStation.remoteAuthorizations.push(
        {
          id: startSession.authorization_id,
          connectorId: connector.connectorId,
          timestamp: new Date(),
          tagId: startSession.token.uid
        }
      );
    }
    // Save Auth
    await ChargingStationStorage.saveChargingStationRemoteAuthorizations(
      tenant, chargingStation.id, chargingStation.remoteAuthorizations);
    // Called Async as the response to the eMSP is sent asynchronously and this request has to finish before the command returns
    void this.remoteStartTransaction(tenant, chargingStation, connector, startSession, ocpiEndpoint);
    return this.buildOCPIResponse(OCPICommandResponseType.ACCEPTED);
  }

  private async remoteStopSessionRequest(req: Request, res: Response, next: NextFunction, tenant: Tenant, ocpiEndpoint: OCPIEndpoint): Promise<OCPIResponse> {
    const stopSession = req.body as OCPIStopSession;
    if (!this.validateStopSession(stopSession)) {
      throw new AppError({
        module: MODULE_NAME, method: 'remoteStopSession',
        action: ServerAction.OCPI_START_SESSION,
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
        action: ServerAction.OCPI_STOP_SESSION,
        message: `Transaction with Session ID '${stopSession.session_id}' does not exists`,
        module: MODULE_NAME, method: 'remoteStopSession',
        detailedMessages: { stopSession },
      });
      return this.buildOCPIResponse(OCPICommandResponseType.REJECTED);
    }
    if (!transaction.issuer) {
      await Logging.logError({
        ...LoggingHelper.getTransactionProperties(transaction),
        tenantID: tenant.id,
        action: ServerAction.OCPI_STOP_SESSION,
        message: `Transaction with Session ID '${stopSession.session_id}' is local to the tenant`,
        module: MODULE_NAME, method: 'remoteStopSession',
        detailedMessages: { stopSession, transaction },
      });
      return this.buildOCPIResponse(OCPICommandResponseType.REJECTED);
    }
    if (transaction.stop) {
      await Logging.logError({
        ...LoggingHelper.getTransactionProperties(transaction),
        tenantID: tenant.id,
        action: ServerAction.OCPI_STOP_SESSION,
        message: `Transaction with Session ID '${stopSession.session_id}' is already stopped`,
        module: MODULE_NAME, method: 'remoteStopSession',
        detailedMessages: { stopSession, transaction },
      });
      return this.buildOCPIResponse(OCPICommandResponseType.REJECTED);
    }
    const chargingStation = await ChargingStationStorage.getChargingStation(tenant, transaction.chargeBoxID);
    if (!chargingStation) {
      await Logging.logError({
        ...LoggingHelper.getTransactionProperties(transaction),
        tenantID: tenant.id,
        action: ServerAction.OCPI_STOP_SESSION,
        message: `Charging Station ID '${transaction.chargeBoxID}' has not been found`,
        module: MODULE_NAME, method: 'remoteStopSession',
        detailedMessages: { stopSession, transaction },
      });
      return this.buildOCPIResponse(OCPICommandResponseType.REJECTED);
    }
    // Called Async as the response to the eMSP is sent asynchronously and this request has to finish before the command returns
    void this.remoteStopTransaction(tenant, chargingStation, transaction.id, stopSession, ocpiEndpoint);
    return this.buildOCPIResponse(OCPICommandResponseType.ACCEPTED);
  }

  private buildOCPIResponse(responseType: OCPICommandResponseType): OCPIResponse {
    return OCPIUtils.success({ result: responseType });
  }

  private validateStartSession(startSession: OCPIStartSession): boolean {
    if (!startSession
      || !startSession.response_url
      || !startSession.evse_uid
      || !startSession.location_id
      || !startSession.token
      || !startSession.authorization_id
    ) {
      return false;
    }
    return OCPIUtilsService.validateToken(startSession.token);
  }

  private validateStopSession(stopSession: OCPIStopSession): boolean {
    if (!stopSession ||
        !stopSession.response_url ||
        !stopSession.session_id) {
      return false;
    }
    return true;
  }

  private async remoteStartTransaction(tenant: Tenant, chargingStation: ChargingStation,
      connector: Connector, startSession: OCPIStartSession, ocpiEndpoint: OCPIEndpoint): Promise<void> {
    const chargingStationClient = await ChargingStationClientFactory.getChargingStationClient(tenant, chargingStation);
    if (!chargingStationClient) {
      await Logging.logError({
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        tenantID: tenant.id,
        action: ServerAction.OCPI_START_SESSION,
        message: 'Charging Station is not connected to the backend',
        module: MODULE_NAME, method: 'remoteStartTransaction',
        detailedMessages: { startSession, chargingStation },
      });
    }
    const result = await chargingStationClient.remoteStartTransaction({
      connectorId: connector.connectorId,
      idTag: startSession.token.uid
    });
    if (result?.status === OCPPRemoteStartStopStatus.ACCEPTED) {
      await this.sendCommandResponse(tenant, ServerAction.OCPI_START_SESSION, startSession.response_url, OCPICommandResponseType.ACCEPTED, ocpiEndpoint);
    } else {
      await this.sendCommandResponse(tenant, ServerAction.OCPI_START_SESSION, startSession.response_url, OCPICommandResponseType.REJECTED, ocpiEndpoint);
    }
  }

  private async remoteStopTransaction(tenant: Tenant, chargingStation: ChargingStation, transactionId: number,
      stopSession: OCPIStopSession, ocpiEndpoint: OCPIEndpoint): Promise<void> {
    const chargingStationClient = await ChargingStationClientFactory.getChargingStationClient(tenant, chargingStation);
    if (!chargingStationClient) {
      await Logging.logError({
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        tenantID: tenant.id,
        action: ServerAction.OCPI_STOP_SESSION,
        message: 'Charging Station is not connected to the backend',
        module: MODULE_NAME, method: 'remoteStopTransaction',
        detailedMessages: { transactionId, stopSession, chargingStation },
      });
    }
    const result = await chargingStationClient.remoteStopTransaction({
      transactionId: transactionId
    });
    if (result?.status === OCPPRemoteStartStopStatus.ACCEPTED) {
      await this.sendCommandResponse(tenant, ServerAction.OCPI_STOP_SESSION, stopSession.response_url, OCPICommandResponseType.ACCEPTED, ocpiEndpoint);
    } else {
      await this.sendCommandResponse(tenant, ServerAction.OCPI_STOP_SESSION, stopSession.response_url, OCPICommandResponseType.REJECTED, ocpiEndpoint);
    }
  }

  private async sendCommandResponse(tenant: Tenant, action: ServerAction, responseUrl: string, responseType: OCPICommandResponseType, ocpiEndpoint: OCPIEndpoint) {
    // Build payload
    const payload: OCPICommandResponse = {
      result: responseType
    };
    // Log
    await Logging.logDebug({
      tenantID: tenant.id,
      action: action,
      message: `Post command response at ${responseUrl}`,
      module: MODULE_NAME, method: 'sendCommandResponse',
      detailedMessages: { payload }
    });
    // Call IOP
    await AxiosFactory.getAxiosInstance(tenant).post(responseUrl, payload,
      {
        headers: {
          Authorization: `Token ${ocpiEndpoint.token}`,
          'Content-Type': 'application/json'
        },
      });
  }
}

