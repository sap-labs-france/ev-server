const Logging = require('../../../utils/Logging');
const ChargingStation = require('../../../entity/ChargingStation');
const Constants = require('../../../utils/Constants');
const WSConnection = require('./WSConnection');

const MODULE_NAME = "JsonRestWSConnection";

class JsonRestWSConnection extends WSConnection {
  constructor(wsConnection, req, wsServer) {
    // Call super
    super(wsConnection, req, wsServer);
    // Parse URL: should like /OCPP16/TENANTNAME/CHARGEBOXID
    const splittedURL = this.getURL().split("/");
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
      message: `New Rest connection from '${this.getIP()}', Protocol '${wsConnection.protocol}', URL '${this.getURL()}'`
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
      throw new Error(`'${this.getChargingStationID()}' > '${commandName}': Charging Station not found`);
    }
    // Get the client from JSon Server
    let chargingStationClient = global.centralSystemJson.getChargingStationClient(chargingStation.getID());
    if (!chargingStationClient) {
      // Throw
      throw new Error(`'${this.getChargingStationID()}' > '${commandName}': Charging Station is not connected to this server'`);
    }
    // Call the client
    let result; 
    // Build the method
    const actionMethod = commandName[0].toLowerCase() + commandName.substring(1);
    // Call
    if (typeof chargingStationClient[actionMethod] === 'function') {
      // Call the method
      result = chargingStationClient[actionMethod](commandPayload);
    } else {
      // Throw Exception
      throw new Error(`'${this.getChargingStationID()}' > '${commandName}' is not implemented`);
    }
    // Log
    Logging.logReturnedAction(MODULE_NAME, this.getChargingStationID(), commandName, result);
    // Send Response
    await this.sendMessage(messageId, result, Constants.OCPP_JSON_CALL_RESULT_MESSAGE);
  }
}

module.exports = JsonRestWSConnection;