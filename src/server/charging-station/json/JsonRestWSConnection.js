const Logging = require('../../../utils/Logging');
const ChargingStation = require('../../../entity/ChargingStation');
const Constants = require('../../../utils/Constants');
const BackendError = require('../../../exception/BackendError');
const WSConnection = require('./WSConnection');

const MODULE_NAME = "JsonRestWSConnection";

class JsonRestWSConnection extends WSConnection {
  constructor(wsConnection, req, wsServer) {
    // Call super
    super(wsConnection, req, wsServer);
    // Log
    Logging.logInfo({
      module: MODULE_NAME,
      source: this.getChargingStationID(),
      method: "onOpen",
      action: "WSRestServerConnectionOpened",
      message: `New Rest connection from '${this.getIP()}', Protocol '${wsConnection.protocol}', URL '${this.getURL()}'`
    });
  }

  onError(error) {
    // Log
    Logging.logError({
      module: MODULE_NAME,
      method: "onError",
      action: "WSRestServerErrorReceived",
      message: error
    });
  }
  
  onClose(code, reason) {
    // Log
    Logging.logInfo({
      module: MODULE_NAME,
      source: (this.getChargingStationID() ? this.getChargingStationID() : ""),
      method: "onClose",
      action: "WSRestServerConnectionClosed",
      message: `Connection has been closed, Reason '${reason}', Code '${code}'`
    });
    // Remove the connection
    this._wsServer.removeRestConnection(this);
  }

  async handleRequest(messageId, commandName, commandPayload) {
    // Log
    Logging.logReceivedAction(MODULE_NAME, this.getChargingStationID(), commandName, commandPayload);
    // Get the Charging Station
    let chargingStation = await ChargingStation.getChargingStation(this.getChargingStationID());
    // Found?
    if (!chargingStation) {
      // Error
      throw new BackendError(this.getChargingStationID(), `'${commandName}' not found`,
        "JsonRestWSConnection", "handleRequest", commandName);
    }
    // Get the client from JSon Server
    let chargingStationClient = global.centralSystemJson.getChargingStationClient(chargingStation.getID());
    if (!chargingStationClient) {
      // Error
      throw new BackendError(this.getChargingStationID(), `Charger not connected to this instance`,
        "JsonRestWSConnection", "handleRequest", commandName);
    }
    // Call the client
    let result; 
    // Build the method
    const actionMethod = commandName[0].toLowerCase() + commandName.substring(1);
    // Call
    if (typeof chargingStationClient[actionMethod] === 'function') {
      // Call the method
      result = await chargingStationClient[actionMethod](commandPayload);
    } else {
      // Error
      throw new BackendError(this.getChargingStationID(), `'${actionMethod}' is not implemented`,
        "JsonRestWSConnection", "handleRequest", commandName);
    }
    // Log
    Logging.logReturnedAction(MODULE_NAME, this.getChargingStationID(), commandName, result);
    // Send Response
    await this.sendMessage(messageId, result, Constants.OCPP_JSON_CALL_RESULT_MESSAGE);
  }
}

module.exports = JsonRestWSConnection;