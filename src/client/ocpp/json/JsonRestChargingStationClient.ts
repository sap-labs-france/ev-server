import uuid from 'uuid/v4';
import ChargingStationClient from '../ChargingStationClient';
import Configuration from '../../../utils/Configuration';
import Constants from '../../../utils/Constants';
import Logging from '../../../utils/Logging';
import WSClient from '../../WSClient';

const MODULE_NAME = 'JsonRestChargingStationClient';
export default class JsonRestChargingStationClient extends ChargingStationClient {
  private serverURL: any;
  private chargingStation: any;
  private requests: any;
  private wsConnection: WSClient;

  constructor(chargingStation) {
    super();
    // Get URL
    let chargingStationURL = chargingStation.getChargingStationURL();
    // Check URL: remove starting and trailing '/'
    if (chargingStationURL.endsWith('/')) {
      // Remove '/'
      chargingStationURL = chargingStationURL.substring(0, chargingStationURL.length - 1);
    }
    // Keep
    this.serverURL = `${chargingStationURL}/REST/${chargingStation.getTenantID()}/${chargingStation.id}`;
    this.chargingStation = chargingStation;
    this.requests = {};
  }

  remoteStartTransaction(params) {
    return this._sendMessage(
      this._buildRequest('RemoteStartTransaction', params)
    );
  }

  reset(params) {
    return this._sendMessage(
      this._buildRequest('Reset', params)
    );
  }

  clearCache() {
    return this._sendMessage(
      this._buildRequest('ClearCache')
    );
  }

  getConfiguration(params) {
    return this._sendMessage(
      this._buildRequest('GetConfiguration', params)
    );
  }

  changeConfiguration(params) {
    return this._sendMessage(
      this._buildRequest('ChangeConfiguration', params)
    );
  }

  remoteStopTransaction(params) {
    return this._sendMessage(
      this._buildRequest('RemoteStopTransaction', params)
    );
  }

  unlockConnector(params) {
    return this._sendMessage(
      this._buildRequest('UnlockConnector', params)
    );
  }

  setChargingProfile(params) {
    return this._sendMessage(this._buildRequest('SetChargingProfile', params));
  }

  getCompositeSchedule(params) {
    return this._sendMessage(this._buildRequest('GetCompositeSchedule', params));
  }

  clearChargingProfile(params) {
    return this._sendMessage(this._buildRequest('ClearChargingProfile', params));
  }

  changeAvailability(params) {
    return this._sendMessage(this._buildRequest('ChangeAvailability', params));
  }

  getDiagnostics(params) {
    return this._sendMessage(this._buildRequest('GetDiagnostics', params));
  }

  updateFirmware(params) {
    return this._sendMessage(this._buildRequest('UpdateFirmware', params));
  }

  async _openConnection(): Promise<any> {
    // Log
    Logging.logInfo({
      tenantID: this.chargingStation.getTenantID(),
      module: MODULE_NAME,
      source: this.chargingStation.id,
      method: 'onOpen',
      action: 'WSRestClientConnectionOpen',
      message: `Try to connect to '${this.serverURL}', CF Instance '${this.chargingStation.getCFApplicationIDAndInstanceIndex()}'`
    });
    // Create Promise
    // eslint-disable-next-line no-undef
    return await new Promise((resolve, reject) => {
      // Create WS
      let WSOptions = {};
      if (Configuration.isCloudFoundry()) {
        WSOptions = {
          protocol: 'rest',
          headers: { 'X-CF-APP-INSTANCE': this.chargingStation.getCFApplicationIDAndInstanceIndex() }
        };
      } else {
        WSOptions = {
          protocol: 'rest'
        };
      }
      const wsClientOptions = {
        WSOptions: WSOptions,
        autoReconnectTimeout: Configuration.getWSClientConfig().autoReconnectTimeout,
        autoReconnectMaxRetries: Configuration.getWSClientConfig().autoReconnectMaxRetries,
        logTenantID: this.chargingStation.getTenantID()
      };
      this.wsConnection = new WSClient(this.serverURL, wsClientOptions);
      // Opened
      this.wsConnection.onopen = () => {
        // Log
        Logging.logInfo({
          tenantID: this.chargingStation.getTenantID(),
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
          tenantID: this.chargingStation.getTenantID(),
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
        Logging.logException(error, 'WSRestConnectionClosed', this.chargingStation.id, MODULE_NAME, 'onError', this.chargingStation.getTenantID());
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
            tenantID: this.chargingStation.getTenantID(),
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
                tenantID: this.chargingStation.getTenantID(),
                module: MODULE_NAME,
                source: this.chargingStation.id,
                method: 'onMessage',
                action: 'WSRestClientErrorResponse',
                message: `OCPP error response for '${JSON.stringify(messageJson[2])}'`,
                detailedMessages: `Details: ${JSON.stringify(messageJson[3])}`
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
          Logging.logException(error, '', this.chargingStation.id, MODULE_NAME, 'onMessage', this.chargingStation.getTenantID());
        }
      };
    });
  }

  _closeConnection() {
    // Close
    if (this.wsConnection) {
      this.wsConnection.close();
      this.wsConnection = null;
    }
  }

  _terminateConnection() {
    // Terminate
    if (this.wsConnection) {
      this.wsConnection.terminate();
      this.wsConnection = null;
    }
  }

  async _sendMessage(request) {
    // Return a promise
    // eslint-disable-next-line no-undef
    const promise = await new Promise(async (resolve, reject) => {
      // Open WS Connection
      await this._openConnection();
      // Check if wsConnection in ready
      if (this.wsConnection.isConnectionOpen()) {
        // Log
        Logging.logDebug({
          tenantID: this.chargingStation.getTenantID(),
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

  _buildRequest(command, params = {}) {
    // Build the request
    return [
      Constants.OCPP_JSON_CALL_MESSAGE,
      uuid(),
      command,
      params];
  }
}
