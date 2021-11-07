import BackendError from '../../../exception/BackendError';
import ChargingStationClient from '../../../client/ocpp/ChargingStationClient';
import ChargingStationStorage from '../../../storage/mongodb/ChargingStationStorage';
import { Command } from '../../../types/ChargingStation';
import JsonCentralSystemServer from './JsonCentralSystemServer';
import Logging from '../../../utils/Logging';
import { OCPPMessageType } from '../../../types/ocpp/OCPPCommon';
import OCPPUtils from '../utils/OCPPUtils';
import { ServerAction } from '../../../types/Server';
import Utils from '../../../utils/Utils';
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
      // Init parent
      await super.initialize();
      this.initialized = true;
      await Logging.logInfo({
        tenantID: this.getTenantID(),
        siteID: this.getSiteID(),
        siteAreaID: this.getSiteAreaID(),
        companyID: this.getCompanyID(),
        chargingStationID: this.getChargingStationID(),
        action: ServerAction.WS_REST_CONNECTION_OPENED,
        module: MODULE_NAME, method: 'initialize',
        message: `New Rest connection from '${this.getClientIP().toString()}', Protocol '${this.getWSConnection().protocol}', URL '${this.getURL()}'`
      });
    }
  }

  public onError(error: Error): void {
    void Logging.logError({
      tenantID: this.getTenantID(),
      siteID: this.getSiteID(),
      siteAreaID: this.getSiteAreaID(),
      companyID: this.getCompanyID(),
      chargingStationID: this.getChargingStationID(),
      module: MODULE_NAME, method: 'onError',
      action: ServerAction.WS_REST_CONNECTION_ERROR,
      message: `Error: ${error?.message}`,
      detailedMessages: { error: error?.stack }
    });
  }

  public onClose(code: number, reason: Buffer): void {
    // Remove the connection
    this.wsServer.removeRestConnection(this);
    void Logging.logInfo({
      tenantID: this.getTenantID(),
      siteID: this.getSiteID(),
      siteAreaID: this.getSiteAreaID(),
      companyID: this.getCompanyID(),
      chargingStationID: this.getChargingStationID(),
      module: MODULE_NAME, method: 'onClose',
      action: ServerAction.WS_REST_CONNECTION_CLOSED,
      message: `Connection has been closed, Reason: '${reason.toString()}', Message: '${Utils.getWebSocketCloseEventStatusString(Utils.convertToInt(code))}', Code: '${code}'`,
      detailedMessages: { code, reason }
    });
  }

  public async handleRequest(messageId: string, command: Command, commandPayload: Record<string, unknown> | string): Promise<void> {
    // Get the Charging Station
    const chargingStation = await ChargingStationStorage.getChargingStation(this.getTenant(), this.getChargingStationID());
    if (!chargingStation) {
      throw new BackendError({
        chargingStationID: this.getChargingStationID(),
        siteID: this.getSiteID(),
        siteAreaID: this.getSiteAreaID(),
        companyID: this.getCompanyID(),
        module: MODULE_NAME,
        method: 'handleRequest',
        message: 'Charging Station not found',
        action: OCPPUtils.buildServerActionFromOcppCommand(command)
      });
    }
    // Get the client from JSON Server
    const chargingStationClient: ChargingStationClient = global.centralSystemJsonServer.getChargingStationClient(this.getTenantID(), this.getChargingStationID(), {
      siteAreaID: this.getSiteAreaID(),
      siteID: this.getSiteID(),
      companyID: this.getCompanyID()
    });
    if (!chargingStationClient) {
      throw new BackendError({
        chargingStationID: this.getChargingStationID(),
        siteID: this.getSiteID(),
        siteAreaID: this.getSiteAreaID(),
        companyID: this.getCompanyID(),
        module: MODULE_NAME,
        method: 'handleRequest',
        message: 'Charging Station is not connected to the backend',
        action: OCPPUtils.buildServerActionFromOcppCommand(command)
      });
    }
    // Call the client
    const actionMethod = command[0].toLowerCase() + command.substring(1);
    // Call
    if (typeof chargingStationClient[actionMethod] === 'function') {
      // Call the method
      const result = await chargingStationClient[actionMethod](commandPayload);
      // Send Response
      await this.sendResponse(messageId, command, result);
    } else {
      // Error
      throw new BackendError({
        chargingStationID: this.getChargingStationID(),
        siteID: this.getSiteID(),
        siteAreaID: this.getSiteAreaID(),
        companyID: this.getCompanyID(),
        module: MODULE_NAME,
        method: 'handleRequest',
        message: `'${actionMethod}' is not implemented`,
        action: OCPPUtils.buildServerActionFromOcppCommand(command)
      });
    }
  }
}

