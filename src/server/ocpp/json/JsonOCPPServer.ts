import * as uWS from 'uWebSockets.js';

import { App, HttpRequest, HttpResponse, WebSocket, us_socket_context_t } from 'uWebSockets.js';
import FeatureToggles, { Feature } from '../../../utils/FeatureToggles';
import { OCPPIncomingRequest, OCPPIncomingResponse, OCPPMessageType } from '../../../types/ocpp/OCPPCommon';
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
    if (FeatureToggles.isFeatureActive(Feature.WS_SEND_PING_AUTOMATICALLY)) {
      // Nothing to do - the uWS layer takes care to ping the WS for us!
    } else {
      // Start job to ping and clean WS connections (if necessary)
      this.checkAndCleanupAllWebSockets();
    }
    // Monitor WS activity
    this.monitorWSConnections();
    // Monitor Memory Usage
    if (FeatureToggles.isFeatureActive(Feature.OCPP_MONITOR_MEMORY_USAGE)) {
      this.monitorMemoryUsage();
    }
  }

  public start(): void {
    // Keep it global
    global.centralSystemJsonServer = this;
    // uWS can send pings automatically before the idleTimeout is reached
    let idleTimeout: number;
    const sendPingsAutomatically = FeatureToggles.isFeatureActive(Feature.WS_SEND_PING_AUTOMATICALLY);
    if (sendPingsAutomatically) {
      idleTimeout = 1 * 60; // closed if inactive
    } else {
      // idleTimeout = 3600; // 1 hour of inactivity ==> close
      idleTimeout = 0; // Never close Web Sockets
    }
    // Start the WS server
    Logging.logConsoleDebug(`Starting ${ServerType.JSON_SERVER} Server...`);
    App({}).ws('/*', {
      compression: uWS.SHARED_COMPRESSOR,
      maxPayloadLength: 64 * 1024, // 64 KB per request
      idleTimeout,
      sendPingsAutomatically,
      upgrade: (res: HttpResponse, req: HttpRequest, context: us_socket_context_t) => {
        // Delegate
        this.onUpgrade(res, req, context);
      },
      open: (ws: WebSocket) => {
        // Delegate
        this.onOpen(ws);
      },
      drain: (ws: WebSocket) => {
        this.onDrain(ws);
      },
      message: (ws: WebSocket, message: ArrayBuffer, isBinary: boolean) => {
        // Delegate
        const messageStr = Utils.convertBufferArrayToString(message);
        this.onMessage(ws, messageStr, isBinary).catch(() => { /* Intentional */ });
      },
      close: (ws: WebSocket, code: number, message: ArrayBuffer) => {
        const reason = Utils.convertBufferArrayToString(message);
        this.onClose(ws, code, reason);
      },
      ping: (ws: WebSocket, message: ArrayBuffer) => {
        // Convert right away (sometimes not working in the method)
        const ocppMessage = Utils.convertBufferArrayToString(message);
        this.onPing(ws, ocppMessage);
      },
      pong: (ws: WebSocket, message: ArrayBuffer) => {
        // Convert right away (sometimes not working in the method)
        const ocppMessage = Utils.convertBufferArrayToString(message);
        this.onPong(ws, ocppMessage);
      }
    }).any(Constants.HEALTH_CHECK_ROUTE, (res: HttpResponse) => {
      res.onAborted(() => {
        res.aborted = true;
      });
      if (FeatureToggles.isFeatureActive(Feature.HEALTH_CHECK_PING_DATABASE)) {
        global.database.ping().then((pingSuccess) => {
          if (!res.aborted) {
            if (pingSuccess) {
              res.end('OK');
            } else {
              res.writeStatus('500');
              res.end('KO');
            }
          }
        }).catch(() => { /* Intentional */ });
      } else {
        // TODO - FIND ANOTHER METRIC TO CHECK THE READINESS and LIVENESS PROBE
        res.end('OK');
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

  public getChargingStationClient(tenant: Tenant, chargingStation: ChargingStation): ChargingStationClient {
    // Get the Json Web Socket
    const jsonWebSocket = this.jsonWSConnections.get(`${tenant.id}~${chargingStation.id}`);
    if (!jsonWebSocket) {
      const message = 'No opened Web Socket connection found';
      Logging.beError()?.log({
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        tenantID: tenant.id,
        module: MODULE_NAME, method: 'getChargingStationClient',
        action: ServerAction.WS_SERVER_CONNECTION, message
      });
      Logging.beError()?.log({
        tenantID: Constants.DEFAULT_TENANT_ID,
        chargingStationID: chargingStation.id,
        module: MODULE_NAME, method: 'getChargingStationClient',
        action: ServerAction.WS_SERVER_CONNECTION, message
      });
      return;
    }
    // Return the client
    return jsonWebSocket.getChargingStationClient();
  }

  public hasChargingStationConnected(tenant: Tenant, chargingStation: ChargingStation): boolean {
    return this.jsonWSConnections.has(`${tenant.id}~${chargingStation.id}`);
  }

  private onUpgrade(res: uWS.HttpResponse, req: uWS.HttpRequest, context: uWS.us_socket_context_t) {
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
        Logging.beError()?.log({
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
        Logging.beError()?.log({
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
        Logging.beError()?.log({
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
      this.createAndKeepJsonConnection(wsWrapper).then(() => {
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
      }).catch((error) => {
        // Wrapper creation failed
        const message = `${WebSocketAction.UPGRADE} > New WS Connection with URL '${url}' failed with error: ${error.message as string}`;
        res.writeStatus('500');
        res.end(message);
        this.isDebug() && Logging.logConsoleDebug(message);
        Logging.beError()?.log({
          tenantID: Constants.DEFAULT_TENANT_ID,
          action: ServerAction.WS_SERVER_CONNECTION,
          module: MODULE_NAME, method: 'onUpgrade',
          message, detailedMessages: { error: error.stack }
        });
      });
    } catch (error) {
      const message = `${WebSocketAction.UPGRADE} > New WS Connection with URL '${url}' failed with error: ${error.message as string}`;
      res.writeStatus('500');
      res.end(message);
      this.isDebug() && Logging.logConsoleDebug(message);
      Logging.beError()?.log({
        tenantID: Constants.DEFAULT_TENANT_ID,
        action: ServerAction.WS_SERVER_CONNECTION,
        module: MODULE_NAME, method: 'onUpgrade',
        message, detailedMessages: { error: error.stack }
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
      Logging.beDebug()?.log({
        tenantID: wsConnection.getTenantID(),
        ...LoggingHelper.getWSConnectionProperties(wsConnection),
        action: ServerAction.WS_SERVER_CONNECTION_OPEN, module: MODULE_NAME, method: 'createAndKeepJsonConnection',
        message: `${WebSocketAction.OPEN} > WS Connection ID '${wsWrapper.guid}'  is being checked ('${wsWrapper.url}')`,
        detailedMessages: {
          wsWrapper: wsWrapper.toJson()
        }
      });
      // Initialize (check of Tenant, Token, Charging Station -> Can take time)
      await wsConnection.initialize();
      // Keep common data (Set here to get Tenant info in case of exception in Logs)
      wsWrapper.setConnection(wsConnection);
      // Keep WS connection in cache
      if (wsWrapper.protocol === WSServerProtocol.OCPP16) {
        this.jsonWSConnections.set(wsConnection.getID(), wsConnection as JsonWSConnection);
      } else if (wsWrapper.protocol === WSServerProtocol.REST) {
        this.jsonRestWSConnections.set(wsConnection.getID(), wsConnection as JsonRestWSConnection);
      }
      Logging.beInfo()?.log({
        ...LoggingHelper.getWSWrapperProperties(wsWrapper),
        tenantID: wsWrapper.wsConnection?.getTenantID(),
        action: ServerAction.WS_SERVER_CONNECTION_OPEN, module: MODULE_NAME, method: 'createAndKeepJsonConnection',
        message: `${WebSocketAction.OPEN} > WS ID '${wsWrapper.guid}' is valid (processed in ${Utils.computeTimeDurationSecs(timeStart)} secs)`,
        detailedMessages: { wsWrapper: wsWrapper.toJson() }
      });
    } catch (error) {
      wsWrapper.isValid = false;
      Logging.beError()?.log({
        ...LoggingHelper.getWSWrapperProperties(wsWrapper),
        tenantID: wsWrapper.wsConnection?.getTenantID(),
        action: ServerAction.WS_SERVER_CONNECTION_OPEN, module: MODULE_NAME, method: 'createAndKeepJsonConnection',
        message: `${WebSocketAction.OPEN} > WS ID '${wsWrapper.guid}' is invalid (processed in ${Utils.computeTimeDurationSecs(timeStart)} secs)`,
        detailedMessages: { wsWrapper: wsWrapper.toJson() }
      });
    }
  }

  private onOpen(ws: uWS.WebSocket) {
    // Init WS
    this.resolveAndGetWSWrapper(ws);
  }

  private onDrain(ws: WebSocket) {
    // Do not try to resolve the WSWrapper
    const wsWrapper = ws['wsWrapper'] as WSWrapper ?? new WSWrapper(ws['url'] as string);
    // Just log draining
    Logging.beWarning()?.log({
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

  private onClose(ws: WebSocket, code: number, reason: string): void {
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
      this.logWSConnectionClosed(wsWrapper, ServerAction.WS_SERVER_CONNECTION_CLOSE, code,
        `${WebSocketAction.CLOSE} > WS ID '${wsWrapper?.guid}' closed by charging station with code '${code}', reason: '${!Utils.isNullOrEmptyString(reason) ? reason : '-'}'`);
    } else {
      const message = `${WebSocketAction.CLOSE} > WS ID 'N/A' closed by charging station with code '${code}', reason: '${!Utils.isNullOrEmptyString(reason) ? reason : '-'}'`;
      Logging.beInfo()?.log({
        tenantID: Constants.DEFAULT_TENANT_ID,
        action: ServerAction.WS_SERVER_CONNECTION_CLOSE,
        module: MODULE_NAME, method: 'onClose',
        message, detailedMessages: { code, reason }
      });
      this.isDebug() && Logging.logConsoleDebug(message);
    }
  }

  private onPing(ws: WebSocket, ocppMessage: string): void {
    const wsWrapper = this.resolveAndGetWSWrapper(ws);
    if (wsWrapper) {
      wsWrapper.lastPingDate = new Date();
      // Get the WS
      if (wsWrapper.wsConnection) {
        wsWrapper.wsConnection.onPing(ocppMessage);
      }
    }
  }

  private onPong(ws: WebSocket, ocppMessage: string): void {
    const wsWrapper = this.resolveAndGetWSWrapper(ws);
    if (wsWrapper) {
      wsWrapper.lastPongDate = new Date();
      // Get the WS
      if (wsWrapper.wsConnection) {
        wsWrapper.wsConnection.onPong(ocppMessage);
      }
    }
  }

  private async onMessage(ws: uWS.WebSocket, message: string, isBinary: boolean): Promise<void> {
    const wsWrapper = this.resolveAndGetWSWrapper(ws);
    if (!wsWrapper) {
      Logging.beError()?.log({
        action: ServerAction.WS_SERVER_MESSAGE,
        module: MODULE_NAME, method: 'onMessage',
        message: `${WebSocketAction.MESSAGE} > WS Connection not found ('${ws['url'] as string}')`,
        detailedMessages: { message, isBinary }
      });
      ws.end(WebSocketCloseEventStatusCode.CLOSE_ABNORMAL, 'Connection rejected by the backend: No WS Wrapper found');
      return;
    }
    if (!wsWrapper.isValid) {
      Logging.beError()?.log({
        ...LoggingHelper.getWSWrapperProperties(wsWrapper),
        action: ServerAction.WS_SERVER_MESSAGE,
        module: MODULE_NAME, method: 'onMessage',
        message: `${WebSocketAction.MESSAGE} > WS Connection ID '${wsWrapper.guid}' is invalid ('${wsWrapper.url}')`,
        detailedMessages: { message, isBinary, wsWrapper: wsWrapper.toJson() }
      });
      wsWrapper.close(WebSocketCloseEventStatusCode.CLOSE_ABNORMAL, 'Connection rejected by the backend');
      return;
    }
    try {
      // Extract the OCPP Message Type
      const ocppMessage: OCPPIncomingRequest|OCPPIncomingResponse = JSON.parse(message);
      try {
        this.runningWSMessages++;
        // OCPP Request?
        if (wsWrapper.wsConnection) {
          await wsWrapper.wsConnection.handleIncomingOcppMessage(wsWrapper, ocppMessage);
        } else {
          Logging.beError()?.log({
            ...LoggingHelper.getWSWrapperProperties(wsWrapper),
            action: ServerAction.WS_SERVER_MESSAGE,
            module: MODULE_NAME, method: 'onMessage',
            message: 'Unexpected situation - message is received but wsConnection is not set',
            detailedMessages: { message, isBinary, wsWrapper: this.getWSWrapperData(wsWrapper) }
          });
        }
      } finally {
        this.runningWSMessages--;
      }
    } catch (error) {
      const logMessage = `${WebSocketAction.MESSAGE} > WS Connection ID '${wsWrapper.guid}' got error while processing WS Message: ${error.message as string}`;
      if (wsWrapper?.wsConnection?.getTenantID()) {
        Logging.beError()?.log({
          ...LoggingHelper.getWSWrapperProperties(wsWrapper),
          action: ServerAction.WS_SERVER_MESSAGE,
          module: MODULE_NAME, method: 'onMessage',
          message: logMessage,
          detailedMessages: { message, isBinary, wsWrapper: this.getWSWrapperData(wsWrapper), error: error.stack }
        });
      }
      Logging.beError()?.log({
        tenantID: Constants.DEFAULT_TENANT_ID,
        ...LoggingHelper.getWSWrapperProperties(wsWrapper),
        action: ServerAction.WS_SERVER_MESSAGE,
        module: MODULE_NAME, method: 'onMessage',
        message: logMessage + ` - tenant: ${wsWrapper?.wsConnection?.getTenantID()}`,
        detailedMessages: { message, isBinary, wsWrapper: this.getWSWrapperData(wsWrapper), error: error.stack }
      });
    }
  }

  private logWSConnectionClosed(wsWrapper: WSWrapper, action: ServerAction, code: number, message: string): void {
    this.isDebug() && Logging.logConsoleDebug(message);
    if (wsWrapper?.wsConnection?.getTenantID()) {
      Logging.beInfo()?.log({
        ...LoggingHelper.getWSWrapperProperties(wsWrapper),
        action, module: MODULE_NAME, method: 'logWSConnectionClosed',
        message: message, detailedMessages: { code, message, wsWrapper: this.getWSWrapperData(wsWrapper) }
      });
    }
    Logging.beInfo()?.log({
      tenantID: Constants.DEFAULT_TENANT_ID,
      ...LoggingHelper.getWSWrapperProperties(wsWrapper),
      action, module: MODULE_NAME, method: 'logWSConnectionClosed',
      message: message, detailedMessages: { code, message, wsWrapper: this.getWSWrapperData(wsWrapper) }
    });
  }

  private async waitForWSLockToRelease(wsAction: WebSocketAction, action: ServerAction, wsWrapper: WSWrapper): Promise<boolean> {
    // Wait for init to handle multiple same WS Connection
    if (this.runningWSRequestsMessages[wsWrapper.url]) {
      const maxNumberOfTrials = 10;
      let numberOfTrials = 0;
      const timeStart = Date.now();
      Logging.beWarning()?.log({
        tenantID: Constants.DEFAULT_TENANT_ID,
        ...LoggingHelper.getWSWrapperProperties(wsWrapper),
        action, module: MODULE_NAME, method: 'waitForWSLockToRelease',
        message: `${wsAction} > WS Connection ID '${wsWrapper.guid}' - Lock is taken: Wait and try to acquire the lock after ${Constants.WS_LOCK_TIME_OUT_MILLIS} ms...`,
        detailedMessages: { wsWrapper: this.getWSWrapperData(wsWrapper) }
      });
      this.waitingWSMessages++;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        // Wait
        await Utils.sleep(Constants.WS_LOCK_TIME_OUT_MILLIS);
        numberOfTrials++;
        // Message has been processed
        if (!this.runningWSRequestsMessages[wsWrapper.url]) {
          Logging.beInfo()?.log({
            tenantID: Constants.DEFAULT_TENANT_ID,
            ...LoggingHelper.getWSWrapperProperties(wsWrapper),
            action, module: MODULE_NAME, method: 'waitForWSLockToRelease',
            message: `${wsAction} > WS Connection ID '${wsWrapper.guid}' - Lock has been acquired successfully after ${numberOfTrials} trial(s) and ${Utils.computeTimeDurationSecs(timeStart)} secs`,
            detailedMessages: { wsWrapper: this.getWSWrapperData(wsWrapper) }
          });
          // Free the lock
          this.waitingWSMessages--;
          break;
        }
        // Handle remaining trial
        if (numberOfTrials >= maxNumberOfTrials) {
          // Abnormal situation: The lock should not be taken for so long!
          Logging.beError()?.log({
            tenantID: Constants.DEFAULT_TENANT_ID,
            ...LoggingHelper.getWSWrapperProperties(wsWrapper),
            action, module: MODULE_NAME, method: 'waitForWSLockToRelease',
            message: `${wsAction} > WS Connection ID '${wsWrapper.guid}' - Cannot acquire the lock after ${numberOfTrials} trial(s) and ${Utils.computeTimeDurationSecs(timeStart)} secs - Lock will be forced to be released`,
            detailedMessages: { wsWrapper: this.getWSWrapperData(wsWrapper) }
          });
          // Free the lock
          this.waitingWSMessages--;
          break;
        }
      }
    }
    return true;
  }

  private pingWebSocket(wsWrapper: WSWrapper): WebSocketPingResult {
    try {
      // Ping the WS
      wsWrapper.ping('OCPPJ Ping');
      // Reset
      wsWrapper.nbrPingFailed = 0;
      return {
        ok: true
      };
    } catch (error) {
      wsWrapper.nbrPingFailed++;
      // Close WS
      if (wsWrapper.nbrPingFailed >= Constants.WS_MAX_NBR_OF_FAILED_PINGS) {
        Logging.beError()?.log({
          tenantID: Constants.DEFAULT_TENANT_ID,
          ...LoggingHelper.getWSWrapperProperties(wsWrapper),
          action: ServerAction.WS_SERVER_CONNECTION_PING, module: MODULE_NAME, method: 'pingWebSocket',
          message: `${WebSocketAction.PING} > Failed to ping the WS Connection ID '${wsWrapper.guid}' after ${wsWrapper.nbrPingFailed} trial(s), will be removed from WS cache`,
          detailedMessages: { wsWrapper: this.getWSWrapperData(wsWrapper), error: error.stack }
        });
        this.closeWebSocket(WebSocketAction.PING, ServerAction.WS_SERVER_CONNECTION_PING, wsWrapper,
          WebSocketCloseEventStatusCode.CLOSE_ABNORMAL, `${WebSocketAction.PING} > WS Connection ID '${wsWrapper.guid}' has been closed by server after ${wsWrapper.nbrPingFailed} failed ping`);
      } else {
        Logging.beWarning()?.log({
          tenantID: Constants.DEFAULT_TENANT_ID,
          ...LoggingHelper.getWSWrapperProperties(wsWrapper),
          action: ServerAction.WS_SERVER_CONNECTION_PING, module: MODULE_NAME, method: 'pingWebSocket',
          message: `${WebSocketAction.PING} > Failed to ping the WS Connection ID '${wsWrapper.guid}' after ${wsWrapper.nbrPingFailed} trial(s) (${Constants.WS_MAX_NBR_OF_FAILED_PINGS - wsWrapper.nbrPingFailed} remaining)`,
          detailedMessages: { wsWrapper: this.getWSWrapperData(wsWrapper), error: error.stack }
        });
      }
      return {
        ok: false,
        errorCode: WebSocketCloseEventStatusCode.CLOSE_ABNORMAL,
        errorMessage: error?.message
      };
    }
  }

  private closeWebSocket(wsAction: WebSocketAction, action: ServerAction, wsWrapper: WSWrapper, code: WebSocketCloseEventStatusCode, message: string): void {
    // Close WS
    if (!wsWrapper.closed) {
      try {
        wsWrapper.close(code, message);
        this.logWSConnectionClosed(wsWrapper, action, code, message);
      } catch (error) {
        // Just log and ignore issue
        Logging.beError()?.log({
          tenantID: Constants.DEFAULT_TENANT_ID,
          ...LoggingHelper.getWSWrapperProperties(wsWrapper),
          action, module: MODULE_NAME, method: 'closeWebSocket',
          message: `${wsAction} > Failed to close WS Connection ID '${wsWrapper.guid}': ${error.message as string}`,
          detailedMessages: { error: error.stack, wsWrapper: this.getWSWrapperData(wsWrapper) }
        });
      }
    }
    // Remove connection
    this.removeWSWrapper(wsAction, action, wsWrapper);
  }

  private removeWSWrapper(wsAction: WebSocketAction, action: ServerAction, wsWrapper: WSWrapper): void {
    if (wsWrapper.protocol === WSServerProtocol.OCPP16) {
      this.removeWSConnection(
        wsAction, action, wsWrapper.wsConnection, this.jsonWSConnections);
    } else if (wsWrapper.protocol === WSServerProtocol.REST) {
      this.removeWSConnection(
        wsAction, action, wsWrapper.wsConnection, this.jsonRestWSConnections);
    }
  }

  private removeWSConnection(wsAction: WebSocketAction, action: ServerAction, wsConnection: WSConnection, wsConnections: Map<string, WSConnection>): void {
    if (wsConnection) {
      const wsWrapper = wsConnection.getWS();
      const existingWsConnection = wsConnections.get(wsConnection.getID());
      if (existingWsConnection) {
        const existingWsWrapper = existingWsConnection.getWS();
        // Check id same WS Connection
        if (existingWsWrapper.guid === wsWrapper.guid) {
          // Remove from WS Cache
          wsConnections.delete(wsConnection.getID());
          Logging.beDebug()?.log({
            tenantID: Constants.DEFAULT_TENANT_ID,
            ...LoggingHelper.getWSWrapperProperties(wsWrapper),
            action, module: MODULE_NAME, method: 'setWSConnection',
            message: `${wsAction} > WS Connection ID '${wsWrapper.guid}' has been removed from the WS cache`,
            detailedMessages: { wsWrapper: this.getWSWrapperData(wsWrapper) }
          });
        } else {
          // WS Connection not identical
          Logging.beWarning()?.log({
            tenantID: Constants.DEFAULT_TENANT_ID,
            ...LoggingHelper.getWSWrapperProperties(wsWrapper),
            action, module: MODULE_NAME, method: 'removeWSConnection',
            message: `${wsAction} > Failed to remove WS Connection ID '${wsWrapper.guid}' from WS cache due to an already existing WS with different ID '${existingWsWrapper.guid}'`,
            detailedMessages: { wsWrapper: this.getWSWrapperData(wsWrapper), existingWsWrapper: this.getWSWrapperData(existingWsWrapper) }
          });
        }
      } else {
        // WS Connection not found
        Logging.beWarning()?.log({
          tenantID: Constants.DEFAULT_TENANT_ID,
          ...LoggingHelper.getWSWrapperProperties(wsWrapper),
          action, module: MODULE_NAME, method: 'removeWSConnection',
          message: `${wsAction} > Failed to remove WS Connection ID '${wsWrapper.guid}' from WS cache as it does not exist anymore in it`,
          detailedMessages: { wsWrapper: this.getWSWrapperData(wsWrapper) }
        });
      }
    }
  }

  private isDebug(): boolean {
    return this.centralSystemConfig.debug || Utils.isDevelopmentEnv();
  }

  private monitorWSConnections() {
    setInterval(() => {
      try {
        // Log size of WS Json Connections (track leak)
        let sizeOfCurrentRequestsBytes = 0, numberOfCurrentRequests = 0;
        for (const jsonWSConnection of Array.from(this.jsonWSConnections.values())) {
          const pendingCommands = jsonWSConnection.getPendingOccpCommands();
          sizeOfCurrentRequestsBytes += sizeof(pendingCommands);
          numberOfCurrentRequests += Object.keys(pendingCommands).length;
        }
        // Log Stats on number of WS Connections
        Logging.beDebug()?.log({
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
      } catch (error) {
        /* Intentional */
      }
    }, Configuration.getChargingStationConfig().monitoringIntervalOCPPJSecs * 1000);
  }

  private monitorMemoryUsage() {
    setInterval(() => {
      try {
        // get Node memory usage
        const beginDate = new Date().getTime();
        const memoryUsage = process.memoryUsage();
        const elapsedTime = new Date().getTime() - beginDate;
        const memoryUsagePercentage = ((memoryUsage.heapUsed / memoryUsage.rss) * 100);
        const usagePercentage = memoryUsagePercentage.toFixed(2);
        const heapTotal = (memoryUsage.heapTotal / 1024 / 1024).toFixed(2);
        const heapUsed = (memoryUsage.heapUsed / 1024 / 1024).toFixed(2);
        const external = (memoryUsage.external / 1024 / 1024).toFixed(2);
        const rss = (memoryUsage.rss / 1024 / 1024).toFixed(2); // total amount of memory allocated to the process - to be clarified!
        const message = `Memory Usage ${usagePercentage}% - total heap: ${heapTotal} MiB - heap used: ${heapUsed} MiB - rss: ${rss} MiB - external: ${external} MiB - elapsed time: ${elapsedTime}`;
        const dataToLog = {
          tenantID: Constants.DEFAULT_TENANT_ID,
          action: ServerAction.PERFORMANCES, module: MODULE_NAME, method: 'monitorMemoryUsage',
          message
        };
        // TODO - remove it - JUST FOR TROUBLESHOOTING STRESS TESTS
        Logging.beError()?.log(dataToLog);
        // if (memoryUsagePercentage > 90) {
        //   Logging.beError()?.log(dataToLog);
        // } else if (memoryUsagePercentage > 80) {
        //   Logging.beWarning()?.log(dataToLog);
        // } else {
        //   Logging.beDebug()?.log(dataToLog);
        // }
        if (this.isDebug()) {
          Logging.logConsoleDebug(message);
        }
      } catch (error) {
        /* Intentional */
      }
    }, 5 * 60 * 1000); // every minute - TODO - add new configuration for it!
  }

  private checkAndCleanupAllWebSockets() {
    setInterval(() => {
      try {
        // Check Json connections
        this.checkAndCleanupWebSockets(this.jsonWSConnections, 'CS');
        // Check Rest connections
        this.checkAndCleanupWebSockets(this.jsonRestWSConnections, 'REST');
      } catch (error) {
        /* Intentional */
      }
    }, Configuration.getChargingStationConfig().pingIntervalOCPPJSecs * 1000);
  }

  private checkAndCleanupWebSockets(wsConnections: Map<string, WSConnection>, type: 'CS'|'REST'): void {
    const validConnections: Record<string, any>[] = [], invalidConnections: Record<string, any>[] = [];
    const timeStart = Date.now();
    const wsConnectionKeys = Array.from(wsConnections.keys());
    if (!Utils.isEmptyArray(wsConnectionKeys)) {
      for (const wsConnectionKey of wsConnectionKeys) {
        const wsConnection = wsConnections.get(wsConnectionKey);
        if (wsConnection) {
          // Get the WS
          const wsWrapper = wsConnection.getWS();
          // Check WS
          const result = this.pingWebSocket(wsWrapper);
          if (result.ok) {
            validConnections.push(this.getWSWrapperData(wsWrapper));
          } else {
            invalidConnections.push(this.getWSWrapperData(wsWrapper));
          }
        }
      }
      if (validConnections.length || invalidConnections.length) {
        const message = `Total of ${wsConnectionKeys.length} ${type} WS connection(s) pinged in ${Utils.computeTimeDurationSecs(timeStart)} secs: ${validConnections.length} valid,  ${invalidConnections.length} invalid`;
        this.isDebug() && Logging.logConsoleDebug(message);
        if (invalidConnections.length) {
          Logging.beError()?.log({
            tenantID: Constants.DEFAULT_TENANT_ID,
            module: MODULE_NAME, method: 'checkAndCleanupWebSockets',
            action: ServerAction.WS_SERVER_CONNECTION_PING,
            message, /* detailedMessages: { invalidConnections, validConnections } */
          });
        } else {
          Logging.beInfo()?.log({
            tenantID: Constants.DEFAULT_TENANT_ID,
            module: MODULE_NAME, method: 'checkAndCleanupWebSockets',
            action: ServerAction.WS_SERVER_CONNECTION_PING,
            message, /* detailedMessages: { invalidConnections, validConnections } */
          });
        }
      }
    }
  }

  private getWSWrapperData(wsWrapper: WSWrapper): Record<string, any> {
    return {
      tenantID: wsWrapper.wsConnection?.getTenantID(),
      key: wsWrapper.wsConnection?.getID(),
      guid: wsWrapper.guid,
      nbrPingFailed: wsWrapper.nbrPingFailed,
      tokenID: wsWrapper.tokenID,
      ...LoggingHelper.getWSConnectionProperties(wsWrapper.wsConnection),
      url: wsWrapper.url,
      clientIP: wsWrapper.clientIP,
      closed: wsWrapper.closed,
      protocol: wsWrapper.protocol,
      remoteAddress: wsWrapper.remoteAddress,
      firstConnectionDate: wsWrapper.firstConnectionDate,
      durationSecs: Utils.computeTimeDurationSecs(new Date(wsWrapper.firstConnectionDate).getTime()),
      lastPingDate: wsWrapper.lastPingDate,
      lastPongDate: wsWrapper.lastPongDate,
    };
  }
}
