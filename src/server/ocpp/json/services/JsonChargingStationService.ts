import { OCPPAuthorizeRequest, OCPPAuthorizeResponse, OCPPBootNotificationRequest, OCPPBootNotificationResponse, OCPPDataTransferRequest, OCPPDataTransferResponse, OCPPDiagnosticsStatus, OCPPDiagnosticsStatusNotificationRequest, OCPPDiagnosticsStatusNotificationResponse, OCPPFirmwareStatusNotificationRequest, OCPPFirmwareStatusNotificationResponse, OCPPHeartbeatRequest, OCPPHeartbeatResponse, OCPPMeterValuesRequest, OCPPMeterValuesResponse, OCPPStartTransactionRequest, OCPPStartTransactionResponse, OCPPStatusNotificationRequest, OCPPStatusNotificationResponse, OCPPStopTransactionRequest, OCPPStopTransactionResponse, OCPPVersion } from '../../../../types/ocpp/OCPPServer';

import ChargingStationConfiguration from '../../../../types/configuration/ChargingStationConfiguration';
import Logging from '../../../../utils/Logging';
import { OCPPHeader } from '../../../../types/ocpp/OCPPHeader';
import OCPPService from '../../services/OCPPService';
import global from '../../../../types/GlobalType';

const MODULE_NAME = 'JsonChargingStationService';

export default class JsonChargingStationService {
  public chargingStationService: OCPPService;
  private chargingStationConfig: ChargingStationConfiguration;

  constructor(chargingStationConfig: ChargingStationConfiguration) {
    this.chargingStationConfig = chargingStationConfig;
    // Get the OCPP service
    this.chargingStationService = global.centralSystemJsonServer.getChargingStationService(OCPPVersion.VERSION_16);
  }

  public async handleBootNotification(headers: OCPPHeader, payload: OCPPBootNotificationRequest): Promise<OCPPBootNotificationResponse> {
    // Forward
    const result: OCPPBootNotificationResponse = await this.handle('BootNotification', headers, payload);
    // Return the response
    return {
      currentTime: result.currentTime,
      status: result.status,
      interval: result.interval
    };
  }

  public async handleHeartbeat(headers: OCPPHeader, payload: OCPPHeartbeatRequest): Promise<OCPPHeartbeatResponse> {
    // Forward
    const result: OCPPHeartbeatResponse = await this.handle('Heartbeat', headers, payload);
    // Return the response
    return {
      currentTime: result.currentTime
    };
  }

  public async handleStatusNotification(headers: OCPPHeader, payload: OCPPStatusNotificationRequest): Promise<OCPPStatusNotificationResponse> {
    // Forward
    await this.handle('StatusNotification', headers, payload);
    // Return the response
    return {};
  }

  public async handleMeterValues(headers: OCPPHeader, payload: OCPPMeterValuesRequest): Promise<OCPPMeterValuesResponse> {
    // Forward
    await this.handle('MeterValues', headers, payload);
    // Return the response
    return {};
  }

  public async handleAuthorize(headers: OCPPHeader, payload: OCPPAuthorizeRequest): Promise<OCPPAuthorizeResponse> {
    // Forward
    const result: OCPPAuthorizeResponse = await this.handle('Authorize', headers, payload);
    // Return the response
    return {
      idTagInfo: {
        status: result.idTagInfo.status
      }
    };
  }

  public async handleDiagnosticsStatusNotification(headers: OCPPHeader, payload: OCPPDiagnosticsStatusNotificationRequest): Promise<OCPPDiagnosticsStatusNotificationResponse> {
    // Forward
    await this.handle('DiagnosticsStatusNotification', headers, payload);
    // Return the response
    return {};
  }

  public async handleFirmwareStatusNotification(headers: OCPPHeader, payload: OCPPFirmwareStatusNotificationRequest): Promise<OCPPFirmwareStatusNotificationResponse> {
    // Forward
    await this.handle('FirmwareStatusNotification', headers, payload);
    // Return the response
    return {};
  }

  public async handleStartTransaction(headers: OCPPHeader, payload: OCPPStartTransactionRequest): Promise<OCPPStartTransactionResponse> {
    // Forward
    const result: OCPPStartTransactionResponse = await this.handle('StartTransaction', headers, payload);
    // Return the response
    return {
      transactionId: result.transactionId,
      idTagInfo: {
        status: result.idTagInfo.status
      }
    };
  }

  public async handleDataTransfer(headers: OCPPHeader, payload: OCPPDataTransferRequest): Promise<OCPPDataTransferResponse> {
    // Forward
    const result: OCPPDataTransferResponse = await this.handle('DataTransfer', headers, payload);
    // Return the response
    return {
      status: result.status
    };
  }

  public async handleStopTransaction(headers: OCPPHeader, payload: OCPPStopTransactionRequest): Promise<OCPPStopTransactionResponse> {
    // Forward
    const result: OCPPStopTransactionResponse = await this.handle('StopTransaction', headers, payload);
    // Return the response
    return {
      idTagInfo: {
        status: result.idTagInfo.status
      }
    };
  }

  private async handle(command, headers, payload) {
    try {
      // Handle
      return await this.chargingStationService['handle' + command](headers, payload);
    } catch (error) {
      Logging.logException(error, command, headers.chargeBoxIdentity, MODULE_NAME, command, headers.tenantID);
      throw error;
    }
  }
}
