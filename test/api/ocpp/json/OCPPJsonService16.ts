import { MessageType, WSClientOptions } from '../../../../src/types/WebSocket';
import { OCPP15MeterValuesRequest, OCPPAuthorizeRequest, OCPPAuthorizeResponse, OCPPBootNotificationRequest, OCPPBootNotificationResponse, OCPPDataTransferRequest, OCPPDataTransferResponse, OCPPDiagnosticsStatusNotificationRequest, OCPPDiagnosticsStatusNotificationResponse, OCPPFirmwareStatusNotificationRequest, OCPPFirmwareStatusNotificationResponse, OCPPHeartbeatRequest, OCPPHeartbeatResponse, OCPPMeterValuesRequest, OCPPMeterValuesResponse, OCPPStartTransactionRequest, OCPPStartTransactionResponse, OCPPStatusNotificationRequest, OCPPStatusNotificationResponse, OCPPStopTransactionRequest, OCPPStopTransactionResponse, OCPPVersion } from '../../../../src/types/ocpp/OCPPServer';

import OCPPService from '../OCPPService';
import Utils from '../../../../src/utils/Utils';
import WSClient from '../../../../src/client/websocket/WSClient';
import config from '../../../config';
import { performance } from 'perf_hooks';

export default class OCPPJsonService16 extends OCPPService {
  private wsSessions: Map<string, any>;
  private requestHandler: any;

  public constructor(serverUrl, requestHandler) {
    super(serverUrl);
    // eslint-disable-next-line no-undef
    this.wsSessions = new Map();
    this.requestHandler = requestHandler;
  }

  public getVersion(): OCPPVersion {
    return OCPPVersion.VERSION_16;
  }

  public async openConnection(chargeBoxIdentity: string) {
    // eslint-disable-next-line no-undef
    return new Promise((resolve, reject) => {
      // Create WS
      const sentRequests = {};
      const wsClientOptions: WSClientOptions = {
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
          if (messageJson[0] === MessageType.CALL_RESULT_MESSAGE && sentRequests[messageJson[1]]) {
            const response: any = {};
            // Set the data
            response.responseMessageId = messageJson[1];
            response.executionTime = t1 - sentRequests[messageJson[1]].t0;
            response.data = messageJson[2];
            // Respond to the request
            sentRequests[messageJson[1]].resolve(response);
          } else if (messageJson[0] === MessageType.CALL_MESSAGE) {
            const [messageType, messageId, commandName, commandPayload] = messageJson;
            await this.handleRequest(chargeBoxIdentity, messageId, commandName, commandPayload);
          }
        } catch (error) {
          reject(error);
        }
      };
    });
  }

  public async handleRequest(chargeBoxIdentity, messageId, commandName, commandPayload): Promise<void> {
    let result = {};
    if (this.requestHandler && typeof this.requestHandler['handle' + commandName] === 'function') {
      result = await this.requestHandler['handle' + commandName](commandPayload);
    }
    await this.send(chargeBoxIdentity, this.buildResponse(messageId, result));
  }

  public closeConnection(): void {
    // Close
    if (this.wsSessions) {
      this.wsSessions.forEach((session) => session.connection.close());
      this.wsSessions = null;
    }
  }

  public async executeAuthorize(chargingStationID: string, authorize: OCPPAuthorizeRequest): Promise<OCPPAuthorizeResponse> {
    const response = await this.send(chargingStationID, this.buildRequest('Authorize', authorize));
    return response.data;
  }

  public async executeStartTransaction(chargingStationID: string, startTransaction: OCPPStartTransactionRequest): Promise<OCPPStartTransactionResponse> {
    const response = await this.send(chargingStationID, this.buildRequest('StartTransaction', startTransaction));
    return response.data;
  }

  public async executeStopTransaction(chargingStationID: string, stopTransaction: OCPPStopTransactionRequest): Promise<OCPPStopTransactionResponse> {
    const response = await this.send(chargingStationID, this.buildRequest('StopTransaction', stopTransaction));
    return response.data;
  }

  public async executeHeartbeat(chargingStationID: string, heartbeat: OCPPHeartbeatRequest): Promise<OCPPHeartbeatResponse> {
    const response = await this.send(chargingStationID, this.buildRequest('Heartbeat', heartbeat));
    return response.data;
  }

  public async executeMeterValues(chargingStationID: string, meterValue: OCPPMeterValuesRequest|OCPP15MeterValuesRequest): Promise<OCPPMeterValuesResponse> {
    const response = await this.send(chargingStationID, this.buildRequest('MeterValues', meterValue));
    return response.data;
  }

  public async executeBootNotification(chargingStationID: string, bootNotification: OCPPBootNotificationRequest): Promise<OCPPBootNotificationResponse> {
    const response = await this.send(chargingStationID, this.buildRequest('BootNotification', bootNotification));
    return response.data;
  }

  public async executeStatusNotification(chargingStationID: string, statusNotification: OCPPStatusNotificationRequest): Promise<OCPPStatusNotificationResponse> {
    const response = await this.send(chargingStationID, this.buildRequest('StatusNotification', statusNotification));
    return response.data;
  }

  public async executeFirmwareStatusNotification(chargingStationID: string, firmwareStatusNotification: OCPPFirmwareStatusNotificationRequest): Promise<OCPPFirmwareStatusNotificationResponse> {
    const response = await this.send(chargingStationID, this.buildRequest('FirmwareStatusNotification', firmwareStatusNotification));
    return response.data;
  }

  public async executeDiagnosticsStatusNotification(chargingStationID: string, diagnosticsStatusNotification: OCPPDiagnosticsStatusNotificationRequest): Promise<OCPPDiagnosticsStatusNotificationResponse> {
    const response = await this.send(chargingStationID, this.buildRequest('DiagnosticsStatusNotification', diagnosticsStatusNotification));
    return response.data;
  }

  public async executeDataTransfer(chargingStationID: string, dataTransfer: OCPPDataTransferRequest): Promise<OCPPDataTransferResponse> {
    const response = await this.send(chargingStationID, this.buildRequest('DataTransfer', dataTransfer));
    return response.data;
  }

  private async send(chargeBoxIdentity: string, message: any): Promise<any> {
    // Debug
    // console.log('OCPP Request ====================================');
    // console.log({ chargeBoxIdentity, message });
    // console.log('====================================');
    // WS Opened?
    if (!this.wsSessions.get(chargeBoxIdentity)) {
      // Open WS
      const ws = await this.openConnection(chargeBoxIdentity);
      this.wsSessions.set(chargeBoxIdentity, ws);
    }
    // Send
    const t0 = performance.now();
    this.wsSessions.get(chargeBoxIdentity).connection.send(JSON.stringify(message), {}, (error?: Error) => {
      // pragma console.log(`Sending error to '${chargeBoxIdentity}', error '${JSON.stringify(error)}', message: '${JSON.stringify(message)}'`);
    });
    if (message[0] === MessageType.CALL_MESSAGE) {
      // Return a promise
      // eslint-disable-next-line no-undef
      return new Promise((resolve, reject) => {
        // Set the resolve function
        this.wsSessions.get(chargeBoxIdentity).requests[message[1]] = { resolve, reject, t0: t0 };
      });
    }
  }

  private buildRequest(command: string, payload: any) {
    // Build the request
    return [
      MessageType.CALL_MESSAGE,
      Utils.generateUUID(),
      command,
      payload];
  }

  private buildResponse(messageId, payload: any) {
    // Build the request
    return [
      MessageType.CALL_MESSAGE,
      messageId,
      payload];
  }
}
