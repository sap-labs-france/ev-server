const uuid = require('uuid/v4');
const WebSocket = require('ws');
const ChargingStationClient = require('../ChargingStationClient');
const Logging = require('../../utils/Logging');

const MODULE_NAME = "JsonRestChargingStationClient";
const OCPP_JSON_CALL_MESSAGE = 2;

class JsonRestChargingStationClient extends ChargingStationClient {
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
    this._serverURL = `${chargingStationURL}/REST/${chargingStation.getID()}`;
    this._chargingStation = chargingStation;
    this._requests = {};
  }

  startTransaction(params) {
    return this._sendMessage(
      this._buildRequest('StartTransaction', params)
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

  stopTransaction(params) {
    return this._sendMessage(
      this._buildRequest('RemoteStopTransaction', params)
    );
  }

  unlockConnector(params) {
    return this._sendMessage(
      this._buildRequest('UnlockConnector', params)
    );
  }

  _openConnection() {
    // Log
    Logging.logInfo({
      module: MODULE_NAME,
      source: this._chargingStation.getID(),
      method: "onOpen",
      action: "WSRestClientConnectionOpen",
      message: `Try to connect to '${this._serverURL}', CF Instance '${this._chargingStation.getCFApplicationIDAndInstanceIndex()}'`
    });
    // Create Promise
    return new Promise((resolve, reject) => {
      // Create WS
      this._wsConnection = new WebSocket(this._serverURL, {
        protocol: 'rest',
        headers: { 'X-CF-APP-INSTANCE': this._chargingStation.getCFApplicationIDAndInstanceIndex() }
      });
      // Opened
      this._wsConnection.onopen = () => {
        // Log
        Logging.logInfo({
          module: MODULE_NAME,
          source: this._chargingStation.getID(),
          method: "onOpen",
          action: "WSRestClientConnectionOpened",
          message: `Connection opened to '${this._serverURL}'`
        });
        // connection is opened and ready to use
        resolve();
      };
      // Closed
      this._wsConnection.onclose = () => {
        // Log
        Logging.logInfo({
          module: MODULE_NAME,
          source: this._chargingStation.getID(),
          method: "onClose",
          action: "WSRestClientConnectionClosed",
          message: `Connection closed from '${this._serverURL}'`
        });
      };
      // Handle Error Message
      this._wsConnection.onerror = (error) => {
        // Log
        Logging.logException(error, "WSRestConnectionClosed", this._chargingStation.getID(), MODULE_NAME, "onError");
        // Reject
        reject();
      };
      // Handle Server Message
      this._wsConnection.onmessage = async (message) => {
        try {
          // Parse the message 
          const messageJson = JSON.parse(message.data);
          // Log
          Logging.logDebug({
            module: MODULE_NAME,
            source: this._chargingStation.getID(),
            method: "onMessage",
            action: "WSRestClientMessage",
            message: `Received message '${message.data}'`,
            detailedMessages: messageJson
          });
          // Check if this corresponds to a request
          if (this._requests[messageJson[1]]) {
            // Respond to the request
            this._requests[messageJson[1]].resolve(messageJson[2]);
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
    if (this._wsConnection) {
      this._wsConnection.close();
      this._wsConnection = null;
    }
  }

  async _sendMessage(request) {
    // Return a promise
    return new Promise(async (resolve, reject) => {
      // Open WS Connection
      await this._openConnection();
      // Check if wsConnection in ready
      if (this._wsConnection.readyState === WebSocket.OPEN) {
        // Log
        Logging.logDebug({
          module: MODULE_NAME,
          source: this._chargingStation.getID(),
          method: "SendMessage",
          action: "WSRestClientSendMessage",
          message: `Send message '${request[2]}'`,
          detailedMessages: request
        });
        // Send
        await this._wsConnection.send(JSON.stringify(request));
        // Set the resolve function
        this._requests[request[1]] = { resolve, reject };
      } else {
        // Reject it
        return reject(`Socket is closed for message ${messageId}`);
      }
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