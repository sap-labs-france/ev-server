const WebSocket = require('ws');
const Constants = require('../utils/Constants');
const Logging = require('../utils/Logging');

const MODULE_NAME = "WSClient";

class WSClient {
  /**
   * Create a new `WSClient`.
   *
   * @param {String|url.URL} url
   * @param {Object} options
   * @param {Number} options.autoReconnectTimeout must be an integer
   * @param {Number} options.autoReconnectMaxRetries must be an integer
   * @param {String|String[]} options.protocols
   * @param {Object} options.WSOptions
   * @param {Boolean} dbLogging
   */
  constructor(url, options, dbLogging = true) {
    this._url = url;
    this._options = options || {};
    this._callbacks = {
      onopen: () => { },
      onerror: () => { },
      onclose: () => { },
      onmessage: () => { },
      onreconnect: () => { },
      onmaximum: () => { }
    };
    this._dbLogging = dbLogging;
    this._autoReconnectRetryCount = 0;
    this._autoReconnectMaxRetries = options.autoReconnectMaxRetries; // -1 for unlimited retries
    this._autoReconnectTimeout = options.autoReconnectTimeout * 1000; // ms, 0 to disable
    this.open();
  }

  get CONNECTING() {
    return WebSocket.CONNECTING;
  }
  get CLOSING() {
    return WebSocket.CLOSING;
  }
  get CLOSED() {
    return WebSocket.CLOSED;
  }
  get OPEN() {
    return WebSocket.OPEN;
  }

  onOpen() {
    this._autoReconnectRetryCount = 0;
  }

  /**
   * Reinstantiate callbacks.
   *
   * @private
   */
  _reinstantiateCbs() {
    ['onopen', 'onerror', 'onclose', 'onmessage'].forEach((method) => {
      if ('' + this._callbacks[method] !== '' + (() => { }))
        this._ws[method] = this._callbacks[method];
    });
  }

  onError(error) {
    switch (error.code) {
      case 'ECONNREFUSED':
        if (this._dbLogging) {
          // Error message
          Logging.logError({
            tenantID: Constants.DEFAULT_TENANT,
            module: MODULE_NAME,
            method: "onError",
            action: "WSClientError",
            message: `Connection refused to '${this._url}': ${error}`
          });
        } else {
          // eslint-disable-next-line no-console
          console.log(`Connection refused to '${this._url}':`, error);
        }
        this.reconnect();
        break;
      default:
        if (this._dbLogging) {
          // Error message
          Logging.logError({
            tenantID: Constants.DEFAULT_TENANT,
            module: MODULE_NAME,
            method: "onError",
            action: "WSClientError",
            message: `Connection error to '${this._url}': ${error}`
          });
        } else {
          // eslint-disable-next-line no-console
          console.log(`Connection error to '${this._url}':`, error);
        }
        break;
    }
  }

  onClose(error) {
    switch (error.code) {
      case 1000: // Normal close
        this._autoReconnectRetryCount = 0;
        break;
      default: // Abnormal close
        if (this._dbLogging) {
          // Error message
          Logging.logError({
            tenantID: Constants.DEFAULT_TENANT,
            module: MODULE_NAME,
            method: "onClose",
            action: "WSClientError",
            message: `Connection closing error to '${this._url}': ${error}`
          });
        } else {
          // eslint-disable-next-line no-console
          console.log(`Connection closing error to '${this._url}':`, error);
        }
        this.reconnect();
        break;
    }
  }

  /**
   * Open the web socket.
   *
   * @public
   */
  open() {
    this._ws = new WebSocket(this._url, this._options.protocols || [], this._options.WSOptions || {});
    // Handle Socket open
    this._ws.on('open', this.onOpen.bind(this));
    // Handle Socket error
    this._ws.on('error', this.onError.bind(this));
    // Handle Socket close
    this._ws.on('close', this.onClose.bind(this));
    // A new WS have just been created, reinstantiate the saved callbacks on it
    this._reinstantiateCbs();
  }

  /**
   * Reconnect the web socket.
   *
   * @param {Error} error
   * @public
   */
  reconnect(error) {
    if (this._autoReconnectTimeout !== 0 &&
      (this._autoReconnectRetryCount < this._autoReconnectMaxRetries || this._autoReconnectMaxRetries === -1)) {
      this._autoReconnectRetryCount++;
      setTimeout(() => {
        if (this._dbLogging) {
          // Informational message
          Logging.logInfo({
            tenantID: Constants.DEFAULT_TENANT,
            module: MODULE_NAME,
            method: "reconnect",
            action: "WSClientInfo",
            message: `Re-connection try #${this._autoReconnectRetryCount} to '${this._url}' with timeout ${this._autoReconnectTimeout}ms`
          });
        } else {
          // eslint-disable-next-line no-console
          console.log(`Re-connection try #${this._autoReconnectRetryCount} to '${this._url}' with timeout ${this._autoReconnectTimeout}ms`);
        }
        this.onreconnect(error);
        this.open();
      }, this._autoReconnectTimeout);
    } else if (this._autoReconnectTimeout !== 0 || this._autoReconnectMaxRetries !== -1) {
      if (this._dbLogging) {
        // Informational message
        Logging.logInfo({
          tenantID: Constants.DEFAULT_TENANT,
          module: MODULE_NAME,
          method: "reconnect",
          action: "WSClientInfo",
          message: `Re-connection maximum retries reached (${this._autoReconnectRetryCount}) or disabled (${this._autoReconnectTimeout}) to '${this._url}'`
        });
      } else {
        // eslint-disable-next-line no-console
        console.log(`Re-connection maximum retries reached (${this._autoReconnectRetryCount}) or disabled (${this._autoReconnectTimeout}) to '${this._url}'`);
      }
      this.onmaximum(error);
    }
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
  send(data, options, callback) {
    this._ws.send(data, options, callback);
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
  close(code, reason) {
    return this._ws.close(code, reason);
  }

  /**
   * Send a ping.
   *
   * @param {*} data The data to send
   * @param {Boolean} mask Indicates whether or not to mask `data`
   * @param {Function} cb Callback which is executed when the ping is sent
   * @public
   */
  ping(data, mask, callback) {
    this._ws.ping(data, mask, callback);
  }

  /**
   * Send a pong.
   *
   * @param {*} data The data to send
   * @param {Boolean} mask Indicates whether or not to mask `data`
   * @param {Function} cb Callback which is executed when the pong is sent
   * @public
   */
  pong(data, mask, callback) {
    this._ws.pong(data, mask, callback);
  }

  /**
   * Forcibly close the connection.
   *
   * @public
   */
  terminate() {
    return this._ws.terminate();
  }

  isConnectionOpen() {
    return this._ws.readyState === WebSocket.OPEN;
  }
}

/**
 * Add the `onopen`, `onerror`, `onclose`, `onmessage`, `onreconnect`
 * and `onmaximum` attributes.
 */
['onopen', 'onerror', 'onclose', 'onmessage'].forEach((method) => {
  Object.defineProperty(WSClient.prototype, method, {
    get() {
      return this._ws[method];
    },
    set(callback) {
      // Save the callback in an object attribute
      this._callbacks[method] = callback;
      this._ws[method] = callback;
    }
  });
});
['onreconnect', 'onmaximum'].forEach((method) => {
  Object.defineProperty(WSClient.prototype, method, {
    get() {
      return this._callbacks[method];
    },
    set(callback) {
      this._callbacks[method] = callback;
    }
  });
});

/**
 * Add `readyState` property
 */
Object.defineProperty(WSClient.prototype, 'readyState', {
  get() {
    return this._ws.readyState;
  }
});

module.exports = WSClient;