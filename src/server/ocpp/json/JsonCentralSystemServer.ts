import { ServerAction, WSServerProtocol } from '../../../types/Server';

import CentralSystemConfiguration from '../../../types/configuration/CentralSystemConfiguration';
import CentralSystemServer from '../CentralSystemServer';
import ChargingStationClient from '../../../client/ocpp/ChargingStationClient';
import ChargingStationConfiguration from '../../../types/configuration/ChargingStationConfiguration';
import Constants from '../../../utils/Constants';
import JsonRestWSConnection from './JsonRestWSConnection';
import JsonWSConnection from './JsonWSConnection';
import Logging from '../../../utils/Logging';
import { OCPPVersion } from '../../../types/ocpp/OCPPServer';
import Utils from '../../../utils/Utils';
import WSConnection from './WSConnection';
import WSServer from './WSServer';
import WebSocket from 'ws';
import { WebSocketCloseEventStatusCode } from '../../../types/WebSocket';
import global from '../../../types/GlobalType';
import http from 'http';

const MODULE_NAME = 'JsonCentralSystemServer';

export default class JsonCentralSystemServer extends CentralSystemServer {
  private serverName = 'OCPP-J';
  private wsServer: WSServer;
  private jsonChargingStationClients: Map<string, JsonWSConnection>;
  private jsonRestClients: Map<string, JsonRestWSConnection>;
  private keepAliveIntervalMillis: number;
  private keepAliveInterval: NodeJS.Timeout;

  constructor(centralSystemConfig: CentralSystemConfiguration, chargingStationConfig: ChargingStationConfiguration) {
    // Call parent
    super(centralSystemConfig, chargingStationConfig);
    // Keep local
    this.jsonChargingStationClients = new Map<string, JsonWSConnection>();
    this.jsonRestClients = new Map<string, JsonRestWSConnection>();
    // Disable Ping/Pong
    // this.keepAliveIntervalMillis = this.centralSystemConfig.keepAliveIntervalMillis ?
    //   this.centralSystemConfig.keepAliveIntervalMillis : Constants.WS_DEFAULT_KEEP_ALIVE_MILLIS;
  }

  public start(): void {
    // Keep it global
    global.centralSystemJsonServer = this;
    // Make the WS server listen
    this.startWSServer();
  }

  public getChargingStationClient(tenantID: string, chargingStationID: string): ChargingStationClient {
    // Get the Json Web Socket
    const jsonWebSocket = this.jsonChargingStationClients.get(`${tenantID}~${chargingStationID}`);
    if (!jsonWebSocket) {
      void Logging.logError({
        tenantID: tenantID,
        source: chargingStationID,
        module: MODULE_NAME, method: 'getChargingStationClient',
        action: ServerAction.WS_CONNECTION,
        message: 'No open WebSocket connection found'
      });
      return null;
    }
    // Return the client
    return jsonWebSocket.getChargingStationClient();
  }

  public removeJsonConnection(wsConnection: JsonWSConnection): boolean {
    // Remove from cache
    return this.jsonChargingStationClients.delete(wsConnection.getID());
  }

  public getNumberOfJsonConnections(): number {
    return this.jsonChargingStationClients.size;
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

  private startWSServer() {
    // Create the WS server
    this.createWSServer();
    // Start the WS server
    this.wsServer.start();
  }

  private createWSServer() {
    const verifyClient = (info) => {
      // Check the URI
      if (info.req.url.startsWith(`/${Utils.getOCPPServerVersionURLPath(OCPPVersion.VERSION_16)}`)) {
        return true;
      }
      if (info.req.url.startsWith('/REST')) {
        return true;
      }
      void Logging.logError({
        tenantID: Constants.DEFAULT_TENANT,
        module: MODULE_NAME, method: 'verifyClient',
        action: ServerAction.EXPRESS_SERVER,
        message: `Invalid connection URL ${info.req.url}`
      });
      return false;
    };
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const handleProtocols = (protocols: WSServerProtocol | WSServerProtocol[], request: http.IncomingMessage): boolean | WSServerProtocol => {
      // Check the protocols and ensure protocol used as ocpp1.6 or nothing (should create an error)
      if (!Utils.isEmptyArray(protocols)) {
        if (protocols.includes(WSServerProtocol.OCPP16)) {
          return WSServerProtocol.OCPP16;
        }
        if (protocols.includes(WSServerProtocol.REST)) {
          return WSServerProtocol.REST;
        }
      } else if (protocols === WSServerProtocol.OCPP16) {
        return protocols;
      } else if (protocols === WSServerProtocol.REST) {
        return protocols;
      }
      void Logging.logError({
        tenantID: Constants.DEFAULT_TENANT,
        module: MODULE_NAME, method: 'handleProtocols',
        action: ServerAction.EXPRESS_SERVER,
        message: `Invalid protocol ${protocols.toString()}`
      });
      return false;
    };
    // Create the WS server
    this.wsServer = new WSServer(this.centralSystemConfig, this.serverName, verifyClient, handleProtocols);
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    this.wsServer.on('connection', async (ws: WebSocket, req: http.IncomingMessage) => {
      let wsConnection: WSConnection;
      try {
        // Check Rest calls
        if (req.url.startsWith('/REST')) {
          // Create a Rest WebSocket connection object
          wsConnection = new JsonRestWSConnection(ws, req, this);
          // Init
          await wsConnection.initialize();
          // Add
          this.addRestConnection(wsConnection as JsonRestWSConnection);
        } else if (req.url.startsWith(`/${Utils.getOCPPServerVersionURLPath(OCPPVersion.VERSION_16)}`)) {
          // Create a Json WebSocket connection object
          wsConnection = new JsonWSConnection(ws, req, this);
          // Init
          await wsConnection.initialize();
          // Add
          this.addJsonConnection(wsConnection as JsonWSConnection);
        } else {
          throw Error('Wrong WebSocket client connection URI path');
        }
      } catch (error) {
        ws.close(WebSocketCloseEventStatusCode.CLOSE_UNSUPPORTED, error.message);
        await Logging.logException(error, ServerAction.WS_CONNECTION, '', MODULE_NAME, 'connection',
          wsConnection?.getTenantID() ? wsConnection.getTenantID() : Constants.DEFAULT_TENANT);
      }
    });
    // Keep alive WebSocket connection
    if (this.keepAliveIntervalMillis > 0 && !this.keepAliveInterval) {
      void Logging.logInfo({
        tenantID: Constants.DEFAULT_TENANT,
        module: MODULE_NAME, method: 'createWSServer',
        action: ServerAction.EXPRESS_SERVER,
        message: 'Charging Station Web Socket ping/pong is active'
      });
      this.keepAliveInterval = setInterval((): void => {
        for (const jsonWSConnection of this.jsonChargingStationClients.values()) {
          if (!jsonWSConnection.isConnectionAlive) {
            void Logging.logError({
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
      }, this.keepAliveIntervalMillis);
    } else {
      void Logging.logInfo({
        tenantID: Constants.DEFAULT_TENANT,
        module: MODULE_NAME, method: 'createWSServer',
        action: ServerAction.EXPRESS_SERVER,
        message: 'Charging Station Web Socket ping/pong is disabled'
      });
    }
  }
}

