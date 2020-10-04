import { OCPPAvailabilityStatus, OCPPChangeAvailabilityCommandParam, OCPPChangeAvailabilityCommandResult, OCPPChangeConfigurationCommandParam, OCPPChangeConfigurationCommandResult, OCPPChargingProfileStatus, OCPPClearCacheCommandResult, OCPPClearCacheStatus, OCPPClearChargingProfileCommandParam, OCPPClearChargingProfileCommandResult, OCPPClearChargingProfileStatus, OCPPConfigurationStatus, OCPPGetCompositeScheduleCommandParam, OCPPGetCompositeScheduleCommandResult, OCPPGetCompositeScheduleStatus, OCPPGetConfigurationCommandParam, OCPPGetConfigurationCommandResult, OCPPGetDiagnosticsCommandParam, OCPPGetDiagnosticsCommandResult, OCPPRemoteStartStopStatus, OCPPRemoteStartTransactionCommandParam, OCPPRemoteStartTransactionCommandResult, OCPPRemoteStopTransactionCommandParam, OCPPRemoteStopTransactionCommandResult, OCPPResetCommandParam, OCPPResetCommandResult, OCPPResetStatus, OCPPSetChargingProfileCommandParam, OCPPSetChargingProfileCommandResult, OCPPUnlockConnectorCommandParam, OCPPUnlockConnectorCommandResult, OCPPUnlockStatus, OCPPUpdateFirmwareCommandParam } from '../../types/ocpp/OCPPClient';

import ChargingStation from '../../types/ChargingStation';
import ChargingStationClient from '../ocpp/ChargingStationClient';
import EmspOCPIClient from './EmspOCPIClient';
import { OCPICommandResponseType } from '../../types/ocpi/OCPICommandResponse';

export default class OCPIChargingStationClient extends ChargingStationClient {

  protected ocpiClient: EmspOCPIClient;
  private chargingStation: ChargingStation;

  constructor(ocpiClient: EmspOCPIClient, chargingStation: ChargingStation) {
    super();
    this.ocpiClient = ocpiClient;
    this.chargingStation = chargingStation;
  }

  async changeAvailability(params: OCPPChangeAvailabilityCommandParam): Promise<OCPPChangeAvailabilityCommandResult> {
    const result: OCPPChangeAvailabilityCommandResult = {
      status: OCPPAvailabilityStatus.REJECTED
    };
    return result;
  }

  async changeConfiguration(params: OCPPChangeConfigurationCommandParam): Promise<OCPPChangeConfigurationCommandResult> {
    const result: OCPPChangeConfigurationCommandResult = {
      status: OCPPConfigurationStatus.NOT_SUPPORTED
    };
    return result;
  }

  async clearCache(): Promise<OCPPClearCacheCommandResult> {
    const result: OCPPClearCacheCommandResult = {
      status: OCPPClearCacheStatus.REJECTED
    };
    return result;
  }

  async clearChargingProfile(params: OCPPClearChargingProfileCommandParam): Promise<OCPPClearChargingProfileCommandResult> {
    const result: OCPPClearChargingProfileCommandResult = {
      status: OCPPClearChargingProfileStatus.UNKNOWN
    };
    return result;
  }

  async getCompositeSchedule(params: OCPPGetCompositeScheduleCommandParam): Promise<OCPPGetCompositeScheduleCommandResult> {
    const result: OCPPGetCompositeScheduleCommandResult = {
      status: OCPPGetCompositeScheduleStatus.REJECTED
    };
    return result;
  }

  async getConfiguration(params: OCPPGetConfigurationCommandParam): Promise<OCPPGetConfigurationCommandResult> {
    return {
      configurationKey: []
    };
  }

  async getDiagnostics(params: OCPPGetDiagnosticsCommandParam): Promise<OCPPGetDiagnosticsCommandResult> {
    return {};
  }

  async remoteStartTransaction(params: OCPPRemoteStartTransactionCommandParam): Promise<OCPPRemoteStartTransactionCommandResult> {
    const commandResponse = await this.ocpiClient.remoteStartSession(this.chargingStation, params.connectorId, params.idTag);
    return {
      status: commandResponse && commandResponse.result === OCPICommandResponseType.ACCEPTED ?
        OCPPRemoteStartStopStatus.ACCEPTED : OCPPRemoteStartStopStatus.REJECTED
    };
  }

  async remoteStopTransaction(params: OCPPRemoteStopTransactionCommandParam): Promise<OCPPRemoteStopTransactionCommandResult> {
    const commandResponse = await this.ocpiClient.remoteStopSession(params.transactionId);
    return {
      status: commandResponse && commandResponse.result === OCPICommandResponseType.ACCEPTED ?
        OCPPRemoteStartStopStatus.ACCEPTED : OCPPRemoteStartStopStatus.REJECTED
    };
  }

  async reset(params: OCPPResetCommandParam): Promise<OCPPResetCommandResult> {
    return {
      status: OCPPResetStatus.REJECTED
    };
  }

  async setChargingProfile(params: OCPPSetChargingProfileCommandParam): Promise<OCPPSetChargingProfileCommandResult> {
    return {
      status: OCPPChargingProfileStatus.NOT_SUPPORTED
    };
  }

  async unlockConnector(params: OCPPUnlockConnectorCommandParam): Promise<OCPPUnlockConnectorCommandResult> {
    return {
      status: OCPPUnlockStatus.NOT_SUPPORTED
    };
  }

  async updateFirmware(params: OCPPUpdateFirmwareCommandParam): Promise<void> { }
}
