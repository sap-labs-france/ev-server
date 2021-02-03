import { OCPPErrorType, OCPPIncomingRequest, OCPPMessageType, OCPPRequest } from '../../../types/ocpp/OCPPCommon';
import WebSocket, { CLOSED, CLOSING, CONNECTING, CloseEvent, ErrorEvent, MessageEvent, OPEN } from 'ws';

import BackendError from '../../../exception/BackendError';
import ChargingStationStorage from '../../../storage/mongodb/ChargingStationStorage';
import { Command } from '../../../types/ChargingStation';
import Configuration from '../../../utils/Configuration';
import Constants from '../../../utils/Constants';
import DatabaseUtils from '../../../storage/mongodb/DatabaseUtils';
import JsonCentralSystemServer from './JsonCentralSystemServer';
import Logging from '../../../utils/Logging';
import OCPPError from '../../../exception/OcppError';
import { OCPPVersion } from '../../../types/ocpp/OCPPServer';
import { ServerAction } from '../../../types/Server';
import TenantStorage from '../../../storage/mongodb/TenantStorage';
import Utils from '../../../utils/Utils';
import http from 'http';

const MODULE_NAME = 'WSConnection';

export default abstract class WSConnection {
  public code: string;
  public message: string;
  public details: string;
  protected initialized: boolean;
  protected wsServer: JsonCentralSystemServer;
  protected readonly chargingStationID: string;
  protected readonly tenantID: string;
  private readonly token: string;
  private readonly url: string;
  private readonly clientIP: string | string[];
  private readonly wsConnection: WebSocket;
  private req: http.IncomingMessage;
  private requests: { [id: string]: OCPPRequest };
  private tenantIsValid: boolean;

  constructor(wsConnection: WebSocket, req: http.IncomingMessage, wsServer: JsonCentralSystemServer) {
    // Init
    this.url = req.url.trim().replace(/\b(\?|&).*/, ''); // Filter trailing URL parameters
    this.clientIP = Utils.getRequestIP(req);
    this.wsConnection = wsConnection;
    this.req = req;
    this.initialized = false;
    this.wsServer = wsServer;
    Logging.logDebug({
      tenantID: Constants.DEFAULT_TENANT,
      action: ServerAction.WS_CONNECTION_OPENED,
      module: MODULE_NAME, method: 'constructor',
      message: `WS connection opening attempts with URL: '${req.url}'`,
    });
    // Default
    this.tenantIsValid = false;
    this.requests = {};
    // Check URL: remove starting and trailing '/'
    if (this.url.endsWith('/')) {
      // Remove '/'
      this.url = this.url.substring(0, this.url.length - 1);
    }
    if (this.url.startsWith('/')) {
      // Remove '/'
      this.url = this.url.substring(1, this.url.length);
    }
    // Parse URL: should be like /OCPPxx/TENANTID/TOKEN/CHARGEBOXID
    // We support previous format for existing charging station without token /OCPPxx/TENANTID/CHARGEBOXID
    const splittedURL = this.getURL().split('/');
    if (splittedURL.length === 4) {
      // URL /OCPPxx/TENANTID/TOKEN/CHARGEBOXID
      this.tenantID = splittedURL[1];
      this.token = splittedURL[2];
      this.chargingStationID = splittedURL[3];
    } else if (splittedURL.length === 3) {
      // URL /OCPPxx/TENANTID/CHARGEBOXID
      this.tenantID = splittedURL[1];
      this.chargingStationID = splittedURL[2];
    } else {
      // Error
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME, method: 'constructor',
        message: `The URL '${req.url}' is invalid (/(OCPPxx|REST)/TENANT_ID/CHARGEBOX_ID)`
      });
    }
    let logMsg = `Unknown type WS connection attempts with URL: '${req.url}'`;
    let action: ServerAction = ServerAction.WS_CONNECTION_OPENED;
    if (req.url.startsWith('/REST')) {
      logMsg = `REST service connection attempts to Charging Station with URL: '${req.url}'`;
      action = ServerAction.WS_REST_CONNECTION_OPENED;
    } else if (req.url.startsWith(`/${Utils.getOCPPServerVersionURLPath(OCPPVersion.VERSION_16)}`)) {
      logMsg = `Charging Station connection attempts with URL: '${req.url}'`;
      action = ServerAction.WS_JSON_CONNECTION_OPENED;
    }
    Logging.logDebug({
      tenantID: this.tenantID,
      source: this.chargingStationID,
      action: action,
      module: MODULE_NAME, method: 'constructor',
      message: logMsg,
    });
    if (!Utils.isChargingStationIDValid(this.chargingStationID)) {
      const backendError = new BackendError({
        source: this.chargingStationID,
        module: MODULE_NAME,
        method: 'constructor',
        message: `The Charging Station ID is invalid: '${this.chargingStationID}'`
      });
      // Log in the right Tenants
      Logging.logException(
        backendError,
        ServerAction.WS_CONNECTION,
        Constants.CENTRAL_SERVER,
        MODULE_NAME, 'constructor',
        this.tenantID
      );
      throw backendError;
    }
    // Handle incoming messages
    this.wsConnection.on('message', this.onMessage.bind(this));
    // Handle Socket error
    this.wsConnection.on('error', this.onError.bind(this));
    // Handle Socket close
    this.wsConnection.on('close', this.onClose.bind(this));
  }

  public async initialize(): Promise<void> {
    try {
      // Check Tenant?
      await DatabaseUtils.checkTenant(this.tenantID);
      this.tenantIsValid = true;
      // Cloud Foundry?
      if (Configuration.isCloudFoundry()) {
        // Yes: Save the CF App and Instance ID to call the Charging Station from the Rest server
        const chargingStation = await ChargingStationStorage.getChargingStation(this.tenantID, this.getChargingStationID());
        // Found?
        if (chargingStation) {
          // Update CF Instance
          chargingStation.cfApplicationIDAndInstanceIndex = Configuration.getCFApplicationIDAndInstanceIndex();
          // Save it
          await ChargingStationStorage.saveChargingStation(this.tenantID, chargingStation);
        }
      }
    } catch (error) {
      // Custom Error
      Logging.logException(error, ServerAction.WS_CONNECTION, this.getChargingStationID(), 'WSConnection', 'initialize', this.tenantID);
      throw new BackendError({
        source: this.getChargingStationID(),
        action: ServerAction.WS_CONNECTION,
        module: MODULE_NAME, method: 'initialize',
        message: `Invalid Tenant '${this.tenantID}' in URL '${this.getURL()}'`,
        detailedMessages: { error: error.message, stack: error.stack }
      });
    }
  }

  public async onMessage(messageEvent: MessageEvent): Promise<void> {
    let [messageType, messageId, commandName, commandPayload, errorDetails]: OCPPIncomingRequest = [0, '', '' as ServerAction, '', {}];
    let responseCallback: (payload?: Record<string, unknown> | string) => void;
    let rejectCallback: (reason?: OCPPError) => void;
    try {
      // Parse the message
      [messageType, messageId, commandName, commandPayload, errorDetails] = JSON.parse(messageEvent.toString()) as OCPPIncomingRequest;
      // Initialize: done in the message as init could be lengthy and first message may be lost
      await this.initialize();
      // Check the Type of message
      switch (messageType) {
        // Incoming Message
        case OCPPMessageType.CALL_MESSAGE:
          // Process the call
          await this.handleRequest(messageId, commandName, commandPayload);
          break;
        // Outcome Message
        case OCPPMessageType.CALL_RESULT_MESSAGE:
          // Respond
          if (Utils.isIterable(this.requests[messageId])) {
            [responseCallback] = this.requests[messageId];
          } else {
            throw new BackendError({
              source: this.getChargingStationID(),
              module: MODULE_NAME,
              method: 'onMessage',
              message: `Response request for message id ${messageId} is not iterable`,
              action: commandName
            });
          }
          if (!responseCallback) {
            // Error
            throw new BackendError({
              source: this.getChargingStationID(),
              module: MODULE_NAME,
              method: 'onMessage',
              message: `Response request for unknown message id ${messageId}`,
              action: commandName
            });
          }
          delete this.requests[messageId];
          responseCallback(commandName);
          break;
        // Error Message
        case OCPPMessageType.CALL_ERROR_MESSAGE:
          // Log
          Logging.logError({
            tenantID: this.getTenantID(),
            module: MODULE_NAME,
            method: 'onMessage',
            action: commandName,
            message: `Error occurred '${commandName}' with message content '${JSON.stringify(commandPayload)}'`,
            detailedMessages: [messageType, messageId, commandName, commandPayload, errorDetails]
          });
          if (!this.requests[messageId]) {
            // Error
            throw new BackendError({
              source: this.getChargingStationID(),
              module: MODULE_NAME,
              method: 'onMessage',
              message: `Error request for unknown message id ${messageId}`,
              action: commandName
            });
          }
          if (Utils.isIterable(this.requests[messageId])) {
            [, rejectCallback] = this.requests[messageId];
          } else {
            throw new BackendError({
              source: this.getChargingStationID(),
              module: MODULE_NAME,
              method: 'onMessage',
              message: `Error request for message id ${messageId} is not iterable`,
              action: commandName
            });
          }
          delete this.requests[messageId];
          rejectCallback(new OCPPError({
            source: this.getChargingStationID(),
            module: MODULE_NAME,
            method: 'onMessage',
            code: commandName,
            message: commandPayload.toString(),
            details: { errorDetails }
          }));
          break;
        // Error
        default:
          // Error
          throw new BackendError({
            source: this.getChargingStationID(),
            module: MODULE_NAME,
            method: 'onMessage',
            message: `Wrong message type ${messageType}`,
            action: commandName
          });
      }
    } catch (error) {
      // Log
      Logging.logException(error, commandName, this.getChargingStationID(), MODULE_NAME, 'onMessage', this.getTenantID());
      // Send error
      await this.sendError(messageId, error);
    }
  }

  public getWSConnection(): WebSocket {
    return this.wsConnection;
  }

  public getWSServer(): JsonCentralSystemServer {
    return this.wsServer;
  }

  public getURL(): string {
    return this.url;
  }

  public getClientIP(): string | string[] {
    return this.clientIP;
  }

  public async sendError(messageId: string, error: OCPPError): Promise<unknown> {
    // Send error
    return this.sendMessage(messageId, error, OCPPMessageType.CALL_ERROR_MESSAGE);
  }

  public async sendMessage(messageId: string, commandParams: Record<string, unknown> | OCPPError, messageType: OCPPMessageType = OCPPMessageType.CALL_RESULT_MESSAGE, commandName?: Command | ServerAction): Promise<unknown> {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    // Send a message through WSConnection
    const tenant = await TenantStorage.getTenant(this.tenantID);
    // Create a promise
    return await new Promise((resolve, reject) => {
      let messageToSend: string;
      // Function that will receive the request's response
      function responseCallback(payload: Record<string, unknown> | string): void {
        // Send the response
        resolve(payload);
      }
      // Function that will receive the request's rejection
      function rejectCallback(reason: string | OCPPError): void {
        // Build Exception
        self.requests[messageId] = [() => { }, () => { }];
        const error = reason instanceof OCPPError ? reason : new Error(reason);
        // Send error
        reject(error);
      }
      // Type of message
      switch (messageType) {
        // Request
        case OCPPMessageType.CALL_MESSAGE:
          // Build request
          this.requests[messageId] = [responseCallback, rejectCallback];
          messageToSend = JSON.stringify([messageType, messageId, commandName, commandParams]);
          break;
        // Response
        case OCPPMessageType.CALL_RESULT_MESSAGE:
          // Build response
          messageToSend = JSON.stringify([messageType, messageId, commandParams]);
          break;
        // Error Message
        case OCPPMessageType.CALL_ERROR_MESSAGE:
          // Build Error Message
          messageToSend = JSON.stringify([messageType, messageId, commandParams.code ? commandParams.code : OCPPErrorType.GENERIC_ERROR, commandParams.message ? commandParams.message : '', commandParams.details ? commandParams.details : {}]);
          break;
      }
      // Check if wsConnection is ready
      if (this.isWSConnectionOpen()) {
        // Yes: Send Message
        this.wsConnection.send(messageToSend);
      } else {
        // Reject it
        return rejectCallback(`WebSocket closed for Message ID '${messageId}' with content '${messageToSend}' (${tenant?.name})`);
      }
      // Response?
      if (messageType !== OCPPMessageType.CALL_MESSAGE) {
        // Yes: send Ok
        resolve();
      } else {
        // Send timeout
        setTimeout(() => rejectCallback(`Timeout for Message ID '${messageId}' with content '${messageToSend} (${tenant?.name})`), Constants.OCPP_SOCKET_TIMEOUT);
      }
    });
  }

  public getChargingStationID(): string {
    return this.chargingStationID;
  }

  public getTenantID(): string {
    // Check
    if (this.isTenantValid()) {
      // Ok
      return this.tenantID;
    }
    // No, go to the master tenant
    return Constants.DEFAULT_TENANT;
  }

  public getToken(): string {
    return this.token;
  }

  public getID(): string {
    return `${this.getTenantID()}~${this.getChargingStationID()}}`;
  }

  public isTenantValid(): boolean {
    return this.tenantIsValid;
  }

  public isWSConnectionOpen(): boolean {
    return this.wsConnection?.readyState === OPEN;
  }

  public getConnectionStatusString(): string {
    switch (this.getConnectionStatus()) {
      case OPEN:
        return 'Open';
      case CONNECTING:
        return 'Connecting';
      case CLOSING:
        return 'Closing';
      case CLOSED:
        return 'Closed';
      default:
        return `Unknown code '${this.getConnectionStatus()}'`;
    }
  }

  private getConnectionStatus(): number {
    return this.wsConnection?.readyState;
  }

  public abstract handleRequest(messageId: string, commandName: ServerAction, commandPayload: Record<string, unknown> | string): Promise<void>;

  public abstract onError(errorEvent: ErrorEvent): void;

  public abstract onClose(closeEvent: CloseEvent): void;
}
