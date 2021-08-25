import { OCPP15MeterValuesRequest, OCPPAuthorizeRequest, OCPPAuthorizeResponse, OCPPBootNotificationRequest, OCPPBootNotificationResponse, OCPPDataTransferRequest, OCPPDataTransferResponse, OCPPDiagnosticsStatusNotificationRequest, OCPPDiagnosticsStatusNotificationResponse, OCPPFirmwareStatusNotificationRequest, OCPPFirmwareStatusNotificationResponse, OCPPHeartbeatRequest, OCPPHeartbeatResponse, OCPPMeterValuesRequest, OCPPMeterValuesResponse, OCPPStartTransactionRequest, OCPPStartTransactionResponse, OCPPStatusNotificationRequest, OCPPStatusNotificationResponse, OCPPStopTransactionRequest, OCPPStopTransactionResponse } from '../../../src/types/ocpp/OCPPServer';

import ChargingStation from '../../types/ChargingStation';

export default abstract class OCPPService {
  public serverUrl: string;
  public constructor(serverUrl: string) {
    this.serverUrl = serverUrl;
  }

  public abstract getVersion(): string;

  public abstract executeAuthorize(chargingStation: ChargingStation, authorize: OCPPAuthorizeRequest): Promise<OCPPAuthorizeResponse>;

  public abstract executeStartTransaction(chargingStation: ChargingStation, startTransaction: OCPPStartTransactionRequest): Promise<OCPPStartTransactionResponse>;

  public abstract executeStopTransaction(chargingStation: ChargingStation, stopTransaction: OCPPStopTransactionRequest): Promise<OCPPStopTransactionResponse>;

  public abstract executeHeartbeat(chargingStation: ChargingStation, heartbeat: OCPPHeartbeatRequest): Promise<OCPPHeartbeatResponse>;

  public abstract executeMeterValues(chargingStation: ChargingStation, meterValue: OCPPMeterValuesRequest|OCPP15MeterValuesRequest): Promise<OCPPMeterValuesResponse>;

  public abstract executeBootNotification(chargingStation: ChargingStation, bootNotification: OCPPBootNotificationRequest): Promise<OCPPBootNotificationResponse>;

  public abstract executeStatusNotification(chargingStation: ChargingStation, statusNotification: OCPPStatusNotificationRequest): Promise<OCPPStatusNotificationResponse>;

  public abstract executeFirmwareStatusNotification(chargingStation: ChargingStation, firmwareStatusNotification: OCPPFirmwareStatusNotificationRequest): Promise<OCPPFirmwareStatusNotificationResponse>;

  public abstract executeDiagnosticsStatusNotification(chargingStation: ChargingStation, diagnosticsStatusNotification: OCPPDiagnosticsStatusNotificationRequest): Promise<OCPPDiagnosticsStatusNotificationResponse>;

  public abstract executeDataTransfer(chargingStation: ChargingStation, dataTransfer: OCPPDataTransferRequest): Promise<OCPPDataTransferResponse>;
}
