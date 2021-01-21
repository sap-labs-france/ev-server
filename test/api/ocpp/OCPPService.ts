import { OCPP15MeterValuesRequest, OCPPAuthorizeRequest, OCPPAuthorizeResponse, OCPPBootNotificationRequest, OCPPBootNotificationResponse, OCPPDataTransferRequest, OCPPDataTransferResponse, OCPPDiagnosticsStatusNotificationRequest, OCPPDiagnosticsStatusNotificationResponse, OCPPFirmwareStatusNotificationRequest, OCPPFirmwareStatusNotificationResponse, OCPPHeartbeatRequest, OCPPHeartbeatResponse, OCPPMeterValuesRequest, OCPPMeterValuesResponse, OCPPStartTransactionRequest, OCPPStartTransactionResponse, OCPPStatusNotificationRequest, OCPPStatusNotificationResponse, OCPPStopTransactionRequest, OCPPStopTransactionResponse } from '../../../src/types/ocpp/OCPPServer';

export default abstract class OCPPService {
  public serverUrl: string;
  public constructor(serverUrl: string) {
    this.serverUrl = serverUrl;
  }

  public abstract getVersion(): string;

  public abstract executeAuthorize(chargingStationID: string, authorize: OCPPAuthorizeRequest): Promise<OCPPAuthorizeResponse>;

  public abstract executeStartTransaction(chargingStationID: string, startTransaction: OCPPStartTransactionRequest): Promise<OCPPStartTransactionResponse>;

  public abstract executeStopTransaction(chargingStationID: string, stopTransaction: OCPPStopTransactionRequest): Promise<OCPPStopTransactionResponse>;

  public abstract executeHeartbeat(chargingStationID: string, heartbeat: OCPPHeartbeatRequest): Promise<OCPPHeartbeatResponse>;

  public abstract executeMeterValues(chargingStationID: string, meterValue: OCPPMeterValuesRequest|OCPP15MeterValuesRequest): Promise<OCPPMeterValuesResponse>;

  public abstract executeBootNotification(chargingStationID: string, bootNotification: OCPPBootNotificationRequest): Promise<OCPPBootNotificationResponse>;

  public abstract executeStatusNotification(chargingStationID: string, statusNotification: OCPPStatusNotificationRequest): Promise<OCPPStatusNotificationResponse>;

  public abstract executeFirmwareStatusNotification(chargingStationID: string, firmwareStatusNotification: OCPPFirmwareStatusNotificationRequest): Promise<OCPPFirmwareStatusNotificationResponse>;

  public abstract executeDiagnosticsStatusNotification(chargingStationID: string, diagnosticsStatusNotification: OCPPDiagnosticsStatusNotificationRequest): Promise<OCPPDiagnosticsStatusNotificationResponse>;

  public abstract executeDataTransfer(chargingStationID: string, dataTransfer: OCPPDataTransferRequest): Promise<OCPPDataTransferResponse>;
}
