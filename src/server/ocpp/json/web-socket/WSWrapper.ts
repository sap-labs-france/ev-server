import { RecognizedString, WebSocket } from 'uWebSockets.js';
import { ServerAction, WSServerProtocol } from '../../../../types/Server';

import { Command } from '../../../../types/ChargingStation';
import Constants from '../../../../utils/Constants';
import Logging from '../../../../utils/Logging';
import LoggingHelper from '../../../../utils/LoggingHelper';
import Utils from '../../../../utils/Utils';
import WSConnection from './WSConnection';
import { WebSocketAction } from '../../../../types/WebSocket';

const MODULE_NAME = 'WSWrapper';

export default class WSWrapper {
  public key: string;
  public guid: string;
  public siteID: string;
  public siteAreaID: string;
  public companyID: string;
  public chargingStationID: string;
  public tenantID: string;
  public tokenID: string;
  public url: string;
  public clientIP: string | string[];
  public closed: boolean;
  public protocol: WSServerProtocol;
  public wsConnection: WSConnection;
  public remoteAddress: string;
  public firstConnectionDate: Date;
  public nbrPingFailed: number;
  public lastPingDate: Date;
  public lastPongDate: Date;
  public isValid: boolean;

  private ws: WebSocket;

  public constructor(ws: WebSocket) {
    this.ws = ws;
    this.url = ws.url;
    this.remoteAddress = Utils.convertBufferArrayToString(ws.getRemoteAddressAsText()).toString();
    this.guid = Utils.generateShortNonUniqueID();
    this.firstConnectionDate = new Date();
    this.nbrPingFailed = 0;
    this.closed = false;
    this.isValid = false;
    if (this.url.startsWith('/OCPP16')) {
      this.protocol = WSServerProtocol.OCPP16;
    }
    if (this.url.startsWith('/REST')) {
      this.protocol = WSServerProtocol.REST;
    }
  }

  public send(messageToSend: RecognizedString, command: Command, commandPayload?: Record<string, any>, isBinary?: boolean, compress?: boolean): boolean {
    this.canSendMessage(WebSocketAction.MESSAGE, messageToSend as string, command, commandPayload);
    const returnedCode = this.ws.send(messageToSend, isBinary, compress);
    // Return a boolean in production
    if (typeof returnedCode === 'boolean') {
      return returnedCode;
    }
    // Handle back pressure
    if (returnedCode !== 1) {
      void Logging.logWarning({
        ...LoggingHelper.getWSWrapperProperties(this),
        tenantID: Constants.DEFAULT_TENANT_ID,
        action: ServerAction.WS_SERVER_MESSAGE,
        module: MODULE_NAME, method: 'send',
        message: `WS Message returned a backpressure code '${returnedCode}'`,
        detailedMessages: {
          message: messageToSend,
          returnedCode,
          wsWrapper: this.toJson()
        }
      });
    }
    return true;
  }

  public close(code: number, shortMessage: RecognizedString): void {
    if (!this.closed) {
      this.closed = true;
      if (this.ws) {
        try {
          // Close WS
          this.ws.end(code, shortMessage);
        } catch (error) {
          // Do nothing
        }
      }
    }
  }

  public ping(message: RecognizedString) : boolean {
    this.canSendMessage(WebSocketAction.PING, message as string);
    const returnedCode = this.ws.ping(message);
    // Return a boolean in production
    if (typeof returnedCode === 'boolean') {
      return returnedCode;
    }
    // Handle back pressure
    if (returnedCode !== 1) {
      void Logging.logWarning({
        ...LoggingHelper.getWSWrapperProperties(this),
        tenantID: Constants.DEFAULT_TENANT_ID,
        action: ServerAction.WS_SERVER_CONNECTION_PING,
        module: MODULE_NAME, method: 'ping',
        message: `WS Ping returned a backpressure code '${returnedCode}'`,
        detailedMessages: {
          message,
          returnedCode,
          wsWrapper: this.toJson()
        }
      });
    }
    return true;
  }

  public getRemoteAddress(): string {
    return this.remoteAddress;
  }

  public toJson(): Record<string, any> {
    return {
      key: this.key,
      guid: this.guid,
      nbrPingFailed: this.nbrPingFailed,
      siteID: this.siteID,
      siteAreaID: this.siteAreaID,
      companyID: this.companyID,
      chargingStationID: this.chargingStationID,
      tenantID: this.tenantID,
      tokenID: this.tokenID,
      url: this.url,
      clientIP: this.clientIP,
      closed: this.closed,
      protocol: this.protocol,
      remoteAddress: this.remoteAddress,
      firstConnectionDate: this.firstConnectionDate,
      durationSecs: Utils.computeTimeDurationSecs(new Date(this.firstConnectionDate).getTime()),
      lastPingDate: this.lastPingDate,
      lastPongDate: this.lastPongDate,
    };
  }

  private canSendMessage(wsAction: WebSocketAction, messageToSend: string, command?: Command, commandPayload?: Record<string, any>): void {
    if (this.closed) {
      throw new Error(`'${wsAction}' > Cannot send message '${messageToSend}', initial command '${command ?? 'N/A'}', command payload '${commandPayload ? JSON.stringify(commandPayload) : 'N/A'}'), WS Connection ID '${this.guid}' is already closed ('${this.url}')`);
    }
  }
}
