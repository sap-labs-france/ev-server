import * as uWS from 'uWebSockets.js';

import { App, HttpRequest, HttpResponse, WebSocket, us_socket_context_t } from 'uWebSockets.js';
import { ServerAction, ServerType, WSServerProtocol } from '../../../types/Server';

import BackendError from '../../../exception/BackendError';
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
import chalk from 'chalk';
import global from '../../../types/GlobalType';

const MODULE_NAME = 'JsonCentralSystemServer';

export default class JsonCentralSystemServer extends CentralSystemServer {
  private ongoingWSInitializations: Map<string, null> = new Map;
  private jsonWSConnections: Map<string, JsonWSConnection> = new Map();
  private jsonRestWSConnections: Map<string, JsonRestWSConnection> = new Map();

  public constructor(centralSystemConfig: CentralSystemConfiguration, chargingStationConfig: ChargingStationConfiguration) {
    super(centralSystemConfig, chargingStationConfig);
    if (this.centralSystemConfig.debug) {
      setInterval(() => {
        console.log(chalk.green('====================================='));
        if (this.jsonWSConnections.size > 0) {
          console.log(chalk.green(`** ${this.jsonWSConnections.size} CS connection(s)`));
          // for (const key of this.jsonWSConnections.keys()) {
          //   const jsonChargingStationClient = this.jsonWSConnections.get(key);
          //   console.log(chalk.green(`** Connection CS: ${jsonChargingStationClient.getChargingStationID()}`));
          // }
          // console.log(chalk.green('====================================='));
        } else {
          console.log(chalk.green('** No CS connection'));
        }
        if (this.jsonRestWSConnections.size > 0) {
          console.log(chalk.green(`** ${this.jsonRestWSConnections.size} CS connection(s)`));
          // for (const key of this.jsonRestWSConnections.keys()) {
          //   const jsonRestClient = this.jsonRestWSConnections.get(key);
          //   console.log(chalk.green(`** Connection REST: ${jsonRestClient.getChargingStationID()}`));
          // }
          // console.log(chalk.green('====================================='));
        } else {
          console.log(chalk.green('** No REST connection'));
        }
        if (this.ongoingWSInitializations.size > 0) {
          console.log(chalk.green(`** ${this.ongoingWSInitializations.size} ongoing WS initialization(s)`));
          // for (const key of this.ongoingWSInitializations.keys()) {
          //   console.log(chalk.green(`** Init incoming URL: ${key}`));
          // }
          // console.log(chalk.green('====================================='));
        } else {
          console.log(chalk.green('** No ongoing WS initialization(s)'));
        }
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

  private startWSServer() {
    console.log(`Starting ${ServerType.JSON_SERVER} Server...`);
    App({}).ws('/*', {
      compression: uWS.SHARED_COMPRESSOR,
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
          ws.end(WebSocketCloseEventStatusCode.CLOSE_ABNORMAL, error.message);
          await Logging.logException(error, ServerAction.WS_CONNECTION, MODULE_NAME, 'connection',
            wsConnection?.getTenantID() ? wsConnection.getTenantID() : Constants.DEFAULT_TENANT);
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
        console.log(`${ServerType.JSON_SERVER} Server listening on 'http://${this.centralSystemConfig.host}:${this.centralSystemConfig.port}'`);
      }
    });
  }

  private async getWSConnectionFromWebSocket(ws: uWS.WebSocket): Promise<WSConnection> {
    // Check if init has been finished
    await this.waitForEndOfInitialization(ws);
    if (ws.jsonWSConnection) {
      // Check if it's still available in the Map
      const jsonWSConnection = ws.jsonWSConnection as JsonWSConnection;
      if (!this.getJsonWSConnection(jsonWSConnection.getID())) {
        this.setJsonWSConnection(jsonWSConnection);
      }
      return jsonWSConnection;
    }
    if (ws.jsonRestWSConnection) {
      // Check if it's still available in the Map
      const jsonRestWSConnection = ws.jsonRestWSConnection as JsonRestWSConnection;
      if (!this.getJsonRestWSConnection(jsonRestWSConnection.getID())) {
        this.setJsonRestWSConnection(jsonRestWSConnection);
      }
      return jsonRestWSConnection;
    }
    // Nothing found
    ws.end(WebSocketCloseEventStatusCode.CLOSE_ABNORMAL, 'Web Socket not registered in the backend');
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
      // Try 10 times
      let remainingTrials = 10;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        // Wait
        await Utils.sleep(100);
        // Check
        if (!this.ongoingWSInitializations.has(ws.url)) {
          break;
        }
        // Nbr of trials ended?
        if (remainingTrials <= 0) {
          throw new BackendError({
            siteID: ws.siteID,
            siteAreaID: ws.siteAreaID,
            companyID: ws.companyID,
            chargingStationID: ws.chargingStationID,
            module: MODULE_NAME, method: 'waitForInitialization',
            message: 'OCPP Request received before OCPP connection init has been completed!'
          });
        }
        // Try another time
        remainingTrials--;
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

  private getJsonWSConnection(id: string): JsonWSConnection {
    return this.jsonWSConnections.get(id);
  }

  private getJsonRestWSConnection(id: string): JsonRestWSConnection {
    return this.jsonRestWSConnections.get(id);
  }
}
