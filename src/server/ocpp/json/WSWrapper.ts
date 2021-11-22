import { RecognizedString, WebSocket } from 'uWebSockets.js';

import JsonRestWSConnection from './JsonRestWSConnection';
import JsonWSConnection from './JsonWSConnection';
import Utils from '../../../utils/Utils';

export default class WSWrapper {
  public key: string;
  public siteID: string;
  public siteAreaID: string;
  public companyID: string;
  public chargingStationID: string;
  public tenantID: string;
  public tokenID: string;
  public url: string;
  public clientIP: string | string[];
  public closed: boolean;
  public protocol: string;
  public jsonWSConnection: JsonWSConnection;
  public jsonRestWSConnection: JsonRestWSConnection;
  public remoteAddress: string;
  public firstConnectionDate: Date;
  public lastPingDate: Date;
  public lastPongDate: Date;

  private ws: WebSocket;

  constructor(ws: WebSocket) {
    this.ws = ws;
    this.url = ws.url;
    this.remoteAddress = Utils.convertBufferArrayToString(ws.getRemoteAddressAsText()).toString();
    this.firstConnectionDate = new Date();
  }

  public send(message: RecognizedString, isBinary?: boolean, compress?: boolean): boolean {
    this.checkWSClosed();
    return this.ws.send(message, isBinary, compress);
  }

  public getBufferedAmount() : number {
    this.checkWSClosed();
    return this.ws.getBufferedAmount();
  }

  public close(code: number, shortMessage: RecognizedString): void {
    if (!this.closed) {
      this.closed = true;
      try {
        this.ws.end(code, shortMessage);
      } catch (error) {
        console.log(`Error closing ${error?.message as string}`);
      }
    }
  }

  public ping(message?: RecognizedString) : boolean {
    this.checkWSClosed();
    return this.ws.ping(message);
  }

  public getRemoteAddress(): string {
    return this.remoteAddress;
  }

  private checkWSClosed(): void {
    if (this.closed) {
      throw new Error(`WS Comnection - Closed: '${this.ws.url as string}'`);
    }
  }
}
