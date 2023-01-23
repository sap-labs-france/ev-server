/* eslint-disable @typescript-eslint/no-misused-promises */
import * as uWS from 'uWebSockets.js';

import { App, HttpRequest, HttpResponse, WebSocket, us_socket_context_t } from 'uWebSockets.js';
import { ServerAction, ServerType, WSServerProtocol } from '../../../types/Server';
import { WebSocketAction, WebSocketCloseEventStatusCode, WebSocketPingResult } from '../../../types/WebSocket';

import CentralSystemConfiguration from '../../../types/configuration/CentralSystemConfiguration';
import ChargingStation from '../../../types/ChargingStation';
import ChargingStationClient from '../../../client/ocpp/ChargingStationClient';
import ChargingStationConfiguration from '../../../types/configuration/ChargingStationConfiguration';
import Configuration from '../../../utils/Configuration';
import Constants from '../../../utils/Constants';
import JsonRestWSConnection from './web-socket/JsonRestWSConnection';
import JsonWSConnection from './web-socket/JsonWSConnection';
import Logging from '../../../utils/Logging';
import LoggingHelper from '../../../utils/LoggingHelper';
import { OCPPMessageType } from '../../../types/ocpp/OCPPCommon';
import OCPPServer from '../OCPPServer';
import Tenant from '../../../types/Tenant';
import Utils from '../../../utils/Utils';
import WSConnection from './web-socket/WSConnection';
import WSWrapper from './web-socket/WSWrapper';
import global from '../../../types/GlobalType';
import sizeof from 'object-sizeof';

const MODULE_NAME = 'JsonOCPPServer';

export default class JsonOCPPServer extends OCPPServer {
  private waitingWSMessages = 0;
  private runningWSMessages = 0;
  private runningWSRequestsMessages: Record<string, boolean> = {};
  private jsonWSConnections: Map<string, JsonWSConnection> = new Map();
  private jsonRestWSConnections: Map<string, JsonRestWSConnection> = new Map();

  public constructor(centralSystemConfig: CentralSystemConfiguration, chargingStationConfig: ChargingStationConfiguration) {
    super(centralSystemConfig, chargingStationConfig);
    this.monitorAndCleanupWebSockets();
    this.monitorWebSocketActivities();
  }

  public start(): void {
    // Keep it global
    global.centralSystemJsonServer = this;
    // Start the WS server
    Logging.logConsoleDebug(`Starting ${ServerType.JSON_SERVER} Server...`);
    App({}).ws('/*', {
      compression: uWS.SHARED_COMPRESSOR,
      maxPayloadLength: 64 * 1024, // 64 KB per request
      idleTimeout: 0, // Never close the WS
      // maxLifetime: 0, // Never close the WS
      sendPingsAutomatically: true, // Ping the WS
      upgrade: async (res: HttpResponse, req: HttpRequest, context: us_socket_context_t) => {
        await this.onUpgrade(res, req, context);
      },
      open: (ws: WebSocket) => {
        this.onOpen(ws);
      },
      drain: async (ws: WebSocket) => {
        await this.onDrain(ws);
      },
      message: async (ws: WebSocket, message: ArrayBuffer, isBinary: boolean) => {
        // Delegate
        const messageStr = Utils.convertBufferArrayToString(message);
        await this.onMessage(ws, messageStr, isBinary);
      },
      close: async (ws: WebSocket, code: number, message: ArrayBuffer) => {
        // Convert right away (sometimes not working in the method)
        const reason = Utils.convertBufferArrayToString(message);
        await this.onClose(ws, code, reason);
      },
      ping: async (ws: WebSocket, message: ArrayBuffer) => {
        // Convert right away (sometimes not working in the method)
        const ocppMessage = Utils.convertBufferArrayToString(message);
        await this.onPing(ws, ocppMessage);
      },
      pong: async (ws: WebSocket, message: ArrayBuffer) => {
        // Convert right away (sometimes not working in the method)
        const ocppMessage = Utils.convertBufferArrayToString(message);
        await this.onPong(ws, ocppMessage);
      }
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    }).any(Constants.HEALTH_CHECK_ROUTE, async (res: HttpResponse) => {
      res.onAborted(() => {
        res.aborted = true;
      });
      const pingSuccess = await global.database.ping();
      if (!res.aborted) {
        if (pingSuccess) {
          res.end('OK');
        } else {
          res.writeStatus('500');
          res.end('KO');
        }
      }
    }).any('/*', (res: HttpResponse) => {
      res.writeStatus('404');
      res.end();
    }).listen(this.centralSystemConfig.port, (token) => {
      if (token) {
        Logging.logConsoleDebug(
          `${ServerType.JSON_SERVER} Server listening on 'http://${this.centralSystemConfig.host}:${this.centralSystemConfig.port}'`);
      } else {
        Logging.logConsoleError(
          `${ServerType.JSON_SERVER} Server failed to listen on 'http://${this.centralSystemConfig.host}:${this.centralSystemConfig.port}'`);
      }
    });
  }

  public async getChargingStationClient(tenant: Tenant, chargingStation: ChargingStation): Promise<ChargingStationClient> {
    // Get the Json Web Socket
    const jsonWebSocket = this.jsonWSConnections.get(`${tenant.id}~${chargingStation.id}`);
    if (!jsonWebSocket) {
      await Logging.logError({
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        tenantID:  [Constants.DEFAULT_TENANT_ID, tenant.id],
        module: MODULE_NAME, method: 'getChargingStationClient',
        action: ServerAction.WS_SERVER_CONNECTION,
        message: 'No opened Web Socket connection found',
      });
      return;
    }
    // Return the client
    return jsonWebSocket.getChargingStationClient();
  }

  public hasChargingStationConnected(tenant: Tenant, chargingStation: ChargingStation): boolean {
    return this.jsonWSConnections.has(`${tenant.id}~${chargingStation.id}`);
  }

  private async onUpgrade(res: uWS.HttpResponse, req: uWS.HttpRequest, context: uWS.us_socket_context_t) {
    /* Keep track of abortions */
    const upgradeAborted = { aborted: false };
    // Copy data here because access to 'req' object no longer valid after an 'await' call
    const url = req.getUrl();
    const secWebSocketKey = req.getHeader('sec-websocket-key');
    const secWebSocketProtocol = req.getHeader('sec-websocket-protocol');
    const secWebSocketExtensions = req.getHeader('sec-websocket-extensions');
    try {
      // You MUST register an abort handler to know if the upgrade was aborted by peer
      res.onAborted(() => {
        upgradeAborted.aborted = true;
      });
      // INFO: Cannot use Logging in this method as uWebSocket will fail in using req/res objects :S
      // Check URI (/OCPP16/<TENANT_ID>/<TOKEN_ID>/<CHARGING_STATION_ID> or /REST/<TENANT_ID>/<TOKEN_ID>/<CHARGING_STATION_ID>)
      if (!url.startsWith('/OCPP16') && !url.startsWith('/REST')) {
        await Logging.logError({
          tenantID: Constants.DEFAULT_TENANT_ID,
          module: MODULE_NAME, method: 'onUpgrade',
          action: ServerAction.WS_SERVER_CONNECTION,
          message: `${WebSocketAction.UPGRADE} > WS Connection with URL '${url}' is invalid: No 'OCPP16' or 'REST' in path`
        });
        res.close();
        return;
      }
      // Check Protocol (ocpp1.6 / rest)
      const protocol = req.getHeader('sec-websocket-protocol');
      if (url.startsWith('/OCPP16') && (protocol !== WSServerProtocol.OCPP16)) {
        await Logging.logError({
          tenantID: Constants.DEFAULT_TENANT_ID,
          module: MODULE_NAME, method: 'onUpgrade',
          action: ServerAction.WS_SERVER_CONNECTION,
          message: `${WebSocketAction.UPGRADE} > WS Connection with URL '${url}' is invalid, expected protocol 'ocpp1.6' but got '${protocol}'`,
          detailedMessages: { protocol }
        });
        res.close();
        return;
      }
      if (url.startsWith('/REST') && (protocol !== WSServerProtocol.REST)) {
        await Logging.logError({
          tenantID: Constants.DEFAULT_TENANT_ID,
          module: MODULE_NAME, method: 'onUpgrade',
          action: ServerAction.WS_SERVER_CONNECTION,
          message: `${WebSocketAction.UPGRADE} > WS Connection with URL '${url}' is invalid, expected protocol 'rest' but got '${protocol}'`,
          detailedMessages: { protocol }
        });
        res.close();
        return;
      }
      // Check and Create WSWrapper without WebSocket
      const wsWrapper = new WSWrapper(url);
      // Create Json connection
      await this.createAndKeepJsonConnection(wsWrapper);
      // Upgrade to WS
      if (!upgradeAborted.aborted) {
        res.upgrade(
          { url },
          secWebSocketKey,
          secWebSocketProtocol,
          secWebSocketExtensions,
          context
        );
      }
    } catch (error) {
      const message = `${WebSocketAction.UPGRADE} > New WS Connection with URL '${url}' failed with error: ${error.message as string}`;
      res.writeStatus('500');
      res.end(message);
      this.isDebug() && Logging.logConsoleDebug(message);
      await Logging.logError({
        tenantID: Constants.DEFAULT_TENANT_ID,
        action: ServerAction.WS_SERVER_CONNECTION,
        module: MODULE_NAME, method: 'onUpgrade',
        message, detailedMessages: { error: error.stack }
      });
    }
  }

  private onOpen(ws: WebSocket) {
    // Init WS
    this.resolveAndGetWSWrapper(ws);
  }

  private async onDrain(ws: WebSocket) {
    // Do not try to resolve the WSWrapper
    const wsWrapper = ws['wsWrapper'] as WSWrapper ?? new WSWrapper(ws['url'] as string);
    // Just log draining
    await Logging.logWarning({
      ...LoggingHelper.getWSWrapperProperties(wsWrapper),
      tenantID: Constants.DEFAULT_TENANT_ID,
      action: ServerAction.WS_SERVER_CONNECTION_CLOSE,
      module: MODULE_NAME, method: 'drain',
      message: 'Web Socket drain method called',
      detailedMessages: {
        wsWrapper: wsWrapper?.toJson()
      }
    });
  }

  private async onClose(ws: WebSocket, code: number, reason: string): Promise<void> {
    // Do not try to resolve the WSWrapper, just get it from the uWS
    const wsWrapper = ws['wsWrapper'] as WSWrapper;
    if (wsWrapper) {
      // Force close
      wsWrapper.closed = true;
      // Cleanup WS Connection map
      if (wsWrapper.wsConnection) {
        if (wsWrapper.protocol === WSServerProtocol.OCPP16) {
          this.jsonWSConnections.delete(wsWrapper.wsConnection.getID());
        }
        if (wsWrapper.protocol === WSServerProtocol.REST) {
          this.jsonRestWSConnections.delete(wsWrapper.wsConnection.getID());
        }
      }
      await this.logWSConnectionClosed(wsWrapper, ServerAction.WS_SERVER_CONNECTION_CLOSE, code,
        `${WebSocketAction.CLOSE} > WS ID '${wsWrapper?.guid}' closed by charging station with code '${code}', reason: '${!Utils.isNullOrEmptyString(reason) ? reason : '-'}'`);
    } else {
      const message = `${WebSocketAction.CLOSE} > WS ID 'N/A' closed by charging station with code '${code}', reason: '${!Utils.isNullOrEmptyString(reason) ? reason : '-'}'`;
      await Logging.logInfo({
        tenantID: Constants.DEFAULT_TENANT_ID,
        action: ServerAction.WS_SERVER_CONNECTION_CLOSE,
        module: MODULE_NAME, method: 'onClose',
        message, detailedMessages: { code, reason }
      });
      this.isDebug() && Logging.logConsoleDebug(message);
    }
  }

  private async onPing(ws: WebSocket, ocppMessage: string): Promise<void> {
    const wsWrapper = this.resolveAndGetWSWrapper(ws);
    if (wsWrapper) {
      wsWrapper.lastPingDate = new Date();
      // Get the WS
      if (wsWrapper.wsConnection) {
        await wsWrapper.wsConnection.onPing(ocppMessage);
      }
    }
  }

  private async onPong(ws: WebSocket, ocppMessage: string): Promise<void> {
    const wsWrapper = this.resolveAndGetWSWrapper(ws);
    if (wsWrapper) {
      wsWrapper.lastPongDate = new Date();
      // Get the WS
      if (wsWrapper.wsConnection) {
        await wsWrapper.wsConnection.onPong(ocppMessage);
      }
    }
  }

  private async onMessage(ws: WebSocket, message: string, isBinary: boolean): Promise<void> {
    // Get WS Wrapper
    const wsWrapper = this.resolveAndGetWSWrapper(ws);
    if (!wsWrapper) {
      return;
    }
    if (!wsWrapper.isValid) {
      wsWrapper.close(WebSocketCloseEventStatusCode.CLOSE_ABNORMAL, 'Connection rejected by the backend');
      return;
    }
    // Process message
    try {
      const [ocppMessageType] = JSON.parse(message);
      try {
        this.runningWSMessages++;
        // OCPP Request?
        if (ocppMessageType === OCPPMessageType.CALL_MESSAGE) {
          if (!wsWrapper.closed) {
            // Process the message
            if (wsWrapper.wsConnection) {
              await wsWrapper.wsConnection.receivedMessage(message, isBinary);
            }
          }
        // Process the message
        } else if (wsWrapper.wsConnection) {
          await wsWrapper.wsConnection.receivedMessage(message, isBinary);
        }
      } finally {
        this.runningWSMessages--;
      }
    } catch (error) {
      await Logging.logError({
        ...LoggingHelper.getWSWrapperProperties(wsWrapper),
        tenantID: [Constants.DEFAULT_TENANT_ID, wsWrapper.tenantID],
        action: ServerAction.WS_SERVER_MESSAGE,
        module: MODULE_NAME, method: 'onMessage',
        message: `${WebSocketAction.MESSAGE} > WS ID '${wsWrapper.guid}' got error while processing WS Message: ${error.message as string}`,
        detailedMessages: { message, isBinary, wsWrapper: wsWrapper.toJson(), error: error.stack }
      });
    }
  }

  private resolveAndGetWSWrapper(ws: WebSocket): WSWrapper {
    const wsWrapper = ws['wsWrapper'] as WSWrapper;
    if (wsWrapper) {
      if (!wsWrapper.closed) {
        return wsWrapper;
      }
      return;
    }
    // Find the WS Wrapper (only done the first time, next it is attached to the uWS)
    const url = ws['url'] as string;
    let wsConnections: IterableIterator<WSConnection>;
    if (url.startsWith('/OCPP16')) {
      wsConnections = this.jsonWSConnections.values();
    }
    if (url.startsWith('/REST')) {
      wsConnections = this.jsonRestWSConnections.values();
    }
    // Search for already registered Wrapper set by in the 'onUpgrade' method
    if (wsConnections) {
      for (const wsConnection of wsConnections) {
        if (wsConnection.getOriginalURL() === url) {
          // Attach it to the Web Socket
          const foundWSWrapper = wsConnection.getWS();
          ws['wsWrapper'] = foundWSWrapper;
          foundWSWrapper.setWebSocket(ws);
          return foundWSWrapper;
        }
      }
    }
    // No found: close the connection
    ws.end(WebSocketCloseEventStatusCode.CLOSE_ABNORMAL, 'Connection rejected by the backend');
  }

  private async createAndKeepJsonConnection(wsWrapper: WSWrapper): Promise<void> {
    let wsConnection: WSConnection;
    const timeStart = Date.now();
    try {
      // Create a WebSocket connection object
      if (wsWrapper.protocol === WSServerProtocol.OCPP16) {
        wsConnection = new JsonWSConnection(wsWrapper);
      }
      if (wsWrapper.protocol === WSServerProtocol.REST) {
        wsConnection = new JsonRestWSConnection(wsWrapper);
      }
      await Logging.logDebug({
        tenantID: Constants.DEFAULT_TENANT_ID,
        action: ServerAction.WS_SERVER_CONNECTION_OPEN, module: MODULE_NAME, method: 'createAndKeepJsonConnection',
        message: `${WebSocketAction.OPEN} > WS ID '${wsWrapper.guid}'  is being checked ('${wsWrapper.url}')`,
        detailedMessages: { wsWrapper: wsWrapper.toJson() }
      });
      // Initialize (check of Tenant, Token, Charging Station -> Can take time)
      await wsConnection.initialize();
      // Keep common data (Set here to get Tenant info in case of exception in Logs)
      wsWrapper.key = wsConnection.getID();
      wsWrapper.chargingStationID = wsConnection.getChargingStationID();
      wsWrapper.tenantID = wsConnection.getTenantID();
      wsWrapper.tokenID = wsConnection.getTokenID();
      wsWrapper.siteID = wsConnection.getSiteID();
      wsWrapper.siteAreaID = wsConnection.getSiteAreaID();
      wsWrapper.companyID = wsConnection.getCompanyID();
      wsWrapper.wsConnection = wsConnection;
      // Keep WS connection in cache
      if (wsWrapper.protocol === WSServerProtocol.OCPP16) {
        this.jsonWSConnections.set(wsConnection.getID(), wsConnection as JsonWSConnection);
      }
      if (wsWrapper.protocol === WSServerProtocol.REST) {
        this.jsonRestWSConnections.set(wsConnection.getID(), wsConnection as JsonRestWSConnection);
      }
      await Logging.logInfo({
        ...LoggingHelper.getWSWrapperProperties(wsWrapper),
        tenantID: [Constants.DEFAULT_TENANT_ID, wsWrapper.tenantID],
        action: ServerAction.WS_SERVER_CONNECTION_OPEN, module: MODULE_NAME, method: 'createAndKeepJsonConnection',
        message: `${WebSocketAction.OPEN} > WS ID '${wsWrapper.guid}' is valid (processed in ${Utils.computeTimeDurationSecs(timeStart)} secs)`,
        detailedMessages: { wsWrapper: wsWrapper.toJson() }
      });
    } catch (error) {
      await Logging.logError({
        ...LoggingHelper.getWSWrapperProperties(wsWrapper),
        tenantID: [Constants.DEFAULT_TENANT_ID, wsWrapper.tenantID],
        action: ServerAction.WS_SERVER_CONNECTION_OPEN, module: MODULE_NAME, method: 'createAndKeepJsonConnection',
        message: `${WebSocketAction.OPEN} > WS ID '${wsWrapper.guid}' is invalid (processed in ${Utils.computeTimeDurationSecs(timeStart)} secs)`,
        detailedMessages: { wsWrapper: wsWrapper.toJson() }
      });
    }
  }

  private monitorWebSocketActivities() {
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    setTimeout(async () => {
      try {
        // Log size of WS Json Connections (track leak)
        let sizeOfCurrentRequestsBytes = 0, numberOfCurrentRequests = 0;
        for (const jsonWSConnection of Array.from(this.jsonWSConnections.values())) {
          const currentOcppRequests = jsonWSConnection.getCurrentOcppRequests();
          sizeOfCurrentRequestsBytes += sizeof(currentOcppRequests);
          numberOfCurrentRequests += Object.keys(currentOcppRequests).length;
        }
        // Log Stats on number of WS Connections
        await Logging.logDebug({
          tenantID: Constants.DEFAULT_TENANT_ID,
          action: ServerAction.WS_SERVER_CONNECTION, module: MODULE_NAME, method: 'monitorWSConnections',
          message: `${this.jsonWSConnections.size} WS connections, ${this.jsonRestWSConnections.size} REST connections, ${this.runningWSMessages} Messages, ${Object.keys(this.runningWSRequestsMessages).length} Requests, ${this.waitingWSMessages} queued WS Message(s)`,
          detailedMessages: [
            `${numberOfCurrentRequests} JSON WS Requests cached`,
            `${sizeOfCurrentRequestsBytes / 1000} kB used in JSON WS cache`
          ]
        });
        if (this.isDebug()) {
          Logging.logConsoleDebug('=====================================');
          Logging.logConsoleDebug(`** ${this.jsonWSConnections.size} JSON Connection(s)`);
          Logging.logConsoleDebug(`** ${numberOfCurrentRequests} JSON WS Requests in cache with a size of ${sizeOfCurrentRequestsBytes / 1000} kB`);
          Logging.logConsoleDebug(`** ${this.jsonRestWSConnections.size} REST Connection(s)`);
          Logging.logConsoleDebug(`** ${Object.keys(this.runningWSRequestsMessages).length} running WS Requests`);
          Logging.logConsoleDebug(`** ${this.runningWSMessages} running WS Messages (Requests + Responses)`);
          Logging.logConsoleDebug(`** ${this.waitingWSMessages} queued WS Message(s)`);
          Logging.logConsoleDebug('=====================================');
        }
      } finally {
        // Relaunch it
        this.monitorWebSocketActivities();
      }
    }, Configuration.getChargingStationConfig().monitoringIntervalOCPPJSecs * 1000);
    // }, 24 * 60 * 60 * 1000);
  }

  private monitorAndCleanupWebSockets() {
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    setTimeout(async () => {
      try {
        // Check Json connections
        await this.checkAndCleanupWebSockets(this.jsonWSConnections, 'CS');
        // Check Rest connections
        await this.checkAndCleanupWebSockets(this.jsonRestWSConnections, 'REST');
      } finally {
        // Relaunch it
        this.monitorAndCleanupWebSockets();
      }
    }, Configuration.getChargingStationConfig().pingIntervalOCPPJSecs * 1000);
    // }, 24 * 60 * 60 * 1000);
  }

  private async checkAndCleanupWebSockets(wsConnections: Map<string, WSConnection>, type: 'CS'|'REST') {
    const validConnections: Record<string, any>[] = [], invalidConnections: Record<string, any>[] = [];
    const timeStart = Date.now();
    if (wsConnections.size > 0) {
      const wsConnectionKeys = Array.from(wsConnections.keys());
      for (const wsConnectionKey of wsConnectionKeys) {
        const wsConnection = wsConnections.get(wsConnectionKey);
        if (wsConnection) {
          // Get the WS
          const wsWrapper = wsConnection.getWS();
          // Check WS
          const result = await this.pingWebSocket(wsConnections, wsConnection, wsWrapper);
          if (result.ok) {
            validConnections.push(wsWrapper.toJson());
          } else {
            invalidConnections.push(wsWrapper.toJson());
          }
        }
      }
      if (validConnections.length || invalidConnections.length) {
        const message = `Total of ${wsConnectionKeys.length} ${type} WS connection(s) pinged in ${Utils.computeTimeDurationSecs(timeStart)} secs: ${validConnections.length} valid, ${invalidConnections.length} invalid`;
        this.isDebug() && Logging.logConsoleDebug(message);
        if (invalidConnections.length) {
          await Logging.logError({
            tenantID: Constants.DEFAULT_TENANT_ID,
            module: MODULE_NAME, method: 'checkAndCleanupWebSockets',
            action: ServerAction.WS_SERVER_CONNECTION_PING,
            message, detailedMessages: { invalidConnections, validConnections }
          });
        } else {
          await Logging.logInfo({
            tenantID: Constants.DEFAULT_TENANT_ID,
            module: MODULE_NAME, method: 'checkAndCleanupWebSockets',
            action: ServerAction.WS_SERVER_CONNECTION_PING,
            message, detailedMessages: { invalidConnections, validConnections }
          });
        }
      }
    }
  }

  private async pingWebSocket(wsConnections: Map<string, WSConnection>, wsConnection: WSConnection, wsWrapper: WSWrapper): Promise<WebSocketPingResult> {
    try {
      wsWrapper.ping('Server Web Socket test');
      wsWrapper.nbrPingFailed = 0;
      return {
        ok: true
      };
    } catch (error) {
      wsWrapper.nbrPingFailed++;
      // Close WS
      if (wsWrapper.nbrPingFailed >= Constants.WS_MAX_NBR_OF_FAILED_PINGS) {
        const message = `${WebSocketAction.PING} > ${wsWrapper.nbrPingFailed} ping(s) failed on WS ID '${wsWrapper.guid}', WS removed from WS cache`;
        await Logging.logError({
          ...LoggingHelper.getWSWrapperProperties(wsWrapper),
          tenantID: [Constants.DEFAULT_TENANT_ID, wsWrapper.tenantID],
          action: ServerAction.WS_SERVER_CONNECTION_PING, module: MODULE_NAME, method: 'pingWebSocket',
          message, detailedMessages: { wsWrapper: wsWrapper.toJson(), error: error.stack }
        });
        await this.closeWebSocket(
          WebSocketAction.PING, ServerAction.WS_SERVER_CONNECTION_PING, wsWrapper, WebSocketCloseEventStatusCode.CLOSE_ABNORMAL, message);
        // Remove WS
        wsConnections.delete(wsConnection.getID());
        this.isDebug() && Logging.logConsoleDebug(message);
      // Ping failed
      } else {
        await Logging.logError({
          ...LoggingHelper.getWSWrapperProperties(wsWrapper),
          tenantID: [Constants.DEFAULT_TENANT_ID, wsWrapper.tenantID],
          action: ServerAction.WS_SERVER_CONNECTION_PING, module: MODULE_NAME, method: 'pingWebSocket',
          message: `${WebSocketAction.PING} > Ping failed on WS ID '${wsWrapper.guid}', remaining ${Constants.WS_MAX_NBR_OF_FAILED_PINGS - wsWrapper.nbrPingFailed} trial(s)`,
          detailedMessages: { wsWrapper: wsWrapper.toJson(), error: error.stack }
        });
      }
      return {
        ok: false,
        errorCode: WebSocketCloseEventStatusCode.CLOSE_ABNORMAL,
        errorMessage: error?.message
      };
    }
  }

  private async closeWebSocket(wsAction: WebSocketAction, action: ServerAction, wsWrapper: WSWrapper, code: WebSocketCloseEventStatusCode, message: string): Promise<void> {
    // Close WS
    if (!wsWrapper.closed) {
      try {
        wsWrapper.close(code, message);
        await this.logWSConnectionClosed(wsWrapper, action, code, message);
      } catch (error) {
        // Just log and ignore issue
        await Logging.logError({
          ...LoggingHelper.getWSWrapperProperties(wsWrapper),
          tenantID: [Constants.DEFAULT_TENANT_ID, wsWrapper.tenantID],
          action, module: MODULE_NAME, method: 'closeWebSocket',
          message: `${wsAction} > Failed to close WS ID '${wsWrapper.guid}': ${error.message as string}`,
          detailedMessages: { error: error.stack, wsWrapper: wsWrapper.toJson() }
        });
      }
    }
  }

  private async logWSConnectionClosed(wsWrapper: WSWrapper, action: ServerAction, code: number, message: string): Promise<void> {
    this.isDebug() && Logging.logConsoleDebug(message);
    if (wsWrapper.tenantID) {
      await Logging.logInfo({
        ...LoggingHelper.getWSWrapperProperties(wsWrapper),
        tenantID: [Constants.DEFAULT_TENANT_ID, wsWrapper.tenantID],
        action, module: MODULE_NAME, method: 'logWSConnectionClosed',
        message: message, detailedMessages: { code, message, wsWrapper: wsWrapper.toJson() }
      });
    }
  }

  private isDebug(): boolean {
    return this.centralSystemConfig.debug || Utils.isDevelopmentEnv();
  }
}
