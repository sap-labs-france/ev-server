const uuid = require('uuid/v4');
const Logging = require('../../../utils/Logging');
const WebSocket = require('ws');
const ChargingStation = require('../../../model/ChargingStation');
const Constants = require('../../../utils/Constants');
const OCPPError = require('../../../exception/OcppError');
const WSConnection = require('./WSConnection');

const MODULE_NAME = "RestWSConnection";

class RestWSConnection extends WSConnection {
  constructor(socket, req, wsServer) {
    // Call super
    super(socket, req, wsServer);
    // Log
    Logging.logInfo({
      module: MODULE_NAME,
      source: this.chargeBoxID,
      method: "constructor",
      action: "WSRestConnectionOpened",
      message: `New Rest connection from '${this._ip}', Protocol '${socket.protocol}', URL '${this._url}'`
    });
  }

  async handleRequest(messageId, commandName, commandPayload) {
    console.log({messageId, commandName, commandPayload});
    
    // Check
    if (!commandPayload.chargingStationID) {
      // Throw
      throw new Error(`Rest request '${commandName}' must contain the Charging Station ID`);
    }
    // Set
    this.setChargingStationID(commandPayload.chargingStationID);
    // Get the Charging Station
    let chargingStation = await ChargingStation.getChargingStation(this.getChargingStationID());
    // Found?
    if (!chargingStation) {
      // Throw
      throw new Error(`Charging Station '${this.getChargingStationID()}' not found for Rest request '${commandName}'`);
    }
    // Get the WS client
    let wsClient = await chargingStation.getChargingStationClient();
    // Check
    console.log(wsClient);
    
    if (!wsClient) {
      // Throw
      throw new Error(`Charging Station '${this.getChargingStationID()}' is not connected to the Json server`);
    }
    // Call
  }
}

module.exports = RestWSConnection;