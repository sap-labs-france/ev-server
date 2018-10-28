const Logging = require('../../../utils/Logging');
const ChargingStation = require('../../../model/ChargingStation');
const Constants = require('../../../utils/Constants');
const WSConnection = require('./WSConnection');

const MODULE_NAME = "RestWSConnection";

class RestWSConnection extends WSConnection {
  constructor(socket, req, wsServer) {
    // Call super
    super(socket, req, wsServer);
    // Parse URL: should like /OCPP16/TENANTNAME/CHARGEBOXID
    const splittedURL = this._url.split("/");
    // Check
    if (splittedURL.length === 2) {
      // Set Charger ID
      this.setChargingStationID(splittedURL[1]);
    } else {
      // Throw
      throw new Error(`The URL '${req.url }' must contain the Charging Station ID (/REST/CHARGEBOX_ID)`);
    }
    // Log
    Logging.logInfo({
      module: MODULE_NAME,
      source: this.getChargingStationID(),
      method: "constructor",
      action: "WSRestConnectionOpened",
      message: `New Rest connection from '${this._ip}', Protocol '${socket.protocol}', URL '${this._url}'`
    });
  }

  async handleRequest(messageId, commandName, commandPayload) {
    // Log
    Logging.logReceivedAction(MODULE_NAME, this.getChargingStationID(), commandName, commandPayload);
    // Get the Charging Station
    let chargingStation = await ChargingStation.getChargingStation(this.getChargingStationID());
    // Found?
    if (!chargingStation) {
      // Throw
      throw new Error(`Charging Station '${this.getChargingStationID()}' not found for Rest request '${commandName}'`);
    }
    // Handle action
    let result = await chargingStation.handleAction(commandName, commandPayload.params);
    // Log
    Logging.logReturnedAction(MODULE_NAME, this.getChargingStationID(), commandName, result);
    // Send Response
    await this.sendMessage(messageId, result, Constants.OCPP_JSON_CALL_RESULT_MESSAGE);
  }
}

module.exports = RestWSConnection;