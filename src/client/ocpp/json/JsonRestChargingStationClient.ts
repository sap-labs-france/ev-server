import uuid from 'uuid/v4';
import ChargingStation from '../../../types/ChargingStation';
import { JsonWSClientConfiguration } from '../../../types/configuration/WSClientConfiguration';
import { OCPPChangeAvailabilityCommandParam, OCPPChangeAvailabilityCommandResult, OCPPChangeConfigurationCommandParam, OCPPChangeConfigurationCommandResult, OCPPChargingStationCommand, OCPPClearCacheCommandResult, OCPPClearChargingProfileCommandParam, OCPPClearChargingProfileCommandResult, OCPPGetCompositeScheduleCommandParam, OCPPGetCompositeScheduleCommandResult, OCPPGetConfigurationCommandParam, OCPPGetConfigurationCommandResult, OCPPGetDiagnosticsCommandParam, OCPPGetDiagnosticsCommandResult, OCPPRemoteStartTransactionCommandParam, OCPPRemoteStartTransactionCommandResult, OCPPRemoteStopTransactionCommandParam, OCPPRemoteStopTransactionCommandResult, OCPPResetCommandParam, OCPPResetCommandResult, OCPPSetChargingProfileCommandParam, OCPPSetChargingProfileCommandResult, OCPPUnlockConnectorCommandParam, OCPPUnlockConnectorCommandResult, OCPPUpdateFirmwareCommandParam } from '../../../types/ocpp/OCPPClient';
import Configuration from '../../../utils/Configuration';
import Constants from '../../../utils/Constants';
import Logging from '../../../utils/Logging';
import WSClient from '../../WSClient';
import ChargingStationClient from '../ChargingStationClient';

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

  public remoteStartTransaction(params: OCPPRemoteStartTransactionCommandParam): Promise<OCPPRemoteStartTransactionCommandResult> {
    return this._sendMessage(this._buildRequest(OCPPChargingStationCommand.REMOTE_START_TRANSACTION, params));
  }

  public reset(params: OCPPResetCommandParam): Promise<OCPPResetCommandResult> {
    return this._sendMessage(this._buildRequest(OCPPChargingStationCommand.RESET, params));
  }

  public clearCache(): Promise<OCPPClearCacheCommandResult> {
    return this._sendMessage(this._buildRequest(OCPPChargingStationCommand.CLEAR_CACHE));
  }

  public getConfiguration(params: OCPPGetConfigurationCommandParam): Promise<OCPPGetConfigurationCommandResult> {
    return this._sendMessage(this._buildRequest(OCPPChargingStationCommand.GET_CONFIGURATION, params));
  }

  public changeConfiguration(params: OCPPChangeConfigurationCommandParam): Promise<OCPPChangeConfigurationCommandResult> {
    return this._sendMessage(this._buildRequest(OCPPChargingStationCommand.CHANGE_CONFIGURATION, params));
  }

  public remoteStopTransaction(params: OCPPRemoteStopTransactionCommandParam): Promise<OCPPRemoteStopTransactionCommandResult> {
    return this._sendMessage(this._buildRequest(OCPPChargingStationCommand.REMOTE_STOP_TRANSACTION, params));
  }

  public unlockConnector(params: OCPPUnlockConnectorCommandParam): Promise<OCPPUnlockConnectorCommandResult> {
    return this._sendMessage(this._buildRequest(OCPPChargingStationCommand.UNLOCK_CONNECTOR, params));
  }

  public setChargingProfile(params: OCPPSetChargingProfileCommandParam): Promise<OCPPSetChargingProfileCommandResult> {
    return this._sendMessage(this._buildRequest(OCPPChargingStationCommand.SET_CHARGING_PROFILE, params));
  }

  public getCompositeSchedule(params: OCPPGetCompositeScheduleCommandParam): Promise<OCPPGetCompositeScheduleCommandResult> {
    return this._sendMessage(this._buildRequest(OCPPChargingStationCommand.GET_COMPOSITE_SCHEDULE, params));
  }

  public clearChargingProfile(params: OCPPClearChargingProfileCommandParam): Promise<OCPPClearChargingProfileCommandResult> {
    return this._sendMessage(this._buildRequest(OCPPChargingStationCommand.CLEAR_CHARGING_PROFILE, params));
  }

  public changeAvailability(params: OCPPChangeAvailabilityCommandParam): Promise<OCPPChangeAvailabilityCommandResult> {
    return this._sendMessage(this._buildRequest(OCPPChargingStationCommand.CHANGE_AVAILABILITY, params));
  }

  public getDiagnostics(params: OCPPGetDiagnosticsCommandParam): Promise<OCPPGetDiagnosticsCommandResult> {
    return this._sendMessage(this._buildRequest(OCPPChargingStationCommand.GET_DIAGNOSTICS, params));
  }

  public updateFirmware(params: OCPPUpdateFirmwareCommandParam): Promise<void> {
    return this._sendMessage(this._buildRequest(OCPPChargingStationCommand.UPDATE_FIRMWARE, params));
  }

  private async _openConnection(): Promise<any> {
    // Log
    Logging.logInfo({
      tenantID: this.tenantID,
      module: MODULE_NAME,
      source: this.chargingStation.id,
      method: 'onOpen',
      action: 'WSRestClientConnectionOpen',
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
      const wsClientOptions: JsonWSClientConfiguration  = {
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
          module: MODULE_NAME,
          source: this.chargingStation.id,
          method: 'onOpen',
          action: 'WSRestClientConnectionOpened',
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
          module: MODULE_NAME,
          source: this.chargingStation.id,
          method: 'onClose',
          action: 'WSRestClientConnectionClosed',
          message: `Connection closed from '${this.serverURL}'`
        });
      };
      // Handle Error Message
      this.wsConnection.onerror = (error) => {
        // Log
        Logging.logException(error, 'WSRestConnectionClosed', this.chargingStation.id, MODULE_NAME, 'onError', this.tenantID);
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
            module: MODULE_NAME,
            source: this.chargingStation.id,
            method: 'onMessage',
            action: 'WSRestClientMessage',
            message: `Received message '${message.data}'`,
            detailedMessages: messageJson
          });
          // Check if this corresponds to a request
          if (this.requests[messageJson[1]]) {
            // Check message type
            if (messageJson[0] === Constants.OCPP_JSON_CALL_ERROR_MESSAGE) {
              // Error message
              Logging.logError({
                tenantID: this.tenantID,
                module: MODULE_NAME,
                source: this.chargingStation.id,
                method: 'onMessage',
                action: 'WSRestClientErrorResponse',
                message: `${messageJson[3]}`,
                detailedMessages: messageJson
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
          Logging.logException(error, 'WSRestClientMessage', this.chargingStation.id, MODULE_NAME, 'onMessage', this.tenantID);
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
          module: MODULE_NAME,
          source: this.chargingStation.id,
          method: 'SendMessage',
          action: 'WSRestClientSendMessage',
          message: `Send message '${request[2]}'`,
          detailedMessages: request
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
