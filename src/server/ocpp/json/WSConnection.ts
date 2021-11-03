import ChargingStation, { Command } from '../../../types/ChargingStation';
import { OCPPErrorType, OCPPIncomingRequest, OCPPMessageType, OCPPRequest } from '../../../types/ocpp/OCPPCommon';
import WebSocket, { CLOSED, CLOSING, CONNECTING, CloseEvent, ErrorEvent, MessageEvent, OPEN } from 'ws';

import BackendError from '../../../exception/BackendError';
import Constants from '../../../utils/Constants';
import JsonCentralSystemServer from './JsonCentralSystemServer';
import LockingHelper from '../../../locking/LockingHelper';
import LockingManager from '../../../locking/LockingManager';
import Logging from '../../../utils/Logging';
import OCPPError from '../../../exception/OcppError';
import OCPPUtils from '../utils/OCPPUtils';
import { OCPPVersion } from '../../../types/ocpp/OCPPServer';
import { ServerAction } from '../../../types/Server';
import Tenant from '../../../types/Tenant';
import Utils from '../../../utils/Utils';
import http from 'http';

const MODULE_NAME = 'WSConnection';

export default abstract class WSConnection {
  protected initialized: boolean;
  protected wsServer: JsonCentralSystemServer;
  private siteID: string;
  private siteAreaID: string;
  private companyID: string;
  private chargingStationID: string;
  private tenantID: string;
  private tenantSubdomain: string;
  private tokenID: string;
  private url: string;
  private clientIP: string | string[];
  private wsConnection: WebSocket;
  private requests: { [id: string]: OCPPRequest } = {};

  constructor(wsConnection: WebSocket, req: http.IncomingMessage, wsServer: JsonCentralSystemServer) {
    // Init
    this.url = req.url.trim().replace(/\b(\?|&).*/, ''); // Filter trailing URL parameters
    this.clientIP = Utils.getRequestIP(req);
    this.wsConnection = wsConnection;
    this.initialized = false;
    this.wsServer = wsServer;
    void Logging.logDebug({
      tenantID: Constants.DEFAULT_TENANT,
      action: ServerAction.WS_CONNECTION_OPENED,
      module: MODULE_NAME, method: 'constructor',
      message: `WS connection opening attempts with URL: '${req.url}'`,
    });
    // Check actions
    this.checkActionInRequest(req);
    // Check mandatory fields
    this.checkMandatoryFieldsInRequest(req);
    // Handle incoming messages
    this.wsConnection.on('message', this.onMessage.bind(this));
    // Handle Socket error
    this.wsConnection.on('error', this.onError.bind(this));
    // Handle Socket close
    this.wsConnection.on('close', this.onClose.bind(this));
  }

  public async initialize(): Promise<void> {
    if (!this.initialized) {
      // Check and Get Charging Station data
      const { tenant, chargingStation } = await OCPPUtils.checkAndGetChargingStationData(
        ServerAction.WS_CONNECTION, this.getTenantID(), this.getChargingStationID(), this.getTokenID(), false);
      // Set
      this.setTenant(tenant);
      this.setChargingStation(chargingStation);
    }
  }

  public async onMessage(messageEvent: MessageEvent): Promise<void> {
    let [messageType, messageId, command, commandPayload, errorDetails]: OCPPIncomingRequest = [0, '', '' as Command, '', {}];
    let responseCallback: (payload?: Record<string, unknown> | string) => void;
    let rejectCallback: (reason?: OCPPError) => void;
    try {
      // Parse the message
      [messageType, messageId, command, commandPayload, errorDetails] = JSON.parse(messageEvent.toString()) as OCPPIncomingRequest;
      // Wait for init
      await this.waitForInitialization();
      // Check the Type of message
      switch (messageType) {
        // Incoming Message
        case OCPPMessageType.CALL_MESSAGE:
          // Process the call
          await this.handleRequest(messageId, command, commandPayload);
          break;
        // Outcome Message
        case OCPPMessageType.CALL_RESULT_MESSAGE:
          // Respond
          if (Utils.isIterable(this.requests[messageId])) {
            [responseCallback] = this.requests[messageId];
          } else {
            throw new BackendError({
              chargingStationID: this.getChargingStationID(),
              siteID: this.getSiteID(),
              siteAreaID: this.getSiteAreaID(),
              companyID: this.getCompanyID(),
              module: MODULE_NAME,
              method: 'onMessage',
              message: `Response request for message id ${messageId} is not iterable`,
              action: OCPPUtils.buildServerActionFromOcppCommand(command)
            });
          }
          if (!responseCallback) {
            // Error
            throw new BackendError({
              chargingStationID: this.getChargingStationID(),
              siteID: this.getSiteID(),
              siteAreaID: this.getSiteAreaID(),
              companyID: this.getCompanyID(),
              module: MODULE_NAME,
              method: 'onMessage',
              message: `Response request for unknown message id ${messageId}`,
              action: OCPPUtils.buildServerActionFromOcppCommand(command)
            });
          }
          delete this.requests[messageId];
          responseCallback(command);
          break;
        // Error Message
        case OCPPMessageType.CALL_ERROR_MESSAGE:
          // Log
          await Logging.logError({
            tenantID: this.getTenantID(),
            module: MODULE_NAME,
            method: 'onMessage',
            action: OCPPUtils.buildServerActionFromOcppCommand(command),
            message: `Error occurred '${command}' with message content '${JSON.stringify(commandPayload)}'`,
            detailedMessages: { messageType, messageId, command, commandPayload, errorDetails }
          });
          if (!this.requests[messageId]) {
            // Error
            throw new BackendError({
              chargingStationID: this.getChargingStationID(),
              siteID: this.getSiteID(),
              siteAreaID: this.getSiteAreaID(),
              companyID: this.getCompanyID(),
              module: MODULE_NAME,
              method: 'onMessage',
              message: `Error request for unknown message id ${messageId}`,
              action: OCPPUtils.buildServerActionFromOcppCommand(command)
            });
          }
          if (Utils.isIterable(this.requests[messageId])) {
            [, rejectCallback] = this.requests[messageId];
          } else {
            throw new BackendError({
              chargingStationID: this.getChargingStationID(),
              siteID: this.getSiteID(),
              siteAreaID: this.getSiteAreaID(),
              companyID: this.getCompanyID(),
              module: MODULE_NAME,
              method: 'onMessage',
              message: `Error request for message id ${messageId} is not iterable`,
              action: OCPPUtils.buildServerActionFromOcppCommand(command)
            });
          }
          delete this.requests[messageId];
          rejectCallback(new OCPPError({
            chargingStationID: this.getChargingStationID(),
            siteID: this.getSiteID(),
            siteAreaID: this.getSiteAreaID(),
            companyID: this.getCompanyID(),
            module: MODULE_NAME,
            method: 'onMessage',
            code: command,
            message: commandPayload.toString(),
            details: { errorDetails }
          }));
          break;
        // Error
        default:
          throw new BackendError({
            chargingStationID: this.getChargingStationID(),
            siteID: this.getSiteID(),
            siteAreaID: this.getSiteAreaID(),
            companyID: this.getCompanyID(),
            module: MODULE_NAME,
            method: 'onMessage',
            message: `Wrong message type ${messageType}`,
            action: OCPPUtils.buildServerActionFromOcppCommand(command)
          });
      }
    } catch (error) {
      await Logging.logError({
        tenantID: this.tenantID,
        siteID: this.siteID,
        siteAreaID: this.siteAreaID,
        companyID: this.companyID,
        chargingStationID: this.chargingStationID,
        action: OCPPUtils.buildServerActionFromOcppCommand(command),
        message: `${error.message as string}`,
        module: MODULE_NAME, method: 'onMessage',
        detailedMessages: { messageEvent, error: error.stack }
      });
      await this.sendError(messageId, error);
    }
  }

  public getWSConnection(): WebSocket {
    return this.wsConnection;
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

  public async sendMessage(messageId: string, commandParams: Record<string, unknown> | OCPPError, messageType: OCPPMessageType,
      command?: Command): Promise<unknown> {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
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
          messageToSend = JSON.stringify([messageType, messageId, command, commandParams]);
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
        return rejectCallback(`WebSocket closed for Message ID '${messageId}' with content '${messageToSend}' (${this.tenantSubdomain})`);
      }
      // Response?
      if (messageType !== OCPPMessageType.CALL_MESSAGE) {
        // Yes: send Ok
        resolve();
      } else {
        // Send timeout
        setTimeout(() => rejectCallback(`Timeout for Message ID '${messageId}' with content '${messageToSend} (${this.tenantSubdomain})`), Constants.OCPP_SOCKET_TIMEOUT);
      }
    });
  }

  public setChargingStation(chargingStation: ChargingStation): void {
    this.siteID = chargingStation?.siteID;
    this.siteAreaID = chargingStation?.siteAreaID;
    this.companyID = chargingStation?.companyID;
  }

  public getSiteID(): string {
    return this.siteID;
  }

  public getSiteAreaID(): string {
    return this.siteAreaID;
  }

  public getCompanyID(): string {
    return this.companyID;
  }

  public getChargingStationID(): string {
    return this.chargingStationID;
  }

  public getTenantID(): string {
    return this.tenantID;
  }

  public setTenant(tenant: Tenant): void {
    this.tenantID = tenant.id;
    this.tenantSubdomain = tenant.subdomain;
  }

  public getTenant(): Tenant {
    return {
      id: this.tenantID,
      subdomain: this.tenantSubdomain
    } as Tenant;
  }

  public getTokenID(): string {
    return this.tokenID;
  }

  public getID(): string {
    return `${this.getTenantID()}~${this.getChargingStationID()}`;
  }

  public isWSConnectionOpen(): boolean {
    return this.getConnectionStatus() === OPEN;
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

  private checkMandatoryFieldsInRequest(req: http.IncomingMessage) {
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
    // We support previous format like for existing charging station without token also /OCPPxx/TENANTID/CHARGEBOXID
    const splittedURL = this.getURL().split('/');
    if (splittedURL.length !== 4) {
      throw new BackendError({
        module: MODULE_NAME, method: 'checkMandatoryFieldsInRequest',
        message: `OCPP wrong number of arguments in URL connection '${this.url}'`
      });
    }
    // URL /OCPPxx/TENANTID/TOKEN/CHARGEBOXID
    this.tenantID = splittedURL[1];
    this.tokenID = splittedURL[2];
    this.chargingStationID = splittedURL[3];
    // Check parameters
    OCPPUtils.checkChargingStationOcppParameters(
      ServerAction.WS_CONNECTION, this.tenantID, this.chargingStationID, this.tokenID);
  }

  private checkActionInRequest(req: http.IncomingMessage) {
    let action = ServerAction.WS_CONNECTION_OPENED;
    if (req.url.startsWith('/REST')) {
      void Logging.logDebug({
        tenantID: this.tenantID,
        siteID: this.siteID,
        siteAreaID: this.siteAreaID,
        companyID: this.companyID,
        chargingStationID: this.chargingStationID,
        action: action,
        module: MODULE_NAME, method: 'constructor',
        message: `REST service connection to Charging Station with URL: '${req.url}'`,
      });
      action = ServerAction.WS_REST_CONNECTION_OPENED;
    } else if (req.url.startsWith(`/${Utils.getOCPPServerVersionURLPath(OCPPVersion.VERSION_16)}`)) {
      void Logging.logDebug({
        tenantID: this.tenantID,
        siteID: this.siteID,
        siteAreaID: this.siteAreaID,
        companyID: this.companyID,
        chargingStationID: this.chargingStationID,
        action: action,
        module: MODULE_NAME, method: 'constructor',
        message: `Charging Station connection with URL: '${req.url}'`,
      });
      action = ServerAction.WS_JSON_CONNECTION_OPENED;
    } else {
      void Logging.logError({
        tenantID: this.tenantID,
        siteID: this.siteID,
        siteAreaID: this.siteAreaID,
        companyID: this.companyID,
        chargingStationID: this.chargingStationID,
        action: action,
        module: MODULE_NAME, method: 'constructor',
        message: `Unknown connection attempts with URL: '${req.url}'`,
      });
    }
  }

  private async waitForInitialization() {
    // Wait for init
    if (!this.initialized) {
      // Wait for 10 secs max
      let remainingWaitingLoop = 10;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        await Utils.sleep(1000);
        // Check
        if (this.initialized) {
          break;
        }
        // Nbr of trials ended?
        if (remainingWaitingLoop <= 0) {
          throw new BackendError({
            chargingStationID: this.getChargingStationID(),
            module: MODULE_NAME, method: 'waitForInitialization',
            message: 'OCPP Request received before OCPP connection has been completed!'
          });
        }
        // Try another time
        remainingWaitingLoop--;
      }
    }
  }

  public abstract handleRequest(messageId: string, command: Command, commandPayload: Record<string, unknown> | string): Promise<void>;

  public abstract onError(errorEvent: ErrorEvent): void;

  public abstract onClose(closeEvent: CloseEvent): void;
}
