const uuid = require('uuid/v4');
const Logging = require('../../../utils/Logging');
const WebSocket = require('ws');
const Tenant = require('../../../model/Tenant');
const ChargingStation = require('../../../model/ChargingStation');
const Constants = require('../../../utils/Constants');
const OCPPError = require('../../../exception/OcppError');
const JsonChargingStationClient16 = require('../../../client/json/JsonChargingStationClient16');
const JsonChargingStationService16 = require('./services/JsonChargingStationService16');

const MODULE_NAME = "RestWSConnection";

class RestWSConnection {

  constructor(socket, req, wsServer) {
    this._url = req.url;
    this._ip = req && ((req.connection && req.connection.remoteAddress) || req.headers['x-forwarded-for']);
    this._socket = socket;
    this._req = req;
    this._wsServer = wsServer;

    // Log
    Logging.logInfo({
      module: MODULE_NAME,
      source: this.chargeBoxID,
      method: "constructor",
      action: "WSRestConnectionOpened",
      message: `New Rest connection from '${this._ip}', Protocol '${socket.protocol}', URL '${this._url}'`
    });
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
        action: "WSRestErrorReceived",
        message: error
      });
    });
    // Handle Socket close
    socket.on('close', (code, reason) => {
      // Log
      Logging.logInfo({
        module: MODULE_NAME,
        method: "OnClose",
        action: "WSRestConnectionClose",
        message: `Rest Connection has been closed, Reason '${reason}', Code '${code}'`
      });
    });
  }

  async onMessage(message) {
    try {
      // Parse the message
      let { chargingStationID, command, params } = JSON.parse(message);
      // Get the Charging Station client
      let chargingStationClient = this._wsServer.getChargingStationClient(chargingStationID);
      if (!chargingStationClient) {
        // Error
        throw new Error(`Charging Station '${chargingStationID}' is not connected`);
      }
      // Check the Type of message
      switch (messageType) {
        // Incoming Message
        case Constants.OCPP_JSON_CALL_MESSAGE:
          // Process the call
          break;
        // Outcome Message
        case Constants.OCPP_JSON_CALL_RESULT_MESSAGE:
          break;
        // Error Message
        case Constants.OCPP_JSON_CALL_ERROR_MESSAGE:
          // Log
          Logging.logError({
            module: MODULE_NAME,
            method: "sendMessage",
            action: "WSRestError",
            message: {
              message: messageId,
              error: JSON.stringify(message, null, " ")
            }
          });
          break;
        // Error
        default:
          throw new Error(`Wrong message type ${messageType}`);
      }
    } catch (error) {
      // Log
      Logging.logException(error, chargingStationID, "", MODULE_NAME, "onMessage");
      // Send error
      await this.sendError("", error);
    }
  }

  sendError(messageId, err) {
    // Check exception: only OCPP error are accepted
    const error = err instanceof OCPPError ? err : new OCPPError(Constants.OCPP_ERROR_INTERNAL_ERROR, err.message);

    // Send error
    return this.sendMessage(messageId, error, Constants.OCPP_JSON_CALL_ERROR_MESSAGE);
  }
}

module.exports = RestWSConnection;