import WebSocket, { AddressInfo } from 'ws';

import CentralSystemConfiguration from '../../../types/configuration/CentralSystemConfiguration';
import CentralSystemServer from '../CentralSystemServer';
import ChargingStationClient from '../../../client/ocpp/ChargingStationClient';
import ChargingStationConfiguration from '../../../types/configuration/ChargingStationConfiguration';
import Constants from '../../../utils/Constants';
import JsonRestWSConnection from './JsonRestWSConnection';
import JsonWSConnection from './JsonWSConnection';
import Logging from '../../../utils/Logging';
import { ServerAction } from '../../../types/Server';
import WSServer from './WSServer';
import global from '../../../types/GlobalType';
import http from 'http';
import { v4 as uuid } from 'uuid';

export default class JsonCentralSystemServer extends CentralSystemServer {
  private serverName: string;
  private MODULE_NAME: string;
  private jsonChargingStationClients: JsonWSConnection[];
  private jsonRestClients: JsonRestWSConnection[];
  private wsServer: WSServer;

  constructor(centralSystemConfig: CentralSystemConfiguration, chargingStationConfig: ChargingStationConfiguration) {
    // Call parent
    super(centralSystemConfig, chargingStationConfig);
    // Keep local
    this.serverName = 'OCPP';
    this.MODULE_NAME = 'JsonCentralSystemServer';
    this.jsonChargingStationClients = [];
    this.jsonRestClients = [];
  }

  public start(): void {
    // Keep it global
    global.centralSystemJsonServer = this;
    // Make server to listen
    this.startListening();
  }

  public getChargingStationClient(tenantID: string, chargingStationID: string): ChargingStationClient {
    // Build ID
    const id = `${tenantID}~${chargingStationID}}`;
    // Charging Station exists?
    if (this.jsonChargingStationClients[id]) {
      // Return from the cache
      return this.jsonChargingStationClients[id].getChargingStationClient();
    }
    // Not found!
    return null;
  }

  public get port(): number {
    return (this.wsServer.address() as AddressInfo).port;
  }

  public removeJsonConnection(wsConnection: JsonWSConnection): void {
    // Check first
    if (this.jsonChargingStationClients[wsConnection.getID()] &&
      this.jsonChargingStationClients[wsConnection.getID()].getWSConnection().id === wsConnection.getWSConnection()['id']) {
      // Remove from cache
      delete this.jsonChargingStationClients[wsConnection.getID()];
    }
  }

  public removeRestConnection(wsConnection: JsonRestWSConnection): void {
    // Check first
    if (this.jsonRestClients[wsConnection.getID()] &&
      this.jsonRestClients[wsConnection.getID()].getWSConnection().id === wsConnection.getWSConnection()['id']) {
      // Remove from cache
      delete this.jsonRestClients[wsConnection.getID()];
    }
  }

  private addJsonConnection(wsConnection: JsonWSConnection) {
    // Keep the connection
    this.jsonChargingStationClients[wsConnection.getID()] = wsConnection;
  }

  private addRestConnection(wsConnection: JsonRestWSConnection) {
    // Keep the connection
    this.jsonRestClients[wsConnection.getID()] = wsConnection;
  }

  private startListening() {
    // Create the WS server
    this.createWSServer();
    // Make server to listen
    this.wsServer.startListening();
  }

  private createWSServer() {
    const verifyClient = (info) => {
      // Check the URI
      if (info.req.url.startsWith('/OCPP16')) {
        return true;
      }
      if (info.req.url.startsWith('/REST')) {
        return true;
      }
      Logging.logError({
        tenantID: Constants.DEFAULT_TENANT,
        module: this.MODULE_NAME, method: 'verifyClient',
        action: ServerAction.EXPRESS_SERVER,
        message: `Invalid connection URL ${info.req.url}`
      });
      return false;
    };

    const handleProtocols = (protocols, request): boolean | string => {
      // Check the protocols
      // Ensure protocol used as ocpp1.6 or nothing (should create an error)
      if (Array.isArray(protocols)) {
        if (protocols.includes('ocpp1.6')) {
          return 'ocpp1.6';
        }
        if (protocols.includes('rest')) {
          return 'rest';
        }
        return false;
      } else if (protocols === 'ocpp1.6') {
        return protocols;
      } else if (protocols === 'rest') {
        return protocols;
      }
      Logging.logError({
        tenantID: Constants.DEFAULT_TENANT,
        module: this.MODULE_NAME, method: 'handleProtocols',
        action: ServerAction.EXPRESS_SERVER,
        message: `Invalid protocol ${protocols}`
      });
      return false;
    };

    // Create the WS server
    this.wsServer = new WSServer(WSServer.createHttpServer(this.centralSystemConfig), this.serverName,
      this.centralSystemConfig, verifyClient, handleProtocols);
    this.wsServer.on('connection', async (ws: WebSocket, req: http.IncomingMessage) => {
      try {
        // Set an ID
        ws['id'] = uuid();
        // Check Rest calls
        if (req.url.startsWith('/REST')) {
          // Create a Rest Web Socket connection object
          const wsConnection = new JsonRestWSConnection(ws, req, this);
          // Init
          await wsConnection.initialize();
          // Add
          this.addRestConnection(wsConnection);
        } else {
          // Create a Json Web Socket connection object
          const wsConnection = new JsonWSConnection(ws, req, this.chargingStationConfig, this);
          // Init
          await wsConnection.initialize();
          // Add
          this.addJsonConnection(wsConnection);
        }
      } catch (error) {
        // Log
        Logging.logException(
          error, ServerAction.WS_CONNECTION, '', this.MODULE_NAME, 'connection', Constants.DEFAULT_TENANT);
        // Respond
        ws.close(Constants.WS_UNSUPPORTED_DATA, error.message);
      }
    });
  }
}

