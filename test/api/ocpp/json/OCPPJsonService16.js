const uuid = require('uuid/v4');
const OCPPService = require('../OCPPService');
const WebSocket = require('ws');
const config = require('../../../config');
const {performance} = require('perf_hooks');
const OCPP_JSON_CALL_MESSAGE = 2;

class OCPPJsonService16 extends OCPPService {
  constructor(serverUrl) {
    super(serverUrl);
    this._wsSessions = new Map();
  }

  getVersion() {
    return "1.6";
  }

  openConnection(chargeBoxIdentity) {
    return new Promise((resolve, reject) => {
      // Create WS
      const requests = [];
      const wsConnection = new WebSocket(`${this.serverUrl}/${chargeBoxIdentity}`, {
        protocol: 'ocpp1.6'
      });
      // Opened
      wsConnection.onopen = () => {
        // connection is opened and ready to use
        resolve({connection: wsConnection, requests: requests});
      };
      // Handle Error Message
      wsConnection.onerror = (error) => {
        // An error occurred when sending/receiving data
        console.log("WSError");
        console.log(error);
        reject(error);
      };
      // Handle Server Message
      wsConnection.onmessage = (message) => {
        const t1 = performance.now();
        try {
          // Parse the message
          const messageJson = JSON.parse(message.data);
          // Check if this corresponds to a request
          if (requests[messageJson[1]]) {
            const response = {};
            // Set the data
            response.responseMessageId = messageJson[1];
            response.executionTime = t1 - requests[messageJson[1]].t0;
            response.data = messageJson[2];
            if (config.get('ocpp.json.logs') === 'json') {
              console.log(JSON.stringify(response, null, 2));
            }
            // Respond to the request
            requests[messageJson[1]].resolve(response);
          }
        } catch (error) {
          console.log(`Error occurred when receiving the message ${message.data}`);
          console.error(error);
          reject(error);
        }
      };
    })
  }

  closeConnection() {
    // Close
    if (this._wsSessions) {
      this._wsSessions.forEach(session => session.connection.close());
      this._wsSessions = null;
    }
  }

  executeAuthorize(chargeBoxIdentity, payload) {
    return this._send(chargeBoxIdentity,
      this._buildRequest('Authorize', payload)
    );
  }

  executeStartTransaction(chargeBoxIdentity, payload) {
    return this._send(chargeBoxIdentity,
      this._buildRequest('StartTransaction', payload)
    );
  }

  executeStopTransaction(chargeBoxIdentity, payload) {
    return this._send(chargeBoxIdentity,
      this._buildRequest('StopTransaction', payload)
    );
  }

  executeHeartbeat(chargeBoxIdentity, payload) {
    return this._send(chargeBoxIdentity,
      this._buildRequest('Heartbeat', payload)
    );
  }

  executeMeterValues(chargeBoxIdentity, payload) {
    return this._send(chargeBoxIdentity,
      this._buildRequest('MeterValues', payload)
    );
  }

  executeBootNotification(chargeBoxIdentity, payload) {
    return this._send(chargeBoxIdentity,
      this._buildRequest('BootNotification', payload)
    );
  }

  executeStatusNotification(chargeBoxIdentity, payload) {
    return this._send(chargeBoxIdentity,
      this._buildRequest('StatusNotification', payload)
    );
  }

  executeFirmwareStatusNotification(chargeBoxIdentity, payload) {
    return this._send(chargeBoxIdentity,
      this._buildRequest('FirmwareStatusNotification', payload)
    );
  }

  executeDiagnosticsStatusNotification(chargeBoxIdentity, payload) {
    return this._send(chargeBoxIdentity,
      this._buildRequest('DiagnosticsStatusNotification', payload)
    );
  }

  executeDataTransfer(chargeBoxIdentity, payload) {
    return this._send(chargeBoxIdentity,
      this._buildRequest('DataTransfer', payload)
    );
  }

  async _send(chargeBoxIdentity, request) {

    // WS Opened?
    if (!this._wsSessions.get(chargeBoxIdentity)) {
      // Open WS
      this._wsSessions.set(chargeBoxIdentity, await this.openConnection(chargeBoxIdentity));
    }
    // Log
    if (config.get('ocpp.json.logs') === 'json') {
      console.log(JSON.stringify({requestMessageId: request[1], action: request[2], data: request[3]}, null, 2));
    }
    // Send
    const t0 = performance.now();
    await this._wsSessions.get(chargeBoxIdentity).connection.send(JSON.stringify(request));
    // Return a promise
    return new Promise((resolve, reject) => {
      // Set the resolve function
      this._wsSessions.get(chargeBoxIdentity).requests[request[1]] = {resolve, reject, t0: t0};
    });
  }

  _buildRequest(command, payload) {
    // Build the request
    return [
      OCPP_JSON_CALL_MESSAGE,
      uuid(),
      command,
      payload];
  }
}

module.exports = OCPPJsonService16;