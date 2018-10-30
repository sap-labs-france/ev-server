const uuid = require('uuid/v4');
const OCPPService = require('../OCPPService');
const WebSocket = require('ws');
const config = require('../../../config');

const OCPP_JSON_CALL_MESSAGE = 2;
class OCPPJsonService16 extends OCPPService {
  constructor(serverUrl) {
    super(serverUrl);
    this._wsConnection = null;
    this._requests = {};
  }

  getVersion() {
    return "1.6";
  }

  openConnection(tenantID, chargeBoxIdentity) {
    return new Promise((resolve, reject) => {
      // Create WS
      this._wsConnection = new WebSocket(`${this.serverUrl}/${tenantID}/${chargeBoxIdentity}`, {
        protocol: 'ocpp1.6'
      });
      // Opened
      this._wsConnection.onopen = () => {
        // connection is opened and ready to use
        resolve();
      };
      // Handle Error Message
      this._wsConnection.onerror = (error) => {
        // An error occurred when sending/receiving data
        console.log("WSError");
        console.log(error);
      };
      // Handle Server Message
      this._wsConnection.onmessage = (message) => {
        try {
          // Parse the message 
          const messageJson = JSON.parse(message.data);
          // Check if this corresponds to a request
          if (this._requests[messageJson[1]]) {
            const response = {};
            // Set the data
            response.data = messageJson[2];
            // Respond to the request
            this._requests[messageJson[1]].resolve(response);
          }
        } catch (error) {
          console.log(`Error occurred when receiving the message ${message.data}`);
          console.error(error);
        }
      };
    })
  }

  closeConnection() {
    // Close
    if (this._wsConnection) {
      this._wsConnection.close();
      this._wsConnection = null;
    }
  }

  executeAuthorize(tenantID, chargeBoxIdentity, payload) {
    return this._send(tenantID, chargeBoxIdentity,
      this._buildRequest('Authorize', payload)
    );
  }

  executeStartTransaction(tenantID, chargeBoxIdentity, payload) {
    return this._send(tenantID, chargeBoxIdentity,
      this._buildRequest('StartTransaction', payload)
    );
  }

  executeStopTransaction(tenantID, chargeBoxIdentity, payload) {
    return this._send(tenantID, chargeBoxIdentity,
      this._buildRequest('StopTransaction', payload)
    );
  }

  executeHeartbeat(tenantID, chargeBoxIdentity, payload) {
    return this._send(tenantID, chargeBoxIdentity,
      this._buildRequest('Heartbeat', payload)
    );
  }

  executeMeterValues(tenantID, chargeBoxIdentity, payload) {
    return this._send(tenantID, chargeBoxIdentity,
      this._buildRequest('MeterValues', payload)
    );
  }

  executeBootNotification(tenantID, chargeBoxIdentity, payload) {
    return this._send(tenantID, chargeBoxIdentity,
      this._buildRequest('BootNotification', payload)
    );
  }

  executeStatusNotification(tenantID, chargeBoxIdentity, payload) {
    return this._send(tenantID, chargeBoxIdentity,
      this._buildRequest('StatusNotification', payload)
    );
  }

  executeFirmwareStatusNotification(tenantID, chargeBoxIdentity, payload) {
    return this._send(tenantID, chargeBoxIdentity,
      this._buildRequest('FirmwareStatusNotification', payload)
    );
  }

  executeDiagnosticsStatusNotification(tenantID, chargeBoxIdentity, payload) {
    return this._send(tenantID, chargeBoxIdentity,
      this._buildRequest('DiagnosticsStatusNotification', payload)
    );
  }

  executeDataTransfer(tenantID, chargeBoxIdentity, payload) {
    return this._send(tenantID, chargeBoxIdentity,
      this._buildRequest('DataTransfer', payload)
    );
  }

  async _send(tenantID, chargeBoxIdentity, request) {
    // WS Opened?
    if (!this._wsConnection) {
      // Open WS
      await this.openConnection(tenantID, chargeBoxIdentity);
    }
    // Log
    if (config.get('ocpp.json.logs') === 'json') {
      console.log(request);
    }
    // Send
    await this._wsConnection.send(JSON.stringify(request));
    // Return a promise
    return new Promise((resolve, reject) => {
      // Set the resolve function
      this._requests[request[1]] = { resolve, reject };
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