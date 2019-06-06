import Logging from '../../../utils/Logging';
import ChargingStation from '../../../entity/ChargingStation';
import Constants from '../../../utils/Constants';
import BackendError from '../../../exception/BackendError';
import WSConnection from './WSConnection';
import TSGlobal from '../../../types/GlobalType';
declare var global: TSGlobal;

const MODULE_NAME = "JsonRestWSConnection";
export default class JsonRestWSConnection extends WSConnection {

	public getTenantID: any;
	public getChargingStationID: any;
	public getIP: any;
	public getWSConnection: any;
	public getURL: any;
	public sendMessage: any;

  constructor(wsConnection, req, wsServer) {
    // Call super
    super(wsConnection, req, wsServer);
  }

  async initialize() {
    // Already initialized?
    if (!this.initialized) {
      // Call super class
      await super.initialize();
      // Ok
      this.initialized = true;
      // Log
      Logging.logInfo({
        tenantID: this.getTenantID(),
        module: MODULE_NAME, method: "initialize",
        source: this.getChargingStationID(),
        action: "WSRestServerConnectionOpened",
        message: `New Rest connection from '${this.getIP()}', Protocol '${this.getWSConnection().protocol}', URL '${this.getURL()}'`
      });
    }
  }

  onError(error) {
    // Log
    Logging.logError({
      tenantID: this.getTenantID(),
      module: MODULE_NAME,
      method: "onError",
      action: "WSRestServerErrorReceived",
      message: error
    });
  }

  onClose(code, reason) {
    // Log
    Logging.logInfo({
      tenantID: this.getTenantID(),
      module: MODULE_NAME,
      source: (this.getChargingStationID() ? this.getChargingStationID() : ""),
      method: "onClose",
      action: "WSRestServerConnectionClosed",
      message: `Connection has been closed, Reason '${reason}', Code '${code}'`
    });
    // Remove the connection
    this.wsServer.removeRestConnection(this);
  }

  async handleRequest(messageId, commandName, commandPayload) {
    // Log
    Logging.logSendAction(MODULE_NAME, this.getTenantID(), this.getChargingStationID(), commandName, commandPayload);
    // Get the Charging Station
    const chargingStation = await ChargingStation.getChargingStation(this.getTenantID(), this.getChargingStationID());
    // Found?
    if (!chargingStation) {
      // Error
      throw new BackendError(this.getChargingStationID(), `'${commandName}' not found`,
        "JsonRestWSConnection", "handleRequest", commandName);
    }
    // Get the client from JSon Server
    const chargingStationClient = global.centralSystemJson.getChargingStationClient(chargingStation.getTenantID(), chargingStation.getID());
    if (!chargingStationClient) {
      // Error
      throw new BackendError(this.getChargingStationID(), `Charger is not connected to the backend`,
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
    Logging.logReturnedAction(MODULE_NAME, this.getTenantID(), this.getChargingStationID(), commandName, result);
    // Send Response
    await this.sendMessage(messageId, result, Constants.OCPP_JSON_CALL_RESULT_MESSAGE);
  }
}

