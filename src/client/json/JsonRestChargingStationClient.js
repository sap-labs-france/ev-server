const uuid = require('uuid/v4');
const WebSocket = require('ws');
const ChargingStationClient = require('../ChargingStationClient');
const Logging = require('../../utils/Logging');

const MODULE_NAME = "JsonRestChargingStationClient";
const OCPP_JSON_CALL_MESSAGE = 2;

class JsonRestChargingStationClient extends ChargingStationClient {
  constructor(chargingStation) {
    super();
    // Keep
    this._chargingStation = chargingStation;
    this._serverURL = `${this._chargingStation.getChargingStationURL()}/REST/${chargingStation.getID()}`;
    this._requests = {};
  }

  startTransaction(params) {
    return this._send(
      this._buildRequest('StartTransaction', params)
    );
  }

  reset(params) {
    return this._send(
      this._buildRequest('Reset', params)
    );
  }

  clearCache() {
    return this._send(
      this._buildRequest('ClearCache')
    );
  }

  getConfiguration(params) {
    return this._send(
      this._buildRequest('GetConfiguration', params)
    );
  }

  changeConfiguration(params) {
    return this._send(
      this._buildRequest('ChangeConfiguration', params)
    );
  }

  stopTransaction(params) {
    return this._send(
      this._buildRequest('RemoteStopTransaction', params)
    );
  }

  unlockConnector(params) {
    return this._send(
      this._buildRequest('UnlockConnector', params)
    );
  }

  _openConnection() {
    return new Promise((resolve, reject) => {
      // Create WS
      this._wsConnection = new WebSocket(this._serverURL, {
        protocol: 'rest'
      });
      // Opened
      this._wsConnection.onopen = () => {
        // connection is opened and ready to use
        resolve();
      };
      // Handle Error Message
      this._wsConnection.onerror = (error) => {
        // Log
        Logging.logError({
          module: MODULE_NAME,
          method: "OnError",
          action: "WSErrorReceived",
          message: error
        });
      };
      // Handle Server Message
      this._wsConnection.onmessage = async (message) => {
        try {
          // Parse the message 
          const messageJson = JSON.parse(message.data);
          // Check if this corresponds to a request
          if (this._requests[messageJson[1]]) {
            const response = {};
            // Set the data
            response.data = messageJson[2];
            // Respond to the request
            this._requests[messageJson[1]].resolve(response);
            // Close WS
            await this._closeConnection();
          }
        } catch (error) {
          // Log
          Logging.logException(error, "", this._chargingStation.getID(), MODULE_NAME, "onMessage");
        }
      };
    })
  }

  _closeConnection() {
    // Close
    if (this.wsConnection) {
      this.wsConnection.close();
      this.wsConnection = null;
    }
  }

  async _send(request) {
    // Open WS
    await this._openConnection();
    // Send
    await this._wsConnection.send(JSON.stringify(request));
    // Return a promise
    return new Promise((resolve, reject) => {
      // Set the resolve function
      this._requests[request[1]] = { resolve, reject };
    });
  }

  _buildRequest(command, params={}) {
    // Build the request
    return [
      OCPP_JSON_CALL_MESSAGE,
      uuid(),
      command,
      params];
  }
}

module.exports = JsonRestChargingStationClient;