import { OCPPCancelReservationRequest, OCPPCancelReservationResponse, OCPPChangeAvailabilityRequest, OCPPChangeAvailabilityResponse, OCPPChangeConfigurationRequest, OCPPChangeConfigurationResponse, OCPPClearCacheResponse, OCPPClearChargingProfileRequest, OCPPClearChargingProfileResponse, OCPPDataTransferRequest, OCPPDataTransferResponse, OCPPGetCompositeScheduleRequest, OCPPGetCompositeScheduleResponse, OCPPGetConfigurationRequest, OCPPGetConfigurationResponse, OCPPGetDiagnosticsRequest, OCPPGetDiagnosticsResponse, OCPPRemoteStartTransactionRequest, OCPPRemoteStartTransactionResponse, OCPPRemoteStopTransactionRequest, OCPPRemoteStopTransactionResponse, OCPPReserveNowRequest, OCPPReserveNowResponse, OCPPResetRequest, OCPPResetResponse, OCPPSetChargingProfileRequest, OCPPSetChargingProfileResponse, OCPPUnlockConnectorRequest, OCPPUnlockConnectorResponse, OCPPUpdateFirmwareRequest } from '../../types/ocpp/OCPPClient';

export default abstract class ChargingStationClient {
  public abstract reset(params: OCPPResetRequest): Promise<OCPPResetResponse>;

  public abstract clearCache(): Promise<OCPPClearCacheResponse>;

  public abstract dataTransfer(params: OCPPDataTransferRequest): Promise<OCPPDataTransferResponse>;

  public abstract getConfiguration(params: OCPPGetConfigurationRequest): Promise<OCPPGetConfigurationResponse>;

  public abstract changeConfiguration(params: OCPPChangeConfigurationRequest): Promise<OCPPChangeConfigurationResponse>;

  public abstract remoteStartTransaction(params: OCPPRemoteStartTransactionRequest): Promise<OCPPRemoteStartTransactionResponse>;

  public abstract remoteStopTransaction(params: OCPPRemoteStopTransactionRequest): Promise<OCPPRemoteStopTransactionResponse>;

  public abstract unlockConnector(params: OCPPUnlockConnectorRequest): Promise<OCPPUnlockConnectorResponse>;

  public abstract setChargingProfile(params: OCPPSetChargingProfileRequest): Promise<OCPPSetChargingProfileResponse>;

  public abstract getCompositeSchedule(params: OCPPGetCompositeScheduleRequest): Promise<OCPPGetCompositeScheduleResponse>;

  public abstract clearChargingProfile(params: OCPPClearChargingProfileRequest): Promise<OCPPClearChargingProfileResponse>;

  public abstract changeAvailability(params: OCPPChangeAvailabilityRequest): Promise<OCPPChangeAvailabilityResponse>;

  public abstract getDiagnostics(params: OCPPGetDiagnosticsRequest): Promise<OCPPGetDiagnosticsResponse>;

  public abstract updateFirmware(params: OCPPUpdateFirmwareRequest): Promise<void>;

  public abstract reserveNow(params: OCPPReserveNowRequest): Promise<OCPPReserveNowResponse>;

  public abstract cancelReservation(params: OCPPCancelReservationRequest): Promise<OCPPCancelReservationResponse>;
}
