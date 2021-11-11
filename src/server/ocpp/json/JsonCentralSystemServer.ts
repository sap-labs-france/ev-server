import * as uWS from 'uWebSockets.js';

import { App, HttpRequest, HttpResponse, WebSocket, us_socket_context_t } from 'uWebSockets.js';
import { ServerAction, ServerType, WSServerProtocol } from '../../../types/Server';
import { WebSocketCloseEventStatusCode, WebSocketPingResult } from '../../../types/WebSocket';

import CentralSystemConfiguration from '../../../types/configuration/CentralSystemConfiguration';
import CentralSystemServer from '../CentralSystemServer';
import ChargingStationClient from '../../../client/ocpp/ChargingStationClient';
import ChargingStationConfiguration from '../../../types/configuration/ChargingStationConfiguration';
import { Command } from '../../../types/ChargingStation';
import Constants from '../../../utils/Constants';
import JsonRestWSConnection from './JsonRestWSConnection';
import JsonWSConnection from './JsonWSConnection';
import Logging from '../../../utils/Logging';
import Utils from '../../../utils/Utils';
import WSConnection from './WSConnection';
import global from '../../../types/GlobalType';

const MODULE_NAME = 'JsonCentralSystemServer';

export default class JsonCentralSystemServer extends CentralSystemServer {
  private ongoingWSInits: Map<string, null> = new Map;
  private incomingAndWaitingWSMessages: Map<string, string> = new Map;
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
        // Convert right away
        const ocppMessage = Utils.convertBufferArrayToString(message);
        // Wait for Init
        const processMessage = await this.waitForEndOfInitForOnMessage(ws, ocppMessage);
        // Get the WS
        if (processMessage) {
          const wsConnection = await this.getWSConnectionFromWebSocket(ws);
          if (wsConnection) {
            await wsConnection.onMessage(ocppMessage, isBinary);
          }
        }
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

  private async onOpen(ws: uWS.WebSocket) {
    let wsConnection: WSConnection;
    let result: WebSocketPingResult;
    try {
      // Wait for Init (avoid WS connection with same URL)
      await this.waitForEndOfInitForOnOpen(ws);
      // Lock incomming WS messages
      this.ongoingWSInits.set(ws.url, null);
      // Log (do not put the log before the lock or you'll receive a WS Message before which will close the WS connection => Unit Tests fails)
      await Logging.logInfo({
        tenantID: Constants.DEFAULT_TENANT,
        action: ServerAction.WS_CONNECTION,
        module: MODULE_NAME, method: 'open',
        message: `New connection from URL '${ws.url as string}'`
      });
      // Check Json connection
      if (ws.url.startsWith('/OCPP16')) {
        // Check if connection is still valid (maybe the same connection may have waited)
        result = await this.isWebSocketValid(ws);
        if (result.ok) {
          // Set the protocol
          ws.protocol = WSServerProtocol.OCPP16;
          // Create a Json WebSocket connection object
          wsConnection = new JsonWSConnection(ws, ws.url);
          // Init
          await wsConnection.initialize();
          // Check if connection is still valid (init can be time consuming with a lot of WS connections)
          result = await this.isWebSocketValid(ws);
          if (result.ok) {
            // Add
            this.setJsonWSConnection(wsConnection as JsonWSConnection);
            // Keep WS
            ws.jsonWSConnection = wsConnection;
            await Logging.logInfo({
              tenantID: wsConnection.getTenantID(),
              siteID: wsConnection.getSiteID(),
              siteAreaID: wsConnection.getSiteAreaID(),
              companyID: wsConnection.getCompanyID(),
              chargingStationID: wsConnection.getChargingStationID(),
              action: ServerAction.WS_JSON_CONNECTION_OPENED,
              module: MODULE_NAME, method: 'open',
              message: `New Json connection from URL '${wsConnection.getURL()}'`
            });
          }
        }
      }
      // Check Rest connection
      if (ws.url.startsWith('/REST')) {
        // Check if connection is still valid (maybe the same connection may have waited)
        result = await this.isWebSocketValid(ws);
        if (result.ok) {
          // Create a Rest WebSocket connection object
          wsConnection = new JsonRestWSConnection(ws, ws.url);
          // Init
          await wsConnection.initialize();
          // Check if connection is still valid
          result = await this.isWebSocketValid(ws);
          if (result.ok) {
            // Add
            this.setJsonRestWSConnection(wsConnection as JsonRestWSConnection);
            // Keep WS
            ws.jsonRestWSConnection = wsConnection;
            await Logging.logInfo({
              tenantID: wsConnection.getTenantID(),
              siteID: wsConnection.getSiteID(),
              siteAreaID: wsConnection.getSiteAreaID(),
              companyID: wsConnection.getCompanyID(),
              chargingStationID: wsConnection.getChargingStationID(),
              action: ServerAction.WS_REST_CONNECTION_OPENED,
              module: MODULE_NAME, method: 'open',
              message: `New Rest connection from URL '${wsConnection.getURL()}'`
            });
          }
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
      // Clear init
      this.ongoingWSInits.delete(ws.url);
    }
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

  private cleanupWSIncomingMessages(ws: WebSocket) {
    for (const incomingAndWaitingWSMessageKey of this.incomingAndWaitingWSMessages.keys()) {
      // Same WebSocket
      if (incomingAndWaitingWSMessageKey.startsWith(ws.url as string)) {
        // Remove
        this.incomingAndWaitingWSMessages.delete(incomingAndWaitingWSMessageKey);
      }
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

  private async waitForEndOfInitForOnOpen(ws: WebSocket): Promise<boolean> {
    // Wait for init to handle multiple same WS Connection
    if (this.ongoingWSInits.has(ws.url)) {
      this.isDebug() && Logging.logConsoleError(`Duplicate WS > WS new Connection '${ws.url as string}' has been put on hold`);
      // eslint-disable-next-line no-constant-condition
      while (true) {
        // Wait
        await Utils.sleep(500 + Math.trunc(Math.random() * 1000));
        // Initialization has been done
        if (!this.ongoingWSInits.has(ws.url)) {
          break;
        }
      }
    }
    return true;
  }

  private async waitForEndOfInitForOnMessage(ws: WebSocket, wsMessage: string): Promise<boolean> {
    // Wait for init and handle duplicate WS Messages
    if (this.ongoingWSInits.has(ws.url)) {
      // Handle duplicate WS message wait for init
      const wsMessageKey = this.buildOcppRequestDupKey(ws, wsMessage);
      const wsMessageID = `${Utils.generateUUID()}~${new Date().toLocaleString()}`;
      this.incomingAndWaitingWSMessages.set(wsMessageKey, wsMessageID);
      this.isDebug() && Logging.logConsoleError(`WS Init Not Ready > WS Request Key '${wsMessageKey}' with ID '${wsMessageID}' has been put on hold`);
      // eslint-disable-next-line no-constant-condition
      while (true) {
        // Wait
        await Utils.sleep(500 + Math.trunc(Math.random() * 1000));
        // Check if a new and same WS message has arrived
        // First WS message may have been timed out and a retry may have been triggered by the CS: then first WS message should be ignored)
        const foundWSMessageID = this.incomingAndWaitingWSMessages.get(wsMessageKey);
        // No WS Message (WS closed)?
        if (!foundWSMessageID) {
          this.isDebug() && Logging.logConsoleError(`WS Message Key '${wsMessageKey}' with ID '${wsMessageID}' has not been found anymore (WS Closed?) and will be ignored`);
          return false;
        }
        // Check if WS Message is still valid
        if (foundWSMessageID !== wsMessageID) {
          // Dup message in the queue: ignore this one
          this.isDebug() && Logging.logConsoleError(`Duplicate WS Message > Key '${wsMessageKey}' with ID '${wsMessageID}' will be ignored`);
          this.incomingAndWaitingWSMessages.delete(wsMessageID);
          return false;
        }
        // Initialization has been done
        if (!this.ongoingWSInits.has(ws.url)) {
          this.incomingAndWaitingWSMessages.delete(wsMessageKey);
          break;
        }
      }
    }
    return true;
  }

  private buildOcppRequestDupKey(ws: WebSocket, wsMessage: string): string {
    const wsJsonMessage = JSON.parse(wsMessage);
    const command: Command = wsJsonMessage[2];
    try {
      // Parse the OCPP request
      const ocppParameter: Record<string, string> = wsJsonMessage[3];
      switch (command) {
        case Command.UPDATE_FIRMWARE:
        case Command.RESET:
        case Command.HEARTBEAT:
        case Command.CLEAR_CACHE:
        case Command.DATA_TRANSFER:
        case Command.GET_CONFIGURATION:
        case Command.BOOT_NOTIFICATION:
        case Command.GET_DIAGNOSTICS:
        case Command.DIAGNOSTICS_STATUS_NOTIFICATION:
        case Command.FIRMWARE_STATUS_NOTIFICATION:
          return `${ws.url as string}~${command}`;

        case Command.CHANGE_CONFIGURATION:
          if (ocppParameter.key) {
            return `${ws.url as string}~${command}~${ocppParameter.key}`;
          }
          return `${ws.url as string}~${command}`;

        case Command.REMOTE_STOP_TRANSACTION:
          return `${ws.url as string}~${command}~${ocppParameter.transactionId}`;

        case Command.REMOTE_START_TRANSACTION:
        case Command.START_TRANSACTION:
          return `${ws.url as string}~${command}~${ocppParameter.connectorId}~${ocppParameter.idTag}`;

        case Command.METER_VALUES:
        case Command.UNLOCK_CONNECTOR:
        case Command.RESERVE_NOW:
        case Command.STATUS_NOTIFICATION:
        case Command.CHANGE_AVAILABILITY:
        case Command.SET_CHARGING_PROFILE:
        case Command.CLEAR_CHARGING_PROFILE:
        case Command.GET_COMPOSITE_SCHEDULE:
          return `${ws.url as string}~${command}~${ocppParameter.connectorId}`;

        case Command.AUTHORIZE:
        case Command.STOP_TRANSACTION:
          return `${ws.url as string}~${command}~${ocppParameter.idTag}`;

        case Command.CANCEL_RESERVATION:
          return `${ws.url as string}~${command}~${ocppParameter.reservationId}`;

        default:
          return `${ws.url as string}~${command as string}`;
      }
    } catch (error) {
      this.isDebug() && Logging.logConsoleError(`Error processing the WS command '${command}', Message '${wsMessage}': '${error.message as string}'`);
      return `${ws.url as string}~${command as string}`;
    }
  }

  private async isWebSocketValid(ws: WebSocket): Promise<WebSocketPingResult> {
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
    // Cleanup incoming message on hold if any
    this.cleanupWSIncomingMessages(ws);
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
        if (this.jsonWSConnections.size > 0) {
          Logging.logConsoleDebug(`** ${this.jsonWSConnections.size} CS connection(s)`);
        } else {
          Logging.logConsoleDebug('** No CS connection');
        }
        if (this.jsonRestWSConnections.size > 0) {
          Logging.logConsoleDebug(`** ${this.jsonRestWSConnections.size} REST connection(s)`);
        } else {
          Logging.logConsoleDebug('** No REST connection');
        }
        if (this.ongoingWSInits.size > 0) {
          Logging.logConsoleDebug(`** ${this.ongoingWSInits.size} ongoing WS initialization(s)`);
        } else {
          Logging.logConsoleDebug('** No ongoing WS initialization(s)');
        }
        Logging.logConsoleDebug(`** ${this.incomingAndWaitingWSMessages.size} WS Requests on hold`);
        for (const incomingAndWaitingWSMessageKey of this.incomingAndWaitingWSMessages.keys()) {
          const incomingAndWaitingWSMessage = this.incomingAndWaitingWSMessages.get(incomingAndWaitingWSMessageKey);
          Logging.logConsoleDebug(`Incoming WS Message on hold: Key '${incomingAndWaitingWSMessageKey}', value '${incomingAndWaitingWSMessage}'`);
        }
        Logging.logConsoleDebug('=====================================');
      }, 5000);
    }
  }

  private startCleanupWSConnectionsJob() {
    // Check WS connections
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    setInterval(async () => {
      // Check Json connections
      await this.checkAndCleanupWebSocket(ServerAction.WS_JSON_CONNECTION_CLOSED, this.jsonWSConnections, 'Json');
      // Check Rest connections
      await this.checkAndCleanupWebSocket(ServerAction.WS_REST_CLIENT_CONNECTION_CLOSED, this.jsonRestWSConnections, 'Rest');
    }, 10 * 60 * 1000);
  }

  private async checkAndCleanupWebSocket(action: ServerAction, wsConnectionMap: Map<string, WSConnection>, type: 'Json'|'Rest') {
    this.isDebug() && Logging.logConsoleDebug('===========================================');
    let validConnections = 0, invalidConnections = 0;
    for (const wsConnectionKey of wsConnectionMap.keys()) {
      const wsConnection = wsConnectionMap.get(wsConnectionKey);
      if (wsConnection) {
        // Get the WS
        const ws = wsConnection.getWSConnection();
        // Check
        const result = await this.isWebSocketValid(ws);
        if (result.ok) {
          validConnections++;
        } else {
          invalidConnections++;
          await this.logWSConnectionClosed(wsConnection, action, result.errorCode, result.errorMessage);
        }
        try {
          // Test
          ws.ping();
        } catch (error) {
          // Remove the invalid WS
          wsConnectionMap.delete(wsConnectionKey);
          invalidConnections++;
          // Cleanup incoming message on hold if any
          this.cleanupWSIncomingMessages(ws);
          // Log
          const message = `Invalid ${type} WS Connection '${error?.message as string}', removed from cache!`;
          void Logging.logError({
            tenantID: wsConnection.getTenantID(),
            siteID: wsConnection.getSiteID(),
            siteAreaID: wsConnection.getSiteAreaID(),
            companyID: wsConnection.getCompanyID(),
            chargingStationID: wsConnection.getChargingStationID(),
            module: MODULE_NAME, method: 'checkAndCleanupWebSocket',
            action, message, detailedMessages: { error: error.stack }
          });
          this.isDebug() && Logging.logConsoleError(message);
        }
      }
    }
    const message = `${type} WS Connection checked: ${validConnections} valid, ${invalidConnections} invalid`;
    this.isDebug() && Logging.logConsoleDebug(message);
    void Logging.logInfo({
      tenantID: Constants.DEFAULT_TENANT,
      module: MODULE_NAME, method: 'checkAndCleanupWebSocket',
      action: ServerAction.WS_CONNECTION,
      message
    });
    this.isDebug() && Logging.logConsoleDebug('===========================================');
  }
}
