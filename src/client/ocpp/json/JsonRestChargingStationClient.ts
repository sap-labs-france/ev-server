import ChargingStation, { Command } from '../../../types/ChargingStation';
import { MessageType, WSClientOptions } from '../../../types/WebSocket';
import { OCPPChangeAvailabilityCommandParam, OCPPChangeAvailabilityCommandResult, OCPPChangeConfigurationCommandParam, OCPPChangeConfigurationCommandResult, OCPPClearCacheCommandResult, OCPPClearChargingProfileCommandParam, OCPPClearChargingProfileCommandResult, OCPPGetCompositeScheduleCommandParam, OCPPGetCompositeScheduleCommandResult, OCPPGetConfigurationCommandParam, OCPPGetConfigurationCommandResult, OCPPGetDiagnosticsCommandParam, OCPPGetDiagnosticsCommandResult, OCPPRemoteStartTransactionCommandParam, OCPPRemoteStartTransactionCommandResult, OCPPRemoteStopTransactionCommandParam, OCPPRemoteStopTransactionCommandResult, OCPPResetCommandParam, OCPPResetCommandResult, OCPPSetChargingProfileCommandParam, OCPPSetChargingProfileCommandResult, OCPPUnlockConnectorCommandParam, OCPPUnlockConnectorCommandResult, OCPPUpdateFirmwareCommandParam } from '../../../types/ocpp/OCPPClient';

import ChargingStationClient from '../ChargingStationClient';
import Configuration from '../../../utils/Configuration';
import Logging from '../../../utils/Logging';
import { ServerAction } from '../../../types/Server';
import Utils from '../../../utils/Utils';
import WSClient from '../../websocket/WSClient';

const MODULE_NAME = 'JsonRestChargingStationClient';

export default class JsonRestChargingStationClient extends ChargingStationClient {
  private serverURL: string;
  private chargingStation: ChargingStation;
  private requests: { [messageUID: string]: { resolve?: (result: object) => void; reject?: (error: object) => void; command: ServerAction } };
  private wsConnection: WSClient;
  private tenantID: string;

  constructor(tenantID: string, chargingStation: ChargingStation) {
    super();
    this.tenantID = tenantID;
    // Get URL
    let chargingStationURL: string = chargingStation.chargingStationURL;
    // Check URL: remove starting and trailing '/'
    if (chargingStationURL.endsWith('/')) {
      // Remove '/'
      chargingStationURL = chargingStationURL.substring(0, chargingStationURL.length - 1);
    }
    // Keep
    this.serverURL = `${chargingStationURL}/REST/${tenantID}/${chargingStation.id}`;
    this.chargingStation = chargingStation;
    this.requests = {};
  }

  public async remoteStartTransaction(params: OCPPRemoteStartTransactionCommandParam): Promise<OCPPRemoteStartTransactionCommandResult> {
    return this.sendMessage(this.buildRequest(Command.REMOTE_START_TRANSACTION, params));
  }

  public async reset(params: OCPPResetCommandParam): Promise<OCPPResetCommandResult> {
    return this.sendMessage(this.buildRequest(Command.RESET, params));
  }

  public async clearCache(): Promise<OCPPClearCacheCommandResult> {
    return this.sendMessage(this.buildRequest(Command.CLEAR_CACHE));
  }

  public async getConfiguration(params: OCPPGetConfigurationCommandParam): Promise<OCPPGetConfigurationCommandResult> {
    return this.sendMessage(this.buildRequest(Command.GET_CONFIGURATION, params));
  }

  public async changeConfiguration(params: OCPPChangeConfigurationCommandParam): Promise<OCPPChangeConfigurationCommandResult> {
    return this.sendMessage(this.buildRequest(Command.CHANGE_CONFIGURATION, params));
  }

  public async remoteStopTransaction(params: OCPPRemoteStopTransactionCommandParam): Promise<OCPPRemoteStopTransactionCommandResult> {
    return this.sendMessage(this.buildRequest(Command.REMOTE_STOP_TRANSACTION, params));
  }

  public async unlockConnector(params: OCPPUnlockConnectorCommandParam): Promise<OCPPUnlockConnectorCommandResult> {
    return this.sendMessage(this.buildRequest(Command.UNLOCK_CONNECTOR, params));
  }

  public async setChargingProfile(params: OCPPSetChargingProfileCommandParam): Promise<OCPPSetChargingProfileCommandResult> {
    return this.sendMessage(this.buildRequest(Command.SET_CHARGING_PROFILE, params));
  }

  public async getCompositeSchedule(params: OCPPGetCompositeScheduleCommandParam): Promise<OCPPGetCompositeScheduleCommandResult> {
    return this.sendMessage(this.buildRequest(Command.GET_COMPOSITE_SCHEDULE, params));
  }

  public async clearChargingProfile(params: OCPPClearChargingProfileCommandParam): Promise<OCPPClearChargingProfileCommandResult> {
    return this.sendMessage(this.buildRequest(Command.CLEAR_CHARGING_PROFILE, params));
  }

  public async changeAvailability(params: OCPPChangeAvailabilityCommandParam): Promise<OCPPChangeAvailabilityCommandResult> {
    return this.sendMessage(this.buildRequest(Command.CHANGE_AVAILABILITY, params));
  }

  public async getDiagnostics(params: OCPPGetDiagnosticsCommandParam): Promise<OCPPGetDiagnosticsCommandResult> {
    return this.sendMessage(this.buildRequest(Command.GET_DIAGNOSTICS, params));
  }

  public async updateFirmware(params: OCPPUpdateFirmwareCommandParam): Promise<void> {
    return this.sendMessage(this.buildRequest(Command.UPDATE_FIRMWARE, params));
  }

  private async openConnection(): Promise<any> {
    // Log
    Logging.logInfo({
      tenantID: this.tenantID,
      source: this.chargingStation.id,
      action: ServerAction.WS_REST_CLIENT_CONNECTION_OPENED,
      module: MODULE_NAME, method: 'onOpen',
      message: `Try to connect to '${this.serverURL}' ${Configuration.isCloudFoundry() ? ', CF Instance \'' + this.chargingStation.cfApplicationIDAndInstanceIndex + '\'' : ''}`
    });
    // Create Promise
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    return await new Promise((resolve, reject) => {
      // Create WS
      let WSOptions = {};
      if (Configuration.isCloudFoundry()) {
        WSOptions = {
          protocol: 'rest',
          headers: { 'X-CF-APP-INSTANCE': this.chargingStation.cfApplicationIDAndInstanceIndex }
        };
      } else {
        WSOptions = {
          protocol: 'rest'
        };
      }
      const wsClientOptions: WSClientOptions = {
        WSOptions: WSOptions,
        autoReconnectTimeout: Configuration.getWSClientConfig().autoReconnectTimeout,
        autoReconnectMaxRetries: Configuration.getWSClientConfig().autoReconnectMaxRetries,
        logTenantID: this.tenantID
      };
      this.wsConnection = new WSClient(this.serverURL, wsClientOptions);
      // Opened
      this.wsConnection.onopen = () => {
        // Log
        Logging.logInfo({
          tenantID: this.tenantID,
          source: this.chargingStation.id,
          action: ServerAction.WS_REST_CLIENT_CONNECTION_OPENED,
          module: MODULE_NAME, method: 'onOpen',
          message: `Connection opened to '${this.serverURL}'`
        });
        // Connection is opened and ready to use
        resolve();
      };
      // Closed
      this.wsConnection.onclose = () => {
        if (Utils.isProductionEnv()) {
          // Log
          Logging.logInfo({
            tenantID: this.tenantID,
            source: this.chargingStation.id,
            action: ServerAction.WS_REST_CLIENT_CONNECTION_CLOSED,
            module: MODULE_NAME, method: 'onClose',
            message: `Connection closed from '${this.serverURL}'`
          });
        }
      };
      // Handle Error Message
      this.wsConnection.onerror = (error) => {
        if (Utils.isProductionEnv()) {
          // Log
          Logging.logException(
            error,
            ServerAction.WS_REST_CLIENT_CONNECTION_ERROR,
            this.chargingStation.id,
            MODULE_NAME, 'onError',
            this.tenantID
          );
        }
        // Terminate WS in error
        this.terminateConnection();
      };
      // Handle Server Message
      this.wsConnection.onmessage = (message) => {
        try {
          // Parse the message
          const messageJson = JSON.parse(message.data);
          // Check if this corresponds to a request
          if (this.requests[messageJson[1]]) {
            // Check message type
            if (messageJson[0] === MessageType.CALL_ERROR_MESSAGE) {
              // Error message
              Logging.logError({
                tenantID: this.tenantID,
                source: this.chargingStation.id,
                action: ServerAction.WS_REST_CLIENT_ERROR_RESPONSE,
                module: MODULE_NAME, method: 'onMessage',
                message: `${messageJson[3]}`,
                detailedMessages: { messageJson }
              });
              // Resolve with error message
              this.requests[messageJson[1]].reject({ status: 'Rejected', error: messageJson });
            } else {
              // Respond to the request
              this.requests[messageJson[1]].resolve(messageJson[2]);
            }
            // Close WS
            this.closeConnection();
          } else {
            // Error message
            Logging.logError({
              tenantID: this.tenantID,
              source: this.chargingStation.id,
              action: ServerAction.WS_REST_CLIENT_ERROR_RESPONSE,
              module: MODULE_NAME, method: 'onMessage',
              message: 'Received unknown message',
              detailedMessages: { messageJson }
            });
          }
        } catch (error) {
          // Log
          Logging.logException(
            error,
            ServerAction.WS_REST_CLIENT_MESSAGE,
            this.chargingStation.id,
            MODULE_NAME, 'onMessage',
            this.tenantID);
        }
      };
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

  private async sendMessage(request): Promise<any> {
    // Return a promise
    // eslint-disable-next-line @typescript-eslint/no-misused-promises, no-async-promise-executor
    const promise = await new Promise(async (resolve, reject) => {
      // Open WS Connection
      await this.openConnection();
      // Check if wsConnection is ready
      if (this.wsConnection.isConnectionOpen()) {
        // Send
        this.wsConnection.send(JSON.stringify(request));
        // Set the resolve function
        this.requests[request[1]] = { resolve, reject, command: request[2] };
      } else {
        // Reject it
        return reject(`Socket is closed for message ${request[2]}`);
      }
    });
    return promise;
  }

  private buildRequest(command, params = {}) {
    // Build the request
    return [MessageType.CALL_MESSAGE, Utils.generateUUID(), command, params];
  }
}
