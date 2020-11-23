import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import { ServerAction } from '../../types/Server';
import Utils from '../../utils/Utils';
import { WSClientOptions } from '../../types/WebSocket';
import WebSocket from 'ws';
import axiosRetry from 'axios-retry';

const MODULE_NAME = 'WSClient';

export default class WSClient {
  public onopen: Function;
  public onerror: Function;
  public onclose: Function;
  public onmessage: Function;
  public onmaximum: Function;
  public onreconnect: Function;
  public readyState: number;
  private url: string;
  private options: WSClientOptions;
  private callbacks: { [key: string]: Function };
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
      onopen: () => { },
      onerror: () => { },
      onclose: () => { },
      onmessage: () => { },
      onreconnect: () => { },
      onmaximum: () => { }
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
    return this.ws.readyState === WebSocket.OPEN;
  }

  private reconnect(error: Error): void {
    if (this.autoReconnectTimeout !== Constants.WS_RECONNECT_DISABLED &&
      (this.autoReconnectRetryCount < this.autoReconnectMaxRetries || this.autoReconnectMaxRetries === Constants.WS_RECONNECT_UNLIMITED)) {
      this.autoReconnectRetryCount++;
      Utils.sleep(axiosRetry.exponentialDelay(this.autoReconnectRetryCount)).catch(() => { });
      setTimeout(() => {
        if (this.dbLogging) {
          // Informational message
          Logging.logInfo({
            tenantID: this.logTenantID,
            module: MODULE_NAME, method: 'reconnect',
            action: ServerAction.WS_CLIENT_INFO,
            message: `Re-connection try #${this.autoReconnectRetryCount} to '${this.url}' with timeout ${this.autoReconnectTimeout}ms`
          });
        } else {
          // eslint-disable-next-line no-console
          console.log(`Re-connection try #${this.autoReconnectRetryCount} to '${this.url}' with timeout ${this.autoReconnectTimeout}ms`);
        }
        this.onreconnect(error);
        this.open();
      }, this.autoReconnectTimeout);
    } else if (this.autoReconnectTimeout !== Constants.WS_RECONNECT_DISABLED || this.autoReconnectMaxRetries !== Constants.WS_RECONNECT_UNLIMITED) {
      if (this.dbLogging) {
        // Informational message
        Logging.logInfo({
          tenantID: this.logTenantID,
          module: MODULE_NAME, method: 'reconnect',
          action: ServerAction.WS_CLIENT_INFO,
          message: `Re-connection maximum retries reached (${this.autoReconnectRetryCount}) or disabled (${this.autoReconnectTimeout}) to '${this.url}'`
        });
      } else {
        // eslint-disable-next-line no-console
        console.log(`Re-connection maximum retries reached (${this.autoReconnectRetryCount}) or disabled (${this.autoReconnectTimeout}) to '${this.url}'`);
      }
      this.onmaximum(error);
    }
  }

  private onOpen() {
    this.autoReconnectRetryCount = 0;
  }

  private reinstantiateCbs() {
    ['onopen', 'onerror', 'onclose', 'onmessage'].forEach((method) => {
      if ('' + this.callbacks[method] !== '' + (() => { })) {
        this.ws[method] = this.callbacks[method];
      }
    });
  }

  private onError(error) {
    switch (error) {
      case 'ECONNREFUSED':
        if (this.dbLogging) {
          // Error message
          Logging.logError({
            tenantID: this.logTenantID,
            module: MODULE_NAME, method: 'onError',
            action: ServerAction.WS_CLIENT_ERROR,
            message: `Connection refused to '${this.url}': ${error}`
          });
        } else {
          // eslint-disable-next-line no-console
          console.log(`Connection refused to '${this.url}':`, error);
        }
        this.reconnect(error);
        break;
      default:
        if (this.dbLogging) {
          if (Utils.isProductionEnv()) {
            // Error message
            Logging.logError({
              tenantID: this.logTenantID,
              module: MODULE_NAME, method: 'onError',
              action: ServerAction.WS_CLIENT_ERROR,
              message: `Connection error to '${this.url}': ${error}`
            });
          }
        } else {
          // eslint-disable-next-line no-console
          console.log(`Connection error to '${this.url}':`, error);
        }
        break;
    }
  }

  private onClose(error) {
    switch (error) {
      case 1000: // Normal close
      case 1005:
        this.autoReconnectRetryCount = 0;
        break;
      default: // Abnormal close
        if (this.dbLogging) {
          if (Utils.isProductionEnv()) {
            // Error message
            Logging.logError({
              tenantID: this.logTenantID,
              module: MODULE_NAME, method: 'onClose',
              action: ServerAction.WS_CLIENT_ERROR,
              message: `Connection closing error to '${this.url}': ${error}`
            });
          }
        } else {
          // eslint-disable-next-line no-console
          console.log(`Connection closing error to '${this.url}':`, error);
        }
        this.reconnect(error);
        break;
    }
  }
}

/**
 * Add the `onopen`, `onerror`, `onclose`, `onmessage`, `onreconnect`
 * and `onmaximum` attributes.
 */
['onopen', 'onerror', 'onclose', 'onmessage'].forEach((method) => {
  Object.defineProperty(WSClient.prototype, method, {
    configurable: true,
    enumerable: true,
    get(): Function {
      return this.ws[method];
    },
    set(callback: Function): void {
      // Save the callback in an object attribute
      this.callbacks[method] = callback;
      this.ws[method] = callback;
    }
  });
});
['onreconnect', 'onmaximum'].forEach((method) => {
  Object.defineProperty(WSClient.prototype, method, {
    configurable: true,
    enumerable: true,
    get(): Function {
      return this.callbacks[method];
    },
    set(callback: Function): void {
      this.callbacks[method] = callback;
    }
  });
});

/**
 * Add some ws properties
 */
[
  'binaryType',
  'bufferedAmount',
  'extensions',
  'protocol',
  'readyState'
].forEach((property) => {
  Object.defineProperty(WSClient.prototype, property, {
    enumerable: true,
    get() {
      return this.ws[property];
    }
  });
});

