import { RecognizedString, WebSocket } from 'uWebSockets.js';
import { ServerAction, WSServerProtocol } from '../../../../types/Server';

import { Command } from '../../../../types/ChargingStation';
import Constants from '../../../../utils/Constants';
import Logging from '../../../../utils/Logging';
import LoggingHelper from '../../../../utils/LoggingHelper';
import { OCPPPayload } from '../../../../types/ocpp/OCPPCommon';
import Utils from '../../../../utils/Utils';
import WSConnection from './WSConnection';
import { WebSocketAction } from '../../../../types/WebSocket';

const MODULE_NAME = 'WSWrapper';

export default class WSWrapper {
  public guid: string;
  public tokenID: string;
  public url: string;
  public clientIP: string | string[];
  public closed: boolean;
  public protocol: WSServerProtocol;
  public remoteAddress: string;
  public wsConnection: WSConnection;
  public firstConnectionDate: Date;
  public nbrPingFailed: number;
  public lastMessageDate: Date;
  public lastPingDate: Date;
  public lastPongDate: Date;
  public isValid: boolean;

  private ws: WebSocket;

  public constructor(url: string) {
    this.url = url;
    this.guid = Utils.generateShortNonUniqueID();
    this.firstConnectionDate = new Date();
    this.nbrPingFailed = 0;
    this.closed = false;
    this.isValid = false;
    if (this.url.startsWith('/OCPP16')) {
      this.protocol = WSServerProtocol.OCPP16;
    } else if (this.url.startsWith('/REST')) {
      this.protocol = WSServerProtocol.REST;
    }
  }

  public setWebSocket(ws: WebSocket) {
    this.ws = ws;
    this.remoteAddress = Utils.convertBufferArrayToString(ws.getRemoteAddressAsText()).toString();
    this.isValid = true;
  }

  public setConnection(wsConnection: WSConnection) {
    this.wsConnection = wsConnection;
    this.isValid = true;
  }

  public send(messageToSend: string, initialCommand: Command, initialCommandPayload?: OCPPPayload, isBinary?: boolean, compress?: boolean): boolean {
    this.canSendMessage(WebSocketAction.MESSAGE, messageToSend, initialCommand, initialCommandPayload);
    const returnedCode = this.ws.send(messageToSend, isBinary, compress);
    // Return a boolean in production
    if (typeof returnedCode === 'boolean') {
      return returnedCode;
    }
    // Handle back pressure
    if (returnedCode !== 1) {
      Logging.beWarning()?.log({
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
      // Local ref to the Web Socket
      const ws = this.ws;
      if (ws) {
        try {
          // Clear the reference to the WebSocket!
          this.ws = null;
          // Close WS
          ws.end(code, shortMessage);
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
      Logging.beWarning()?.log({
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
      key: this.wsConnection?.getID(),
      guid: this.guid,
      nbrPingFailed: this.nbrPingFailed,
      ...LoggingHelper.getWSConnectionProperties(this.wsConnection),
      tokenID: this.tokenID,
      url: this.url,
      clientIP: this.clientIP,
      closed: this.closed,
      protocol: this.protocol,
      remoteAddress: this.remoteAddress,
      firstConnectionDate: this.firstConnectionDate,
      durationSecs: Utils.computeTimeDurationSecs(new Date(this.firstConnectionDate).getTime()),
      lastMessageDate: this.lastMessageDate,
      lastPingDate: this.lastPingDate,
      lastPongDate: this.lastPongDate,
    };
  }

  private canSendMessage(wsAction: WebSocketAction, messageToSend: string, initialCommand?: Command, initialCommandPayload?: OCPPPayload): void {
    if (this.closed) {
      if (initialCommand && initialCommandPayload) {
        throw new Error(`'${wsAction}' > Cannot send message '${messageToSend}', initial command '${initialCommand}', command payload '${JSON.stringify(initialCommandPayload)}', WS Connection ID '${this.guid}' is already closed ('${this.url}')`);
      } else {
        throw new Error(`'${wsAction}' > Cannot send message '${messageToSend}', WS Connection ID '${this.guid}' is already closed ('${this.url}')`);
      }
    }
  }
}
