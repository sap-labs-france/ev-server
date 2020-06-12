import { OCPP15MeterValuesRequest, OCPPAuthorizeRequest, OCPPAuthorizeResponse, OCPPBootNotificationRequest, OCPPBootNotificationResponse, OCPPDataTransferRequest, OCPPDataTransferResponse, OCPPDiagnosticsStatusNotificationRequest, OCPPDiagnosticsStatusNotificationResponse, OCPPFirmwareStatusNotificationRequest, OCPPFirmwareStatusNotificationResponse, OCPPHeartbeatRequest, OCPPHeartbeatResponse, OCPPMeterValuesRequest, OCPPMeterValuesResponse, OCPPStartTransactionRequest, OCPPStartTransactionResponse, OCPPStatusNotificationRequest, OCPPStatusNotificationResponse, OCPPStopTransactionRequest, OCPPStopTransactionResponse } from '../../../src/types/ocpp/OCPPServer';

export default abstract class OCPPService {
  public serverUrl: string;
  public constructor(serverUrl: string) {
    this.serverUrl = serverUrl;
  }

  public abstract getVersion(): string;

  public abstract async executeAuthorize(chargingStationID: string, authorize: OCPPAuthorizeRequest): Promise<OCPPAuthorizeResponse>;

  public abstract async executeStartTransaction(chargingStationID: string, startTransaction: OCPPStartTransactionRequest): Promise<OCPPStartTransactionResponse>;

  public abstract async executeStopTransaction(chargingStationID: string, stopTransaction: OCPPStopTransactionRequest): Promise<OCPPStopTransactionResponse>;

  public abstract async executeHeartbeat(chargingStationID: string, heartbeat: OCPPHeartbeatRequest): Promise<OCPPHeartbeatResponse>;

  public abstract async executeMeterValues(chargingStationID: string, meterValue: OCPPMeterValuesRequest|OCPP15MeterValuesRequest): Promise<OCPPMeterValuesResponse>;

  public abstract async executeBootNotification(chargingStationID: string, bootNotification: OCPPBootNotificationRequest): Promise<OCPPBootNotificationResponse>;

  public abstract async executeStatusNotification(chargingStationID: string, statusNotification: OCPPStatusNotificationRequest): Promise<OCPPStatusNotificationResponse>;

  public abstract async executeFirmwareStatusNotification(chargingStationID: string, firmwareStatusNotification: OCPPFirmwareStatusNotificationRequest): Promise<OCPPFirmwareStatusNotificationResponse>;

  public abstract async executeDiagnosticsStatusNotification(chargingStationID: string, diagnosticsStatusNotification: OCPPDiagnosticsStatusNotificationRequest): Promise<OCPPDiagnosticsStatusNotificationResponse>;

  public abstract async executeDataTransfer(chargingStationID: string, dataTransfer: OCPPDataTransferRequest): Promise<OCPPDataTransferResponse>;
}
