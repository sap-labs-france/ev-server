import ChargingStation, { Command } from '../../../types/ChargingStation';
import { OCPPCancelReservationRequest, OCPPCancelReservationResponse, OCPPChangeAvailabilityRequest, OCPPChangeAvailabilityResponse, OCPPChangeConfigurationRequest, OCPPChangeConfigurationResponse, OCPPClearCacheResponse, OCPPClearChargingProfileRequest, OCPPClearChargingProfileResponse, OCPPDataTransferRequest, OCPPDataTransferResponse, OCPPGetCompositeScheduleRequest, OCPPGetCompositeScheduleResponse, OCPPGetConfigurationRequest, OCPPGetConfigurationResponse, OCPPGetDiagnosticsRequest, OCPPGetDiagnosticsResponse, OCPPRemoteStartTransactionRequest, OCPPRemoteStartTransactionResponse, OCPPRemoteStopTransactionRequest, OCPPRemoteStopTransactionResponse, OCPPReserveNowRequest, OCPPReserveNowResponse, OCPPResetRequest, OCPPResetResponse, OCPPSetChargingProfileRequest, OCPPSetChargingProfileResponse, OCPPStatus, OCPPUnlockConnectorRequest, OCPPUnlockConnectorResponse, OCPPUpdateFirmwareRequest } from '../../../types/ocpp/OCPPClient';
import { OCPPIncomingError, OCPPIncomingRequest, OCPPIncomingResponse, OCPPMessageType, OCPPOutgoingRequest } from '../../../types/ocpp/OCPPCommon';
import { ServerAction, WSServerProtocol } from '../../../types/Server';

import BackendError from '../../../exception/BackendError';
import ChargingStationClient from '../ChargingStationClient';
import Configuration from '../../../utils/Configuration';
import Logging from '../../../utils/Logging';
import LoggingHelper from '../../../utils/LoggingHelper';
import Utils from '../../../utils/Utils';
import WebSocket from 'ws';
import { WebSocketCloseEventStatusCode } from '../../../types/WebSocket';

const MODULE_NAME = 'JsonRestChargingStationClient';

export default class JsonRestChargingStationClient extends ChargingStationClient {
  private jsonEndpoint = Configuration.getJsonEndpointConfig();
  private serverURL: string;
  private chargingStation: ChargingStation;
  private requests: { [messageUID: string]: { resolve?: (result: Record<string, unknown> | string) => void; reject?: (error: Error|Record<string, unknown>) => void; command: Command } };
  private webSocket: WebSocket;
  private tenantID: string;

  public constructor(tenantID: string, chargingStation: ChargingStation) {
    super();
    this.tenantID = tenantID;
    // Get URL
    let jsonServerURL: string;
    // Check K8s
    if (process.env.K8S && this.jsonEndpoint.targetPort && chargingStation.cloudHostIP) {
      // Use K8s internal IP, always in ws
      jsonServerURL = `ws://${chargingStation.cloudHostIP}:${this.jsonEndpoint.targetPort}`;
    } else {
      jsonServerURL = chargingStation.chargingStationURL;
      if (!jsonServerURL) {
        throw new BackendError({
          ...LoggingHelper.getChargingStationProperties(chargingStation),
          module: MODULE_NAME, method: 'constructor',
          message: 'Cannot access the Charging Station via a REST call because no URL is provided',
          detailedMessages: { chargingStation }
        });
      }
    }
    // Check URL: remove starting and trailing '/'
    if (jsonServerURL.endsWith('/')) {
      jsonServerURL = jsonServerURL.substring(0, jsonServerURL.length - 1);
    }
    this.serverURL = `${jsonServerURL}/REST/${tenantID}/${chargingStation.tokenID}/${chargingStation.id}`;
    this.chargingStation = chargingStation;
    this.requests = {};
  }

  public async remoteStartTransaction(params: OCPPRemoteStartTransactionRequest): Promise<OCPPRemoteStartTransactionResponse> {
    return this.sendMessage(this.buildRequest(Command.REMOTE_START_TRANSACTION, params));
  }

  public async reset(params: OCPPResetRequest): Promise<OCPPResetResponse> {
    return this.sendMessage(this.buildRequest(Command.RESET, params));
  }

  public async clearCache(): Promise<OCPPClearCacheResponse> {
    return this.sendMessage(this.buildRequest(Command.CLEAR_CACHE));
  }

  public async getConfiguration(params: OCPPGetConfigurationRequest): Promise<OCPPGetConfigurationResponse> {
    return this.sendMessage(this.buildRequest(Command.GET_CONFIGURATION, params));
  }

  public async changeConfiguration(params: OCPPChangeConfigurationRequest): Promise<OCPPChangeConfigurationResponse> {
    return this.sendMessage(this.buildRequest(Command.CHANGE_CONFIGURATION, params));
  }

  public async remoteStopTransaction(params: OCPPRemoteStopTransactionRequest): Promise<OCPPRemoteStopTransactionResponse> {
    return this.sendMessage(this.buildRequest(Command.REMOTE_STOP_TRANSACTION, params));
  }

  public async unlockConnector(params: OCPPUnlockConnectorRequest): Promise<OCPPUnlockConnectorResponse> {
    return this.sendMessage(this.buildRequest(Command.UNLOCK_CONNECTOR, params));
  }

  public async setChargingProfile(params: OCPPSetChargingProfileRequest): Promise<OCPPSetChargingProfileResponse> {
    return this.sendMessage(this.buildRequest(Command.SET_CHARGING_PROFILE, params));
  }

  public async getCompositeSchedule(params: OCPPGetCompositeScheduleRequest): Promise<OCPPGetCompositeScheduleResponse> {
    return this.sendMessage(this.buildRequest(Command.GET_COMPOSITE_SCHEDULE, params));
  }

  public async clearChargingProfile(params: OCPPClearChargingProfileRequest): Promise<OCPPClearChargingProfileResponse> {
    return this.sendMessage(this.buildRequest(Command.CLEAR_CHARGING_PROFILE, params));
  }

  public async changeAvailability(params: OCPPChangeAvailabilityRequest): Promise<OCPPChangeAvailabilityResponse> {
    return this.sendMessage(this.buildRequest(Command.CHANGE_AVAILABILITY, params));
  }

  public async getDiagnostics(params: OCPPGetDiagnosticsRequest): Promise<OCPPGetDiagnosticsResponse> {
    return this.sendMessage(this.buildRequest(Command.GET_DIAGNOSTICS, params));
  }

  public async updateFirmware(params: OCPPUpdateFirmwareRequest): Promise<void> {
    return this.sendMessage(this.buildRequest(Command.UPDATE_FIRMWARE, params));
  }

  public async dataTransfer(params: OCPPDataTransferRequest): Promise<OCPPDataTransferResponse> {
    return this.sendMessage(this.buildRequest(Command.DATA_TRANSFER, params));
  }

  public async reserveNow(params: OCPPReserveNowRequest): Promise<OCPPReserveNowResponse> {
    return this.sendMessage(this.buildRequest(Command.RESERVE_NOW, params));
  }

  public async cancelReservation(params: OCPPCancelReservationRequest): Promise<OCPPCancelReservationResponse> {
    return this.sendMessage(this.buildRequest(Command.CANCEL_RESERVATION, params));
  }

  private async openConnection(triggeringCommand: string): Promise<any> {
    // Log
    Logging.beInfo()?.log({
      tenantID: this.tenantID,
      siteID: this.chargingStation.siteID,
      siteAreaID: this.chargingStation.siteAreaID,
      companyID: this.chargingStation.companyID,
      chargingStationID: this.chargingStation.id,
      action: ServerAction.WS_CLIENT_CONNECTION,
      module: MODULE_NAME, method: 'onOpen',
      message: `${triggeringCommand} > Connecting to '${this.serverURL}'`
    });
    // Create Promise
    return new Promise((resolve, reject) => {
      try {
        // Create and Open the WS
        this.webSocket = new WebSocket(this.serverURL, WSServerProtocol.REST, {
          handshakeTimeout: 5000,
        });

        // Opened
        this.webSocket.on('open', () => {
          Logging.beInfo()?.log({
            tenantID: this.tenantID,
            siteID: this.chargingStation.siteID,
            siteAreaID: this.chargingStation.siteAreaID,
            companyID: this.chargingStation.companyID,
            chargingStationID: this.chargingStation.id,
            action: ServerAction.WS_CLIENT_CONNECTION_OPEN,
            module: MODULE_NAME, method: 'onOpen',
            message: `${triggeringCommand} > Now connected to '${this.serverURL}'`
          });
          // Connection is opened and ready to use
          resolve();
        });
        // Closed
        this.webSocket.on('close', (code) => {
          // code === 1000
          if (code !== WebSocketCloseEventStatusCode.CLOSE_NORMAL) {
            Logging.beWarning()?.log({
              tenantID: this.tenantID,
              siteID: this.chargingStation.siteID,
              siteAreaID: this.chargingStation.siteAreaID,
              companyID: this.chargingStation.companyID,
              chargingStationID: this.chargingStation.id,
              action: ServerAction.WS_CLIENT_CONNECTION_CLOSE,
              module: MODULE_NAME, method: 'onClose',
              message: `${triggeringCommand} > Connection has been closed - Code: '${code}'`,
            });
          }
        });
        // Handle Error Message
        this.webSocket.on('error', (error) => {
          Logging.beError()?.log({
            tenantID: this.tenantID,
            siteID: this.chargingStation.siteID,
            siteAreaID: this.chargingStation.siteAreaID,
            companyID: this.chargingStation.companyID,
            chargingStationID: this.chargingStation.id,
            action: ServerAction.WS_CLIENT_CONNECTION_ERROR,
            module: MODULE_NAME, method: 'onError',
            message: `${triggeringCommand} > Connection failed - ${error?.message}`,
            detailedMessages: {
              url: this.serverURL,
              error: error.stack
            }
          });
          // Terminate WS in error
          this.terminateConnection();
          reject(new Error(`${triggeringCommand} - Web Socket connection failed - ${error.message}`));
        });
        // Handle Server Message
        this.webSocket.on('message', (rawData: WebSocket.RawData) => {
          try {
            // Parse the message
            const messageData = rawData.toString();
            const ocppMessage: OCPPIncomingRequest|OCPPIncomingResponse|OCPPIncomingError = JSON.parse(messageData);
            const [ messageType ] = ocppMessage;
            if (messageType === OCPPMessageType.CALL_RESULT_MESSAGE) {
              this.handleOcppResponse(ocppMessage as OCPPIncomingResponse);
            } else if (messageType === OCPPMessageType.CALL_ERROR_MESSAGE) {
              this.handleOcppError(ocppMessage as OCPPIncomingError);
            } else {
              this.handleOcppRequest(ocppMessage as OCPPIncomingRequest);
            }
          } catch (error) {
            Logging.logException(error as Error, ServerAction.WS_CLIENT_MESSAGE, MODULE_NAME, 'onMessage', this.tenantID);
          }
        });
      } catch (error) {
        reject(new Error(`Failed to open Web Socket connection - ${error.message as string}'`));
      }
    });
  }

  private handleOcppResponse(occpMessage : OCPPIncomingResponse) {
    const [messageType, messageId, payload] = occpMessage;
    // Respond to the request
    if (this.requests[messageId]) {
      this.requests[messageId].resolve(payload);
    } else {
      // Error message
      Logging.beError()?.log({
        tenantID: this.tenantID,
        siteID: this.chargingStation.siteID,
        siteAreaID: this.chargingStation.siteAreaID,
        companyID: this.chargingStation.companyID,
        chargingStationID: this.chargingStation.id,
        action: ServerAction.WS_CLIENT_ERROR,
        module: MODULE_NAME, method: 'onMessage',
        message: 'Unexpected OCPP Response',
        detailedMessages: { messageType, messageId, payload }
      });
    }
    // Close WS
    this.endConnection();
  }

  private handleOcppError(occpMessage : OCPPIncomingError) {
    const [messageType, messageId, errorType, errorMessage, errorDetails] = occpMessage;
    // Respond to the request
    if (this.requests[messageId]) {
      this.requests[messageId].reject(new Error(`WS Error Message - type: ${messageType} - ID: ${messageId} - message: ${errorMessage}`));
    } else {
      // Error message
      Logging.beError()?.log({
        tenantID: this.tenantID,
        siteID: this.chargingStation.siteID,
        siteAreaID: this.chargingStation.siteAreaID,
        companyID: this.chargingStation.companyID,
        chargingStationID: this.chargingStation.id,
        action: ServerAction.WS_CLIENT_ERROR,
        module: MODULE_NAME, method: 'onMessage',
        message: 'Unexpected OCPP Error',
        detailedMessages: { messageType, messageId, errorType, errorMessage, errorDetails }
      });
    }
    // Close WS
    this.endConnection();
  }

  private handleOcppRequest(occpMessage : OCPPIncomingRequest) {
    const [messageType, messageId, command, payload] = occpMessage;
    // Should not happen
    Logging.beError()?.log({
      tenantID: this.tenantID,
      siteID: this.chargingStation.siteID,
      siteAreaID: this.chargingStation.siteAreaID,
      companyID: this.chargingStation.companyID,
      chargingStationID: this.chargingStation.id,
      action: ServerAction.WS_CLIENT_ERROR,
      module: MODULE_NAME, method: 'onMessage',
      message: 'Unexpected OCPP Request',
      detailedMessages: { messageType, messageId, command, payload }
    });
    // Close WS
    // this.endConnection();
  }

  private endConnection() {
    if (this.webSocket) {
      // Gracefully Close Web Socket - WS Code 1000
      this.webSocket.close(WebSocketCloseEventStatusCode.CLOSE_NORMAL, 'Operation completed');
    }
    this.webSocket = null;
  }

  private terminateConnection() {
    // Terminate
    if (this.webSocket) {
      this.webSocket.terminate();
    }
    this.webSocket = null;
  }

  private async sendMessage(request: OCPPOutgoingRequest): Promise<any> {
    // Extract Current Command
    const triggeringCommand: Command = request[2];
    // Check for the lastSeen
    if (Date.now() - this.chargingStation.lastSeen.getTime() > Configuration.getChargingStationConfig().pingIntervalOCPPJSecs * 1000 * 2) {
      // Charging station is not connected to the server - let's abort the current operation
      throw new Error(`Charging station is not connected to the server - command '${triggeringCommand}' has been aborted`);
    }
    return new Promise((resolve, reject) => {
      // Open WS Connection
      this.openConnection(triggeringCommand).then(() => {
        // Check if wsConnection is ready
        if (this.webSocket?.readyState === WebSocket.OPEN) {
          // Send
          this.webSocket.send(JSON.stringify(request));
          // Set the resolve function
          this.requests[request[1]] = { resolve, reject, command: triggeringCommand };
        } else {
          // Reject it
          reject(new Error(`Socket is closed for message ${triggeringCommand}`));
        }
      }).catch((error: Error) => {
        reject(new Error(`Unexpected error on request '${triggeringCommand}': ${error.message}'`));
      });
    });
  }

  private buildRequest(command, params = {}): OCPPOutgoingRequest {
    // Build the request
    return [OCPPMessageType.CALL_MESSAGE, Utils.generateUUID(), command, params] as OCPPOutgoingRequest;
  }
}
