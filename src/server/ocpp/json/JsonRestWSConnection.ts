import BackendError from '../../../exception/BackendError';
import ChargingStation from '../../../types/ChargingStation';
import ChargingStationStorage from '../../../storage/mongodb/ChargingStationStorage';
import Constants from '../../../utils/Constants';
import global from '../../../types/GlobalType';
import Logging from '../../../utils/Logging';
import WSConnection from './WSConnection';

const MODULE_NAME = 'JsonRestWSConnection';
export default class JsonRestWSConnection extends WSConnection {

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
        module: MODULE_NAME, method: 'initialize',
        source: this.getChargingStationID(),
        action: 'WSRestServerConnectionOpened',
        message: `New Rest connection from '${this.getIP()}', Protocol '${this.getWSConnection().protocol}', URL '${this.getURL()}'`
      });
    }
  }

  onError(error) {
    // Log
    Logging.logError({
      tenantID: this.getTenantID(),
      module: MODULE_NAME,
      method: 'onError',
      action: 'WSRestServerErrorReceived',
      message: error
    });
  }

  onClose(code, reason) {
    // Log
    Logging.logInfo({
      tenantID: this.getTenantID(),
      module: MODULE_NAME,
      source: (this.getChargingStationID() ? this.getChargingStationID() : ''),
      method: 'onClose',
      action: 'WSRestServerConnectionClosed',
      message: `Connection has been closed, Reason '${reason}', Code '${code}'`
    });
    // Remove the connection
    this.wsServer.removeRestConnection(this);
  }

  async handleRequest(messageId, commandName, commandPayload) {
    // Log
    Logging.logReceivedAction(MODULE_NAME, this.getTenantID(), this.getChargingStationID(), commandName, commandPayload);
    // Get the Charging Station
    const chargingStation = await ChargingStationStorage.getChargingStation(this.getTenantID(), this.getChargingStationID());
    // Found?
    if (!chargingStation) {
      // Error
      throw new BackendError({
        source: this.getChargingStationID(),
        module: 'JsonRestWSConnection',
        method: 'handleRequest',
        message: `'${commandName}' not found`,
        action: commandName
      });
    }
    // Get the client from JSON Server
    const chargingStationClient = global.centralSystemJson.getChargingStationClient(this.getTenantID(), chargingStation.id);
    if (!chargingStationClient) {
      // Error
      throw new BackendError({
        source: this.getChargingStationID(),
        module: 'JsonRestWSConnection',
        method: 'handleRequest',
        message: 'Charging Station is not connected to the backend',
        action: commandName
      });
    }
    // Call the client
    let result;
    // Build the method
    const actionMethod = commandName[0].toLowerCase() + commandName.substring(1);
    // Call
    if (typeof chargingStationClient[actionMethod] === 'function') {
      // Call the method
      result = await chargingStationClient[actionMethod](commandPayload);
      // Log
      Logging.logReturnedAction(MODULE_NAME, this.getTenantID(), this.getChargingStationID(), commandName, result);
      // Send Response
      await this.sendMessage(messageId, result, Constants.OCPP_JSON_CALL_RESULT_MESSAGE);
    } else {
      // Error
      throw new BackendError({
        source: this.getChargingStationID(),
        module: 'JsonRestWSConnection',
        method: 'handleRequest',
        message: `'${actionMethod}' is not implemented`,
        action: commandName
      });
    }
  }
}

