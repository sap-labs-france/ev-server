const WebSocket = require('ws');
const Constants = require('../utils/Constants');
const Logging = require('../utils/Logging');

const MODULE_NAME = "WSClient";

class WSClient extends WebSocket {
  constructor(url, protocols, options, WSClientConfig, retryCount = null, dbLogging = true) {
    super(url, protocols, options);
    this._protocols = protocols;
    this._options = options;
    this._wsConfig = WSClientConfig;
    if (!retryCount)
      this._autoReconnectRetryCount = 0;
    else
      this._autoReconnectRetryCount = retryCount;
    this._dbLogging = dbLogging;
    this._autoReconnectMaxRetries = WSClientConfig.autoReconnectMaxRetries; // -1 for unlimited retries
    this._autoReconnectInterval = WSClientConfig.autoReconnectInterval * 1000; // ms, 0 to disable
    // Handle Socket open
    this.on('open', this.onOpen.bind(this));
    // Handle Socket error
    this.on('error', this.onError.bind(this));
    // Handle Socket close
    this.on('close', this.onClose.bind(this));
    // Handle Socket send
    this.on('send', this.onSend.bind(this));
  }

  onOpen() {
    this._autoReconnectRetryCount = 0;
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
            message: `Connection refused to '${this.url}': ${error}`
          });
        } else {
          // eslint-disable-next-line no-console
          console.log(`Connection refused to '${this.url}':`, error);
        }
        this._reconnect();
        break;
      default:
        if (this._dbLogging) {
          // Error message
          Logging.logError({
            tenantID: Constants.DEFAULT_TENANT,
            module: MODULE_NAME,
            method: "onError",
            action: "WSClientError",
            message: `Connection error to '${this.url}': ${error}`
          });
        } else {
          // eslint-disable-next-line no-console
          console.log(`Connection error to '${this.url}':`, error);
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
            message: `Connection closing error to '${this.url}': ${error}`
          });
        } else {
          // eslint-disable-next-line no-console
          console.log(`Connection closing error to '${this.url}':`, error);
        }
        this._reconnect();
        break;
    }
  }

  /**
   * Callback function of Web Socket default send() function to ensure an error is returned in
   * case of failure.
   * @param {*} data
   * @param {*} options
   */
  async onSend(data, options) {
    try {
      this.send(data, options);
    } catch (error) {
      this.emit('error', error);
    }
  }

  _reconnect() {
    if (this._autoReconnectInterval !== 0 &&
      (this._autoReconnectRetryCount < this._autoReconnectMaxRetries || this._autoReconnectMaxRetries === -1)) {
      this._autoReconnectRetryCount++;
      setTimeout(() => {
        if (this._dbLogging) {
          // Informational message
          Logging.logInfo({
            tenantID: Constants.DEFAULT_TENANT,
            module: MODULE_NAME,
            method: "_reconnect",
            action: "WSClientInfo",
            message: `Re-connection try #${this._autoReconnectRetryCount} to '${this.url}' each ${this._autoReconnectInterval}ms`
          });
        } else {
          // eslint-disable-next-line no-console
          console.log(`Re-connection try #${this._autoReconnectRetryCount} to '${this.url}' each ${this._autoReconnectInterval}ms`);
        }
        Object.assign(this, new WSClient(this.url, this._protocols, this._options, this._wsConfig, this._autoReconnectRetryCount, this._dbLogging));
      }, this._autoReconnectInterval);
    } else {
      if (this._dbLogging) {
        // Informational message
        Logging.logInfo({
          tenantID: Constants.DEFAULT_TENANT,
          module: MODULE_NAME,
          method: "_reconnect",
          action: "WSClientInfo",
          message: `Re-connection maximum retries reached (${this._autoReconnectRetryCount}) or disabled (${this._autoReconnectInterval}) to '${this.url}'`
        });
      } else {
        // eslint-disable-next-line no-console
        console.log(`Re-connection maximum retries reached (${this._autoReconnectRetryCount}) or disabled (${this._autoReconnectInterval}) to '${this.url}'`);
      }
    }
  }

  isConnectionOpen() {
    return this.readyState === WebSocket.OPEN;
  }
}

module.exports = WSClient;