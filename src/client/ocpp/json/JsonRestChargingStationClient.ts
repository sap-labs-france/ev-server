import ChargingStation, { Command } from '../../../types/ChargingStation';
import { OCPPCancelReservationRequest, OCPPCancelReservationResponse, OCPPChangeAvailabilityRequest, OCPPChangeAvailabilityResponse, OCPPChangeConfigurationRequest, OCPPChangeConfigurationResponse, OCPPClearCacheResponse, OCPPClearChargingProfileRequest, OCPPClearChargingProfileResponse, OCPPDataTransferRequest, OCPPDataTransferResponse, OCPPGetCompositeScheduleRequest, OCPPGetCompositeScheduleResponse, OCPPGetConfigurationRequest, OCPPGetConfigurationResponse, OCPPGetDiagnosticsRequest, OCPPGetDiagnosticsResponse, OCPPRemoteStartTransactionRequest, OCPPRemoteStartTransactionResponse, OCPPRemoteStopTransactionRequest, OCPPRemoteStopTransactionResponse, OCPPReserveNowRequest, OCPPReserveNowResponse, OCPPResetRequest, OCPPResetResponse, OCPPSetChargingProfileRequest, OCPPSetChargingProfileResponse, OCPPStatus, OCPPUnlockConnectorRequest, OCPPUnlockConnectorResponse, OCPPUpdateFirmwareRequest } from '../../../types/ocpp/OCPPClient';
import { OCPPIncomingRequest, OCPPMessageType, OCPPOutgoingRequest } from '../../../types/ocpp/OCPPCommon';
import { ServerAction, WSServerProtocol } from '../../../types/Server';

import BackendError from '../../../exception/BackendError';
import ChargingStationClient from '../ChargingStationClient';
import Configuration from '../../../utils/Configuration';
import Logging from '../../../utils/Logging';
import LoggingHelper from '../../../utils/LoggingHelper';
import Utils from '../../../utils/Utils';
import WSClient from '../../websocket/WSClient';
import { WSClientOptions } from '../../../types/WebSocket';

const MODULE_NAME = 'JsonRestChargingStationClient';

export default class JsonRestChargingStationClient extends ChargingStationClient {
  private jsonEndpoint = Configuration.getJsonEndpointConfig();
  private serverURL: string;
  private chargingStation: ChargingStation;
  private requests: { [messageUID: string]: { resolve?: (result: Record<string, unknown> | string) => void; reject?: (error: Error|Record<string, unknown>) => void; command: Command } };
  private wsConnection: WSClient;
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

  private async openConnection(request: OCPPOutgoingRequest): Promise<any> {
    // Extract Current Command
    const triggeringCommand: Command = request[2];
    // Log
    await Logging.logInfo({
      tenantID: this.tenantID,
      siteID: this.chargingStation.siteID,
      siteAreaID: this.chargingStation.siteAreaID,
      companyID: this.chargingStation.companyID,
      chargingStationID: this.chargingStation.id,
      action: ServerAction.WS_CLIENT_CONNECTION,
      module: MODULE_NAME, method: 'onOpen',
      message: `Try to connect to '${this.serverURL}' - command: ${triggeringCommand}`
    });
    // Create Promise
    return new Promise((resolve, reject) => {
      try {
        // Create WS
        const wsClientOptions: WSClientOptions = {
          wsOptions: {
            handshakeTimeout: 5000,
          },
          protocols: WSServerProtocol.REST,
          logTenantID: this.tenantID
        };
        // Create and Open the WS
        this.wsConnection = new WSClient(this.serverURL, wsClientOptions);
        // Opened
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        this.wsConnection.onopen = async () => {
          await Logging.logInfo({
            tenantID: this.tenantID,
            siteID: this.chargingStation.siteID,
            siteAreaID: this.chargingStation.siteAreaID,
            companyID: this.chargingStation.companyID,
            chargingStationID: this.chargingStation.id,
            action: ServerAction.WS_CLIENT_CONNECTION_OPEN,
            module: MODULE_NAME, method: 'onOpen',
            message: `Connection opened to '${this.serverURL}' - command: ${triggeringCommand}`
          });
          // Connection is opened and ready to use
          resolve();
        };
        // Closed
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        this.wsConnection.onclose = async (code: number) => {
          await Logging.logInfo({
            tenantID: this.tenantID,
            siteID: this.chargingStation.siteID,
            siteAreaID: this.chargingStation.siteAreaID,
            companyID: this.chargingStation.companyID,
            chargingStationID: this.chargingStation.id,
            action: ServerAction.WS_CLIENT_CONNECTION_CLOSE,
            module: MODULE_NAME, method: 'onClose',
            message: `Connection closed to '${this.serverURL}', Message: '${Utils.getWebSocketCloseEventStatusString(code)}', Code: '${code}'`,
            detailedMessages: { code }
          });
        };
        // Handle Error Message
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        this.wsConnection.onerror = async (error: Error) => {
          await Logging.logError({
            tenantID: this.tenantID,
            siteID: this.chargingStation.siteID,
            siteAreaID: this.chargingStation.siteAreaID,
            companyID: this.chargingStation.companyID,
            chargingStationID: this.chargingStation.id,
            action: ServerAction.WS_CLIENT_CONNECTION_ERROR,
            module: MODULE_NAME, method: 'onError',
            message: `Connection error to '${this.serverURL}: ${error?.message}`,
            detailedMessages: { error: error.stack }
          });
          // Terminate WS in error
          this.terminateConnection();
          reject(new Error(`Error on opening Web Socket connection: ${error.message}'`));
        };
        // Handle Server Message
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        this.wsConnection.onmessage = async (message) => {
          try {
            // Parse the message
            const [messageType, messageId, command, commandPayload, errorDetails]: OCPPIncomingRequest = JSON.parse(message.data) as OCPPIncomingRequest;
            // Check if this corresponds to a request
            if (this.requests[messageId]) {
              // Check message type
              if (messageType === OCPPMessageType.CALL_ERROR_MESSAGE) {
                // Error message
                await Logging.logError({
                  tenantID: this.tenantID,
                  siteID: this.chargingStation.siteID,
                  siteAreaID: this.chargingStation.siteAreaID,
                  companyID: this.chargingStation.companyID,
                  chargingStationID: this.chargingStation.id,
                  action: ServerAction.WS_CLIENT_ERROR,
                  module: MODULE_NAME, method: 'onMessage',
                  message: `${commandPayload.toString()}`,
                  detailedMessages: { messageType, messageId, command, commandPayload, errorDetails }
                });
                // Resolve with error message
                // this.requests[messageId].reject({ status: OCPPStatus.REJECTED, error: [messageType, messageId, command, commandPayload, errorDetails] });
                this.requests[messageId].reject(new Error(`${message.data as string}`));
              } else {
                // Respond to the request
                this.requests[messageId].resolve(command);
              }
              // Close WS
              this.closeConnection();
            } else {
              // Error message
              await Logging.logError({
                tenantID: this.tenantID,
                siteID: this.chargingStation.siteID,
                siteAreaID: this.chargingStation.siteAreaID,
                companyID: this.chargingStation.companyID,
                chargingStationID: this.chargingStation.id,
                action: ServerAction.WS_CLIENT_ERROR,
                module: MODULE_NAME, method: 'onMessage',
                message: 'Received unknown message',
                detailedMessages: { messageType, messageId, command, commandPayload, errorDetails }
              });
            }
          } catch (error) {
            await Logging.logException(error as Error, ServerAction.WS_CLIENT_MESSAGE, MODULE_NAME, 'onMessage', this.tenantID);
          }
        };
      } catch (error) {
        reject(new Error(`Unexpected error on opening Web Socket connection: ${error.message as string}'`));
      }
    });
  }

  private closeConnection() {
    // Close
    if (this.wsConnection) {
      this.wsConnection.close();
    }
    this.wsConnection = null;
  }

  private terminateConnection() {
    // Terminate
    if (this.wsConnection) {
      this.wsConnection.terminate();
    }
    this.wsConnection = null;
  }

  private async sendMessage(request: OCPPOutgoingRequest): Promise<any> {
    // Check for the lastSeen
    if (Date.now() - this.chargingStation.lastSeen.getTime() > Configuration.getChargingStationConfig().pingIntervalOCPPJSecs * 1000 * 2) {
      // Charging station is not connected to the server - let's abort the current operation
      throw new Error(`Charging station is not connected to the server - request '${request[2]}' has been aborted`);
    }
    // eslint-disable-next-line @typescript-eslint/no-misused-promises, no-async-promise-executor
    return new Promise(async (resolve, reject) => {
      try {
        // Open WS Connection
        await this.openConnection(request);
        // Check if wsConnection is ready
        if (this.wsConnection?.isConnectionOpen()) {
          // Send
          this.wsConnection.send(JSON.stringify(request));
          // Set the resolve function
          this.requests[request[1]] = { resolve, reject, command: request[2] };
        } else {
          // Reject it
          reject(new Error(`Socket is closed for message ${request[2]}`));
        }
      } catch (error) {
        reject(new Error(`Unexpected error on request '${request[2]}': ${error.message}'`));
      }
    });
  }

  private buildRequest(command, params = {}): OCPPOutgoingRequest {
    // Build the request
    return [OCPPMessageType.CALL_MESSAGE, Utils.generateUUID(), command, params] as OCPPOutgoingRequest;
  }
}
