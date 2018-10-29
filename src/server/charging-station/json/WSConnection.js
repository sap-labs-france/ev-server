const uuid = require('uuid/v4');
const Logging = require('../../../utils/Logging');
const WebSocket = require('ws');
const Constants = require('../../../utils/Constants');
const OCPPError = require('../../../exception/OcppError');

const MODULE_NAME = "WSConnection";

class WSConnection {

  constructor(wsConnection, req, wsServer) {
    // Init
    this._url = req.url;
    this._ip = req && ((req.connection && req.connection.remoteAddress) || req.headers['x-forwarded-for']);
    this._wsConnection = wsConnection;
    this._req = req;
    this._requests = {};
    this._chargingStationID = null;
    this._initialized = false;
    this._wsServer = wsServer;

    // Check URL: remove starting and trailing '/'
    if (this._url.endsWith('/')) {
      // Remove '/'
      this._url = this._url.substring(0, this._url.length - 1);
    }
    if (this._url.startsWith('/')) {
      // Remove '/'
      this._url = this._url.substring(1, this._url.length);
    }
    // Handle incoming messages
    this._wsConnection.on('message', (message) => {
      // Forward
      this.onMessage(message);
    });
    // Handle Error on Socket
    this._wsConnection.on('error', (error) => {
      // Log
      Logging.logError({
        module: MODULE_NAME,
        method: "OnError",
        action: "WSErrorReceived",
        message: error
      });
    });
    // Handle Socket close
    this._wsConnection.on('close', (code, reason) => {
      // Log
      Logging.logInfo({
        module: MODULE_NAME,
        source: (this.getChargingStationID() ? this.getChargingStationID() : ""),
        method: "OnClose",
        action: "WSConnectionClose",
        message: `Connection has been closed, Reason '${reason}', Code '${code}'`
      });
      // Close the connection
      this._wsServer.removeConnection(this.getChargingStationID());
    });
  }

  getWSConnection() {
    return this._wsConnection;
  }

  getWSServer() {
    return this._wsServer;
  }

  getURL() {
    return this._url;
  }

  getIP() {
    return this._ip;
  }

  async initialize() {
    this._initialized = true;
  }

  async onMessage(message) {
    // Parse the message
    let [messageType, messageId, commandName, commandPayload, errorDetails] = JSON.parse(message);

    try {
      // Initialize: done in the message as init could be lengthy and first message may be lost
      await this.initialize();

      // Check the Type of message
      switch (messageType) {
        // Incoming Message
        case Constants.OCPP_JSON_CALL_MESSAGE:
          // Process the call
          await this.handleRequest(messageId, commandName, commandPayload);
          break;
          // Outcome Message
        case Constants.OCPP_JSON_CALL_RESULT_MESSAGE:
          // Respond
          const [responseCallback] = this._requests[messageId];
          if (!responseCallback) {
            throw new Error(`Response for unknown message ${messageId}`);
          }
          delete this._requests[messageId];
          responseCallback(commandName);
          break;
          // Error Message
        case Constants.OCPP_JSON_CALL_ERROR_MESSAGE:
          // Log
          Logging.logError({
            module: MODULE_NAME,
            method: "sendMessage",
            action: "WSError",
            message: {
              messageID: messageId,
              error: JSON.stringify(message, null, " ")
            }
          });
          if (!this._requests[messageId]) {
            throw new Error(`Error for unknown message ${messageId}`);
          }
          const [, rejectCallback] = this._requests[messageId];
          delete this._requests[messageId];
          rejectCallback(new OCPPError(commandName, commandPayload, errorDetails));
          break;
          // Error
        default:
          throw new Error(`Wrong message type ${messageType}`);
      }
    } catch (error) {
      // Log
      Logging.logException(error, "", this.getChargingStationID(), MODULE_NAME, "onMessage");
      // Send error
      await this.sendError(messageId, error);
    }
  }

  async handleRequest(messageId, commandName, commandPayload) {
    // To implement in sub-class
  }

  send(command, messageType = Constants.OCPP_JSON_CALL_MESSAGE) {
    // Send Message
    return this.sendMessage(uuid(), command, messageType);
  }

  sendError(messageId, err) {
    // Check exception: only OCPP error are accepted
    const error = (err instanceof OCPPError ? err : new OCPPError(Constants.OCPP_ERROR_INTERNAL_ERROR, err.message));
    // Send error
    return this.sendMessage(messageId, error, Constants.OCPP_JSON_CALL_ERROR_MESSAGE);
  }

  sendMessage(messageId, command, messageType = Constants.OCPP_JSON_CALL_RESULT_MESSAGE, commandName = "") {
    // send a message through webwsConnection
    const wsConnection = this.getWSConnection();
    const self = this;
    // Create a promise
    return new Promise((resolve, reject) => {
      let messageToSend;
      // Type of message
      switch (messageType) {
        // Request
        case Constants.OCPP_JSON_CALL_MESSAGE:
          // Build request
          this._requests[messageId] = [responseCallback, rejectCallback];
          messageToSend = JSON.stringify([messageType, messageId, commandName, command]);
          break;
          // Response
        case Constants.OCPP_JSON_CALL_RESULT_MESSAGE:
          // Build response
          messageToSend = JSON.stringify([messageType, messageId, command]);
          break;
          // Error Message
        case Constants.OCPP_JSON_CALL_ERROR_MESSAGE:
          // Build Message
          const {
            code,
            message,
            details
          } = command;
          messageToSend = JSON.stringify([messageType, messageId, code, message, details]);
          break;
      }
      // Check if wsConnection in ready
      if (wsConnection.readyState === WebSocket.OPEN) {
        // Yes: Send Message
        wsConnection.send(messageToSend);
      } else {
        // Reject it
        return rejectCallback(`Socket closed ${messageId}`);
      }
      // Request?
      if (messageType !== Constants.OCPP_JSON_CALL_MESSAGE) {
        // Yes: send Ok
        resolve();
      } else {
        // Send timeout
        setTimeout(() => rejectCallback(`Timeout for message ${messageId}`), Constants.OCPP_SOCKET_TIMEOUT);
      }

      // Function that will receive the request's response
      function responseCallback(payload) {
        // Send the response
        resolve(payload);
      }

      // Function that will receive the request's rejection
      function rejectCallback(reason) {
        // Build Exception
        self._requests[messageId] = () => {};
        const error = reason instanceof OCPPError ? reason : new Error(reason);
        // Send error
        reject(error);
      }
    });
  }

  getChargingStationID() {
    return this._chargingStationID;
  }

  setChargingStationID(chargingStationID) {
    this._chargingStationID = chargingStationID;
  }
}

module.exports = WSConnection;