import * as uWS from 'uWebSockets.js';

import { App, HttpRequest, HttpResponse, WebSocket, us_socket_context_t } from 'uWebSockets.js';
import { ServerAction, ServerType, WSServerProtocol } from '../../../types/Server';
import { WebSocketCloseEventStatusCode, WebSocketPingResult } from '../../../types/WebSocket';

import CentralSystemConfiguration from '../../../types/configuration/CentralSystemConfiguration';
import CentralSystemServer from '../CentralSystemServer';
import ChargingStationClient from '../../../client/ocpp/ChargingStationClient';
import ChargingStationConfiguration from '../../../types/configuration/ChargingStationConfiguration';
import Constants from '../../../utils/Constants';
import JsonRestWSConnection from './JsonRestWSConnection';
import JsonWSConnection from './JsonWSConnection';
import Logging from '../../../utils/Logging';
import { OCPPMessageType } from '../../../types/ocpp/OCPPCommon';
import Utils from '../../../utils/Utils';
import WSConnection from './WSConnection';
import global from '../../../types/GlobalType';

const MODULE_NAME = 'JsonCentralSystemServer';

export default class JsonCentralSystemServer extends CentralSystemServer {
  private waitingWSMessages = 0;
  private runningWSMessages = 0;
  private runningWSRequestsMessages: Record<string, boolean> = {};
  private jsonWSConnections: Map<string, JsonWSConnection> = new Map();
  private jsonRestWSConnections: Map<string, JsonRestWSConnection> = new Map();

  public constructor(centralSystemConfig: CentralSystemConfiguration, chargingStationConfig: ChargingStationConfiguration) {
    super(centralSystemConfig, chargingStationConfig);
    // Start job to clean WS connections
    this.startCleanupWSConnectionsJob();
    // Monitor WS activity
    this.monitorWSConnectionsJob();
  }

  public start(): void {
    // Keep it global
    global.centralSystemJsonServer = this;
    // Start the WS server
    Logging.logConsoleDebug(`Starting ${ServerType.JSON_SERVER} Server...`);
    App({}).ws('/*', {
      // compression: uWS.SHARED_COMPRESSOR,
      maxPayloadLength: 64 * 1024, // 64 KB per request
      idleTimeout: 1 * 3600, // 1 hour of inactivity => Close
      upgrade: async (res: HttpResponse, req: HttpRequest, context: us_socket_context_t) => {
        // Delegate
        await this.onUpgrade(res, req, context);
      },
      open: async (ws: WebSocket) => {
        // Delegate
        await this.onOpen(ws);
      },
      message: async (ws: WebSocket, message: ArrayBuffer, isBinary: boolean) => {
        // Delegate
        await this.onMessage(ws, message, isBinary);
      },
      close: async (ws: WebSocket, code: number, message: ArrayBuffer) => {
        // Convert right away
        const reason = Utils.convertBufferArrayToString(message).toString();
        // Close
        await this.closeWebSocket(ws, code, reason, true);
      },
      ping: async (ws: WebSocket, message: ArrayBuffer) => {
        // Convert
        const ocppMessage = Utils.convertBufferArrayToString(message);
        // Get the WS
        const wsConnection = await this.getWSConnectionFromWebSocket(ws, false);
        if (wsConnection) {
          await wsConnection.onPing(ocppMessage);
        }
      },
      pong: async (ws: WebSocket, message: ArrayBuffer) => {
        // Convert
        const ocppMessage = Utils.convertBufferArrayToString(message);
        // Get the WS
        const wsConnection = await this.getWSConnectionFromWebSocket(ws, false);
        if (wsConnection) {
          await wsConnection.onPong(ocppMessage);
        }
      }
    }).listen(this.centralSystemConfig.port, (token) => {
      if (token) {
        this.isDebug() && Logging.logConsoleDebug(`${ServerType.JSON_SERVER} Server listening on 'http://${this.centralSystemConfig.host}:${this.centralSystemConfig.port}'`);
      }
    });
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
        message: 'No opened Web Socket connection found'
      });
      return null;
    }
    // Return the client
    return jsonWebSocket.getChargingStationClient();
  }

  private async onUpgrade(res: uWS.HttpResponse, req: uWS.HttpRequest, context: uWS.us_socket_context_t) {
    // Check for WS connection over HTTP
    const upgrade = req.getHeader('upgrade');
    if (upgrade !== 'websocket') {
      await Logging.logError({
        tenantID: Constants.DEFAULT_TENANT,
        module: MODULE_NAME, method: 'onUpgrade',
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
        module: MODULE_NAME, method: 'onUpgrade',
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
        module: MODULE_NAME, method: 'onUpgrade',
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
  }

  private async onOpen(ws: uWS.WebSocket) {
    let wsConnection: WSConnection;
    let result: WebSocketPingResult;
    // Lock incoming WS messages
    await this.aquireLockForProcessingMessage(ws);
    try {
      this.runningWSMessages++;
      // Log (do not put the log before the lock or you'll receive a WS Message before which will close the WS connection => Unit Tests fails)
      await Logging.logInfo({
        tenantID: Constants.DEFAULT_TENANT,
        action: ServerAction.WS_CONNECTION,
        module: MODULE_NAME, method: 'onOpen',
        message: `New connection from URL '${ws.url as string}'`
      });
      // Check Json connection
      if (ws.url.startsWith('/OCPP16')) {
        // Set the protocol
        ws.protocol = WSServerProtocol.OCPP16;
        // Create a Json WebSocket connection object
        wsConnection = new JsonWSConnection(ws, ws.url);
        // Init
        await wsConnection.initialize();
        // Check if connection is still valid (init can be time consuming with a lot of WS connections)
        result = await this.pingWebSocket(ws);
        if (result.ok) {
          // Keep the WS Connection
          this.setJsonWSConnection(wsConnection as JsonWSConnection);
          ws.jsonWSConnection = wsConnection;
          await Logging.logInfo({
            tenantID: wsConnection.getTenantID(),
            siteID: wsConnection.getSiteID(),
            siteAreaID: wsConnection.getSiteAreaID(),
            companyID: wsConnection.getCompanyID(),
            chargingStationID: wsConnection.getChargingStationID(),
            action: ServerAction.WS_JSON_CONNECTION_OPENED,
            module: MODULE_NAME, method: 'onOpen',
            message: `New Json connection from URL '${wsConnection.getURL()}'`
          });
        }
      }
      // Check Rest connection
      if (ws.url.startsWith('/REST')) {
        // Create a Rest WebSocket connection object
        wsConnection = new JsonRestWSConnection(ws, ws.url);
        // Init
        await wsConnection.initialize();
        // Check if connection is still valid
        result = await this.pingWebSocket(ws);
        if (result.ok) {
          // Keep the WS Connection
          this.setJsonRestWSConnection(wsConnection as JsonRestWSConnection);
          ws.jsonRestWSConnection = wsConnection;
          await Logging.logInfo({
            tenantID: wsConnection.getTenantID(),
            siteID: wsConnection.getSiteID(),
            siteAreaID: wsConnection.getSiteAreaID(),
            companyID: wsConnection.getCompanyID(),
            chargingStationID: wsConnection.getChargingStationID(),
            action: ServerAction.WS_REST_CONNECTION_OPENED,
            module: MODULE_NAME, method: 'onOpen',
            message: `New Rest connection from URL '${wsConnection.getURL()}'`
          });
        }
      }
      // Keep data
      if (result?.ok && wsConnection) {
        ws.key = wsConnection.getID();
        ws.chargingStationID = wsConnection.getChargingStationID();
        ws.tenantID = wsConnection.getTenantID();
        ws.tokenID = wsConnection.getTokenID();
        ws.siteID = wsConnection.getSiteID();
        ws.siteAreaID = wsConnection.getSiteAreaID();
        ws.companyID = wsConnection.getCompanyID();
      }
    } catch (error) {
      await Logging.logException(error, ServerAction.WS_CONNECTION, MODULE_NAME, 'connection',
        wsConnection?.getTenantID() ? wsConnection.getTenantID() : Constants.DEFAULT_TENANT);
      // Close WS
      await this.closeWebSocket(ws, WebSocketCloseEventStatusCode.CLOSE_ABNORMAL, `Connection failed: ${error.message as string}`);
    } finally {
      this.runningWSMessages--;
      this.releaseLockAfterProcessingMessage(ws);
    }
  }

  private async aquireLockForProcessingMessage(ws: WebSocket, ocppMessageType?: OCPPMessageType): Promise<void> {
    // Only lock requests, not responses
    if (ocppMessageType && ocppMessageType !== OCPPMessageType.CALL_MESSAGE) {
      return;
    }
    // Wait for Init (avoid WS connection with same URL)
    await this.waitForNextWSMessageProcessing(ws);
    // Lock
    this.runningWSRequestsMessages[ws.url] = true;
  }

  private releaseLockAfterProcessingMessage(ws: WebSocket, ocppMessageType?: OCPPMessageType): void {
    // Only lock requests, not responses
    if (ocppMessageType && ocppMessageType !== OCPPMessageType.CALL_MESSAGE) {
      return;
    }
    // Unlock
    delete this.runningWSRequestsMessages[ws.url];
  }

  private async onMessage(ws: uWS.WebSocket, message: ArrayBuffer, isBinary: boolean): Promise<void> {
    // Convert
    const ocppMessage = Utils.convertBufferArrayToString(message);
    const [ocppMessageType] = JSON.parse(ocppMessage);
    // Lock incoming WS messages
    await this.aquireLockForProcessingMessage(ws, ocppMessageType);
    try {
      this.runningWSMessages++;
      // OCPP Request?
      if (ocppMessageType === OCPPMessageType.CALL_MESSAGE) {
        // Check if the WS connection is still valid
        const result = await this.pingWebSocket(ws);
        if (result.ok) {
          // Get the WS connection
          const wsConnection = await this.getWSConnectionFromWebSocket(ws);
          // Process the message
          if (wsConnection) {
            await wsConnection.onMessage(ocppMessage, isBinary);
          }
        }
      } else {
        // Get the WS connection
        const wsConnection = await this.getWSConnectionFromWebSocket(ws);
        // Process the message
        if (wsConnection) {
          await wsConnection.onMessage(ocppMessage, isBinary);
        }
      }
    } finally {
      this.runningWSMessages--;
      this.releaseLockAfterProcessingMessage(ws, ocppMessageType);
    }
  }


  private async getWSConnectionFromWebSocket(ws: uWS.WebSocket, closeWSIfNotFound = true): Promise<WSConnection> {
    // Return the WS connection
    if (ws.jsonWSConnection) {
      return ws.jsonWSConnection;
    }
    if (ws.jsonRestWSConnection) {
      return ws.jsonRestWSConnection;
    }
    // Close WS
    if (closeWSIfNotFound) {
      await this.closeWebSocket(ws, WebSocketCloseEventStatusCode.CLOSE_ABNORMAL, 'Web Socket not registered in the backend');
    }
  }

  private async logWSConnectionClosed(ws: WSConnection, action: ServerAction, errorCode: number, errorMessage: string): Promise<void> {
    await Logging.logInfo({
      tenantID: ws.getTenantID(),
      siteID: ws.getSiteID(),
      siteAreaID: ws.getSiteAreaID(),
      companyID: ws.getCompanyID(),
      chargingStationID: ws.getChargingStationID(),
      action, module: MODULE_NAME, method: 'logWSConnectionClosed',
      message: `WS Connection is closed, Reason: '${errorMessage ?? 'Unknown'}', Message: '${Utils.getWebSocketCloseEventStatusString(errorCode)}', Code: '${errorCode}'`,
      detailedMessages: { code: errorCode, message: errorMessage }
    });
  }

  private async waitForNextWSMessageProcessing(ws: WebSocket): Promise<boolean> {
    // Wait for init to handle multiple same WS Connection
    if (this.runningWSRequestsMessages[ws.url]) {
      this.isDebug() && Logging.logConsoleDebug(`A WS Message is already running for '${ws.url as string}', wait for it to end`);
      this.waitingWSMessages++;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        // Wait
        await Utils.sleep(500);
        // Initialization has been done
        if (!this.runningWSRequestsMessages[ws.url]) {
          this.waitingWSMessages--;
          break;
        }
      }
    }
    return true;
  }

  private async pingWebSocket(ws: WebSocket): Promise<WebSocketPingResult> {
    // Test the WS
    try {
      ws.ping();
      return {
        ok: true
      };
    } catch (error) {
      // Close
      await this.closeWebSocket(ws, WebSocketCloseEventStatusCode.CLOSE_ABNORMAL, error?.message, true);
      return {
        ok: false,
        errorCode: WebSocketCloseEventStatusCode.CLOSE_ABNORMAL,
        errorMessage: error?.message
      };
    }
  }

  private async closeWebSocket(ws: WebSocket, code: WebSocketCloseEventStatusCode, reason: string, wsAlreadyClosed = false): Promise<void> {
    // Check Json connection
    const jsonWSConnection = ws.jsonWSConnection as JsonWSConnection;
    if (jsonWSConnection) {
      this.removeJsonWSConnection(jsonWSConnection);
      await this.logWSConnectionClosed(jsonWSConnection, ServerAction.WS_JSON_CONNECTION_CLOSED, code, reason);
    }
    // Check REST connection
    const jsonRestWSConnection = ws.jsonRestWSConnection as JsonRestWSConnection;
    if (jsonRestWSConnection) {
      this.removeJsonRestWSConnection(jsonRestWSConnection);
      await this.logWSConnectionClosed(jsonRestWSConnection, ServerAction.WS_REST_CONNECTION_CLOSED, code, reason);
    }
    // Close the WS
    if (!wsAlreadyClosed) {
      try {
        ws.end(code, reason);
      } catch (wsError) {
        // Ignore
        this.isDebug() && Logging.logConsoleError(`Error when closing the Web Socket '${ws.url as string}' '${wsError?.message as string}'`);
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

  private isDebug(): boolean {
    return this.centralSystemConfig.debug || Utils.isDevelopmentEnv();
  }

  private monitorWSConnectionsJob() {
    if (this.isDebug()) {
      setInterval(() => {
        Logging.logConsoleDebug('=====================================');
        Logging.logConsoleDebug(`** ${this.jsonWSConnections.size} JSON Connection(s)`);
        Logging.logConsoleDebug(`** ${this.jsonRestWSConnections.size} REST Connection(s)`);
        Logging.logConsoleDebug(`** ${Object.keys(this.runningWSRequestsMessages).length} running WS Request Messages`);
        Logging.logConsoleDebug(`** ${this.runningWSMessages} running WS Messages`);
        Logging.logConsoleDebug(`** ${this.waitingWSMessages} waiting WS Message(s)`);
        Logging.logConsoleDebug('=====================================');
      }, 5000);
    }
  }

  private startCleanupWSConnectionsJob() {
    // Check WS connections
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    setInterval(async () => {
      this.isDebug() && Logging.logConsoleDebug('===========================================');
      // Check Json connections
      await this.checkAndCleanupWebSocket(ServerAction.WS_JSON_CONNECTION_CLOSED, this.jsonWSConnections, 'Json');
      // Check Rest connections
      await this.checkAndCleanupWebSocket(ServerAction.WS_REST_CLIENT_CONNECTION_CLOSED, this.jsonRestWSConnections, 'Rest');
      this.isDebug() && Logging.logConsoleDebug('===========================================');
    }, 30 * 60 * 1000);
  }

  private async checkAndCleanupWebSocket(action: ServerAction, wsConnectionMap: Map<string, WSConnection>, type: 'Json'|'Rest') {
    const validConnections: string[] = [], invalidConnections: string[] = [];
    for (const wsConnectionKey of wsConnectionMap.keys()) {
      const wsConnection = wsConnectionMap.get(wsConnectionKey);
      if (wsConnection) {
        // Get the WS
        const ws = wsConnection.getWSConnection();
        // Check
        const result = await this.pingWebSocket(ws);
        if (result.ok) {
          validConnections.push(ws.url);
        } else {
          invalidConnections.push(ws.url);
          await this.logWSConnectionClosed(wsConnection, action, result.errorCode, result.errorMessage);
        }
      }
    }
    // Log
    if (validConnections.length || invalidConnections.length) {
      const message = `${validConnections.length} ${type} valid WS Connection (${invalidConnections.length} invalid)`;
      this.isDebug() && Logging.logConsoleDebug(message);
      if (invalidConnections.length) {
        void Logging.logError({
          tenantID: Constants.DEFAULT_TENANT,
          module: MODULE_NAME, method: 'checkAndCleanupWebSocket',
          action: ServerAction.WS_CONNECTION,
          message, detailedMessages: { validConnections, invalidConnections }
        });
      } else {
        void Logging.logInfo({
          tenantID: Constants.DEFAULT_TENANT,
          module: MODULE_NAME, method: 'checkAndCleanupWebSocket',
          action: ServerAction.WS_CONNECTION,
          message, detailedMessages: { validConnections, invalidConnections }
        });
      }
    }
  }
}
