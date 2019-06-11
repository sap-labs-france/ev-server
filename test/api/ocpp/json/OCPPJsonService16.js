const uuid = require('uuid/v4');
const OCPPService = require('../OCPPService');
const WSClient = require('../../../../src/client/WSClient');
const config = require('../../../config');
const { performance } = require('perf_hooks');
const OCPP_JSON_CALL_MESSAGE = 2;
const OCPP_JSON_CALL_RESULT_MESSAGE = 3;

class OCPPJsonService16 extends OCPPService {
  constructor(serverUrl, requestHandler) {
    super(serverUrl);
    this._wsSessions = new Map();
    this.requestHandler = requestHandler;
  }

  getVersion() {
    return "1.6";
  }

  openConnection(chargeBoxIdentity) {
    // eslint-disable-next-line no-undef
    return new Promise((resolve, reject) => {
      // Create WS
      const sentRequests = [];
      const wsClientOptions = {
        protocols: 'ocpp1.6',
        autoReconnectTimeout: config.get('wsClient').autoReconnectTimeout,
        autoReconnectMaxRetries: config.get('wsClient').autoReconnectMaxRetries
      };
      const wsConnection = new WSClient(`${this.serverUrl}/${chargeBoxIdentity}`, wsClientOptions, false);
      // Opened
      wsConnection.onopen = () => {
        // connection is opened and ready to use
        resolve({ connection: wsConnection, requests: sentRequests });
      };
      // Handle Error Message
      wsConnection.onerror = (error) => {
        // An error occurred when sending/receiving data
        reject(error);
      };
      // Handle Server Message
      wsConnection.onmessage = (message) => {
        const t1 = performance.now();
        try {
          // Parse the message
          const messageJson = JSON.parse(message.data);
          // Check if this corresponds to a request
          if (messageJson[0] === OCPP_JSON_CALL_RESULT_MESSAGE && sentRequests[messageJson[1]]) {
            const response = {};
            // Set the data
            response.responseMessageId = messageJson[1];
            response.executionTime = t1 - sentRequests[messageJson[1]].t0;
            response.data = messageJson[2];
            // Respond to the request
            sentRequests[messageJson[1]].resolve(response);
          } else if (messageJson[0] === OCPP_JSON_CALL_MESSAGE) {
            const [messageType, messageId, commandName, commandPayload] = messageJson;
            this.handleRequest(chargeBoxIdentity, messageId, commandName, commandPayload);

          }
        } catch (error) {
          // eslint-disable-next-line no-console
          reject(error);
        }
      };
    });
  }

  async handleRequest(chargeBoxIdentity, messageId, commandName, commandPayload) {
    let result = {};

    if (this.requestHandler && typeof this.requestHandler["handle" + commandName] === 'function') {
      result = await this.requestHandler["handle" + commandName](commandPayload);
    }
    await this._send(chargeBoxIdentity, this._buildResponse(messageId, result));

  }

  closeConnection() {
    // Close
    if (this._wsSessions) {
      this._wsSessions.forEach(session => session.connection.close());
      this._wsSessions = null;
    }
  }

  async executeAuthorize(chargeBoxIdentity, payload) {
    return await this._send(chargeBoxIdentity,
      this._buildRequest('Authorize', payload)
    );
  }

  async executeStartTransaction(chargeBoxIdentity, payload) {
    return await this._send(chargeBoxIdentity,
      this._buildRequest('StartTransaction', payload)
    );
  }

  async executeStopTransaction(chargeBoxIdentity, payload) {
    return await this._send(chargeBoxIdentity,
      this._buildRequest('StopTransaction', payload)
    );
  }

  async executeHeartbeat(chargeBoxIdentity, payload) {
    return await this._send(chargeBoxIdentity,
      this._buildRequest('Heartbeat', payload)
    );
  }

  async executeMeterValues(chargeBoxIdentity, payload) {
    return await this._send(chargeBoxIdentity,
      this._buildRequest('MeterValues', payload)
    );
  }

  async executeBootNotification(chargeBoxIdentity, payload) {
    return await this._send(chargeBoxIdentity,
      this._buildRequest('BootNotification', payload)
    );
  }

  async executeStatusNotification(chargeBoxIdentity, payload) {
    return await this._send(chargeBoxIdentity,
      this._buildRequest('StatusNotification', payload)
    );
  }

  async executeFirmwareStatusNotification(chargeBoxIdentity, payload) {
    return await this._send(chargeBoxIdentity,
      this._buildRequest('FirmwareStatusNotification', payload)
    );
  }

  async executeDiagnosticsStatusNotification(chargeBoxIdentity, payload) {
    return await this._send(chargeBoxIdentity,
      this._buildRequest('DiagnosticsStatusNotification', payload)
    );
  }

  async executeDataTransfer(chargeBoxIdentity, payload) {
    return await this._send(chargeBoxIdentity,
      this._buildRequest('DataTransfer', payload)
    );
  }

  async _send(chargeBoxIdentity, message) {
    // WS Opened?
    if (!this._wsSessions.get(chargeBoxIdentity)) {
      // Open WS
      this._wsSessions.set(chargeBoxIdentity, await this.openConnection(chargeBoxIdentity));
    }
    // Send
    const t0 = performance.now();
    await this._wsSessions.get(chargeBoxIdentity).connection.send(JSON.stringify(message));
    if (message[0] === OCPP_JSON_CALL_MESSAGE) {
      // Return a promise
      return new Promise((resolve, reject) => {
        // Set the resolve function
        this._wsSessions.get(chargeBoxIdentity).requests[message[1]] = { resolve, reject, t0: t0 };
      });
    }
  }

  _buildRequest(command, payload) {
    // Build the request
    return [
      OCPP_JSON_CALL_MESSAGE,
      uuid(),
      command,
      payload];
  }

  _buildResponse(messageId, payload) {
    // Build the request
    return [
      OCPP_JSON_CALL_RESULT_MESSAGE,
      messageId,
      payload];
  }
}

module.exports = OCPPJsonService16;