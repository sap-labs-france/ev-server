import * as uWS from 'uWebSockets.js';

import { App, HttpRequest, HttpResponse, WebSocket, us_socket_context_t } from 'uWebSockets.js';
import FeatureToggles, { Feature } from '../../../utils/FeatureToggles';
import { OCPPIncomingRequest, OCPPIncomingResponse } from '../../../types/ocpp/OCPPCommon';
import { ServerAction, ServerType, WSServerProtocol } from '../../../types/Server';
import { WebSocketAction, WebSocketCloseEventStatusCode, WebSocketPingResult } from '../../../types/WebSocket';

import CentralSystemConfiguration from '../../../types/configuration/CentralSystemConfiguration';
import ChargingStation from '../../../types/ChargingStation';
import ChargingStationClient from '../../../client/ocpp/ChargingStationClient';
import ChargingStationConfiguration from '../../../types/configuration/ChargingStationConfiguration';
import ChargingStationStorage from '../../../storage/mongodb/ChargingStationStorage';
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

// import wtfnode from 'wtfnode';

const MODULE_NAME = 'JsonOCPPServer';

export default class JsonOCPPServer extends OCPPServer {
  private runningWSMessages = 0;
  private jsonWSConnections: Map<string, JsonWSConnection> = new Map();
  private jsonRestWSConnections: Map<string, JsonRestWSConnection> = new Map();
  private lastUpdatedChargingStationsLastSeen = new Date();

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
    // Start 15 secs after ping checks
    setTimeout(() => this.massUpdateChargingStationsLastSeen(), 15 * 1000);
  }

  public start(): void {
    // Keep it global
    global.centralSystemJsonServer = this;
    // uWS can send pings automatically before the idleTimeout is reached
    let idleTimeout: number;
    const sendPingsAutomatically = FeatureToggles.isFeatureActive(Feature.WS_SEND_PING_AUTOMATICALLY);
    if (sendPingsAutomatically) {
      idleTimeout = 1 * 60; // 1 minute - Maintains the web socket live - impact visible with the number of pongs!
      // idleTimeout = 5 * 60; // 5 minutes - too long - some chargers are closing their web socket with error code 1006 - no reason!
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
      sendPingsAutomatically, // keeps the connection alive - uWS sends ping automatically before reaching the idleTimeout
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
        this.closePreviousWebSocketConnection(wsConnection);
        if (Utils.isMonitoringEnabled()) {
          wsWrapper.ocppOpenWebSocketMetricCounter.inc();
        }
        await wsConnection.updateChargingStationRuntimeData();
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

  private closePreviousWebSocketConnection(wsConnection: WSConnection) {
    if (wsConnection.getWS().protocol === WSServerProtocol.OCPP16) {
      const existingWSConnection = this.jsonWSConnections.get(wsConnection.getID());
      if (existingWSConnection) {
        // Still opened WS?
        const existingWSWrapper = existingWSConnection.getWS();
        if (!existingWSWrapper.closed) {
          try {
            // Forcefully closes this WebSocket. Immediately calls the close handler.
            existingWSWrapper.closed = true;
            Logging.beDebug()?.log({
              tenantID: existingWSConnection.getTenantID(),
              chargingStationID: existingWSConnection.getChargingStationID(),
              action: ServerAction.WS_SERVER_CONNECTION_CLOSE, module: MODULE_NAME, method: 'closePreviousWebSocketConnection',
              message: `Forcefully close previous WS ID '${existingWSWrapper.guid}'`
            });
            existingWSWrapper.forceClose();
          } catch (error) {
            // Just log and ignore issue
            Logging.beError()?.log({
              tenantID: existingWSConnection.getTenantID(),
              chargingStationID: existingWSConnection.getChargingStationID(),
              action: ServerAction.WS_SERVER_CONNECTION_CLOSE, module: MODULE_NAME, method: 'closePreviousWebSocketConnection',
              message: `Failed to close WS ID '${existingWSWrapper.guid}' - ${error.message as string}`
            });
          }
        }
      }
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
      // Increment counter
      if (wsWrapper.protocol === WSServerProtocol.OCPP16) {
        wsWrapper.ocppClosedWebSocketMetricCounter?.inc();
      }
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
        `${WebSocketAction.CLOSE} > WS ID '${wsWrapper?.guid}' has been closed - code '${code}', reason: '${reason || ''}'`);
    } else {
      Logging.beError()?.log({
        tenantID: Constants.DEFAULT_TENANT_ID,
        action: ServerAction.WS_SERVER_CONNECTION_CLOSE,
        module: MODULE_NAME, method: 'onClose',
        message: `${WebSocketAction.CLOSE} > Unexpected situation - trying to close an unknown connection`,
        detailedMessages: { code, reason }
      });
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
    // Keep last date
    wsWrapper.lastMessageDate = new Date();
    // Process Message
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
    const tenantID = wsWrapper?.wsConnection?.getTenantID();
    if (tenantID) {
      Logging.beInfo()?.log({
        tenantID,
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
    // Do it once at startup
    Utils.sleep(2000).then(() => {
      this._monitorWSConnections();
    }).catch(() => { /* Intentional */ });
    // Then do it again from time to time
    setInterval(() => {
      this._monitorWSConnections();
    }, Configuration.getChargingStationConfig().monitoringIntervalOCPPJSecs * 1000);
  }

  private _monitorWSConnections() {
    try {
      // Log size of WS Json Connections (track leak)
      let sizeOfPendingCommands = 0, numberOfPendingCommands = 0;
      for (const jsonWSConnection of Array.from(this.jsonWSConnections.values())) {
        const pendingCommands = jsonWSConnection.getPendingOccpCommands();
        sizeOfPendingCommands += sizeof(pendingCommands);
        numberOfPendingCommands += Object.keys(pendingCommands).length;
      }
      // Log Stats on number of WS Connections
      Logging.beDebug()?.log({
        tenantID: Constants.DEFAULT_TENANT_ID,
        action: ServerAction.WS_SERVER_CONNECTION, module: MODULE_NAME, method: 'monitorWSConnections',
        message: `${this.jsonWSConnections.size} WS connections, ${this.jsonRestWSConnections.size} REST connections, ${this.runningWSMessages} Messages, ${numberOfPendingCommands} pending OCPP commands`,
        detailedMessages: [
          `${numberOfPendingCommands} pending OCPP commands - ${sizeOfPendingCommands / 1000} kB`
        ]
      });
      if (Utils.isMonitoringEnabled()) {
        global.monitoringServer.getGauge(Constants.WEB_SOCKET_RUNNING_REQUEST).set(this.runningWSMessages);
        global.monitoringServer.getGauge(Constants.WEB_SOCKET_OCPP_CONNECTIONS_COUNT).set(this.jsonWSConnections.size);
        global.monitoringServer.getGauge(Constants.WEB_SOCKET_REST_CONNECTIONS_COUNT).set(this.jsonRestWSConnections.size);
        global.monitoringServer.getGauge(Constants.WEB_SOCKET_CURRENT_REQUEST).set(numberOfPendingCommands);
        // global.monitoringServer.getGauge(Constants.WEB_SOCKET_RUNNING_REQUEST).set(Object.keys(this.runningWSRequestsMessages).length);
        // global.monitoringServer.getGauge(Constants.WEB_SOCKET_QUEUED_REQUEST).set(this.waitingWSMessages);
      }
      if (this.isDebug()) {
        Logging.logConsoleDebug('=====================================');
        Logging.logConsoleDebug(`** ${this.jsonWSConnections.size} JSON Connection(s)`);
        Logging.logConsoleDebug(`** ${numberOfPendingCommands} pending OCPP commands - Size: ${sizeOfPendingCommands / 1000} kB`);
        Logging.logConsoleDebug(`** ${this.jsonRestWSConnections.size} REST Connection(s)`);
        Logging.logConsoleDebug(`** ${this.runningWSMessages} running WS Messages (Requests + Responses)`);
        Logging.logConsoleDebug('=====================================');
      }
    } catch (error) {
      /* Intentional */
    }
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

  private massUpdateChargingStationsLastSeen() {
    setInterval(() => {
      this._massUpdateChargingStationsLastSeen().catch((error) => {
        Logging.logPromiseError(error);
      });
    }, (Configuration.getChargingStationConfig().pingIntervalOCPPJSecs / 3) * 1000);
  }

  private async _massUpdateChargingStationsLastSeen() {
    const lastUpdatedChargingStationsLastSeen = new Date();
    const lastSeenChargingStationsMap = new Map<string, {tenant: Tenant; chargingStationIDs: string[]; lastSeenDate: Date;}>();
    let numberOfUpdatedChargingStations = 0;
    try {
      for (const jsonWSConnection of this.jsonWSConnections.values()) {
        const wsWrapper = jsonWSConnection.getWS();
        let lastSeenDate: Date;
        // Check Ping date
        if (wsWrapper.lastPingDate) {
          lastSeenDate = wsWrapper.lastPingDate;
        }
        // Check Pong date
        if ((!lastSeenDate && wsWrapper.lastPongDate) ||
              (lastSeenDate && wsWrapper.lastPongDate && lastSeenDate.getTime() < wsWrapper.lastPongDate.getTime())) {
          lastSeenDate = wsWrapper.lastPongDate;
        }
        // Check Last Message date
        if ((!lastSeenDate && wsWrapper.lastMessageDate) ||
              (lastSeenDate && wsWrapper.lastMessageDate && lastSeenDate.getTime() < wsWrapper.lastMessageDate.getTime())) {
          lastSeenDate = wsWrapper.lastMessageDate;
        }
        // Process lastSeen?
        if (lastSeenDate && lastSeenDate.getTime() > this.lastUpdatedChargingStationsLastSeen.getTime()) {
          // Round last seen for mass update
          lastSeenDate.setMilliseconds(0);
          lastSeenDate.setSeconds(lastSeenDate.getSeconds() - (lastSeenDate.getSeconds() % 10)); // Round seconds down
          // Keep them for later mass update
          const lastSeenChargingStationsKey = `${wsWrapper.wsConnection.getTenantID()}-${lastSeenDate.getTime()}`;
          const lastSeenChargingStation = lastSeenChargingStationsMap.get(lastSeenChargingStationsKey);
          if (!lastSeenChargingStation) {
            // Create the entry and add Charging Station to update
            lastSeenChargingStationsMap.set(lastSeenChargingStationsKey, {
              tenant: jsonWSConnection.getTenant(),
              lastSeenDate: lastSeenDate,
              chargingStationIDs: [wsWrapper.wsConnection.getChargingStationID()],
            });
          } else {
            // Add Charging Station to update
            lastSeenChargingStation.chargingStationIDs.push(
              wsWrapper.wsConnection.getChargingStationID());
          }
        }
      }
      // Process mass update lastSeen field
      for (const lastSeenChargingStation of lastSeenChargingStationsMap.values()) {
        await ChargingStationStorage.saveChargingStationsLastSeen(
          lastSeenChargingStation.tenant,
          lastSeenChargingStation.chargingStationIDs,
          lastSeenChargingStation.lastSeenDate
        );
        numberOfUpdatedChargingStations += lastSeenChargingStation.chargingStationIDs.length;
      }
      // Next round
      this.lastUpdatedChargingStationsLastSeen = lastUpdatedChargingStationsLastSeen;
      Logging.beInfo()?.log({
        tenantID: Constants.DEFAULT_TENANT_ID,
        action: ServerAction.WS_SERVER_CONNECTION_LAST_SEEN,
        module: MODULE_NAME, method: 'massUpdateChargingStationsLastSeen',
        message: `${numberOfUpdatedChargingStations} Charging Stations have been updated successfully (${lastSeenChargingStationsMap.size} grouped updates)`,
        detailedMessages: { lastSeenChargingStations: Array.from(lastSeenChargingStationsMap.values())
          .map((lastSeenChargingStation) =>
            ({
              tenant: {
                id: lastSeenChargingStation.tenant.id,
                subdomain: lastSeenChargingStation.tenant.subdomain,
              },
              lastSeen: lastSeenChargingStation.lastSeenDate.toISOString(),
              chargingStationIDs: lastSeenChargingStation.chargingStationIDs,
            })
          )
        }
      });
    } catch (error) {
      Logging.beError()?.log({
        tenantID: Constants.DEFAULT_TENANT_ID,
        action: ServerAction.WS_SERVER_CONNECTION_LAST_SEEN,
        module: MODULE_NAME, method: 'massUpdateChargingStationsLastSeen',
        message: 'Failed to update Charging Station\'s Last Seen',
        detailedMessages: { error: error.stack }
      });
    }
  }

}
