import * as uWS from 'uWebSockets.js';

import { App, HttpRequest, HttpResponse, WebSocket, us_socket_context_t } from 'uWebSockets.js';
import { ServerAction, ServerType, WSServerProtocol } from '../../../types/Server';
import { WebSocketCloseEventStatusCode, WebSocketPingResult } from '../../../types/WebSocket';

import BackendError from '../../../exception/BackendError';
import CentralSystemConfiguration from '../../../types/configuration/CentralSystemConfiguration';
import CentralSystemServer from '../CentralSystemServer';
import ChargingStation from '../../../types/ChargingStation';
import ChargingStationClient from '../../../client/ocpp/ChargingStationClient';
import ChargingStationConfiguration from '../../../types/configuration/ChargingStationConfiguration';
import Configuration from '../../../utils/Configuration';
import Constants from '../../../utils/Constants';
import JsonRestWSConnection from './JsonRestWSConnection';
import JsonWSConnection from './JsonWSConnection';
import Logging from '../../../utils/Logging';
import { OCPPMessageType } from '../../../types/ocpp/OCPPCommon';
import Tenant from '../../../types/Tenant';
import Utils from '../../../utils/Utils';
import WSConnection from './WSConnection';
import WSWrapper from './WSWrapper';
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
    this.checkAndCleanupWSConnections();
    // Monitor WS activity
    this.monitorWSConnections();
  }

  public start(): void {
    // Keep it global
    global.centralSystemJsonServer = this;
    // Start the WS server
    Logging.logConsoleDebug(`Starting ${ServerType.JSON_SERVER} Server...`);
    App({}).ws('/*', {
      compression: uWS.SHARED_COMPRESSOR,
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
        const messageStr = Utils.convertBufferArrayToString(message);
        await this.onMessage(ws, messageStr, isBinary);
      },
      close: async (ws: WebSocket, code: number, message: ArrayBuffer) => {
        // Convert right away
        const reason = Utils.convertBufferArrayToString(message);
        // Close
        this.isDebug() && Logging.logConsoleDebug(`WS Closed received for '${ws.wsWrapper.url as string}'`);
        await this.closeWebSocket(ws.wsWrapper, code, reason, true);
      },
      ping: async (ws: WebSocket, message: ArrayBuffer) => {
        // Convert
        const ocppMessage = Utils.convertBufferArrayToString(message);
        // Update
        if (ws.wsWrapper) {
          (ws.wsWrapper as WSWrapper).lastPingDate = new Date();
        }
        // Get the WS
        const wsConnection = await this.getWSConnectionFromWebSocket(ws.wsWrapper, false);
        if (wsConnection) {
          await wsConnection.onPing(ocppMessage);
        }
      },
      pong: async (ws: WebSocket, message: ArrayBuffer) => {
        // Convert
        const ocppMessage = Utils.convertBufferArrayToString(message);
        // Update
        if (ws.wsWrapper) {
          (ws.wsWrapper as WSWrapper).lastPongDate = new Date();
        }
        // Get the WS
        const wsConnection = await this.getWSConnectionFromWebSocket(ws.wsWrapper, false);
        if (wsConnection) {
          await wsConnection.onPong(ocppMessage);
        }
      }
    }).any('/health-check', (res: HttpResponse) => {
      res.end('OK');
    }).listen(this.centralSystemConfig.port, (token) => {
      if (token) {
        Logging.logConsoleDebug(`${ServerType.JSON_SERVER} Server listening on 'http://${this.centralSystemConfig.host}:${this.centralSystemConfig.port}'`);
      } else {
        Logging.logConsoleError(`${ServerType.JSON_SERVER} Server failed to listen on 'http://${this.centralSystemConfig.host}:${this.centralSystemConfig.port}'`);
      }
    });
  }

  public async getChargingStationClient(tenant: Tenant, chargingStation: ChargingStation): Promise<ChargingStationClient> {
    // Get the Json Web Socket
    const jsonWebSocket = this.jsonWSConnections.get(`${tenant.id}~${chargingStation.id}`);
    if (!jsonWebSocket) {
      await Logging.logWarning({
        tenantID: tenant.id,
        siteID: chargingStation.siteID,
        siteAreaID: chargingStation.siteAreaID,
        companyID: chargingStation.companyID,
        chargingStationID: chargingStation.id,
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
    try {
      // You MUST register an abort handler to know if the upgrade was aborted by peer
      res.onAborted(() => {
        // If no handler here, it crashes!!!
      });
      // Check URI (/OCPP16/<TENANT_ID>/<TOKEN_ID>/<CHARGING_STATION_ID> or /REST/<TENANT_ID>/<TOKEN_ID>/<CHARGING_STATION_ID>)
      const url = req.getUrl();
      if (!url.startsWith('/OCPP16') && !url.startsWith('/REST')) {
        await Logging.logError({
          tenantID: Constants.DEFAULT_TENANT,
          module: MODULE_NAME, method: 'onUpgrade',
          action: ServerAction.WS_CONNECTION,
          message: `WS Connection - Invalid: No 'OCPP16' or 'REST' path in '${req.getUrl()}'`
        });
        res.close();
        return;
      }
      // Check Protocol (ocpp1.6 / rest)
      const protocol = req.getHeader('sec-websocket-protocol');
      if (url.startsWith('/OCPP16') && (protocol !== WSServerProtocol.OCPP16)) {
        await Logging.logError({
          tenantID: Constants.DEFAULT_TENANT,
          module: MODULE_NAME, method: 'onUpgrade',
          action: ServerAction.WS_CONNECTION,
          message: `WS Connection - Invalid: No valid protocol (expected: 'ocpp1.6') for '${req.getUrl()}'`,
          detailedMessages: { protocol }
        });
        res.close();
        return;
      }
      if (url.startsWith('/REST') && (protocol !== WSServerProtocol.REST)) {
        await Logging.logError({
          tenantID: Constants.DEFAULT_TENANT,
          module: MODULE_NAME, method: 'onUpgrade',
          action: ServerAction.WS_CONNECTION,
          message: `WS Connection - Invalid: No valid protocol (expected: 'rest') for '${req.getUrl()}'`,
          detailedMessages: { protocol }
        });
        res.close();
        return;
      }
      // Okay
      res.upgrade(
        { url: req.getUrl() },
        req.getHeader('sec-websocket-key'),
        req.getHeader('sec-websocket-protocol'),
        req.getHeader('sec-websocket-extensions'),
        context
      );
    } catch (error) {
      await Logging.logInfo({
        tenantID: Constants.DEFAULT_TENANT,
        action: ServerAction.WS_CONNECTION,
        module: MODULE_NAME, method: 'onUpgrade',
        message: `New WS Connection failed to init: ${error.message as string}`,
        detailedMessages: { error: error.stack }
      });
    }
  }

  private async onOpen(ws: uWS.WebSocket) {
    let wsConnection: WSConnection;
    // Create WS Wrapper
    const wsWrapper = new WSWrapper(ws);
    // Keep it on the ws
    ws.wsWrapper = wsWrapper;
    // Lock incoming WS messages
    await this.aquireLockForWSRequest(wsWrapper);
    try {
      this.runningWSMessages++;
      // Do not put the log before the lock or it will delay the opening and the set of the lock which will be taken by the incoming WS Messages in // => Unit Tests fails)
      await Logging.logInfo({
        tenantID: Constants.DEFAULT_TENANT,
        action: ServerAction.WS_CONNECTION,
        module: MODULE_NAME, method: 'onOpen',
        message: `WS Connection - '${wsWrapper.url}'`
      });
      // Check Json connection
      if (wsWrapper.url.startsWith('/OCPP16')) {
        // Create and Initialize WS Connection
        wsConnection = await this.checkAndReferenceWSConnection(WSServerProtocol.OCPP16, wsWrapper);
      }
      // Check Rest connection
      if (wsWrapper.url.startsWith('/REST')) {
        // Create and Initialize WS Connection
        wsConnection = await this.checkAndReferenceWSConnection(WSServerProtocol.REST, wsWrapper);
      }
      if (!wsConnection) {
        throw new BackendError({
          action: ServerAction.WS_CONNECTION, module: MODULE_NAME, method: 'onOpen',
          message: `WS Connection - Unknown: '${wsWrapper.url}'`
        });
      }
    } catch (error) {
      await Logging.logException(error, ServerAction.WS_CONNECTION, MODULE_NAME, 'onOpen', wsWrapper.tenantID ?? Constants.DEFAULT_TENANT);
      await this.closeWebSocket(wsWrapper, WebSocketCloseEventStatusCode.CLOSE_ABNORMAL, `WS Connection - Closed: ${error.message as string}`);
    } finally {
      this.runningWSMessages--;
      this.releaseLockForWSMessageRequest(wsWrapper);
    }
  }

  private async checkAndReferenceWSConnection(protocol: WSServerProtocol, wsWrapper: WSWrapper): Promise<WSConnection> {
    let wsConnection: WSConnection;
    let action: ServerAction;
    // Set the protocol
    wsWrapper.protocol = protocol;
    // Create a Json WebSocket connection object
    if (protocol === WSServerProtocol.OCPP16) {
      wsConnection = new JsonWSConnection(wsWrapper);
      action = ServerAction.WS_JSON_CONNECTION_OPENED;
    }
    if (protocol === WSServerProtocol.REST) {
      wsConnection = new JsonRestWSConnection(wsWrapper);
      action = ServerAction.WS_REST_CONNECTION_OPENED;
    }
    // Init
    await wsConnection.initialize();
    // Check if WS is still opened (long time initialization when lots of WS are connecting at the same time)
    if (!wsWrapper.closed) {
      // Keep common data (Set here to get Tenant info in case of exception in Logs)
      wsWrapper.key = wsConnection.getID();
      wsWrapper.chargingStationID = wsConnection.getChargingStationID();
      wsWrapper.tenantID = wsConnection.getTenantID();
      wsWrapper.tokenID = wsConnection.getTokenID();
      wsWrapper.siteID = wsConnection.getSiteID();
      wsWrapper.siteAreaID = wsConnection.getSiteAreaID();
      wsWrapper.companyID = wsConnection.getCompanyID();
      // Check already existing WS Connection
      await this.checkWSConnectionAlreadyExists(wsConnection);
      // Reference a Json WebSocket connection object
      if (protocol === WSServerProtocol.OCPP16) {
        this.setJsonWSConnection(wsConnection as JsonWSConnection);
        wsWrapper.jsonWSConnection = wsConnection as JsonWSConnection;
      }
      if (protocol === WSServerProtocol.REST) {
        this.setJsonRestWSConnection(wsConnection as JsonRestWSConnection);
        wsWrapper.jsonRestWSConnection = wsConnection as JsonRestWSConnection;
      }
      await Logging.logInfo({
        tenantID: wsConnection.getTenantID(),
        siteID: wsConnection.getSiteID(),
        siteAreaID: wsConnection.getSiteAreaID(),
        companyID: wsConnection.getCompanyID(),
        chargingStationID: wsConnection.getChargingStationID(),
        action, module: MODULE_NAME, method: 'checkAndReferenceWSConnection',
        message: `WS Connection - Opened: '${wsConnection.getURL()}'`
      });
      await Logging.logInfo({
        tenantID: Constants.DEFAULT_TENANT,
        chargingStationID: wsConnection.getChargingStationID(),
        action, module: MODULE_NAME, method: 'checkAndReferenceWSConnection',
        message: `WS Connection - Opened: '${wsConnection.getURL()}'`
      });
    }
    return wsConnection;
  }

  private async checkWSConnectionAlreadyExists(wsConnection: WSConnection): Promise<void> {
    let existingWSConnection: WSConnection;
    let action: ServerAction;
    // Json connection
    if (wsConnection.getWS().protocol === WSServerProtocol.OCPP16) {
      existingWSConnection = this.getJsonWSConnection(wsConnection.getID());
      action = ServerAction.WS_JSON_CONNECTION_ERROR;
    }
    // REST connection
    if (wsConnection.getWS().protocol === WSServerProtocol.REST) {
      existingWSConnection = this.getJsonRestWSConnection(wsConnection.getID());
      action = ServerAction.WS_REST_CONNECTION_ERROR;
    }
    if (existingWSConnection) {
      const existingWSWrapper = existingWSConnection.getWS();
      if (!existingWSWrapper.closed) {
        // Check WS
        const result = await this.pingWebSocket(existingWSWrapper);
        if (result.ok) {
          // Close the old WS and keep the new incoming one
          await Logging.logWarning({
            tenantID: existingWSConnection.getTenantID(),
            siteID: existingWSConnection.getSiteID(),
            siteAreaID: existingWSConnection.getSiteAreaID(),
            companyID: existingWSConnection.getCompanyID(),
            chargingStationID: existingWSConnection.getChargingStationID(),
            action, module: MODULE_NAME, method: 'checkWSConnectionAlreadyExists',
            message: `WS Connection - Close already opened WS on '${existingWSWrapper.firstConnectionDate.toISOString()}', last pinged on '${existingWSWrapper.lastPingDate ? existingWSWrapper.lastPingDate?.toISOString() : 'N/A'}', last ponged on '${existingWSWrapper.lastPongDate ? existingWSWrapper.lastPongDate?.toISOString() : 'N/A'}' : '${existingWSWrapper.url}'`
          });
          // Close
          await this.closeWebSocket(existingWSConnection.getWS(), WebSocketCloseEventStatusCode.CLOSE_ABNORMAL, 'New incoming connection');
        }
      }
    }
  }

  private async aquireLockForWSRequest(wsWrapper: WSWrapper, ocppMessageType?: OCPPMessageType): Promise<void> {
    // Only lock requests, not responses
    if (ocppMessageType && ocppMessageType !== OCPPMessageType.CALL_MESSAGE) {
      return;
    }
    // Wait for Init (avoid WS connection with same URL), ocppMessageType only provided when a WS Message is received
    await this.waitForWSLockToRelease(wsWrapper, ocppMessageType ? false : true);
    // Lock
    this.runningWSRequestsMessages[wsWrapper.url] = true;
  }

  private releaseLockForWSMessageRequest(wsWrapper: WSWrapper, ocppMessageType?: OCPPMessageType): void {
    // Only lock requests, not responses
    if (ocppMessageType && (ocppMessageType !== OCPPMessageType.CALL_MESSAGE)) {
      return;
    }
    // Unlock
    delete this.runningWSRequestsMessages[wsWrapper.url];
  }

  private async onMessage(ws: uWS.WebSocket, message: string, isBinary: boolean): Promise<void> {
    // Convert
    const [ocppMessageType] = JSON.parse(message);
    const wsWrapper = ws.wsWrapper;
    // Lock incoming WS messages
    await this.aquireLockForWSRequest(wsWrapper, ocppMessageType);
    try {
      this.runningWSMessages++;
      // OCPP Request?
      if (ocppMessageType === OCPPMessageType.CALL_MESSAGE) {
        if (!wsWrapper.closed) {
          // Get the WS connection
          const wsConnection = await this.getWSConnectionFromWebSocket(wsWrapper);
          // Process the message
          if (wsConnection) {
            await wsConnection.receivedMessage(message, isBinary);
          }
        }
      } else {
        // Get the WS connection
        const wsConnection = await this.getWSConnectionFromWebSocket(wsWrapper);
        // Process the message
        if (wsConnection) {
          await wsConnection.receivedMessage(message, isBinary);
        }
      }
    } finally {
      this.runningWSMessages--;
      this.releaseLockForWSMessageRequest(wsWrapper, ocppMessageType);
    }
  }

  private async getWSConnectionFromWebSocket(wsWrapper: WSWrapper, closeWSIfNotFound = true): Promise<WSConnection> {
    // Return the WS connection
    if (wsWrapper.jsonWSConnection) {
      return wsWrapper.jsonWSConnection;
    }
    if (wsWrapper.jsonRestWSConnection) {
      return wsWrapper.jsonRestWSConnection;
    }
    // Close WS
    if (closeWSIfNotFound) {
      this.isDebug() && Logging.logConsoleDebug(`WS Connection not found for '${wsWrapper.url }', close WS`);
      await this.closeWebSocket(wsWrapper, WebSocketCloseEventStatusCode.CLOSE_ABNORMAL, 'Web Socket not registered in the backend');
    }
  }

  private async logWSConnectionClosed(wsConnection: WSConnection, action: ServerAction, errorCode: number, errorMessage: string): Promise<void> {
    const message = `WS Connection - Closed: '${wsConnection.getWS().url}', Code: '${errorCode}', Reason: '${errorMessage ?? 'Unknown'}'`;
    this.isDebug() && Logging.logConsoleDebug(message);
    await Logging.logInfo({
      tenantID: wsConnection.getTenantID(),
      siteID: wsConnection.getSiteID(),
      siteAreaID: wsConnection.getSiteAreaID(),
      companyID: wsConnection.getCompanyID(),
      chargingStationID: wsConnection.getChargingStationID(),
      action, module: MODULE_NAME, method: 'logWSConnectionClosed',
      message, detailedMessages: { code: errorCode, message: errorMessage }
    });
    await Logging.logInfo({
      tenantID: Constants.DEFAULT_TENANT,
      chargingStationID: wsConnection.getChargingStationID(),
      action, module: MODULE_NAME, method: 'logWSConnectionClosed',
      message, detailedMessages: { code: errorCode, message: errorMessage }
    });
  }

  private async waitForWSLockToRelease(wsWrapper: WSWrapper, incomingConnection: boolean): Promise<boolean> {
    // Wait for init to handle multiple same WS Connection
    if (this.runningWSRequestsMessages[wsWrapper.url]) {
      const maxNumberOfTrials = 10;
      let numberOfTrials = 0;
      const timeStart = Date.now();
      await Logging.logWarning({
        tenantID: Constants.DEFAULT_TENANT,
        action: ServerAction.WS_CONNECTION,
        module: MODULE_NAME, method: 'waitForWSLockToRelease',
        message: `WS ${incomingConnection ? 'Connection' : 'Request'} - Lock taken: Wait and try to acquire the lock for '${wsWrapper.url}'...`
      });
      this.waitingWSMessages++;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        // Wait
        await Utils.sleep(500);
        numberOfTrials++;
        // Message has been processed
        if (!this.runningWSRequestsMessages[wsWrapper.url]) {
          await Logging.logInfo({
            tenantID: Constants.DEFAULT_TENANT,
            action: ServerAction.WS_CONNECTION,
            module: MODULE_NAME, method: 'waitForWSLockToRelease',
            message: `WS ${incomingConnection ? 'Connection' : 'Request'} - Lock acquired successfully after ${numberOfTrials} trial(s) and ${(Date.now() - timeStart) / 1000} secs for '${wsWrapper.url}'`
          });
          // Free the lock
          this.waitingWSMessages--;
          break;
        }
        // Handle remaining trial
        if (numberOfTrials >= maxNumberOfTrials) {
          // Abnormal situation: The lock should not be taken for so long!
          await Logging.logError({
            tenantID: Constants.DEFAULT_TENANT,
            action: ServerAction.WS_CONNECTION,
            module: MODULE_NAME, method: 'waitForWSLockToRelease',
            message: `WS ${incomingConnection ? 'Connection' : 'Request'} - Cannot acquire the lock after ${numberOfTrials} trial(s) and ${(Date.now() - timeStart) / 1000} secs - Lock is freed anyway for '${wsWrapper.url}'`
          });
          // Free the lock
          this.waitingWSMessages--;
          break;
        }
      }
    }
    return true;
  }

  private async pingWebSocket(wsWrapper: WSWrapper): Promise<WebSocketPingResult> {
    // Test the WS
    try {
      wsWrapper.ping();
      return {
        ok: true
      };
    } catch (error) {
      // Close
      await this.closeWebSocket(wsWrapper, WebSocketCloseEventStatusCode.CLOSE_ABNORMAL, error?.message);
      return {
        ok: false,
        errorCode: WebSocketCloseEventStatusCode.CLOSE_ABNORMAL,
        errorMessage: error?.message
      };
    }
  }

  private async closeWebSocket(wsWrapper: WSWrapper, code: WebSocketCloseEventStatusCode, reason: string, fromCloseEvent = false): Promise<void> {
    // Keep status
    wsWrapper.close(code, reason, fromCloseEvent);
    // Check Json connection
    if (wsWrapper.jsonWSConnection) {
      this.removeJsonWSConnection(wsWrapper.jsonWSConnection);
      await this.logWSConnectionClosed(wsWrapper.jsonWSConnection, ServerAction.WS_JSON_CONNECTION_CLOSED, code, reason);
    }
    // Check REST connection
    if (wsWrapper.jsonRestWSConnection) {
      this.removeJsonRestWSConnection(wsWrapper.jsonRestWSConnection);
      await this.logWSConnectionClosed(wsWrapper.jsonRestWSConnection, ServerAction.WS_REST_CONNECTION_CLOSED, code, reason);
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

  private isDebug(): boolean {
    return this.centralSystemConfig.debug || Utils.isDevelopmentEnv();
  }

  private monitorWSConnections() {
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    setInterval(async () => {
      await Logging.logDebug({
        tenantID: Constants.DEFAULT_TENANT,
        action: ServerAction.WS_CONNECTION, module: MODULE_NAME, method: 'monitorWSConnectionsJob',
        message: `${this.jsonWSConnections.size} WS connections, ${this.jsonRestWSConnections.size} REST connections, ${this.runningWSMessages} Messages, ${Object.keys(this.runningWSRequestsMessages).length} Requests, ${this.waitingWSMessages} queued WS Message(s)`,
      });
      if (this.isDebug()) {
        Logging.logConsoleDebug('=====================================');
        Logging.logConsoleDebug(`** ${this.jsonWSConnections.size} JSON Connection(s)`);
        Logging.logConsoleDebug(`** ${this.jsonRestWSConnections.size} REST Connection(s)`);
        Logging.logConsoleDebug(`** ${Object.keys(this.runningWSRequestsMessages).length} running WS Requests`);
        Logging.logConsoleDebug(`** ${this.runningWSMessages} running WS Messages (Requests + Responses)`);
        Logging.logConsoleDebug(`** ${this.waitingWSMessages} queued WS Message(s)`);
        Logging.logConsoleDebug('=====================================');
      }
    }, 30 * 60 * 1000);
  }

  private checkAndCleanupWSConnections() {
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    setInterval(async () => {
      // Check Json connections
      await this.checkAndCleanupWebSockets(this.jsonWSConnections, 'Json');
      // Check Rest connections
      await this.checkAndCleanupWebSockets(this.jsonRestWSConnections, 'Rest');
    }, Configuration.getChargingStationConfig().heartbeatIntervalOCPPJSecs * 1000);
  }

  private async checkAndCleanupWebSockets(wsConnections: Map<string, WSConnection>, type: 'Json'|'Rest') {
    const validConnections: string[] = [], invalidConnections: string[] = [];
    for (const wsConnectionKey of wsConnections.keys()) {
      const wsConnection = wsConnections.get(wsConnectionKey);
      if (wsConnection) {
        // Get the WS
        const wsWrapper = wsConnection.getWS();
        // Check WS
        const result = await this.pingWebSocket(wsWrapper);
        if (result.ok) {
          validConnections.push(wsWrapper.url);
        } else {
          invalidConnections.push(wsWrapper.url);
        }
      }
    }
    if (validConnections.length || invalidConnections.length) {
      const message = `${validConnections.length} ${type} valid WS Connection pinged (${invalidConnections.length} invalid)`;
      this.isDebug() && Logging.logConsoleDebug(message);
      if (invalidConnections.length) {
        await Logging.logError({
          tenantID: Constants.DEFAULT_TENANT,
          module: MODULE_NAME, method: 'checkAndCleanupWebSocket',
          action: ServerAction.WS_CONNECTION_PINGED,
          message, detailedMessages: { validConnections, invalidConnections }
        });
      } else {
        await Logging.logInfo({
          tenantID: Constants.DEFAULT_TENANT,
          module: MODULE_NAME, method: 'checkAndCleanupWebSocket',
          action: ServerAction.WS_CONNECTION_PINGED,
          message, detailedMessages: { validConnections, invalidConnections }
        });
      }
    } else {
      this.isDebug() && Logging.logConsoleDebug('No Web Socket connection to ping');
    }
  }
}
