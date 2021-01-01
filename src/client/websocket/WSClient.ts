import { WSClientOptions, WebSocketCloseEventStatusCode } from '../../types/WebSocket';

import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import { ServerAction } from '../../types/Server';
import Utils from '../../utils/Utils';
import WebSocket from 'ws';
import axiosRetry from 'axios-retry';

const MODULE_NAME = 'WSClient';

export default class WSClient {
  public onopen: (...args: any[]) => void;
  public onerror: (...args: any[]) => void;
  public onclose: (...args: any[]) => void;
  public onmessage: (...args: any[]) => void;
  public onmaximum: (err: Error) => void;
  public onreconnect: (err: Error) => void;
  private url: string;
  private options: WSClientOptions;
  private callbacks: { [key: string]: (...args: any[]) => void };
  private dbLogging: boolean;
  private autoReconnectRetryCount: number;
  private autoReconnectMaxRetries: number;
  private autoReconnectTimeout: number;
  private logTenantID: string;
  private ws: WebSocket;

  public constructor(url: string, options: WSClientOptions, dbLogging = true) {
    this.url = url;
    this.options = options || {} as WSClientOptions;
    this.callbacks = {
      'onopen': () => { },
      'onerror': () => { },
      'onclose': () => { },
      'onmessage': () => { },
      'onreconnect': () => { },
      'onmaximum': () => { }
    };
    this.dbLogging = dbLogging;
    this.autoReconnectRetryCount = 0;
    this.autoReconnectMaxRetries = options.autoReconnectMaxRetries; // -1 for unlimited retries
    this.autoReconnectTimeout = options.autoReconnectTimeout * 1000; // Ms, 0 to disable
    this.logTenantID = options.logTenantID ? options.logTenantID : Constants.DEFAULT_TENANT;
    this.open();
  }

  public open(): void {
    this.ws = new WebSocket(this.url, this.options.protocols || [], this.options.WSOptions || {});
    // Handle Socket open
    this.ws.on('open', this.onOpen.bind(this));
    // Handle Socket error
    this.ws.on('error', this.onError.bind(this));
    // Handle Socket close
    this.ws.on('close', this.onClose.bind(this));
    // A new WS have just been created, re-instantiate the saved callbacks on it
    this.reinstantiateCbs();
  }

  /**
   * Send a data message.
   *
   * @param {*} data The message to send
   * @param {Object} options Options object
   * @param {Boolean} options.compress Specifies whether or not to compress `data`
   * @param {Boolean} options.binary Specifies whether `data` is binary or text
   * @param {Boolean} options.fin Specifies whether the fragment is the last one
   * @param {Boolean} options.mask Specifies whether or not to mask `data`
   * @param {Function} cb Callback which is executed when data is written out
   * @public
   */
  public send(data, options?: { mask?: boolean; binary?: boolean; compress?: boolean; fin?: boolean }, callback?: (err?: Error) => void): void {
    this.ws.send(data, options, callback);
  }

  /**
   * Start a closing handshake.
   *
   *          +----------+   +-----------+   +----------+
   *     - - -|ws.close()|-->|close frame|-->|ws.close()|- - -
   *    |     +----------+   +-----------+   +----------+     |
   *          +----------+   +-----------+         |
   * CLOSING  |ws.close()|<--|close frame|<--+-----+       CLOSING
   *          +----------+   +-----------+   |
   *    |           |                        |   +---+        |
   *                +------------------------+-->|fin| - - - -
   *    |         +---+                      |   +---+
   *     - - - - -|fin|<---------------------+
   *              +---+
   *
   * @param {Number} code Status code explaining why the connection is closing
   * @param {String} data A string explaining why the connection is closing
   * @public
   */
  public close(code?: number, reason?: string): void {
    return this.ws.close(code, reason);
  }

  /**
   * Send a ping.
   *
   * @param {*} data The data to send
   * @param {Boolean} mask Indicates whether or not to mask `data`
   * @param {Function} cb Callback which is executed when the ping is sent
   * @public
   */
  public ping(data?, mask?: boolean, callback?: (err: Error) => void): void {
    this.ws.ping(data, mask, callback);
  }

  /**
   * Send a pong.
   *
   * @param {*} data The data to send
   * @param {Boolean} mask Indicates whether or not to mask `data`
   * @param {Function} cb Callback which is executed when the pong is sent
   * @public
   */
  public pong(data?, mask?, callback?: (err: Error) => void): void {
    this.ws.pong(data, mask, callback);
  }

  /**
   * Forcibly close the connection.
   *
   * @public
   */
  public terminate(): void {
    return this.ws.terminate();
  }

  public isConnectionOpen(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private reconnect(error: Error): void {
    if (this.autoReconnectTimeout !== Constants.WS_RECONNECT_DISABLED &&
      (this.autoReconnectRetryCount < this.autoReconnectMaxRetries || this.autoReconnectMaxRetries === Constants.WS_RECONNECT_UNLIMITED)) {
      this.autoReconnectRetryCount++;
      Utils.sleep(axiosRetry.exponentialDelay(this.autoReconnectRetryCount)).catch(() => { });
      setTimeout(() => {
        // Informational message
        if (this.dbLogging) {
          Logging.logInfo({
            tenantID: this.logTenantID,
            module: MODULE_NAME, method: 'reconnect',
            action: ServerAction.WS_CLIENT_INFO,
            message: `Reconnection try #${this.autoReconnectRetryCount} to '${this.url}' with timeout ${this.autoReconnectTimeout}ms`
          });
        } else {
          // eslint-disable-next-line no-console
          console.log(`WSClient reconnection try #${this.autoReconnectRetryCount} to '${this.url}' with timeout ${this.autoReconnectTimeout}ms`);
        }
        this.onreconnect(error);
        this.open();
      }, this.autoReconnectTimeout);
    } else if (this.autoReconnectTimeout !== Constants.WS_RECONNECT_DISABLED || this.autoReconnectMaxRetries !== Constants.WS_RECONNECT_UNLIMITED) {
      // Informational message
      if (this.dbLogging) {
        Logging.logInfo({
          tenantID: this.logTenantID,
          module: MODULE_NAME, method: 'reconnect',
          action: ServerAction.WS_CLIENT_INFO,
          message: `Reconnection maximum retries reached (${this.autoReconnectRetryCount}) or disabled (${this.autoReconnectTimeout}) to '${this.url}'`
        });
      } else {
        // eslint-disable-next-line no-console
        console.log(`WSClient reconnection maximum retries reached (${this.autoReconnectRetryCount}) or disabled (${this.autoReconnectTimeout}) to '${this.url}'`);
      }
      this.onmaximum(error);
    }
  }

  private onOpen() {
    this.autoReconnectRetryCount = 0;
  }

  private reinstantiateCbs() {
    for (const method of ['onopen', 'onerror', 'onclose', 'onmessage']) {
      if (this.callbacks[method].toString() !== (() => { }).toString()) {
        this.ws[method] = this.callbacks[method];
      }
    }
  }

  private onError(error: Error) {
    switch (error.toString()) {
      case 'ECONNREFUSED':
        // Error message
        if (this.dbLogging) {
          Logging.logError({
            tenantID: this.logTenantID,
            module: MODULE_NAME, method: 'onError',
            action: ServerAction.WS_CLIENT_ERROR,
            message: `Connection refused to '${this.url}': ${error}`,
            detailedMessages: { error }
          });
        } else {
          // eslint-disable-next-line no-console
          console.error(`WSClient connection refused to '${this.url}':`, error);
        }
        // pragma this.reconnect(error);
        break;
      default:
        // Error message
        if (this.dbLogging) {
          Logging.logError({
            tenantID: this.logTenantID,
            module: MODULE_NAME, method: 'onError',
            action: ServerAction.WS_CLIENT_ERROR,
            message: `Connection error to '${this.url}': ${error}`,
            detailedMessages: { error }
          });
        } else {
          // eslint-disable-next-line no-console
          console.error(`WSClient connection error to '${this.url}':`, error);
        }
        break;
    }
  }

  private onClose(code: number, reason: string) {
    switch (code) {
      case WebSocketCloseEventStatusCode.CLOSE_NORMAL: // Normal close
      case WebSocketCloseEventStatusCode.CLOSE_NO_STATUS:
        // Informational message
        if (this.dbLogging) {
          Logging.logInfo({
            tenantID: this.logTenantID,
            module: MODULE_NAME, method: 'onClose',
            action: ServerAction.WS_CLIENT_INFO,
            message: `Connection closing to '${this.url}', Reason: '${reason ? reason : 'No reason given'}', Message: '${Utils.getWebSocketCloseEventStatusString(code)}', Code: '${code}'`
          });
        } else {
          // eslint-disable-next-line no-console
          console.log(`WSClient connection closing to '${this.url}', Reason: '${reason ? reason : 'No reason given'}', Message: '${Utils.getWebSocketCloseEventStatusString(code)}', Code: '${code}'`);
        }
        this.autoReconnectRetryCount = 0;
        break;
      default: // Abnormal close
        // Error message
        if (this.dbLogging) {
          Logging.logError({
            tenantID: this.logTenantID,
            module: MODULE_NAME, method: 'onClose',
            action: ServerAction.WS_CLIENT_ERROR,
            message: `Connection closing error to '${this.url}', Reason: '${reason ? reason : 'No reason given'}', Message: '${Utils.getWebSocketCloseEventStatusString(code)}', Code: '${code}'`
          });
        } else {
          // eslint-disable-next-line no-console
          console.error(`WSClient Connection closing error to '${this.url}', Reason: '${reason ? reason : 'No reason given'}', Message: '${Utils.getWebSocketCloseEventStatusString(code)}', Code: '${code}'`);
        }
        this.reconnect(new Error(`Connection has been closed abnormally, Reason: '${reason ? reason : 'No reason given'}', Message: '${Utils.getWebSocketCloseEventStatusString(code)}', Code: '${code}'`));
        break;
    }
  }
}

/**
 * Add the `onopen`, `onerror`, `onclose`, `onmessage`, `onreconnect`
 * and `onmaximum` attributes.
 */
for (const method of ['onopen', 'onerror', 'onclose', 'onmessage']) {
  Object.defineProperty(WSClient.prototype, method, {
    configurable: true,
    enumerable: true,
    get(): (...args: any[]) => void {
      return this.ws[method];
    },
    set(callback: (...args: any[]) => void): void {
      // Save the callback in an object attribute
      this.callbacks[method] = callback;
      this.ws[method] = callback;
    }
  });
}
for (const method of ['onreconnect', 'onmaximum']) {
  Object.defineProperty(WSClient.prototype, method, {
    configurable: true,
    enumerable: true,
    get(): (...args: any[]) => void {
      return this.callbacks[method];
    },
    set(callback: (...args: any[]) => void): void {
      this.callbacks[method] = callback;
    }
  });
}

/**
 * Add some ws properties
 */
for (const property of ['binaryType', 'bufferedAmount', 'extensions', 'protocol', 'readyState']) {
  Object.defineProperty(WSClient.prototype, property, {
    enumerable: true,
    get() {
      return this.ws[property];
    }
  });
}
