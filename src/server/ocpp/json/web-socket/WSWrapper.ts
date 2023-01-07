import { queueAsPromised } from 'fastq';
import { RecognizedString, WebSocket } from 'uWebSockets.js';

import Utils from '../../../../utils/Utils';
import { Task } from '../JsonOCPPServer';
import WSConnection from './WSConnection';
import { WSServerProtocol } from '../../../../types/Server';
import { WebSocketAction } from '../../../../types/WebSocket';

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
  private ws: WebSocket;
  private q: queueAsPromised<Task>;


  public constructor(ws: WebSocket, queue: queueAsPromised<Task>) {
    this.guid = Utils.generateShortNonUniqueID();
    this.ws = ws;
    this.url = ws.url;
    this.remoteAddress = Utils.convertBufferArrayToString(ws.getRemoteAddressAsText()).toString();
    this.firstConnectionDate = new Date();
    this.nbrPingFailed = 0;
    this.closed = false;
    this.q = queue;
  }

  public send(message: RecognizedString, isBinary?: boolean, compress?: boolean): boolean {
    this.checkWSClosed(WebSocketAction.MESSAGE);
    return this.ws.send(message, isBinary, compress) === 1;
  }

  public close(code: number, shortMessage: RecognizedString): void {
    if (!this.closed) {
      this.closed = true;
      this.ws.end(code, shortMessage);
    }
  }

  public getQueue() :queueAsPromised<Task> {
    return this.q;
  }


  public ping(message?: RecognizedString) : boolean {
    this.checkWSClosed(WebSocketAction.PING);
    return this.ws.ping(message) === 1;
  }

  public getRemoteAddress(): string {
    return this.remoteAddress;
  }

  private checkWSClosed(wsAction: WebSocketAction): void {
    if (this.closed) {
      throw new Error(`${wsAction} > WS Connection ID '${this.guid}' is already closed ('${this.url}'), cannot perform action`);
    }
  }
}
