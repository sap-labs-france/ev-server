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
import { WebSocketCloseEventStatusCode } from '../../../types/WebSocket';
import global from '../../../types/GlobalType';
import http from 'http';

const MODULE_NAME = 'JsonCentralSystemServer';

export default class JsonCentralSystemServer extends CentralSystemServer {
  private serverName: string;
  private serverConfig: CentralSystemConfiguration;
  private wsServer: WSServer;
  private jsonChargingStationClients: Map<string, JsonWSConnection>;
  private jsonRestClients: Map<string, JsonRestWSConnection>;
  private keepAliveIntervalValue: number;
  private keepAliveInterval: NodeJS.Timeout;

  constructor(centralSystemConfig: CentralSystemConfiguration, chargingStationConfig: ChargingStationConfiguration) {
    // Call parent
    super(centralSystemConfig, chargingStationConfig);
    // Keep local
    this.serverName = 'OCPP';
    this.serverConfig = centralSystemConfig;
    this.jsonChargingStationClients = new Map<string, JsonWSConnection>();
    this.jsonRestClients = new Map<string, JsonRestWSConnection>();
    this.keepAliveIntervalValue = (this.serverConfig.keepaliveinterval ? this.serverConfig.keepaliveinterval : Constants.WS_DEFAULT_KEEPALIVE) * 1000; // Milliseconds
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
    // Get the Json Web Socket
    const jsonWebSocket = this.jsonChargingStationClients.get(id);
    if (!jsonWebSocket) {
      Logging.logError({
        tenantID: tenantID,
        source: chargingStationID,
        module: MODULE_NAME, method: 'getChargingStationClient',
        action: ServerAction.WS_CONNECTION,
        message: 'No Web Socket connection found',
        detailedMessages: { chargingStations: Array.from(this.jsonChargingStationClients.keys()) }
      });
      return null;
    }
    // Return the client
    return jsonWebSocket.getChargingStationClient();
  }

  public get port(): number {
    return (this.wsServer.address() as AddressInfo).port;
  }

  public removeJsonConnection(wsConnection: JsonWSConnection): boolean {
    // Remove from cache
    return this.jsonChargingStationClients.delete(wsConnection.getID());
  }

  public removeRestConnection(wsConnection: JsonRestWSConnection): boolean {
    // Remove from cache
    return this.jsonRestClients.delete(wsConnection.getID());
  }

  private addJsonConnection(wsConnection: JsonWSConnection) {
    // Keep the connection
    this.jsonChargingStationClients.set(wsConnection.getID(), wsConnection);
  }

  private addRestConnection(wsConnection: JsonRestWSConnection) {
    // Keep the connection
    this.jsonRestClients.set(wsConnection.getID(), wsConnection);
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
        module: MODULE_NAME, method: 'verifyClient',
        action: ServerAction.EXPRESS_SERVER,
        message: `Invalid connection URL ${info.req.url}`
      });
      return false;
    };

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const handleProtocols = (protocols: string | string[], request: http.IncomingMessage): boolean | string => {
      // Check the protocols and ensure protocol used as ocpp1.6 or nothing (should create an error)
      if (Array.isArray(protocols)) {
        if (protocols.includes('ocpp1.6')) {
          return 'ocpp1.6';
        }
        if (protocols.includes('rest')) {
          return 'rest';
        }
      } else if (protocols === 'ocpp1.6') {
        return protocols;
      } else if (protocols === 'rest') {
        return protocols;
      }
      Logging.logError({
        tenantID: Constants.DEFAULT_TENANT,
        module: MODULE_NAME, method: 'handleProtocols',
        action: ServerAction.EXPRESS_SERVER,
        message: `Invalid protocol ${protocols.toString()}`
      });
      return false;
    };

    // Create the WS server
    this.wsServer = new WSServer(this.serverConfig.port, this.serverConfig.host, this.serverName, WSServer.createHttpServer(this.centralSystemConfig),
      verifyClient, handleProtocols);
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    this.wsServer.on('connection', async (ws: WebSocket, req: http.IncomingMessage) => {
      try {
        // Check Rest calls
        if (req.url.startsWith('/REST')) {
          // Create a Rest WebSocket connection object
          const wsConnection = new JsonRestWSConnection(ws, req, this);
          // Init
          await wsConnection.initialize();
          // Add
          this.addRestConnection(wsConnection);
        } else if (req.url.startsWith('/OCPP16')) {
          // Create a Json WebSocket connection object
          const wsConnection = new JsonWSConnection(ws, req, this.chargingStationConfig, this);
          // Init
          await wsConnection.initialize();
          // Add
          this.addJsonConnection(wsConnection);
        } else {
          throw Error('Wrong WebSocket client connection URI path');
        }
      } catch (error) {
        // Log
        Logging.logException(
          error, ServerAction.WS_CONNECTION, '', MODULE_NAME, 'connection', Constants.DEFAULT_TENANT);
        // Respond
        ws.close(WebSocketCloseEventStatusCode.CLOSE_UNSUPPORTED, error.message);
      }
    });
    // Keep alive WebSocket connection
    if (this.keepAliveIntervalValue > 0 && !this.keepAliveInterval) {
      this.keepAliveInterval = setInterval((): void => {
        for (const jsonWSConnection of this.jsonChargingStationClients.values()) {
          if (!jsonWSConnection.isConnectionAlive) {
            // Log
            Logging.logError({
              tenantID: jsonWSConnection.getTenantID(),
              source: jsonWSConnection.getChargingStationID(),
              action: ServerAction.WS_JSON_CONNECTION_CLOSED,
              module: MODULE_NAME, method: 'createWSServer',
              message: `WebSocket does not respond to ping (IP: ${jsonWSConnection.getClientIP().toString()}), terminating`
            });
            jsonWSConnection.getWSConnection().terminate();
          }
          jsonWSConnection.isConnectionAlive = false;
          jsonWSConnection.getWSConnection().ping((): void => { });
        }
      }, this.keepAliveIntervalValue);
    }
  }
}

