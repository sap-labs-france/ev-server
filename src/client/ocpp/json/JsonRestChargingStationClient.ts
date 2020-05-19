import ChargingStation, { Command } from '../../../types/ChargingStation';
import { OCPPChangeAvailabilityCommandParam, OCPPChangeAvailabilityCommandResult, OCPPChangeConfigurationCommandParam, OCPPChangeConfigurationCommandResult, OCPPClearCacheCommandResult, OCPPClearChargingProfileCommandParam, OCPPClearChargingProfileCommandResult, OCPPGetCompositeScheduleCommandParam, OCPPGetCompositeScheduleCommandResult, OCPPGetConfigurationCommandParam, OCPPGetConfigurationCommandResult, OCPPGetDiagnosticsCommandParam, OCPPGetDiagnosticsCommandResult, OCPPRemoteStartTransactionCommandParam, OCPPRemoteStartTransactionCommandResult, OCPPRemoteStopTransactionCommandParam, OCPPRemoteStopTransactionCommandResult, OCPPResetCommandParam, OCPPResetCommandResult, OCPPSetChargingProfileCommandParam, OCPPSetChargingProfileCommandResult, OCPPUnlockConnectorCommandParam, OCPPUnlockConnectorCommandResult, OCPPUpdateFirmwareCommandParam } from '../../../types/ocpp/OCPPClient';

import ChargingStationClient from '../ChargingStationClient';
import Configuration from '../../../utils/Configuration';
import Constants from '../../../utils/Constants';
import { JsonWSClientConfiguration } from '../../../types/configuration/WSClientConfiguration';
import Logging from '../../../utils/Logging';
import { ServerAction } from '../../../types/Server';
import WSClient from '../../websocket/WSClient';
import { v4 as uuid } from 'uuid';

const MODULE_NAME = 'JsonRestChargingStationClient';

export default class JsonRestChargingStationClient extends ChargingStationClient {
  private serverURL: string;
  private chargingStation: ChargingStation;
  private requests: any;
  private wsConnection: WSClient;
  private tenantID: string;

  constructor(tenantID: string, chargingStation: ChargingStation) {
    super();
    this.tenantID = tenantID;
    // Get URL
    let chargingStationURL = chargingStation.chargingStationURL;
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
    return this._sendMessage(this._buildRequest(Command.REMOTE_START_TRANSACTION, params));
  }

  public async reset(params: OCPPResetCommandParam): Promise<OCPPResetCommandResult> {
    return this._sendMessage(this._buildRequest(Command.RESET, params));
  }

  public async clearCache(): Promise<OCPPClearCacheCommandResult> {
    return this._sendMessage(this._buildRequest(Command.CLEAR_CACHE));
  }

  public async getConfiguration(params: OCPPGetConfigurationCommandParam): Promise<OCPPGetConfigurationCommandResult> {
    return this._sendMessage(this._buildRequest(Command.GET_CONFIGURATION, params));
  }

  public async changeConfiguration(params: OCPPChangeConfigurationCommandParam): Promise<OCPPChangeConfigurationCommandResult> {
    return this._sendMessage(this._buildRequest(Command.CHANGE_CONFIGURATION, params));
  }

  public async remoteStopTransaction(params: OCPPRemoteStopTransactionCommandParam): Promise<OCPPRemoteStopTransactionCommandResult> {
    return this._sendMessage(this._buildRequest(Command.REMOTE_STOP_TRANSACTION, params));
  }

  public async unlockConnector(params: OCPPUnlockConnectorCommandParam): Promise<OCPPUnlockConnectorCommandResult> {
    return this._sendMessage(this._buildRequest(Command.UNLOCK_CONNECTOR, params));
  }

  public async setChargingProfile(params: OCPPSetChargingProfileCommandParam): Promise<OCPPSetChargingProfileCommandResult> {
    return this._sendMessage(this._buildRequest(Command.SET_CHARGING_PROFILE, params));
  }

  public async getCompositeSchedule(params: OCPPGetCompositeScheduleCommandParam): Promise<OCPPGetCompositeScheduleCommandResult> {
    return this._sendMessage(this._buildRequest(Command.GET_COMPOSITE_SCHEDULE, params));
  }

  public async clearChargingProfile(params: OCPPClearChargingProfileCommandParam): Promise<OCPPClearChargingProfileCommandResult> {
    return this._sendMessage(this._buildRequest(Command.CLEAR_CHARGING_PROFILE, params));
  }

  public async changeAvailability(params: OCPPChangeAvailabilityCommandParam): Promise<OCPPChangeAvailabilityCommandResult> {
    return this._sendMessage(this._buildRequest(Command.CHANGE_AVAILABILITY, params));
  }

  public async getDiagnostics(params: OCPPGetDiagnosticsCommandParam): Promise<OCPPGetDiagnosticsCommandResult> {
    return this._sendMessage(this._buildRequest(Command.GET_DIAGNOSTICS, params));
  }

  public async updateFirmware(params: OCPPUpdateFirmwareCommandParam): Promise<void> {
    return this._sendMessage(this._buildRequest(Command.UPDATE_FIRMWARE, params));
  }

  private async _openConnection(): Promise<any> {
    // Log
    Logging.logInfo({
      tenantID: this.tenantID,
      source: this.chargingStation.id,
      action: ServerAction.WS_REST_CLIENT_CONNECTION_OPENED,
      module: MODULE_NAME, method: 'onOpen',
      message: `Try to connect to '${this.serverURL}', CF Instance '${this.chargingStation.cfApplicationIDAndInstanceIndex}'`
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
      const wsClientOptions: JsonWSClientConfiguration = {
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
        // Log
        Logging.logInfo({
          tenantID: this.tenantID,
          source: this.chargingStation.id,
          action: ServerAction.WS_REST_CLIENT_CONNECTION_CLOSED,
          module: MODULE_NAME, method: 'onClose',
          message: `Connection closed from '${this.serverURL}'`
        });
      };
      // Handle Error Message
      this.wsConnection.onerror = (error) => {
        // Log
        Logging.logException(
          error,
          ServerAction.WS_REST_CONNECTION_CLOSED,
          this.chargingStation.id,
          MODULE_NAME, 'onError',
          this.tenantID
        );
        // Terminate WS in error
        this._terminateConnection();
      };
      // Handle Server Message
      this.wsConnection.onmessage = (message) => {
        try {
          // Parse the message
          const messageJson = JSON.parse(message.data);
          // Log
          Logging.logDebug({
            tenantID: this.tenantID,
            source: this.chargingStation.id,
            action: ServerAction.WS_REST_CLIENT_MESSAGE,
            module: MODULE_NAME, method: 'onMessage',
            message: `Received message '${message.data}'`,
            detailedMessages: { messageJson }
          });
          // Check if this corresponds to a request
          if (this.requests[messageJson[1]]) {
            // Check message type
            if (messageJson[0] === Constants.OCPP_JSON_CALL_ERROR_MESSAGE) {
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
            this._closeConnection();
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

  private _closeConnection() {
    // Close
    if (this.wsConnection) {
      this.wsConnection.close();
      this.wsConnection = null;
    }
  }

  private _terminateConnection() {
    // Terminate
    if (this.wsConnection) {
      this.wsConnection.terminate();
      this.wsConnection = null;
    }
  }

  private async _sendMessage(request): Promise<any> {
    // Return a promise
    // eslint-disable-next-line no-undef
    const promise = await new Promise(async (resolve, reject) => {
      // Open WS Connection
      await this._openConnection();
      // Check if wsConnection in ready
      if (this.wsConnection.isConnectionOpen()) {
        // Log
        Logging.logDebug({
          tenantID: this.tenantID,
          source: this.chargingStation.id,
          action: ServerAction.WS_REST_CLIENT_SEND_MESSAGE,
          module: MODULE_NAME, method: 'SendMessage',
          message: `Send message '${request[2]}'`,
          detailedMessages: { request }
        });
        // Send
        await this.wsConnection.send(JSON.stringify(request));
        // Set the resolve function
        this.requests[request[1]] = { resolve, reject };
      } else {
        // Reject it
        return reject(`Socket is closed for message ${request[2]}`);
      }
    });
    return promise;
  }

  private _buildRequest(command, params = {}) {
    // Build the request
    return [
      Constants.OCPP_JSON_CALL_MESSAGE,
      uuid(),
      command,
      params];
  }
}
