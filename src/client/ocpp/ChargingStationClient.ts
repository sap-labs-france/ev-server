import { OCPPChangeAvailabilityCommandParam, OCPPChangeAvailabilityCommandResult, OCPPChangeConfigurationCommandParam, OCPPChangeConfigurationCommandResult, OCPPClearCacheCommandResult, OCPPClearChargingProfileCommandParam, OCPPClearChargingProfileCommandResult, OCPPGet15118EVCertificateCommandParam, OCPPGet15118EVCertificateCommandResult, OCPPGetCompositeScheduleCommandParam, OCPPGetCompositeScheduleCommandResult, OCPPGetConfigurationCommandParam, OCPPGetConfigurationCommandResult, OCPPGetDiagnosticsCommandParam, OCPPGetDiagnosticsCommandResult, OCPPInstallCertificateCommandParam, OCPPInstallCertificateCommandResult, OCPPRemoteStartTransactionCommandParam, OCPPRemoteStartTransactionCommandResult, OCPPRemoteStopTransactionCommandParam, OCPPRemoteStopTransactionCommandResult, OCPPResetCommandParam, OCPPResetCommandResult, OCPPSetChargingProfileCommandParam, OCPPSetChargingProfileCommandResult, OCPPUnlockConnectorCommandParam, OCPPUnlockConnectorCommandResult, OCPPUpdateFirmwareCommandParam } from '../../types/ocpp/OCPPClient';

export default abstract class ChargingStationClient {
  public abstract reset(params: OCPPResetCommandParam): Promise<OCPPResetCommandResult>;

  public abstract clearCache(): Promise<OCPPClearCacheCommandResult>;

  public abstract getConfiguration(params: OCPPGetConfigurationCommandParam): Promise<OCPPGetConfigurationCommandResult>;

  public abstract changeConfiguration(params: OCPPChangeConfigurationCommandParam): Promise<OCPPChangeConfigurationCommandResult>;

  public abstract remoteStartTransaction(params: OCPPRemoteStartTransactionCommandParam): Promise<OCPPRemoteStartTransactionCommandResult>;

  public abstract remoteStopTransaction(params: OCPPRemoteStopTransactionCommandParam): Promise<OCPPRemoteStopTransactionCommandResult>;

  public abstract unlockConnector(params: OCPPUnlockConnectorCommandParam): Promise<OCPPUnlockConnectorCommandResult>;

  public abstract setChargingProfile(params: OCPPSetChargingProfileCommandParam): Promise<OCPPSetChargingProfileCommandResult>;

  public abstract getCompositeSchedule(params: OCPPGetCompositeScheduleCommandParam): Promise<OCPPGetCompositeScheduleCommandResult>;

  public abstract clearChargingProfile(params: OCPPClearChargingProfileCommandParam): Promise<OCPPClearChargingProfileCommandResult>;

  public abstract changeAvailability(params: OCPPChangeAvailabilityCommandParam): Promise<OCPPChangeAvailabilityCommandResult>;

  public abstract getDiagnostics(params: OCPPGetDiagnosticsCommandParam): Promise<OCPPGetDiagnosticsCommandResult>;

  public abstract updateFirmware(params: OCPPUpdateFirmwareCommandParam): Promise<void>;

  public abstract installCertificate(params: OCPPInstallCertificateCommandParam): Promise<OCPPInstallCertificateCommandResult>;

  public abstract get15118EVCertificate(params: OCPPGet15118EVCertificateCommandParam): Promise<OCPPGet15118EVCertificateCommandResult>;
}
