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
import global from '../../../types/GlobalType';

const MODULE_NAME = 'JsonCentralSystemServer';


export default class JsonCentralSystemServer extends CentralSystemServer {
  private jsonChargingStationClients: Map<string, JsonWSConnection>;
  private jsonRestClients: Map<string, JsonRestWSConnection>;

  constructor(centralSystemConfig: CentralSystemConfiguration, chargingStationConfig: ChargingStationConfiguration) {
    // Call parent
    super(centralSystemConfig, chargingStationConfig);
    // Keep local
    this.jsonChargingStationClients = new Map<string, JsonWSConnection>();
    this.jsonRestClients = new Map<string, JsonRestWSConnection>();
  }

  public start(): void {
    // Keep it global
    global.centralSystemJsonServer = this;
    // Make the WS server listen
    this.startWSServer();
  }

  public getChargingStationClient(tenantID: string, chargingStationID: string, chargingStationLocation?: {
    siteID: string,
    siteAreaID: string,
    companyID: string
  }): ChargingStationClient {
    // Get the Json Web Socket
    const jsonWebSocket = this.jsonChargingStationClients.get(`${tenantID}~${chargingStationID}`);
    if (!jsonWebSocket) {
      void Logging.logError({
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
    console.log(`Starting ${ServerType.JSON_SERVER} Server...`);
    App({}).ws('/*', {
      compression: uWS.SHARED_COMPRESSOR,
      maxPayloadLength: 64 * 1024,
      idleTimeout: 24 * 3600,
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
        req.forEach((key, value) => console.log(key, value));
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
        try {
          // Check Rest calls
          if (ws.url.startsWith('/REST')) {
            // Create a Rest WebSocket connection object
            wsConnection = new JsonRestWSConnection(ws, ws.url);
            // Init
            await wsConnection.initialize();
            // Add
            this.addRestConnection(wsConnection as JsonRestWSConnection);
            // Keep WS
            ws.jsonWSConnection = wsConnection;
          } else if (ws.url.startsWith('/OCPP16')) {
            // Set the protocol
            ws.protocol = WSServerProtocol.OCPP16;
            // Create a Json WebSocket connection object
            wsConnection = new JsonWSConnection(ws, ws.url);
            // Init
            await wsConnection.initialize();
            // Add
            this.addJsonConnection(wsConnection as JsonWSConnection);
            // Keep WS
            ws.jsonRestWSConnection = wsConnection;
          } else {
            throw Error('Wrong WebSocket client connection URI path');
          }
        } catch (error) {
          // TODO: Check how to send reason
          // ws.close(WebSocketCloseEventStatusCode.CLOSE_UNSUPPORTED, error.message);
          ws.close();
          await Logging.logException(error, ServerAction.WS_CONNECTION, MODULE_NAME, 'connection',
            wsConnection?.getTenantID() ? wsConnection.getTenantID() : Constants.DEFAULT_TENANT);
        }
      },
      message: async (ws: WebSocket, message: ArrayBuffer, isBinary: boolean) => {
        const wsConnection = this.getWSConnectionFromWebSocket(ws);
        if (wsConnection) {
          await wsConnection.onMessage(message, isBinary);
        } else {
          ws.close();
        }
      },
      drain: (ws: WebSocket) => {
        console.log('WS: Drain');
      },
      close: async (ws: WebSocket, code: number, message: ArrayBuffer) => {
        const jsonWSConnection = ws.jsonWSConnection as JsonWSConnection;
        if (jsonWSConnection) {
          this.removeJsonConnection(jsonWSConnection);
          await this.logWSConnectionClosed(jsonWSConnection, ServerAction.WS_CONNECTION_CLOSED, code, message);
        }
        const jsonRestWSConnection = ws.jsonRestWSConnection as JsonRestWSConnection;
        if (jsonRestWSConnection) {
          this.removeRestConnection(jsonRestWSConnection);
          await this.logWSConnectionClosed(jsonRestWSConnection, ServerAction.WS_REST_CONNECTION_CLOSED, code, message);
        }
      },
      ping: async (ws: WebSocket, message: ArrayBuffer) => {
        const wsConnection = this.getWSConnectionFromWebSocket(ws);
        if (wsConnection) {
          await wsConnection.onPing(message);
        }
      },
      pong: async (ws: WebSocket, message: ArrayBuffer) => {
        const wsConnection = this.getWSConnectionFromWebSocket(ws);
        if (wsConnection) {
          await wsConnection.onPong(message);
        }
      }
    }).listen(this.centralSystemConfig.port, (token) => {
      if (token) {
        console.log(`${ServerType.JSON_SERVER} Server listening on 'ws://${this.centralSystemConfig.host}:${this.centralSystemConfig.port}'`);
      }
    });
  }

  private getWSConnectionFromWebSocket(ws: uWS.WebSocket): WSConnection {
    if (ws.jsonWSConnection) {
      return ws.jsonWSConnection;
    }
    if (ws.jsonRestWSConnection) {
      return ws.jsonRestWSConnection;
    }
  }

  private async logWSConnectionClosed(wsConnection: WSConnection, action: ServerAction, code: number, message: ArrayBuffer): Promise<void> {
    await Logging.logInfo({
      tenantID: wsConnection.getTenantID(),
      siteID: wsConnection.getSiteID(),
      siteAreaID: wsConnection.getSiteAreaID(),
      companyID: wsConnection.getCompanyID(),
      chargingStationID: wsConnection.getChargingStationID(),
      action, module: MODULE_NAME, method: 'onClose',
      message: `Connection has been closed, Reason: '${Buffer.from(message).toString()}', Message: '${Utils.getWebSocketCloseEventStatusString(Utils.convertToInt(code))}', Code: '${code}'`,
      detailedMessages: { code, message }
    });
  }
}

