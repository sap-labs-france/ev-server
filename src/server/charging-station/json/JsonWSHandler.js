const uuid = require('uuid/v4');
const Logging = require('../../../utils/Logging');
const WebSocket = require('ws');
const Tenant = require('../../../model/Tenant');
const Constants = require('../../../utils/Constants');
const OCPPError = require('../../../exception/OcppError');
const JsonChargingStationClient16 = require('../../../client/json/JsonChargingStationClient16');
const JsonChargingStationService16 = require('./JsonChargingStationService16');

const _moduleName = "centralSystemJSONService";

class JsonWSHandler {

  constructor(socket, req, chargingStationConfig) {
    this._socket = socket;
    this._req = req;
    this._requests = {};

    if (req) {
      this._url = req && req.url;
      this._ip = req && ((req.connection && req.connection.remoteAddress) || req.headers['x-forwarded-for']);
      Logging.logInfo({
        module: _moduleName,
        method: "constructor",
        action: "Connection",
        message: `New connection from '${this._ip}', Protocol '${socket.protocol}', URL '${this._url}'`
      });

      if (this._url.startsWith("/OCPP16/") === false) { //In princple already checked in connection opening from server
        throw new Error(`Invalid URL ${this._url}`);
      }
    } else {
      // should not happen as connection is initiated by the box always
      throw new Error(`Invalid URL ${this._url}`);
    }

    switch (this._socket.protocol) { //it is a require field of OCPP spec
      case 'ocpp1.6':
        this._wsClient = new JsonChargingStationClient16(this);
        this._wsServer = new JsonChargingStationService16(this, chargingStationConfig);
        break;
      default:
        throw new Error("protocol not supported");
    }

    socket.on('message', (msg) => {
      try {
        this.onMessage(msg);
      } catch (error) {
        Logging.logError({
          module: _moduleName,
          method: "OnMessage",
          action: "",
          message: err
        });
      }
    });

    socket.on('error', (err) => {
      Logging.logError({
        module: _moduleName,
        method: "OnError",
        action: "",
        message: err
      });
    });

    socket.on('close', (code, reason) => {
      Logging.logWarning({
        module: _moduleName,
        method: "OnClose",
        action: "ConnectionClose",
        message: JSON.stringify({
          code: code,
          reason: reason
        }, null, " ")
      });
      global.centralWSServer.closeConnection(this.getChargeBoxId());
    })
  }

  async initialize() {
    if (this.hasOwnProperty('_headers')) {
      throw new Error(`Has already been initialized`);
    }
    // Fill in standard JSON object for communication with central server
    // Determine tenant
    const splittedURL = this._url.split("/"); //URL should like /OCPP16/TENANTNAME/CHARGEBOXID
    let tenantName = "";
    let chargboxId = "";
    if (splittedURL.length === 4) {
      tenantName = splittedURL[2];
      const checkTenant = await Tenant.getTenantByName(tenantName);
      if (checkTenant === null) { // It is not allowed to connect with an unknown tenant
        Logging.logError({
          module: _moduleName,
          method: "initialize",
          action: "",
          message: `Invalid tenant URL ${this._url}`
        });
        throw new Error(`Invalid tenant URL ${this._url}`);
      }
      chargboxId = splittedURL[3];
    } else {
      chargboxId = splittedURL[2];
    }

    this._headers = {
      chargeBoxIdentity: chargboxId, // URL must be /OCPP16/CHARGEBOXID as defined by the standard
      ocppVersion: (this._socket.protocol.startsWith("ocpp") ? this._socket.protocol.replace("ocpp", "") : this._socket.protocol),
      tenant: tenantName,
      From: {
        Address: this._ip
      }
    }
  }

  async onMessage(message) {
    let messageType, messageId, commandNameOrPayload, commandPayload, errorDetails;

    try {
      [messageType, messageId, commandNameOrPayload, commandPayload, errorDetails] = JSON.parse(message);
    } catch (err) {
      throw new Error(`Failed to parse message: '${message}', ${err.message}`);
    }

    switch (messageType) {
      case Constants.OCPP_JSON_CALL_MESSAGE:
        // request 
        Logging.logReceivedAction(_moduleName, this._headers.chargeBoxIdentity, commandNameOrPayload, message, this._headers);
        await this._wsServer.onCallMessage(messageType, messageId, commandNameOrPayload, commandPayload, errorDetails);
        break;

      case Constants.OCPP_JSON_CALLRESULT_MESSAGE:
        // response
        Logging.logReturnedAction(_moduleName, this._headers.chargeBoxIdentity, commandNameOrPayload, {
          "result": message
        });
        const [responseCallback] = this._requests[messageId];
        if (!responseCallback) {
          throw new Error(`Response for unknown message ${messageId}`);
        }
        delete this._requests[messageId];

        responseCallback(commandNameOrPayload);
        break;

      case Constants.OCPP_JSON_CALLERROR_MESSAGE:
        // error response
        Logging.logError({
          module: _moduleName,
          method: "sendMessage",
          action: "ErrorMessage",
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

        rejectCallback(new OCPPError(commandNameOrPayload, commandPayload, errorDetails));
        break;
      default:
        throw new Error(`Wrong message type ${messageType}`);
    }
  }

  send(command, messageType = Constants.OCPP_JSON_CALL_MESSAGE) {
    return this.sendMessage(uuid(), command, messageType);
  }

  sendError(messageId, err) {
    const error = err instanceof OCPPError ? err : new OCPPError(Constants.OCPP_ERROR_INTERNALERROR, err.message);

    return this.sendMessage(messageId, error, Constants.OCPP_JSON_CALLERROR_MESSAGE);
  }

  sendMessage(messageId, command, messageType = Constants.OCPP_JSON_CALLRESULT_MESSAGE, commandName = "") {
    // send a message through websocket
    const socket = this._socket;
    const self = this;

    return new Promise((resolve, reject) => {
      let messageToSend;

      switch (messageType) {
        case Constants.OCPP_JSON_CALL_MESSAGE:
          this._requests[messageId] = [onResponse, onRejectResponse];
          messageToSend = JSON.stringify([messageType, messageId, commandName, command]);
          break;
        case Constants.OCPP_JSON_CALLRESULT_MESSAGE:
          messageToSend = JSON.stringify([messageType, messageId, command]);
          break;
        case Constants.OCPP_JSON_CALLERROR_MESSAGE:
          const {
            code,
            message,
            details
          } = command;
          messageToSend = JSON.stringify([messageType, messageId, code, message, details]);
          break;
      }

      if (socket.readyState === 1) {
        socket.send(messageToSend);
      } else {
        return onRejectResponse(`Socket closed ${messageId}`);
      }
      if (messageType !== Constants.OCPP_JSON_CALL_MESSAGE) {
        resolve();
      } else {
        setTimeout(() => onRejectResponse(`Timeout for message ${messageId}`), Constants.OCPP_SOCKET_TIMEOUT);
      }

      function onResponse(payload) {
        //                const response = command.createResponse(payload);
        return resolve(payload);
      }

      function onRejectResponse(reason) {
        self._requests[messageId] = () => {};
        const error = reason instanceof OCPPError ? reason : new Error(reason);
        reject(error);
      }
    });
  }

  getChargeBoxId() {
    if (this._headers && typeof this._headers === 'object' && this._headers.hasOwnProperty('chargeBoxIdentity'))
      return this._headers.chargeBoxIdentity;
  }

  getWSClient() {
    if (this._socket.readyState === 1) // only return client if WS is open
      return this._wsClient;
  }

}

module.exports = JsonWSHandler;