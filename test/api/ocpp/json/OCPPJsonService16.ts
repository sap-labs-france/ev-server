import config from '../../../config';
import { performance } from 'perf_hooks';
import uuid from 'uuid/v4';
import OCPPService from '../OCPPService';
import WSClient from '../../../../src/client/WSClient';

const OCPP_JSON_CALL_MESSAGE = 2;
const OCPP_JSON_CALL_RESULT_MESSAGE = 3;

export default class OCPPJsonService16 extends OCPPService {
  private _wsSessions: any;
  private requestHandler: any;

  public constructor(serverUrl, requestHandler) {
    super(serverUrl);
    this._wsSessions = new Map();
    this.requestHandler = requestHandler;
  }

  public getVersion() {
    return '1.6';
  }

  public async openConnection(chargeBoxIdentity){
    return await new Promise((resolve, reject) => {
      // Create WS
      const sentRequests = {};
      const wsClientOptions = {
        protocols: 'ocpp1.6',
        autoReconnectTimeout: config.get('wsClient').autoReconnectTimeout,
        autoReconnectMaxRetries: config.get('wsClient').autoReconnectMaxRetries
      };
      const wsConnection = new WSClient(`${this.serverUrl}/${chargeBoxIdentity}`, wsClientOptions, false);
      // Opened
      wsConnection.onopen = () => {
        // Connection is opened and ready to use
        resolve({ connection: wsConnection, requests: sentRequests });
      };
      // Handle Error Message
      wsConnection.onerror = (error) => {
        // An error occurred when sending/receiving data
        reject(error);
      };
      wsConnection.onclose = (error) => {
        for (const property in sentRequests) {
          sentRequests[property].reject(error);
        }
        reject(error);
      };
      wsConnection.onmaximum = (error) => {
        reject(error);
      };
      // Handle Server Message
      wsConnection.onmessage = async (message) => {
        const t1 = performance.now();
        try {
          // Parse the message
          const messageJson = JSON.parse(message.data);
          // Check if this corresponds to a request
          if (messageJson[0] === OCPP_JSON_CALL_RESULT_MESSAGE && sentRequests[messageJson[1]]) {
            const response: any = {};
            // Set the data
            response.responseMessageId = messageJson[1];
            response.executionTime = t1 - sentRequests[messageJson[1]].t0;
            response.data = messageJson[2];
            // Respond to the request
            sentRequests[messageJson[1]].resolve(response);
          } else if (messageJson[0] === OCPP_JSON_CALL_MESSAGE) {
            const [messageType, messageId, commandName, commandPayload] = messageJson;
            await this.handleRequest(chargeBoxIdentity, messageId, commandName, commandPayload);
          }
        } catch (error) {
          reject(error);
        }
      };
    });
  }

  public async handleRequest(chargeBoxIdentity, messageId, commandName, commandPayload) {
    let result = {};

    if (this.requestHandler && typeof this.requestHandler['handle' + commandName] === 'function') {
      result = await this.requestHandler['handle' + commandName](commandPayload);
    }
    await this._send(chargeBoxIdentity, this._buildResponse(messageId, result));
  }

  public closeConnection() {
    // Close
    if (this._wsSessions) {
      this._wsSessions.forEach((session) => session.connection.close());
      this._wsSessions = null;
    }
  }

  public async executeAuthorize(chargeBoxIdentity, payload) {
    return await this._send(chargeBoxIdentity,
      this._buildRequest('Authorize', payload)
    );
  }

  public async executeStartTransaction(chargeBoxIdentity, payload) {
    return await this._send(chargeBoxIdentity,
      this._buildRequest('StartTransaction', payload)
    );
  }

  public async executeStopTransaction(chargeBoxIdentity, payload) {
    return await this._send(chargeBoxIdentity,
      this._buildRequest('StopTransaction', payload)
    );
  }

  public async executeHeartbeat(chargeBoxIdentity, payload) {
    return await this._send(chargeBoxIdentity,
      this._buildRequest('Heartbeat', payload)
    );
  }

  public async executeMeterValues(chargeBoxIdentity, payload) {
    return await this._send(chargeBoxIdentity,
      this._buildRequest('MeterValues', payload)
    );
  }

  public async executeBootNotification(chargeBoxIdentity, payload) {
    return await this._send(chargeBoxIdentity,
      this._buildRequest('BootNotification', payload)
    );
  }

  public async executeStatusNotification(chargeBoxIdentity, payload) {
    return await this._send(chargeBoxIdentity,
      this._buildRequest('StatusNotification', payload)
    );
  }

  public async executeFirmwareStatusNotification(chargeBoxIdentity, payload) {
    return await this._send(chargeBoxIdentity,
      this._buildRequest('FirmwareStatusNotification', payload)
    );
  }

  public async executeDiagnosticsStatusNotification(chargeBoxIdentity, payload) {
    return await this._send(chargeBoxIdentity,
      this._buildRequest('DiagnosticsStatusNotification', payload)
    );
  }

  public async executeDataTransfer(chargeBoxIdentity, payload) {
    return await this._send(chargeBoxIdentity,
      this._buildRequest('DataTransfer', payload)
    );
  }

  private async _send(chargeBoxIdentity, message): Promise<any> {
    // WS Opened?
    if (!this._wsSessions.get(chargeBoxIdentity)) {
      // Open WS
      const ws = await this.openConnection(chargeBoxIdentity);
      this._wsSessions.set(chargeBoxIdentity, ws);
    }
    // Send
    const t0 = performance.now();
    this._wsSessions.get(chargeBoxIdentity).connection.send(JSON.stringify(message), {}, (error?: Error) => {
      console.log(`Sending error to '${chargeBoxIdentity}', error '${JSON.stringify(error)}', message: '${JSON.stringify(message)}'`);
    });
    if (message[0] === OCPP_JSON_CALL_MESSAGE) {
      // Return a promise
      return await new Promise((resolve, reject) => {
        // Set the resolve function
        this._wsSessions.get(chargeBoxIdentity).requests[message[1]] = { resolve, reject, t0: t0 };
      });
    }
  }

  private _buildRequest(command, payload) {
    // Build the request
    return [
      OCPP_JSON_CALL_MESSAGE,
      uuid(),
      command,
      payload];
  }

  private _buildResponse(messageId, payload) {
    // Build the request
    return [
      OCPP_JSON_CALL_RESULT_MESSAGE,
      messageId,
      payload];
  }
}
