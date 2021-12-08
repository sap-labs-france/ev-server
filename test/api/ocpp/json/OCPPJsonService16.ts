import { OCPP15MeterValuesRequest, OCPPAuthorizeRequest, OCPPAuthorizeResponse, OCPPBootNotificationRequest, OCPPBootNotificationResponse, OCPPDataTransferRequest, OCPPDataTransferResponse, OCPPDiagnosticsStatusNotificationRequest, OCPPDiagnosticsStatusNotificationResponse, OCPPFirmwareStatusNotificationRequest, OCPPFirmwareStatusNotificationResponse, OCPPHeartbeatRequest, OCPPHeartbeatResponse, OCPPMeterValuesRequest, OCPPMeterValuesResponse, OCPPStartTransactionRequest, OCPPStartTransactionResponse, OCPPStatusNotificationRequest, OCPPStatusNotificationResponse, OCPPStopTransactionRequest, OCPPStopTransactionResponse, OCPPVersion } from '../../../../src/types/ocpp/OCPPServer';
import { OCPPIncomingRequest, OCPPMessageType } from '../../../../src/types/ocpp/OCPPCommon';

import { Command } from '../../../types/ChargingStation';
import OCPPService from '../OCPPService';
import Utils from '../../../../src/utils/Utils';
import WSClient from '../../../../src/client/websocket/WSClient';
import { WSClientOptions } from '../../../../src/types/WebSocket';
import { WSServerProtocol } from '../../../../src/types/Server';
import config from '../../../config';
import { performance } from 'perf_hooks';

export default class OCPPJsonService16 extends OCPPService {
  private wsSessions: Map<string, { connection: WSClient, requests: any }>;
  private requestHandler: any;

  public constructor(serverUrl: string, requestHandler) {
    super(serverUrl);
    this.wsSessions = new Map<string, { connection: WSClient, requests: any }>();
    this.requestHandler = requestHandler;
  }

  public getVersion(): OCPPVersion {
    return OCPPVersion.VERSION_16;
  }

  public async openConnection(chargeBoxIdentity: string): Promise<{ connection: WSClient, requests: any }> {
    return new Promise((resolve, reject) => {
      // Create WS
      const sentRequests = {};
      const wsClientOptions: WSClientOptions = {
        protocols: WSServerProtocol.OCPP16,
      };
      const wsConnection = new WSClient(`${this.serverUrl}/${chargeBoxIdentity}`, wsClientOptions, false);
      // Opened
      wsConnection.onopen = () => {
        // Connection is opened and ready to use
        resolve({ connection: wsConnection, requests: sentRequests });
      };
      // Handle Error Message
      wsConnection.onerror = (error: Error) => {
        // An error occurred when sending/receiving data
        reject(error);
      };
      wsConnection.onclose = (code: number) => {
        for (const property in sentRequests) {
          sentRequests[property].reject(code);
        }
        reject(code);
      };
      wsConnection.onmaximum = (error: Error) => {
        reject(error);
      };
      // Handle Server Message
      wsConnection.onmessage = async (message) => {
        const t1 = performance.now();
        try {
          // Parse the message
          const [messageType, messageId, command, commandPayload]: OCPPIncomingRequest = JSON.parse(message.data) as OCPPIncomingRequest;
          // Check if this corresponds to a request
          if (messageType === OCPPMessageType.CALL_RESULT_MESSAGE && sentRequests[messageId]) {
            const response: any = {};
            // Set the data
            response.responseMessageId = messageId;
            response.executionTime = t1 - sentRequests[messageId].t0;
            response.data = command;
            // Respond to the request
            sentRequests[messageId].resolve(response);
          } else if (messageType === OCPPMessageType.CALL_MESSAGE) {
            await this.handleRequest(chargeBoxIdentity, messageId, command, commandPayload);
          }
        } catch (error) {
          reject(error);
        }
      };
    });
  }

  public async handleRequest(chargeBoxIdentity: string, messageId: string, command: Command, commandPayload: Record<string, unknown> | string): Promise<void> {
    let result = {};
    const methodName = `handle${command}`;
    if (this.requestHandler && typeof this.requestHandler[methodName] === 'function') {
      result = await this.requestHandler[methodName](commandPayload);
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

  public async executeMeterValues(chargingStationID: string, meterValue: OCPPMeterValuesRequest | OCPP15MeterValuesRequest): Promise<OCPPMeterValuesResponse> {
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
    if (config.trace_logs) {
      console.debug('OCPP Request ====================================');
      console.debug({ chargeBoxIdentity, message });
      console.debug('====================================');
    }
    // WS Opened?
    if (!this.wsSessions?.get(chargeBoxIdentity)?.connection?.isConnectionOpen()) {
      // Open WS
      const ws = await this.openConnection(chargeBoxIdentity);
      this.wsSessions.set(chargeBoxIdentity, ws);
    }
    // Send
    const t0 = performance.now();
    this.wsSessions.get(chargeBoxIdentity).connection.send(JSON.stringify(message), {}, (error?: Error) => {
      config.trace_logs && console.debug(`Sending error to '${chargeBoxIdentity}', error '${JSON.stringify(error)}', message: '${JSON.stringify(message)}'`);
    });
    if (message[0] === OCPPMessageType.CALL_MESSAGE) {
      // Return a promise
      return new Promise((resolve, reject) => {
        // Set the resolve function
        this.wsSessions.get(chargeBoxIdentity).requests[message[1]] = { resolve, reject, t0: t0 };
      });
    }
  }

  private buildRequest(command: string, payload: any) {
    // Build the request
    return [
      OCPPMessageType.CALL_MESSAGE,
      Utils.generateUUID(),
      command,
      payload];
  }

  private buildResponse(messageId, payload: any) {
    // Build the request
    return [
      OCPPMessageType.CALL_MESSAGE,
      messageId,
      payload];
  }
}
