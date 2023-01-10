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
    // Start job to clean WS connections
    this.checkAndCleanupAllWebSockets();
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
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      upgrade: async (res: HttpResponse, req: HttpRequest, context: us_socket_context_t) => {
        // Delegate
        await this.onUpgrade(res, req, context);
      },
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      open: async (ws: WebSocket) => {
        // Delegate
        await this.onOpen(ws);
      },
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      message: async (ws: WebSocket, message: ArrayBuffer, isBinary: boolean) => {
        // Delegate
        const messageStr = Utils.convertBufferArrayToString(message);
        await this.onMessage(ws, messageStr, isBinary);
      },
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      close: async (ws: WebSocket, code: number, message: ArrayBuffer) => {
        // Convert right away
        const reason = Utils.convertBufferArrayToString(message);
        const wsWrapper = ws.wsWrapper as WSWrapper;
        // Close
        wsWrapper.closed = true;
        await this.logWSConnectionClosed(wsWrapper, ServerAction.WS_SERVER_CONNECTION_CLOSE, code,
          `${WebSocketAction.CLOSE} > WS Connection ID '${wsWrapper.guid}' closed by charging station with code '${code}', reason: '${!Utils.isNullOrEmptyString(reason) ? reason : 'No reason given'}'`);
        // Remove connection
        await this.removeWSWrapper(WebSocketAction.CLOSE, ServerAction.WS_SERVER_CONNECTION_CLOSE, wsWrapper);
      },
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      ping: async (ws: WebSocket, message: ArrayBuffer) => {
        // Convert
        const ocppMessage = Utils.convertBufferArrayToString(message);
        // Update
        if (ws.wsWrapper) {
          (ws.wsWrapper as WSWrapper).lastPingDate = new Date();
        }
        // Get the WS
        if (ws.wsWrapper.wsConnection) {
          await ws.wsWrapper.wsConnection.onPing(ocppMessage);
        }
      },
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      pong: async (ws: WebSocket, message: ArrayBuffer) => {
        // Convert
        const ocppMessage = Utils.convertBufferArrayToString(message);
        // Update
        if (ws.wsWrapper) {
          (ws.wsWrapper as WSWrapper).lastPongDate = new Date();
        }
        // Get the WS
        if (ws.wsWrapper.wsConnection) {
          await ws.wsWrapper.wsConnection.onPong(ocppMessage);
        }
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
      const message = 'No opened Web Socket connection found';
      await Logging.logError({
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        tenantID: tenant.id,
        module: MODULE_NAME, method: 'getChargingStationClient',
        action: ServerAction.WS_SERVER_CONNECTION, message
      });
      await Logging.logError({
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

  private async onUpgrade(res: uWS.HttpResponse, req: uWS.HttpRequest, context: uWS.us_socket_context_t) {
    // Check for WS connection over HTTP
    const url = req.getUrl();
    try {
      // You MUST register an abort handler to know if the upgrade was aborted by peer
      res.onAborted(() => {
        // If no handler here, it crashes!!!
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
      res.upgrade(
        { url },
        req.getHeader('sec-websocket-key'),
        req.getHeader('sec-websocket-protocol'),
        req.getHeader('sec-websocket-extensions'),
        context
      );
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

  private async onOpen(ws: uWS.WebSocket) {
    // Create WS Wrapper
    const wsWrapper = new WSWrapper(ws);
    // Keep it on the ws
    ws.wsWrapper = wsWrapper;
    // Lock incoming WS messages
    await this.acquireLockForWSRequest(WebSocketAction.OPEN, ServerAction.WS_SERVER_CONNECTION_OPEN, wsWrapper);
    try {
      this.runningWSMessages++;
      // Path must contain /OCPP16 or /REST as it is already checked during the Upgrade process
      // Check OCPP16 connection
      if (wsWrapper.url.startsWith('/OCPP16')) {
        // Create and Initialize WS Connection
        await this.checkAndStoreWSOpenedConnection(WSServerProtocol.OCPP16, wsWrapper);
      }
      // Check REST connection
      if (wsWrapper.url.startsWith('/REST')) {
        // Create and Initialize WS Connection
        await this.checkAndStoreWSOpenedConnection(WSServerProtocol.REST, wsWrapper);
      }
    } catch (error) {
      await Logging.logException(error as Error, ServerAction.WS_SERVER_CONNECTION_OPEN, MODULE_NAME, 'onOpen', Constants.DEFAULT_TENANT_ID);
      if (wsWrapper.tenantID) {
        await Logging.logException(error as Error, ServerAction.WS_SERVER_CONNECTION_OPEN, MODULE_NAME, 'onOpen', wsWrapper.tenantID);
      }
      // Close WS
      await this.closeWebSocket(WebSocketAction.OPEN, ServerAction.WS_SERVER_CONNECTION_OPEN, wsWrapper, WebSocketCloseEventStatusCode.CLOSE_ABNORMAL,
        `${WebSocketAction.OPEN} > WS Connection ID '${wsWrapper.guid}' has been rejected and closed by server due to an exception: ${error.message as string}`);
    } finally {
      this.runningWSMessages--;
      this.releaseLockForWSMessageRequest(wsWrapper);
    }
  }

  private async checkAndStoreWSOpenedConnection(protocol: WSServerProtocol, wsWrapper: WSWrapper): Promise<void> {
    let wsConnection: WSConnection;
    const timeStart = Date.now();
    // Set the protocol
    wsWrapper.protocol = protocol;
    // Create a WebSocket connection object
    if (protocol === WSServerProtocol.OCPP16) {
      wsConnection = new JsonWSConnection(wsWrapper);
    }
    if (protocol === WSServerProtocol.REST) {
      wsConnection = new JsonRestWSConnection(wsWrapper);
    }
    await Logging.logDebug({
      tenantID: Constants.DEFAULT_TENANT_ID,
      action: ServerAction.WS_SERVER_CONNECTION_OPEN, module: MODULE_NAME, method: 'checkAndStoreWSOpenedConnection',
      message: `${WebSocketAction.OPEN} > WS Connection ID '${wsWrapper.guid}'  is being checked ('${wsWrapper.url}')`,
      detailedMessages: { wsWrapper: this.getWSWrapperData(wsWrapper) }
    });
    // Initialize (check of Tenant, Token, Charging Station -> Can take time)
    await wsConnection.initialize();
    // Check if WS is still opened (long time initialization when thousand of WS are connecting at the same time)
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
      await this.checkAndCloseIdenticalOpenedWSConnection(wsWrapper, wsConnection);
      const message = `${WebSocketAction.OPEN} > WS Connection ID '${wsWrapper.guid}' has been accepted in ${Utils.computeTimeDurationSecs(timeStart)} secs`;
      await Logging.logInfo({
        tenantID: Constants.DEFAULT_TENANT_ID,
        chargingStationID: wsWrapper.chargingStationID,
        action: ServerAction.WS_SERVER_CONNECTION_OPEN, module: MODULE_NAME, method: 'checkAndStoreWSOpenedConnection',
        message, detailedMessages: { wsWrapper: this.getWSWrapperData(wsWrapper) }
      });
      await Logging.logInfo({
        ...LoggingHelper.getWSWrapperProperties(wsWrapper),
        action: ServerAction.WS_SERVER_CONNECTION_OPEN, module: MODULE_NAME, method: 'checkAndStoreWSOpenedConnection',
        message, detailedMessages: { wsWrapper: this.getWSWrapperData(wsWrapper) }
      });
      // Keep WS connection in cache
      await this.setWSConnection(WebSocketAction.OPEN, ServerAction.WS_SERVER_CONNECTION_OPEN, wsConnection, wsWrapper);
    } else {
      await this.logWSConnectionClosed(wsWrapper, ServerAction.WS_SERVER_CONNECTION_OPEN, WebSocketCloseEventStatusCode.CLOSE_ABNORMAL,
        `${WebSocketAction.OPEN} > WS Connection ID '${wsWrapper.guid}' has been closed during initialization in ${Utils.computeTimeDurationSecs(timeStart)} secs ('${wsWrapper.url}')`);
    }
  }

  private async checkAndCloseIdenticalOpenedWSConnection(wsWrapper: WSWrapper, wsConnection: WSConnection): Promise<void> {
    // Get connection
    const existingWSConnection =
      this.getWSConnectionFromProtocolAndID(wsConnection.getWS().protocol, wsConnection.getID());
    // Found existing WS Connection?
    if (existingWSConnection) {
      // Still opened WS?
      const existingWSWrapper = existingWSConnection.getWS();
      if (!existingWSWrapper.closed) {
        // Ping WS
        const result = await this.pingWebSocket(existingWSWrapper);
        if (result.ok) {
          // Close the old WS and keep the new incoming one
          await Logging.logWarning({
            tenantID: Constants.DEFAULT_TENANT_ID,
            chargingStationID: wsWrapper.chargingStationID,
            action: ServerAction.WS_SERVER_CONNECTION, module: MODULE_NAME, method: 'checkAndCloseIdenticalOpenedWSConnection',
            message: `${WebSocketAction.OPEN} > Existing WS Connection ID '${existingWSWrapper.guid}' will be closed and replaced by new incoming one with ID '${wsWrapper.guid}'`,
            detailedMessages: { wsWrapper: this.getWSWrapperData(wsWrapper) }
          });
          await this.closeWebSocket(WebSocketAction.OPEN, ServerAction.WS_SERVER_CONNECTION_OPEN, existingWSConnection.getWS(), WebSocketCloseEventStatusCode.CLOSE_ABNORMAL,
            `${WebSocketAction.OPEN} > Existing WS Connection ID '${existingWSWrapper.guid}' has been closed successfully by the server`);
        }
      }
    }
  }

  private async acquireLockForWSRequest(wsAction: WebSocketAction, action: ServerAction, wsWrapper: WSWrapper, ocppMessageType?: OCPPMessageType): Promise<void> {
    // Only lock requests, not responses
    if (ocppMessageType && ocppMessageType !== OCPPMessageType.CALL_MESSAGE) {
      return;
    }
    // Wait for Init (avoid WS connection with same URL), ocppMessageType only provided when a WS Message is received
    await this.waitForWSLockToRelease(wsAction, action, wsWrapper);
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
    const wsWrapper: WSWrapper = ws.wsWrapper;
    try {
      // Extract the OCPP Message Type
      const [ocppMessageType]: [OCPPMessageType] = JSON.parse(message);
      // Lock incoming WS messages
      await this.acquireLockForWSRequest(WebSocketAction.MESSAGE, ServerAction.WS_SERVER_MESSAGE, wsWrapper, ocppMessageType);
      try {
        this.runningWSMessages++;
        // Check if connection is available in Map
        await this.checkWSConnectionFromOnMessage(wsWrapper);
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
        this.releaseLockForWSMessageRequest(wsWrapper, ocppMessageType);
      }
    } catch (error) {
      const logMessage = `${WebSocketAction.MESSAGE} > WS Connection ID '${wsWrapper.guid}' got error while processing WS Message: ${error.message as string}`;
      if (wsWrapper?.tenantID) {
        await Logging.logError({
          ...LoggingHelper.getWSWrapperProperties(wsWrapper),
          action: ServerAction.WS_SERVER_MESSAGE,
          module: MODULE_NAME, method: 'onMessage',
          message: logMessage,
          detailedMessages: { message, isBinary, wsWrapper: this.getWSWrapperData(wsWrapper), error: error.stack }
        });
      }
      await Logging.logError({
        tenantID: Constants.DEFAULT_TENANT_ID,
        chargingStationID: wsWrapper.chargingStationID,
        action: ServerAction.WS_SERVER_MESSAGE,
        module: MODULE_NAME, method: 'onMessage',
        message: logMessage + ` - tenant: ${wsWrapper?.tenantID}`,
        detailedMessages: { message, isBinary, wsWrapper: this.getWSWrapperData(wsWrapper), error: error.stack }
      });
    }
  }

  private async checkWSConnectionFromOnMessage(wsWrapper: WSWrapper) {
    // Get WS Connection
    const wsConnection = wsWrapper.wsConnection;
    if (wsWrapper.closed) {
      // Current message is from a charger which should not reach us!
      // e.g.: Websocket has been closed during the onOpen because the tenant does not exist
      throw new Error('Websocket is already closed');
    }
    // Get WS Connection from cache
    const wsExistingConnection =
      this.getWSConnectionFromProtocolAndID(wsWrapper.protocol, wsWrapper.key);
    if (!wsExistingConnection) {
      await Logging.logError({
        tenantID: Constants.DEFAULT_TENANT_ID,
        chargingStationID: wsWrapper.chargingStationID,
        action: ServerAction.WS_SERVER_MESSAGE,
        module: MODULE_NAME, method: 'checkWSConnectionFromOnMessage',
        message: `${WebSocketAction.MESSAGE} > WS Connection ID '${wsWrapper.guid}' has sent a WS Message on an unreferenced WS Connection, it will be then added in the WS cache`,
        detailedMessages: { wsWrapper: this.getWSWrapperData(wsWrapper) }
      });
      // Add WS connection from OnMessage in cache
      await this.setWSConnection(WebSocketAction.MESSAGE, ServerAction.WS_SERVER_MESSAGE, wsConnection, wsWrapper);
      return;
    }
    // Should have the same GUID
    const wsExistingWrapper = wsExistingConnection.getWS();
    if (wsExistingWrapper.guid !== wsWrapper.guid) {
      await Logging.logError({
        tenantID: Constants.DEFAULT_TENANT_ID,
        chargingStationID: wsWrapper.chargingStationID,
        action: ServerAction.WS_SERVER_MESSAGE,
        module: MODULE_NAME, method: 'checkWSConnectionFromOnMessage',
        message: `${WebSocketAction.MESSAGE} > WS Connection ID '${wsWrapper.guid}' has sent a WS Message on an already referenced WS Connection ID '${wsExistingWrapper.guid}' in WS cache, ping will be performed...`,
        detailedMessages: { wsWrapper: this.getWSWrapperData(wsWrapper), wsExistingWrapper: this.getWSWrapperData(wsExistingWrapper) }
      });
      // Ping
      const result = await this.pingWebSocket(wsExistingWrapper);
      if (result.ok) {
        await Logging.logError({
          tenantID: Constants.DEFAULT_TENANT_ID,
          chargingStationID: wsWrapper.chargingStationID,
          action: ServerAction.WS_SERVER_MESSAGE,
          module: MODULE_NAME, method: 'checkWSConnectionFromOnMessage',
          message: `${WebSocketAction.MESSAGE} > Existing WS Connection ID '${wsExistingWrapper.guid}' ping succeeded meaning multiple WS connections are opened by the same charging station, existing one will be closed and replaced by new one with ID '${wsWrapper.guid}'`,
          detailedMessages: { wsExistingWrapper: this.getWSWrapperData(wsExistingWrapper), wsWrapper: this.getWSWrapperData(wsWrapper) }
        });
        // Close WS
        await this.closeWebSocket(WebSocketAction.MESSAGE, ServerAction.WS_SERVER_MESSAGE, wsExistingWrapper,
          WebSocketCloseEventStatusCode.CLOSE_ABNORMAL, `${WebSocketAction.MESSAGE} > Existing WS Connection ID '${wsExistingWrapper.guid}' has been closed successfully by server (duplicate WS Connection)`);
      } else {
        await Logging.logWarning({
          tenantID: Constants.DEFAULT_TENANT_ID,
          chargingStationID: wsWrapper.chargingStationID,
          action: ServerAction.WS_SERVER_MESSAGE,
          module: MODULE_NAME, method: 'checkWSConnectionFromOnMessage',
          message: `${WebSocketAction.MESSAGE} > Existing WS Connection ID '${wsExistingWrapper.guid}' ping failed, new WS Connection ID '${wsWrapper.guid}' will be then added in the WS cache`,
          detailedMessages: { wsExistingWrapper: this.getWSWrapperData(wsExistingWrapper), wsWrapper: this.getWSWrapperData(wsWrapper) }
        });
      }
      // Keep WS connection in cache
      await this.setWSConnection(WebSocketAction.MESSAGE, ServerAction.WS_SERVER_MESSAGE, wsConnection, wsWrapper);
    }
  }

  private async logWSConnectionClosed(wsWrapper: WSWrapper, action: ServerAction, code: number, message: string): Promise<void> {
    this.isDebug() && Logging.logConsoleDebug(message);
    if (wsWrapper.tenantID) {
      await Logging.logInfo({
        ...LoggingHelper.getWSWrapperProperties(wsWrapper),
        action, module: MODULE_NAME, method: 'logWSConnectionClosed',
        message: message, detailedMessages: { code, message, wsWrapper: this.getWSWrapperData(wsWrapper) }
      });
    }
    await Logging.logInfo({
      tenantID: Constants.DEFAULT_TENANT_ID,
      chargingStationID: wsWrapper.chargingStationID,
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
      await Logging.logWarning({
        tenantID: Constants.DEFAULT_TENANT_ID,
        chargingStationID: wsWrapper.chargingStationID,
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
          await Logging.logInfo({
            tenantID: Constants.DEFAULT_TENANT_ID,
            chargingStationID: wsWrapper.chargingStationID,
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
          await Logging.logError({
            tenantID: Constants.DEFAULT_TENANT_ID,
            chargingStationID: wsWrapper.chargingStationID,
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

  private async pingWebSocket(wsWrapper: WSWrapper): Promise<WebSocketPingResult> {
    try {
      // Ping the WS
      wsWrapper.ping();
      // Reset
      wsWrapper.nbrPingFailed = 0;
      return {
        ok: true
      };
    } catch (error) {
      wsWrapper.nbrPingFailed++;
      // Close WS
      if (wsWrapper.nbrPingFailed >= Constants.WS_MAX_NBR_OF_FAILED_PINGS) {
        await Logging.logError({
          tenantID: Constants.DEFAULT_TENANT_ID,
          chargingStationID: wsWrapper.chargingStationID,
          action: ServerAction.WS_SERVER_CONNECTION_PING, module: MODULE_NAME, method: 'pingWebSocket',
          message: `${WebSocketAction.PING} > Failed to ping the WS Connection ID '${wsWrapper.guid}' after ${wsWrapper.nbrPingFailed} trial(s), will be removed from WS cache`,
          detailedMessages: { wsWrapper: this.getWSWrapperData(wsWrapper), error: error.stack }
        });
        await this.closeWebSocket(WebSocketAction.PING, ServerAction.WS_SERVER_CONNECTION_PING, wsWrapper,
          WebSocketCloseEventStatusCode.CLOSE_ABNORMAL, `${WebSocketAction.PING} > WS Connection ID '${wsWrapper.guid}' has been closed by server after ${wsWrapper.nbrPingFailed} failed ping`);
      } else {
        await Logging.logWarning({
          tenantID: Constants.DEFAULT_TENANT_ID,
          chargingStationID: wsWrapper.chargingStationID,
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

  private async closeWebSocket(wsAction: WebSocketAction, action: ServerAction, wsWrapper: WSWrapper, code: WebSocketCloseEventStatusCode, message: string): Promise<void> {
    // Close WS
    if (!wsWrapper.closed) {
      try {
        wsWrapper.close(code, message);
        await this.logWSConnectionClosed(wsWrapper, action, code, message);
      } catch (error) {
        // Just log and ignore issue
        await Logging.logError({
          tenantID: Constants.DEFAULT_TENANT_ID,
          chargingStationID: wsWrapper.chargingStationID,
          action, module: MODULE_NAME, method: 'closeWebSocket',
          message: `${wsAction} > Failed to close WS Connection ID '${wsWrapper.guid}': ${error.message as string}`,
          detailedMessages: { error: error.stack, wsWrapper: this.getWSWrapperData(wsWrapper) }
        });
      }
    }
    // Remove connection
    await this.removeWSWrapper(wsAction, action, wsWrapper);
  }

  private async setWSConnection(wsAction: WebSocketAction, action: ServerAction, wsConnection: WSConnection, wsWrapper: WSWrapper) {
    // Reference a Json WebSocket connection object
    if (wsWrapper.protocol === WSServerProtocol.OCPP16) {
      this.jsonWSConnections.set(wsConnection.getID(), wsConnection as JsonWSConnection);
      await Logging.logDebug({
        tenantID: Constants.DEFAULT_TENANT_ID,
        chargingStationID: wsWrapper.chargingStationID,
        action, module: MODULE_NAME, method: 'setWSConnection',
        message: `${wsAction} > WS Connection ID '${wsWrapper.guid}' has been added in the WS cache`,
        detailedMessages: { wsWrapper: this.getWSWrapperData(wsWrapper) }
      });
    }
    if (wsWrapper.protocol === WSServerProtocol.REST) {
      this.jsonRestWSConnections.set(wsConnection.getID(), wsConnection as JsonRestWSConnection);
      await Logging.logDebug({
        tenantID: Constants.DEFAULT_TENANT_ID,
        chargingStationID: wsWrapper.chargingStationID,
        action, module: MODULE_NAME, method: 'setWSConnection',
        message: `${wsAction} > WS Connection ID '${wsWrapper.guid}' has been added in the WS cache`,
        detailedMessages: { wsWrapper: this.getWSWrapperData(wsWrapper) }
      });
    }
    wsWrapper.wsConnection = wsConnection;
  }

  private getWSConnectionFromProtocolAndID(protocol: WSServerProtocol, wsConnectionID: string): WSConnection {
    if (protocol === WSServerProtocol.OCPP16) {
      return this.jsonWSConnections.get(wsConnectionID);
    }
    if (protocol === WSServerProtocol.REST) {
      return this.jsonRestWSConnections.get(wsConnectionID);
    }
  }

  private async removeWSWrapper(wsAction: WebSocketAction, action: ServerAction, wsWrapper: WSWrapper): Promise<void> {
    if (wsWrapper.protocol === WSServerProtocol.OCPP16) {
      await this.removeWSConnection(
        wsAction, action, wsWrapper.wsConnection, this.jsonWSConnections);
    }
    if (wsWrapper.protocol === WSServerProtocol.REST) {
      await this.removeWSConnection(
        wsAction, action, wsWrapper.wsConnection, this.jsonRestWSConnections);
    }
  }

  private async removeWSConnection(wsAction: WebSocketAction, action: ServerAction, wsConnection: WSConnection, wsConnections: Map<string, WSConnection>): Promise<void> {
    if (wsConnection) {
      const wsWrapper = wsConnection.getWS();
      const existingWsConnection = wsConnections.get(wsConnection.getID());
      if (existingWsConnection) {
        const existingWsWrapper = existingWsConnection.getWS();
        // Check id same WS Connection
        if (existingWsWrapper.guid === wsWrapper.guid) {
          // Remove from WS Cache
          wsConnections.delete(wsConnection.getID());
          await Logging.logDebug({
            tenantID: Constants.DEFAULT_TENANT_ID,
            chargingStationID: wsWrapper.chargingStationID,
            action, module: MODULE_NAME, method: 'setWSConnection',
            message: `${wsAction} > WS Connection ID '${wsWrapper.guid}' has been removed from the WS cache`,
            detailedMessages: { wsWrapper: this.getWSWrapperData(wsWrapper) }
          });
        } else {
          // WS Connection not identical
          await Logging.logWarning({
            tenantID: Constants.DEFAULT_TENANT_ID,
            chargingStationID: wsWrapper.chargingStationID,
            action, module: MODULE_NAME, method: 'removeWSConnection',
            message: `${wsAction} > Failed to remove WS Connection ID '${wsWrapper.guid}' from WS cache due to an already existing WS with different ID '${existingWsWrapper.guid}'`,
            detailedMessages: { wsWrapper: this.getWSWrapperData(wsWrapper), existingWsWrapper: this.getWSWrapperData(existingWsWrapper) }
          });
        }
      } else {
        // WS Connection not found
        await Logging.logWarning({
          tenantID: Constants.DEFAULT_TENANT_ID,
          chargingStationID: wsWrapper.chargingStationID,
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
          const currentOcppRequests = jsonWSConnection.getCurrentOcppRequests();
          sizeOfCurrentRequestsBytes += sizeof(currentOcppRequests);
          numberOfCurrentRequests += Object.keys(currentOcppRequests).length;
        }
        // Log Stats on number of WS Connections
        Logging.logDebug({
          tenantID: Constants.DEFAULT_TENANT_ID,
          action: ServerAction.WS_SERVER_CONNECTION, module: MODULE_NAME, method: 'monitorWSConnections',
          message: `${this.jsonWSConnections.size} WS connections, ${this.jsonRestWSConnections.size} REST connections, ${this.runningWSMessages} Messages, ${Object.keys(this.runningWSRequestsMessages).length} Requests, ${this.waitingWSMessages} queued WS Message(s)`,
          detailedMessages: [
            `${numberOfCurrentRequests} JSON WS Requests cached`,
            `${sizeOfCurrentRequestsBytes / 1000} kB used in JSON WS cache`
          ]
        }).catch(() => { /* Intentional */ });
        if ((global.monitoringServer) && (process.env.K8S)) {
          global.monitoringServer.getGauge(Constants.WEB_SOCKET_RUNNING_REQUEST_RESPONSE).set(this.runningWSMessages);
          global.monitoringServer.getGauge(Constants.WEB_SOCKET_OCPP_CONNECTIONS_COUNT).set(this.jsonWSConnections.size);
          global.monitoringServer.getGauge(Constants.WEB_SOCKET_REST_CONNECTIONS_COUNT).set(this.jsonRestWSConnections.size);
          global.monitoringServer.getGauge(Constants.WEB_SOCKET_CURRRENT_REQUEST).set(numberOfCurrentRequests);
          global.monitoringServer.getGauge(Constants.WEB_SOCKET_RUNNING_REQUEST).set(Object.keys(this.runningWSRequestsMessages).length);
          global.monitoringServer.getGauge(Constants.WEB_SOCKET_QUEUED_REQUEST).set(this.waitingWSMessages);
        }
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

  private checkAndCleanupAllWebSockets() {
    setInterval(() => {
      // Check Json connections
      this.checkAndCleanupWebSockets(this.jsonWSConnections, 'CS').catch(() => { /* Intentional */ });
      // Check Rest connections
      this.checkAndCleanupWebSockets(this.jsonRestWSConnections, 'REST').catch(() => { /* Intentional */ });
    }, Configuration.getChargingStationConfig().pingIntervalOCPPJSecs * 1000);
  }

  private async checkAndCleanupWebSockets(wsConnections: Map<string, WSConnection>, type: 'CS'|'REST') {
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
          const result = await this.pingWebSocket(wsWrapper);
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
          await Logging.logError({
            tenantID: Constants.DEFAULT_TENANT_ID,
            module: MODULE_NAME, method: 'checkAndCleanupWebSockets',
            action: ServerAction.WS_SERVER_CONNECTION_PING,
            message, detailedMessages: { invalidConnections, /* validConnections */ }
          });
        } else {
          await Logging.logInfo({
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
      key: wsWrapper.key,
      guid: wsWrapper.guid,
      nbrPingFailed: wsWrapper.nbrPingFailed,
      siteID: wsWrapper.siteID,
      siteAreaID: wsWrapper.siteAreaID,
      companyID: wsWrapper.companyID,
      chargingStationID: wsWrapper.chargingStationID,
      tenantID: wsWrapper.tenantID,
      tokenID: wsWrapper.tokenID,
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
