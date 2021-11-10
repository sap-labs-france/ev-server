import * as uWS from 'uWebSockets.js';

import { App, HttpRequest, HttpResponse, WebSocket, us_socket_context_t } from 'uWebSockets.js';
import { ServerAction, ServerType, WSServerProtocol } from '../../../types/Server';

import CentralSystemConfiguration from '../../../types/configuration/CentralSystemConfiguration';
import CentralSystemServer from '../CentralSystemServer';
import ChargingStationClient from '../../../client/ocpp/ChargingStationClient';
import ChargingStationConfiguration from '../../../types/configuration/ChargingStationConfiguration';
import Constants from '../../../utils/Constants';
import JsonRestWSConnection from './JsonRestWSConnection';
import JsonWSConnection from './JsonWSConnection';
import Logging from '../../../utils/Logging';
import Utils from '../../../utils/Utils';
import WSConnection from './WSConnection';
import { WebSocketCloseEventStatusCode } from '../../../types/WebSocket';
import global from '../../../types/GlobalType';

const MODULE_NAME = 'JsonCentralSystemServer';

export default class JsonCentralSystemServer extends CentralSystemServer {
  private ongoingWSInitializations: Map<string, null> = new Map;
  private jsonWSConnections: Map<string, JsonWSConnection> = new Map();
  private jsonRestWSConnections: Map<string, JsonRestWSConnection> = new Map();

  public constructor(centralSystemConfig: CentralSystemConfiguration, chargingStationConfig: ChargingStationConfiguration) {
    super(centralSystemConfig, chargingStationConfig);
    // Check WS connection
    setInterval(() => {
      Utils.isDevelopmentEnv() && Logging.logConsoleDebug('=====================================');
      Utils.isDevelopmentEnv() && Logging.logConsoleDebug('Checking WS connection...');
      let validConnections = 0, invalidConnections = 0;
      for (const key of this.jsonWSConnections.keys()) {
        const jsonWSConnection = this.jsonWSConnections.get(key);
        if (jsonWSConnection) {
          try {
            jsonWSConnection.getWSConnection().ping();
            validConnections++;
          } catch (error) {
            invalidConnections++;
            const message = `Invalid Web Socket connection '${error?.message as string}', removed from cache!`;
            void Logging.logError({
              tenantID: jsonWSConnection.getTenantID(),
              siteID: jsonWSConnection.getSiteID(),
              siteAreaID: jsonWSConnection.getSiteAreaID(),
              companyID: jsonWSConnection.getCompanyID(),
              chargingStationID: jsonWSConnection.getChargingStationID(),
              module: MODULE_NAME, method: 'constructor',
              action: ServerAction.WS_JSON_CONNECTION_ERROR,
              message, detailedMessages: { error: error.stack }
            });
            Utils.isDevelopmentEnv() && Logging.logConsoleError(message);
          }
        }
      }
      Utils.isDevelopmentEnv() && Logging.logConsoleDebug(`WS connection checked: ${validConnections} valid, ${invalidConnections} invalid`);
      Utils.isDevelopmentEnv() && Logging.logConsoleDebug('=====================================');
    }, 10000);
    if (this.centralSystemConfig.debug) {
      setInterval(() => {
        Logging.logConsoleDebug('=====================================');
        if (this.jsonWSConnections.size > 0) {
          Logging.logConsoleDebug(`** ${this.jsonWSConnections.size} CS connection(s)`);
        } else {
          Logging.logConsoleDebug('** No CS connection');
        }
        if (this.jsonRestWSConnections.size > 0) {
          Logging.logConsoleDebug(`** ${this.jsonRestWSConnections.size} CS connection(s)`);
        } else {
          Logging.logConsoleDebug('** No REST connection');
        }
        if (this.ongoingWSInitializations.size > 0) {
          Logging.logConsoleDebug(`** ${this.ongoingWSInitializations.size} ongoing WS initialization(s)`);
        } else {
          Logging.logConsoleDebug('** No ongoing WS initialization(s)');
        }
        Logging.logConsoleDebug('=====================================');
      }, 5000);
    }
  }

  public start(): void {
    // Keep it global
    global.centralSystemJsonServer = this;
    // Make the WS server listen
    this.startWSServer();
  }

  public getChargingStationClient(tenantID: string, chargingStationID: string,
      chargingStationLocation?: { siteID: string, siteAreaID: string, companyID: string }): ChargingStationClient {
    // Get the Json Web Socket
    const jsonWebSocket = this.jsonWSConnections.get(`${tenantID}~${chargingStationID}`);
    if (!jsonWebSocket) {
      void Logging.logWarning({
        tenantID: tenantID,
        siteID: chargingStationLocation?.siteID,
        siteAreaID: chargingStationLocation?.siteAreaID,
        companyID: chargingStationLocation?.companyID,
        chargingStationID: chargingStationID,
        module: MODULE_NAME, method: 'getChargingStationClient',
        action: ServerAction.WS_CONNECTION,
        message: 'No open WebSocket connection found'
      });
      return null;
    }
    // Return the client
    return jsonWebSocket.getChargingStationClient();
  }

  private startWSServer() {
    Logging.logConsoleDebug(`Starting ${ServerType.JSON_SERVER} Server...`);
    App({}).ws('/*', {
      // compression: uWS.SHARED_COMPRESSOR,
      maxPayloadLength: 64 * 1024, // 64 KB per request
      idleTimeout: 1 * 3600, // 1 hour of inactivity => Close
      upgrade: async (res: HttpResponse, req: HttpRequest, context: us_socket_context_t) => {
        // Check for WS connection over HTTP
        const upgrade = req.getHeader('upgrade');
        if (upgrade !== 'websocket') {
          await Logging.logError({
            tenantID: Constants.DEFAULT_TENANT,
            module: MODULE_NAME, method: 'startWSServer',
            action: ServerAction.WS_CONNECTION,
            message: `Invalid Web Socket connection for URL '${req.getUrl()}'`
          });
          res.close();
        }
        // Check URI (/OCPP16/<TENANT_ID>/<TOKEN_ID>/<CHARGING_STATION_ID>)
        const url = req.getUrl();
        if (!url.startsWith('/OCPP16') && !url.startsWith('/REST')) {
          await Logging.logError({
            tenantID: Constants.DEFAULT_TENANT,
            module: MODULE_NAME, method: 'startWSServer',
            action: ServerAction.WS_CONNECTION,
            message: `Invalid Web Socket connection for URL '${url}'`
          });
          res.close();
          return;
        }
        // Check Protocol (ocpp1.6)
        const protocol = req.getHeader('sec-websocket-protocol');
        if (protocol !== WSServerProtocol.OCPP16) {
          await Logging.logError({
            tenantID: Constants.DEFAULT_TENANT,
            module: MODULE_NAME, method: 'startWSServer',
            action: ServerAction.WS_CONNECTION,
            message: `Invalid Web Socket protocol '${protocol}' for URL '${url}'`
          });
          res.close();
        }
        // Okay
        res.upgrade(
          { url: req.getUrl() },
          req.getHeader('sec-websocket-key'),
          req.getHeader('sec-websocket-protocol'),
          req.getHeader('sec-websocket-extensions'),
          context
        );
      },
      open: async (ws: WebSocket) => {
        let wsConnection: WSConnection;
        // Init in progress
        this.ongoingWSInitializations.set(ws.url, null);
        try {
          // Check Rest calls
          if (ws.url.startsWith('/REST')) {
            // Create a Rest WebSocket connection object
            wsConnection = new JsonRestWSConnection(ws, ws.url);
            // Init
            await wsConnection.initialize();
            // Add
            this.setJsonRestWSConnection(wsConnection as JsonRestWSConnection);
            // Keep WS
            ws.jsonRestWSConnection = wsConnection;
          } else if (ws.url.startsWith('/OCPP16')) {
            // Set the protocol
            ws.protocol = WSServerProtocol.OCPP16;
            // Create a Json WebSocket connection object
            wsConnection = new JsonWSConnection(ws, ws.url);
            // Init
            await wsConnection.initialize();
            // Add
            this.setJsonWSConnection(wsConnection as JsonWSConnection);
            // Keep WS
            ws.jsonWSConnection = wsConnection;
          } else {
            throw Error('Wrong WebSocket client connection URI path');
          }
          // Keep data
          ws.chargingStationID = wsConnection.getChargingStationID();
          ws.tenantID = wsConnection.getTenantID();
          ws.tokenID = wsConnection.getTokenID();
          ws.siteID = wsConnection.getSiteID();
          ws.siteAreaID = wsConnection.getSiteAreaID();
          ws.companyID = wsConnection.getCompanyID();
        } catch (error) {
          await Logging.logException(error, ServerAction.WS_CONNECTION, MODULE_NAME, 'connection',
            wsConnection?.getTenantID() ? wsConnection.getTenantID() : Constants.DEFAULT_TENANT);
          try {
            ws.end(WebSocketCloseEventStatusCode.CLOSE_ABNORMAL, error.message);
          } catch (wsError) {
            // Ignore
            Utils.isDevelopmentEnv() && Logging.logConsoleError(`Error when closing Web Socket '${wsError?.message as string}'`);
          }
        } finally {
          // Clear init
          this.ongoingWSInitializations.delete(ws.url);
        }
      },
      message: async (ws: WebSocket, message: ArrayBuffer, isBinary: boolean) => {
        // Convert right away
        const ocppMessage = Buffer.from(message).toString();
        // Get the WS
        const wsConnection = await this.getWSConnectionFromWebSocket(ws);
        if (wsConnection) {
          await wsConnection.onMessage(ocppMessage, isBinary);
        }
      },
      close: async (ws: WebSocket, code: number, message: ArrayBuffer) => {
        // Convert right away
        const ocppMessage = Buffer.from(message).toString();
        // Check Json connection
        const jsonWSConnection = ws.jsonWSConnection as JsonWSConnection;
        if (jsonWSConnection) {
          this.removeJsonWSConnection(jsonWSConnection);
          await this.logWSConnectionClosed(jsonWSConnection, ServerAction.WS_CONNECTION_CLOSED, code, ocppMessage);
        }
        // Check REST connection
        const jsonRestWSConnection = ws.jsonRestWSConnection as JsonRestWSConnection;
        if (jsonRestWSConnection) {
          this.removeJsonRestWSConnection(jsonRestWSConnection);
          await this.logWSConnectionClosed(jsonRestWSConnection, ServerAction.WS_REST_CONNECTION_CLOSED, code, ocppMessage);
        }
      },
      ping: async (ws: WebSocket, message: ArrayBuffer) => {
        // Convert right away
        const ocppMessage = Buffer.from(message).toString();
        // Get the WS
        const wsConnection = await this.getWSConnectionFromWebSocket(ws);
        if (wsConnection) {
          await wsConnection.onPing(ocppMessage);
        }
      },
      pong: async (ws: WebSocket, message: ArrayBuffer) => {
        // Convert right away
        const ocppMessage = Buffer.from(message).toString();
        // Get the WS
        const wsConnection = await this.getWSConnectionFromWebSocket(ws);
        if (wsConnection) {
          await wsConnection.onPong(ocppMessage);
        }
      }
    }).any('/*', (res, req) => {
      res.end('Nothing to see here!');
    }).listen(this.centralSystemConfig.port, (token) => {
      if (token) {
        Utils.isDevelopmentEnv() && Logging.logConsoleDebug(`${ServerType.JSON_SERVER} Server listening on 'http://${this.centralSystemConfig.host}:${this.centralSystemConfig.port}'`);
      }
    });
  }

  private async getWSConnectionFromWebSocket(ws: uWS.WebSocket): Promise<WSConnection> {
    // Check if init has been finished
    await this.waitForEndOfInitialization(ws);
    // Return the WS connection
    if (ws.jsonWSConnection) {
      return ws.jsonWSConnection;
    }
    if (ws.jsonRestWSConnection) {
      return ws.jsonRestWSConnection;
    }
    // Close the WS
    try {
      ws.end(WebSocketCloseEventStatusCode.CLOSE_ABNORMAL, 'Web Socket not registered in the backend');
    } catch (wsError) {
      // Ignore if WS is not valid (Error: Invalid access of closed uWS.WebSocket/SSLWebSocket)
      Utils.isDevelopmentEnv() && Logging.logConsoleError(`Error when closing Web Socket '${wsError?.message as string}'`);
    }
  }

  private async logWSConnectionClosed(wsConnection: WSConnection, action: ServerAction, code: number, message: string): Promise<void> {
    await Logging.logInfo({
      tenantID: wsConnection.getTenantID(),
      siteID: wsConnection.getSiteID(),
      siteAreaID: wsConnection.getSiteAreaID(),
      companyID: wsConnection.getCompanyID(),
      chargingStationID: wsConnection.getChargingStationID(),
      action, module: MODULE_NAME, method: 'onClose',
      message: `Connection has been closed, Reason: '${message ?? 'Unknown'}', Message: '${Utils.getWebSocketCloseEventStatusString(Utils.convertToInt(code))}', Code: '${code}'`,
      detailedMessages: { code, message }
    });
  }

  private async waitForEndOfInitialization(ws: WebSocket) {
    // Wait for init
    if (this.ongoingWSInitializations.has(ws.url)) {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        // Wait
        await Utils.sleep(1000 + Math.trunc(Math.random() * 1000));
        // Check
        if (!this.ongoingWSInitializations.has(ws.url)) {
          break;
        }
      }
    }
  }

  private removeJsonWSConnection(wsConnection: JsonWSConnection): boolean {
    return this.jsonWSConnections.delete(wsConnection.getID());
  }

  private removeJsonRestWSConnection(wsConnection: JsonRestWSConnection): boolean {
    return this.jsonRestWSConnections.delete(wsConnection.getID());
  }

  private setJsonWSConnection(wsConnection: JsonWSConnection) {
    this.jsonWSConnections.set(wsConnection.getID(), wsConnection);
  }

  private setJsonRestWSConnection(wsConnection: JsonRestWSConnection) {
    this.jsonRestWSConnections.set(wsConnection.getID(), wsConnection);
  }
}
