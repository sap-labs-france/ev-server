import BackendError from '../../../exception/BackendError';
import ChargingStationStorage from '../../../storage/mongodb/ChargingStationStorage';
import JsonCentralSystemServer from './JsonCentralSystemServer';
import Logging from '../../../utils/Logging';
import { MessageType } from '../../../types/WebSocket';
import { ServerAction } from '../../../types/Server';
import WSConnection from './WSConnection';
import WebSocket from 'ws';
import global from '../../../types/GlobalType';
import http from 'http';

const MODULE_NAME = 'JsonRestWSConnection';

export default class JsonRestWSConnection extends WSConnection {

  constructor(wsConnection: WebSocket, req: http.IncomingMessage, wsServer: JsonCentralSystemServer) {
    super(wsConnection, req, wsServer);
  }

  public async initialize(): Promise<void> {
    // Already initialized?
    if (!this.initialized) {
      // Call super class
      await super.initialize();
      // Ok
      this.initialized = true;
      // Log
      Logging.logInfo({
        tenantID: this.getTenantID(),
        source: this.getChargingStationID(),
        action: ServerAction.WS_REST_CONNECTION_OPENED,
        module: MODULE_NAME, method: 'initialize',
        message: `New Rest connection from '${this.getClientIP()}', Protocol '${this.getWSConnection().protocol}', URL '${this.getURL()}'`
      });
    }
  }

  public onError(event: Event): void {
    // Log
    Logging.logError({
      tenantID: this.getTenantID(),
      module: MODULE_NAME, method: 'onError',
      action: ServerAction.WS_REST_CONNECTION_ERROR,
      message: event
    });
  }

  public onClose(closeEvent: CloseEvent): void {
    // Log
    Logging.logInfo({
      tenantID: this.getTenantID(),
      source: (this.getChargingStationID() ? this.getChargingStationID() : ''),
      module: MODULE_NAME, method: 'onClose',
      action: ServerAction.WS_REST_CONNECTION_CLOSED,
      message: `Connection has been closed, Reason '${closeEvent.reason ? closeEvent.reason : 'No reason'}', Code '${closeEvent.code}'`
    });
    // Remove the connection
    this.wsServer.removeRestConnection(this);
  }

  public async handleRequest(messageId: string, commandName: ServerAction, commandPayload: any): Promise<void> {
    // Get the Charging Station
    const chargingStation = await ChargingStationStorage.getChargingStation(this.getTenantID(), this.getChargingStationID());
    // Found?
    if (!chargingStation) {
      // Error
      throw new BackendError({
        source: this.getChargingStationID(),
        module: MODULE_NAME,
        method: 'handleRequest',
        message: `'${commandName}' not found`,
        action: commandName
      });
    }
    // Get the client from JSON Server
    const chargingStationClient = global.centralSystemJsonServer.getChargingStationClient(this.getTenantID(), chargingStation.id);
    if (!chargingStationClient) {
      throw new BackendError({
        source: this.getChargingStationID(),
        module: MODULE_NAME,
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
      // Send Response
      await this.sendMessage(messageId, result, MessageType.RESULT_MESSAGE);
    } else {
      // Error
      throw new BackendError({
        source: this.getChargingStationID(),
        module: MODULE_NAME,
        method: 'handleRequest',
        message: `'${actionMethod}' is not implemented`,
        action: commandName
      });
    }
  }
}

