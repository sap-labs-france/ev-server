import ChargingStation, { Command } from '../../../../types/ChargingStation';
import { FctOCPPReject, FctOCPPResponse, OCPPErrorType, OCPPIncomingRequest, OCPPIncomingResponse, OCPPMessageType, OCPPRequest } from '../../../../types/ocpp/OCPPCommon';
import { ServerAction, WSServerProtocol } from '../../../../types/Server';

import BackendError from '../../../../exception/BackendError';
import Constants from '../../../../utils/Constants';
import Logging from '../../../../utils/Logging';
import OCPPError from '../../../../exception/OcppError';
import OCPPUtils from '../../utils/OCPPUtils';
import Tenant from '../../../../types/Tenant';
import Utils from '../../../../utils/Utils';
import WSWrapper from './WSWrapper';

const MODULE_NAME = 'WSConnection';

export default abstract class WSConnection {
  private siteID: string;
  private siteAreaID: string;
  private companyID: string;
  private chargingStationID: string;
  private tenantID: string;
  private tenant: Tenant;
  private tenantSubdomain: string;
  private tokenID: string;
  private url: string;
  private clientIP: string | string[];
  private ws: WSWrapper;
  private ocppRequests: Record<string, OCPPRequest> = {};

  public constructor(ws: WSWrapper) {
    // Init
    this.url = ws.url.trim().replace(/\b(\?|&).*/, ''); // Filter trailing URL parameters
    this.ws = ws;
    this.clientIP = ws.getRemoteAddress();
    // Check mandatory fields
    this.checkMandatoryFieldsInRequest();
  }

  public async initialize(): Promise<void> {
    // Do not update the lastSeen when the caller is the REST server!
    const updateChargingStationData = (this.ws.protocol !== WSServerProtocol.REST);
    // Check and Get Charging Station data
    const { tenant, chargingStation } = await OCPPUtils.checkAndGetChargingStationConnectionData(
      ServerAction.WS_SERVER_CONNECTION,
      this.getTenantID(),
      this.getChargingStationID(), this.getTokenID(),
      updateChargingStationData);
    // Set
    this.setTenant(tenant);
    this.setChargingStation(chargingStation);
  }

  public async sendResponse(messageID: string, command: Command, response: Record<string, any>): Promise<Record<string, any>> {
    return this.sendMessage(messageID, OCPPMessageType.CALL_RESULT_MESSAGE, command, response);
  }

  public async sendError(messageID: string, error: OCPPError): Promise<unknown> {
    return this.sendMessage(messageID, OCPPMessageType.CALL_ERROR_MESSAGE, null, null, error);
  }

  public async sendMessage(messageID: string, messageType: OCPPMessageType, command?: Command, data?: Record<string, any>, error?: OCPPError): Promise<unknown> {
    // Create a promise
    return new Promise((resolve, reject) => {
      let messageToSend: string;
      let messageProcessed = false;
      let requestTimeout: NodeJS.Timer;
      // Function that will receive the request's response
      const responseCallback = (payload?: Record<string, unknown> | string): void => {
        if (!messageProcessed) {
          if (requestTimeout) {
            clearTimeout(requestTimeout);
          }
          // Send response
          messageProcessed = true;
          delete this.ocppRequests[messageID];
          resolve(payload);
        }
      };
      // Function that will receive the request's rejection
      const rejectCallback = (reason: string | OCPPError): void => {
        if (!messageProcessed) {
          if (requestTimeout) {
            clearTimeout(requestTimeout);
          }
          // Send error
          messageProcessed = true;
          delete this.ocppRequests[messageID];
          const ocppError = reason instanceof OCPPError ? reason : new Error(reason);
          reject(ocppError);
        }
      };
      // Type of message
      switch (messageType) {
        // Request
        case OCPPMessageType.CALL_MESSAGE:
          // Store Promise callback
          this.ocppRequests[messageID] = [responseCallback, rejectCallback, command];
          // Build request
          messageToSend = JSON.stringify([messageType, messageID, command, data]);
          break;
        // Response
        case OCPPMessageType.CALL_RESULT_MESSAGE:
          // Build response
          messageToSend = JSON.stringify([messageType, messageID, data]);
          break;
        // Error Message
        case OCPPMessageType.CALL_ERROR_MESSAGE:
          // Build Error Message
          messageToSend = JSON.stringify([messageType, messageID, error.code ?? OCPPErrorType.GENERIC_ERROR, error.message ? error.message : '', error.details ? error.details : {}]);
          break;
      }
      Utils.isDevelopmentEnv() && Logging.logConsoleDebug(`Send Message ${messageToSend} for '${this.ws.url }'`);
      try {
        // Send Message
        if (!this.ws.send(messageToSend)) {
          // Not always an error with uWebSocket: check BackPressure example
          const message = `Error when sending message '${messageToSend}' to Web Socket`;
          void Logging.logError({
            tenantID: this.tenantID,
            chargingStationID: this.chargingStationID,
            companyID: this.companyID,
            siteID: this.siteID,
            siteAreaID: this.siteAreaID,
            module: MODULE_NAME, method: 'sendMessage',
            action: ServerAction.WS_SERVER_CONNECTION_ERROR,
            message, detailedMessages: { message: messageToSend }
          });
          Utils.isDevelopmentEnv() && Logging.logConsoleError(message);
        }
      } catch (wsError) {
        // Invalid Web Socket
        const message = `Error when sending message '${messageToSend}' to Web Socket: ${wsError?.message as string}`;
        void Logging.logError({
          tenantID: this.tenantID,
          chargingStationID: this.chargingStationID,
          companyID: this.companyID,
          siteID: this.siteID,
          siteAreaID: this.siteAreaID,
          module: MODULE_NAME, method: 'sendMessage',
          action: ServerAction.WS_SERVER_CONNECTION_ERROR,
          message, detailedMessages: { message: messageToSend, error: wsError?.stack }
        });
        Utils.isDevelopmentEnv() && Logging.logConsoleError(message);
      }
      // Response?
      if (messageType !== OCPPMessageType.CALL_MESSAGE) {
        responseCallback();
      } else {
        // Trigger timeout
        requestTimeout = setTimeout(() => {
          rejectCallback(`Timeout after ${Constants.OCPP_SOCKET_TIMEOUT_MILLIS / 1000} secs for Message ID '${messageID}' with content '${messageToSend} (${this.tenantSubdomain})`);
        }, Constants.OCPP_SOCKET_TIMEOUT_MILLIS);
      }
    });
  }

  public async receivedMessage(message: string, isBinary: boolean): Promise<void> {
    let responseCallback: FctOCPPResponse;
    let rejectCallback: FctOCPPReject;
    let command: Command, commandPayload: Record<string, any>, errorDetails: Record<string, any>;
    // Parse the data
    const ocppMessage: OCPPIncomingRequest|OCPPIncomingResponse = JSON.parse(message);
    const [messageType, messageID] = ocppMessage;
    let result: any;
    try {
      // Check the Type of message
      switch (messageType) {
        // Received Ocpp Request
        case OCPPMessageType.CALL_MESSAGE:
          // Get the data
          [,,command,commandPayload] = ocppMessage as OCPPIncomingRequest;
          try {
            // Process the call
            result = await this.handleRequest(command, commandPayload);
          } catch (error) {
            // Send Error Response
            await this.sendError(messageID, error);
            throw error;
          }
          // Send Response
          await this.sendResponse(messageID, command, result);
          break;
        // Response to an OCPP Request
        case OCPPMessageType.CALL_RESULT_MESSAGE:
          // Get the data
          [,,commandPayload] = ocppMessage as OCPPIncomingResponse;
          // Respond
          if (Array.isArray(this.ocppRequests[messageID])) {
            [responseCallback,,command] = this.ocppRequests[messageID];
          }
          if (!responseCallback) {
            throw new BackendError({
              chargingStationID: this.getChargingStationID(),
              siteID: this.getSiteID(),
              siteAreaID: this.getSiteAreaID(),
              companyID: this.getCompanyID(),
              module: MODULE_NAME, method: 'onMessage',
              message: `Unknown OCPP Request: '${message.toString()}'`,
            });
          }
          responseCallback(commandPayload);
          break;
        // Error Response to an OCPP Request
        case OCPPMessageType.CALL_ERROR_MESSAGE:
          [,,commandPayload,errorDetails] = ocppMessage as OCPPIncomingResponse;
          if (Array.isArray(this.ocppRequests[messageID])) {
            [,rejectCallback,command] = this.ocppRequests[messageID];
          }
          if (!rejectCallback) {
            throw new BackendError({
              chargingStationID: this.getChargingStationID(),
              siteID: this.getSiteID(),
              siteAreaID: this.getSiteAreaID(),
              companyID: this.getCompanyID(),
              module: MODULE_NAME, method: 'onMessage',
              message: `Unknown OCPP Request: '${message.toString()}'`,
              detailedMessages: { messageType, messageID, commandPayload, errorDetails }
            });
          }
          rejectCallback(new OCPPError({
            chargingStationID: this.getChargingStationID(),
            siteID: this.getSiteID(),
            siteAreaID: this.getSiteAreaID(),
            companyID: this.getCompanyID(),
            module: MODULE_NAME, method: 'onMessage',
            code: command,
            message: message.toString(),
          }));
          break;
        default:
          throw new BackendError({
            chargingStationID: this.getChargingStationID(),
            siteID: this.getSiteID(),
            siteAreaID: this.getSiteAreaID(),
            companyID: this.getCompanyID(),
            action: OCPPUtils.buildServerActionFromOcppCommand(command),
            module: MODULE_NAME, method: 'onMessage',
            message: `Wrong OCPP Message Type '${messageType as string}' for '${message.toString()}'`,
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
        detailedMessages: { data: message, error: error.stack }
      });
    }
  }

  public getWS(): WSWrapper {
    return this.ws;
  }

  public getURL(): string {
    return this.url;
  }

  public getClientIP(): string | string[] {
    return this.clientIP;
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
    // Keep the minimum
    this.tenant = {
      id: this.tenantID,
      subdomain: this.tenantSubdomain
    } as Tenant;
  }

  public getTenant(): Tenant {
    return this.tenant;
  }

  public getTokenID(): string {
    return this.tokenID;
  }

  public getID(): string {
    return `${this.getTenantID()}~${this.getChargingStationID()}`;
  }

  public getCurrentOcppRequests(): Record<string, OCPPRequest> {
    return this.ocppRequests;
  }

  private checkMandatoryFieldsInRequest() {
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
    // Note in order to override the CS name the url would look like /OCPPxx/TENANTID/TOKEN/<DESIRED-CHARGEBOXID>/CHARGEBOXID
    const splittedURL = this.getURL().split('/');
    if (splittedURL.length < 4) {
      throw new BackendError({
        module: MODULE_NAME, method: 'checkMandatoryFieldsInRequest',
        message: `Wrong number of arguments in URL '/${this.url}'`
      });
    }
    // URL /OCPPxx/TENANTID/TOKEN/CHARGEBOXID
    this.tenantID = splittedURL[1];
    this.tokenID = splittedURL[2];
    this.chargingStationID = splittedURL[3];
    // Check parameters
    OCPPUtils.checkChargingStationConnectionData(
      ServerAction.WS_SERVER_CONNECTION, this.tenantID, this.tokenID, this.chargingStationID);
  }

  public abstract handleRequest(command: Command, commandPayload: Record<string, unknown> | string): Promise<any>;

  public abstract onPing(message: string): Promise<void>;

  public abstract onPong(message: string): Promise<void>;
}
