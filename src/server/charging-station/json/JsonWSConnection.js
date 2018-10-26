const uuid = require('uuid/v4');
const Logging = require('../../../utils/Logging');
const Tenant = require('../../../entity/Tenant');
const Constants = require('../../../utils/Constants');
const OCPPError = require('../../../exception/OcppError');
const JsonChargingStationClient16 = require('../../../client/json/JsonChargingStationClient16');
const JsonChargingStationService16 = require('./services/JsonChargingStationService16');

const MODULE_NAME = "JsonWSConnection";

class JsonWSConnection {

  constructor(socket, req, chargingStationConfig) {
    this._url = req.url;
    this._ip = req && ((req.connection && req.connection.remoteAddress) || req.headers['x-forwarded-for']);
    this._socket = socket;
    this._req = req;
    this._requests = {};
    this.tenantName = null;
    this.chargeBoxID = null;

    // Check URL: remove starting and trailing '/'
    if (this._url.endsWith('/')) {
      // Remove '/'
      this._url = this._url.substring(0, this._url.length - 1);
    }
    if (this._url.startsWith('/')) {
      // Remove '/'
      this._url = this._url.substring(1, this._url.length);
    }
    // Parse URL: should like /OCPP16/TENANTNAME/CHARGEBOXID
    const splittedURL = this._url.split("/");
    // URL with 4 parts?
    if (splittedURL.length === 3) {
      // Yes: Tenant is then provided in the third part
      this.tenantName = splittedURL[1];
      // The Charger is in the 4th position
      this.chargeBoxID = splittedURL[2];
    } else if (splittedURL.length === 2) {
      // 3 parts: no Tenant provided, get the Charging Station
      // Should not be supported when switched to tenant
      this.chargeBoxID = splittedURL[1];
    } else {
      // Throw
      throw new Error(`The URL '${req.url }' must contain the Charging Station ID (/OCPPxx/TENANT_NAME/CHARGEBOX_ID)`);
    }
    // Log
    Logging.logInfo({
      module: MODULE_NAME,
      source: this.chargeBoxID,
      method: "constructor",
      action: "WSConnection",
      message: `New connection from '${this._ip}', Protocol '${socket.protocol}', URL '${this._url}'`
    });
    // Check Protocol (required field of OCPP spec)
    switch (this._socket.protocol) {
      // OCPP 1.6?
      case 'ocpp1.6':
        // Create the Json Client
        this._chargingStationClient = new JsonChargingStationClient16(this);
        // Create the Json Server Service
        this._chargingStationService = new JsonChargingStationService16(chargingStationConfig);
        break;
      // Not Found
      default:
        throw new Error(`Protocol ${this._socket.protocol} not supported`);
    }
    // Handle incoming messages
    socket.on('message', (msg) => {
      // Forward
      this.onMessage(msg);
    });
    // Handle Error on Socket
    socket.on('error', (error) => {
      // Log
      Logging.logError({
        module: MODULE_NAME,
        method: "OnError",
        action: "WSErrorReceived",
        message: error
      });
    });
    // Handle Socket close
    socket.on('close', (code, reason) => {
      // Log
      Logging.logInfo({
        module: MODULE_NAME,
        source: (this.chargeBoxID ? this.chargeBoxID : ""),
        method: "OnClose",
        action: "WSConnectionClose",
        message: `Connection has been closed, Reason '${reason}', Code '${code}'`
      });
      // Close the connection
      global.centralSystemJson.closeConnection(this.getChargeBoxID());
    })
  }

  async initialize() {
    // Check
    if (this.hasOwnProperty('_headers')) {
      throw new Error(`Has already been initialized`);
    }
    // Check Tenant?
    if (this.tenantName) {
      // Check if the Tenant exists
      const tenant = await Tenant.getTenantByName(this.tenantName);
      // Found?
      if (!tenant) {
        // No: It is not allowed to connect with an unknown tenant
        Logging.logError({
          source: splittedURL[3],
          module: MODULE_NAME,
          method: "initialize",
          action: "WSRegiterConnection",
          message: `Invalid Tenant in URL ${this._url}`
        });
        // Throw
        throw new Error(`Invalid Tenant '${this.tenantName}' in URL '${this._url}'`);
      }
    }
    // Initialize the default Headers
    this._headers = {
      chargeBoxIdentity: this.chargeBoxID,
      ocppVersion: (this._socket.protocol.startsWith("ocpp") ? this._socket.protocol.replace("ocpp", "") : this._socket.protocol),
      tenant: this.tenantName,
      From: {
        Address: this._ip
      }
    }
  }

  async onMessage(message) {
    let messageType, messageId, commandName, commandPayload, errorDetails;
    console.log(message);

    try {
      // Parse the message
      [messageType, messageId, commandName, commandPayload, errorDetails] = JSON.parse(message);
      // Check the Type of message
      switch (messageType) {
        // Incoming Message
        case Constants.OCPP_JSON_CALL_MESSAGE:
          // Log 
          Logging.logReceivedAction(MODULE_NAME, this._headers.chargeBoxIdentity, commandName, message, this._headers);
          // Process the call
          await this.handleRequest(messageId, commandName, commandPayload);
          break;
        // Outcome Message
        case Constants.OCPP_JSON_CALL_RESULT_MESSAGE:
          // Log
          Logging.logReturnedAction(MODULE_NAME, this._headers.chargeBoxIdentity, commandName, {
            "result": message
          });
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
          // error response
          Logging.logError({
            module: MODULE_NAME,
            method: "sendMessage",
            action: "WSError",
            message: {
              message: messageId,
              error: JSON.stringify(message, null, " ")
            }
          });

          if (!this._requests[messageId]) {
            throw new Error(`Response for unknown message ${messageId}`);
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
      Logging.logException(error, "", this._headers.chargeBoxIdentity, MODULE_NAME, "onMessage");
    }
  }

  async handleRequest(messageId, commandName, commandPayload) {
    try {
      // Check if method exist in the service
      if (typeof this._chargingStationService["handle" + commandName] === 'function') {
        // Call it
        let result = await this._chargingStationService["handle" + commandName](Object.assign(commandPayload, this._wsConnection._headers));
        // Log
        Logging.logReturnedAction(MODULE_NAME, this.getChargeBoxID(), commandName, {
          "result": result
        });
        // Send Response
        await this.sendMessage(messageId, result, Constants.OCPP_JSON_CALL_RESULT_MESSAGE);
      } else {
        // Throw Exception
        throw new OCPPError(Constants.OCPP_ERROR_NOT_IMPLEMENTED, `The OCPP method 'handle${commandName}' has not been implemented`);
      }
    } catch (error) {
      // Log error
      Logging.logActionExceptionMessage(commandPayload, error);
      // Send error
      await this.sendError(messageId, error);
    }
  }

  send(command, messageType = Constants.OCPP_JSON_CALL_MESSAGE) {
    // Send Message
    return this.sendMessage(uuid(), command, messageType);
  }

  sendError(messageId, err) {
    // Check exception: only OCPP error are accepted
    const error = err instanceof OCPPError ? err : new OCPPError(Constants.OCPP_ERROR_INTERNAL_ERROR, err.message);

    // Send error
    return this.sendMessage(messageId, error, Constants.OCPP_JSON_CALL_ERROR_MESSAGE);
  }

  sendMessage(messageId, command, messageType = Constants.OCPP_JSON_CALL_RESULT_MESSAGE, commandName = "") {
    // send a message through websocket
    const socket = this._socket;
    const self = this;

    return new Promise((resolve, reject) => {
      let messageToSend;
      // Type of message
      switch (messageType) {
        // Request
        case Constants.OCPP_JSON_CALL_MESSAGE:
          // Build request
          this._requests[messageId] = [onResponse, onRejectResponse];
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
          const { code, message, details } = command;
          messageToSend = JSON.stringify([messageType, messageId, code, message, details]);
          break;
      }
      // Check if socket in ready
      if (socket.readyState === 1) {
        // Yes: Send Message
        socket.send(messageToSend);
      } else {
        // Reject it
        return onRejectResponse(`Socket closed ${messageId}`);
      }
      // Request?
      if (messageType !== Constants.OCPP_JSON_CALL_MESSAGE) {
        // Yes: send Ok
        resolve();
      } else {
        // Send timeout
        setTimeout(() => onRejectResponse(`Timeout for message ${messageId}`), Constants.OCPP_SOCKET_TIMEOUT);
      }

      // Function that will receive the request's response
      function onResponse(payload) {
        // Send the response
        return resolve(payload);
      }

      // Function that will receive the request's rejection
      function onRejectResponse(reason) {
        // Build Exception
        self._requests[messageId] = () => {};
        const error = reason instanceof OCPPError ? reason : new Error(reason);
        // Send error
        reject(error);
      }
    });
  }

  getChargeBoxID() {
    if (this._headers && typeof this._headers === 'object' && this._headers.hasOwnProperty('chargeBoxIdentity'))
      return this._headers.chargeBoxIdentity;
  }

  getWSClient() {
    if (this._socket.readyState === 1) // only return client if WS is open
      return this._chargingStationClient;
  }
}

module.exports = JsonWSConnection;