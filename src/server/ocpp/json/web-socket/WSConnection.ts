/* eslint-disable @typescript-eslint/member-ordering */
import ChargingStation, { Command } from '../../../../types/ChargingStation';
import { FctOCPPReject, FctOCPPResponse, OCPPErrorType, OCPPIncomingRequest, OCPPIncomingResponse, OCPPMessageType, OCPPPayload } from '../../../../types/ocpp/OCPPCommon';
import { ServerAction, WSServerProtocol } from '../../../../types/Server';

import BackendError from '../../../../exception/BackendError';
import Constants from '../../../../utils/Constants';
import Logging from '../../../../utils/Logging';
import LoggingHelper from '../../../../utils/LoggingHelper';
import OCPPError from '../../../../exception/OcppError';
import OCPPUtils from '../../utils/OCPPUtils';
import Tenant from '../../../../types/Tenant';
import Utils from '../../../../utils/Utils';
import WSWrapper from './WSWrapper';

const MODULE_NAME = 'WSConnection';

export class OcppPendingCommand {
  private command: Command;
  private resolveCallback: FctOCPPResponse;
  private rejectCallback: FctOCPPReject;
  private timer: NodeJS.Timeout;

  public constructor(command: Command, resolveCallback: FctOCPPResponse, rejectCallback: FctOCPPReject, timer: NodeJS.Timeout) {
    this.command = command;
    this.resolveCallback = resolveCallback;
    this.rejectCallback = rejectCallback;
    this.timer = timer;
  }

  public getCommand(): Command {
    return this.command;
  }

  public resolve(payload: Record<string, unknown> | string): void {
    this.clearTimer();
    this.resolveCallback(payload);
  }

  public reject(error: OCPPError): void {
    this.clearTimer();
    this.rejectCallback(error);
  }

  private clearTimer() {
    const timer = this.timer;
    if (timer) {
      this.timer = null;
      clearTimeout(timer);
    }
  }
}

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
  private originalURL: string;
  private wsWrapper: WSWrapper;
  private pendingOcppCommands: Record<string, OcppPendingCommand> = {};

  public constructor(wsWrapper: WSWrapper) {
    // Init
    this.url = wsWrapper.url.trim().replace(/\b(\?|&).*/, ''); // Filter trailing URL parameters
    this.originalURL = wsWrapper.url;
    this.wsWrapper = wsWrapper;
    // Check mandatory fields
    this.checkMandatoryFieldsInRequest();
  }

  public async initialize(): Promise<void> {
    // Do not update the lastSeen when the caller is the REST server!
    const updateChargingStationData = (this.wsWrapper.protocol !== WSServerProtocol.REST);
    // Check and Get Charging Station data
    const { tenant, chargingStation } = await OCPPUtils.checkAndGetChargingStationConnectionData(
      ServerAction.WS_SERVER_CONNECTION,
      this.getTenantID(),
      this.getChargingStationID(), this.getTokenID(),
      updateChargingStationData);
    // Set
    this.setTenant(tenant);
    this.setChargingStation(chargingStation);
    this.wsWrapper.setConnection(this);
  }

  public sendResponse(messageID: string, command: Command, initialPayload: OCPPPayload, response: OCPPPayload): void {
    // Build Message
    const messageType = OCPPMessageType.CALL_RESULT_MESSAGE;
    const messageToSend = JSON.stringify([messageType, messageID, response]);
    Utils.isDevelopmentEnv() && Logging.logConsoleDebug(`Send Response ${messageToSend} for '${this.wsWrapper.url }'`);
    this.sendMessageInternal(messageToSend, command, initialPayload);
  }

  public sendError(messageID: string,
      initialCommand: Command,
      initialPayload: OCPPPayload,
      error: any): void {
    // Build Error Message
    const messageType = OCPPMessageType.CALL_ERROR_MESSAGE;
    const errorCode = error.code ?? OCPPErrorType.GENERIC_ERROR;
    const errorMessage = error.message ? error.message : '';
    const errorDetail = error.details ? error.details : {};
    const messageToSend = JSON.stringify([messageType, messageID, errorCode, errorMessage, errorDetail]);
    Utils.isDevelopmentEnv() && Logging.logConsoleDebug(`Send Error ${messageToSend} for '${this.wsWrapper.url}'`);
    this.sendMessageInternal(messageToSend, initialCommand, initialPayload);
  }

  public async sendMessageAndWaitForResult(messageID: string, command: Command, dataToSend: OCPPPayload): Promise<unknown> {
    // Create a pending promise
    const pendingPromise = new Promise((resolve, reject) => {
      // Send the message to the charging station
      const messageType = OCPPMessageType.CALL_MESSAGE;
      const messageToSend = JSON.stringify([messageType, messageID, command, dataToSend]);
      // Function that will receive the request's response
      const responseCallback = (payload?: OCPPPayload | string): void => {
        resolve(payload);
      };
      // Function that will receive the request's rejection
      const rejectCallback = (error: OCPPError): void => {
        reject(error);
      };
      // Make sure to reject automatically if we do not receive anything after 10 seconds
      const timeout = setTimeout(() => {
        // Remove it from the cache
        this.consumePendingOcppCommands(messageID);
        // Send some feedback
        const timeoutError = new Error(`Timeout after ${Constants.OCPP_SOCKET_TIMEOUT_MILLIS / 1000} secs for Message ID '${messageID}' with content '${messageToSend} - (${this.tenantSubdomain})`);
        reject(timeoutError);
      }, Constants.OCPP_SOCKET_TIMEOUT_MILLIS);
      // Let's send it
      Utils.isDevelopmentEnv() && Logging.logConsoleDebug(`Send Message ${messageToSend} for '${this.wsWrapper.url }'`);
      // Keep track of the pending promise
      this.pendingOcppCommands[messageID] = new OcppPendingCommand(command, responseCallback, rejectCallback, timeout);
      // Send the message
      if (!this.sendMessageInternal(messageToSend)) {
        // Well - we have not been able to send the message - Remove the pending promise from the cache
        this.consumePendingOcppCommands(messageID);
        // send some feedback
        const unexpectedError = new Error(`Unexpected situation - Failed to send Message ID '${messageID}' with content '${messageToSend} - (${this.tenantSubdomain})`);
        reject(unexpectedError);
      }
    });
    // This promise is pending and will be resolved as soon as we get a response/error from the charging station
    return pendingPromise;
  }

  private sendMessageInternal(
      messageToSend: string,
      initialCommand: Command = null,
      initialCommandPayload: OCPPPayload = null): boolean {
    let sent = false ;
    try {
      // Send Message
      if (this.wsWrapper.send(messageToSend, initialCommand, initialCommandPayload)) {
        sent = true;
      } else {
        // Not always an error with uWebSocket: check BackPressure example
        const message = `Error when sending error '${messageToSend}' to Web Socket`;
        void Logging.logError({
          tenantID: this.tenantID,
          chargingStationID: this.chargingStationID,
          companyID: this.companyID,
          siteID: this.siteID,
          siteAreaID: this.siteAreaID,
          module: MODULE_NAME, method: 'sendError',
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
        module: MODULE_NAME, method: 'sendPayload',
        action: ServerAction.WS_SERVER_CONNECTION_ERROR,
        message, detailedMessages: { message: messageToSend, error: wsError?.stack }
      });
      Utils.isDevelopmentEnv() && Logging.logConsoleError(message);
    }
    return sent;
  }

  public async handleIncomingOcppMessage(wsWrapper: WSWrapper, ocppMessage: OCPPIncomingRequest|OCPPIncomingResponse): Promise<void> {
    const ocppMessageType = ocppMessage[0];
    try {
      if (ocppMessageType === OCPPMessageType.CALL_MESSAGE) {
        await wsWrapper.wsConnection.handleIncomingOcppRequest(wsWrapper, ocppMessage as OCPPIncomingRequest);
      } else if (ocppMessageType === OCPPMessageType.CALL_RESULT_MESSAGE) {
        wsWrapper.wsConnection.handleIncomingOcppResponse(ocppMessage as OCPPIncomingResponse);
      } else if (ocppMessageType === OCPPMessageType.CALL_ERROR_MESSAGE) {
        wsWrapper.wsConnection.handleIncomingOcppError(ocppMessage as OCPPIncomingResponse);
      } else {
        Logging.beError()?.log({
          tenantID: this.tenantID,
          siteID: this.siteID,
          siteAreaID: this.siteAreaID,
          companyID: this.companyID,
          chargingStationID: this.chargingStationID,
          action: ServerAction.UNKNOWN_ACTION,
          message: `Wrong OCPP Message Type in '${JSON.stringify(ocppMessage)}'`,
          module: MODULE_NAME, method: 'handleIncomingOcppMessage',
        });
      }
    } catch (error) {
      Logging.beError()?.log({
        tenantID: this.tenantID,
        siteID: this.siteID,
        siteAreaID: this.siteAreaID,
        companyID: this.companyID,
        chargingStationID: this.chargingStationID,
        action: ServerAction.UNKNOWN_ACTION,
        message: `${error.message as string}`,
        module: MODULE_NAME, method: 'handleIncomingOcppMessage',
        detailedMessages: { data: JSON.stringify(ocppMessage), error: error.stack }
      });
    }
  }

  public async handleIncomingOcppRequest(wsWrapper: WSWrapper, ocppMessage: OCPPIncomingRequest): Promise<void> {
    if (wsWrapper.closed || !wsWrapper.isValid) {
      return;
    }
    // Parse the data
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [messageType, messageID, command, commandPayload] = ocppMessage;
    try {
      // Process the call
      const result = await this.handleRequest(command, commandPayload);
      // Send Response
      this.sendResponse(messageID, command, commandPayload, result as Record<string, unknown>);
    } catch (error) {
      // Send Error Response
      this.sendError(messageID, command, commandPayload, error);
      Logging.beError()?.log({
        tenantID: this.tenantID,
        siteID: this.siteID,
        siteAreaID: this.siteAreaID,
        companyID: this.companyID,
        chargingStationID: this.chargingStationID,
        action: OCPPUtils.buildServerActionFromOcppCommand(command),
        message: `${error.message as string}`,
        module: MODULE_NAME, method: 'handleIncomingOcppRequest',
        detailedMessages: { data: ocppMessage, error: error.stack }
      });
    }
  }

  private consumePendingOcppCommands(messageID: string) {
    const pendingOcppCommand = this.pendingOcppCommands[messageID];
    if (pendingOcppCommand) {
      // It can be consumed only once - so we remove it from the cache
      delete this.pendingOcppCommands[messageID];
    }
    return pendingOcppCommand;
  }

  public handleIncomingOcppResponse(ocppMessage: OCPPIncomingResponse): void {
    let done = false;
    // Parse the data
    const [messageType, messageID, commandPayload] = ocppMessage as OCPPIncomingResponse;
    // Consume the pending OCPP command matching the current OCPP error?
    const ocppPendingCommand = this.consumePendingOcppCommands(messageID);
    if (ocppPendingCommand) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      ocppPendingCommand.resolve(commandPayload);
      done = true;
    }
    if (!done) {
      // No OCPP request found ???
      // Is there anything to cleanup?
      throw new BackendError({
        ...LoggingHelper.getWSConnectionProperties(this),
        module: MODULE_NAME, method: 'handleIncomingOcppResponse',
        message: `OCPP Request not found for a response to messageID: '${messageID}'`,
        detailedMessages: { messageType, messageID, commandPayload }
      });
    }
  }

  public handleIncomingOcppError(ocppMessage: OCPPIncomingResponse): void {
    let done = false;
    const [messageType, messageID, commandPayload, errorDetails] = ocppMessage;
    // Consume the pending OCPP command matching the current OCPP error?
    const ocppPendingCommand = this.consumePendingOcppCommands(messageID);
    if (ocppPendingCommand) {
      ocppPendingCommand.reject(new OCPPError({
        ...LoggingHelper.getWSConnectionProperties(this),
        module: MODULE_NAME, method: 'onMessage',
        code: ocppPendingCommand.getCommand(),
        message: JSON.stringify(ocppMessage),
      }));
      done = true;
    }
    if (!done) {
      // No OCPP request found ???
      // Is there anything to cleanup?
      throw new BackendError({
        ...LoggingHelper.getWSConnectionProperties(this),
        module: MODULE_NAME, method: 'handleIncomingOcppError',
        message: `OCPP Request not found for an error response to messageID: '${messageID}'`,
        detailedMessages: { messageType, messageID, commandPayload, errorDetails }
      });
    }
  }

  public getWS(): WSWrapper {
    return this.wsWrapper;
  }

  public getURL(): string {
    return this.url;
  }

  public getOriginalURL(): string {
    return this.originalURL;
  }

  public getClientIP(): string | string[] {
    return this.wsWrapper.getRemoteAddress();
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
    this.tenant = tenant;
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

  public getPendingOccpCommands(): Record<string, OcppPendingCommand> {
    return this.pendingOcppCommands;
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
    // We support previous format like for existing charging station without token also /OCPPxx/TENANTID/CHARGEBOXID
    const splittedURL = this.getURL().split('/');
    if (splittedURL.length !== 4) {
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

  public abstract onPing(message: string): void;

  public abstract onPong(message: string): void;

  public abstract updateChargingStationRuntimeData(): Promise<void>;

}
