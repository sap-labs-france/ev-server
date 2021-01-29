import WebSocket, { CloseEvent, ErrorEvent } from 'ws';

import BackendError from '../../../exception/BackendError';
import ChargingStationClient from '../../../client/ocpp/ChargingStationClient';
import ChargingStationStorage from '../../../storage/mongodb/ChargingStationStorage';
import JsonCentralSystemServer from './JsonCentralSystemServer';
import Logging from '../../../utils/Logging';
import { OCPPMessageType } from '../../../types/ocpp/OCPPCommon';
import { ServerAction } from '../../../types/Server';
import Utils from '../../../utils/Utils';
import WSConnection from './WSConnection';
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
        message: `New Rest connection from '${this.getClientIP().toString()}', Protocol '${this.getWSConnection().protocol}', URL '${this.getURL()}'`
      });
    }
  }

  public onError(errorEvent: ErrorEvent): void {
    // Log
    Logging.logError({
      tenantID: this.getTenantID(),
      source: (this.getChargingStationID() ? this.getChargingStationID() : ''),
      module: MODULE_NAME, method: 'onError',
      action: ServerAction.WS_REST_CONNECTION_ERROR,
      message: `Error ${errorEvent?.error} ${errorEvent?.message}`,
      detailedMessages: { errorEvent: errorEvent }
    });
  }

  public onClose(closeEvent: CloseEvent): void {
    // Log
    Logging.logInfo({
      tenantID: this.getTenantID(),
      source: (this.getChargingStationID() ? this.getChargingStationID() : ''),
      module: MODULE_NAME, method: 'onClose',
      action: ServerAction.WS_REST_CONNECTION_CLOSED,
      message: `Connection has been closed, Reason: '${closeEvent.reason ? closeEvent.reason : 'No reason given'}', Message: '${Utils.getWebSocketCloseEventStatusString(Utils.convertToInt(closeEvent))}', Code: '${closeEvent.toString()}'`,
      detailedMessages: { closeEvent: closeEvent }
    });
    // Remove the connection
    this.wsServer.removeRestConnection(this);
  }

  public async handleRequest(messageId: string, commandName: ServerAction, commandPayload: Record<string, unknown> | string): Promise<void> {
    // Get the Charging Station
    const chargingStation = await ChargingStationStorage.getChargingStation(this.getTenantID(), this.getChargingStationID());
    if (!chargingStation) {
      throw new BackendError({
        source: this.getChargingStationID(),
        module: MODULE_NAME,
        method: 'handleRequest',
        message: `Charging Station '${this.getChargingStationID()}' not found`,
        action: commandName
      });
    }
    // Get the client from JSON Server
    const chargingStationClient: ChargingStationClient = global.centralSystemJsonServer.getChargingStationClient(this.getTenantID(), this.getChargingStationID());
    if (!chargingStationClient) {
      throw new BackendError({
        source: this.getChargingStationID(),
        module: MODULE_NAME,
        method: 'handleRequest',
        message: `Charging Station '${this.getChargingStationID()}' is not connected to the backend`,
        action: commandName
      });
    }
    // Call the client
    const actionMethod = commandName[0].toLowerCase() + commandName.substring(1);
    // Call
    if (typeof chargingStationClient[actionMethod] === 'function') {
      // Call the method
      const result = await chargingStationClient[actionMethod](commandPayload);
      // Send Response
      await this.sendMessage(messageId, result, OCPPMessageType.CALL_RESULT_MESSAGE, commandName);
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

