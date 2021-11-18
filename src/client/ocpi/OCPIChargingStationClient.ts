import { OCPPAvailabilityStatus, OCPPCancelReservationRequest, OCPPCancelReservationResponse, OCPPChangeAvailabilityRequest, OCPPChangeAvailabilityResponse, OCPPChangeConfigurationRequest, OCPPChangeConfigurationResponse, OCPPChargingProfileStatus, OCPPClearCacheResponse, OCPPClearCacheStatus, OCPPClearChargingProfileRequest, OCPPClearChargingProfileResponse, OCPPClearChargingProfileStatus, OCPPConfigurationStatus, OCPPDataTransferRequest, OCPPDataTransferResponse, OCPPGetCompositeScheduleRequest, OCPPGetCompositeScheduleResponse, OCPPGetCompositeScheduleStatus, OCPPGetConfigurationRequest, OCPPGetConfigurationResponse, OCPPGetDiagnosticsRequest, OCPPGetDiagnosticsResponse, OCPPRemoteStartStopStatus, OCPPRemoteStartTransactionRequest, OCPPRemoteStartTransactionResponse, OCPPRemoteStopTransactionRequest, OCPPRemoteStopTransactionResponse, OCPPReserveNowRequest, OCPPReserveNowResponse, OCPPResetRequest, OCPPResetResponse, OCPPResetStatus, OCPPSetChargingProfileRequest, OCPPSetChargingProfileResponse, OCPPUnlockConnectorRequest, OCPPUnlockConnectorResponse, OCPPUnlockStatus, OCPPUpdateFirmwareRequest } from '../../types/ocpp/OCPPClient';

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

  async changeAvailability(params: OCPPChangeAvailabilityRequest): Promise<OCPPChangeAvailabilityResponse> {
    const result: OCPPChangeAvailabilityResponse = {
      status: OCPPAvailabilityStatus.REJECTED
    };
    return result;
  }

  async changeConfiguration(params: OCPPChangeConfigurationRequest): Promise<OCPPChangeConfigurationResponse> {
    const result: OCPPChangeConfigurationResponse = {
      status: OCPPConfigurationStatus.NOT_SUPPORTED
    };
    return result;
  }

  async clearCache(): Promise<OCPPClearCacheResponse> {
    const result: OCPPClearCacheResponse = {
      status: OCPPClearCacheStatus.REJECTED
    };
    return result;
  }

  async clearChargingProfile(params: OCPPClearChargingProfileRequest): Promise<OCPPClearChargingProfileResponse> {
    const result: OCPPClearChargingProfileResponse = {
      status: OCPPClearChargingProfileStatus.UNKNOWN
    };
    return result;
  }

  async getCompositeSchedule(params: OCPPGetCompositeScheduleRequest): Promise<OCPPGetCompositeScheduleResponse> {
    const result: OCPPGetCompositeScheduleResponse = {
      status: OCPPGetCompositeScheduleStatus.REJECTED
    };
    return result;
  }

  async getConfiguration(params: OCPPGetConfigurationRequest): Promise<OCPPGetConfigurationResponse> {
    return {
      configurationKey: []
    };
  }

  async getDiagnostics(params: OCPPGetDiagnosticsRequest): Promise<OCPPGetDiagnosticsResponse> {
    return {};
  }

  async remoteStartTransaction(params: OCPPRemoteStartTransactionRequest): Promise<OCPPRemoteStartTransactionResponse> {
    const commandResponse = await this.ocpiClient.remoteStartSession(this.chargingStation, params.connectorId, params.idTag);
    return {
      status: commandResponse && commandResponse.result === OCPICommandResponseType.ACCEPTED ?
        OCPPRemoteStartStopStatus.ACCEPTED : OCPPRemoteStartStopStatus.REJECTED
    };
  }

  async remoteStopTransaction(params: OCPPRemoteStopTransactionRequest): Promise<OCPPRemoteStopTransactionResponse> {
    const commandResponse = await this.ocpiClient.remoteStopSession(params.transactionId);
    return {
      status: commandResponse && commandResponse.result === OCPICommandResponseType.ACCEPTED ?
        OCPPRemoteStartStopStatus.ACCEPTED : OCPPRemoteStartStopStatus.REJECTED
    };
  }

  async reset(params: OCPPResetRequest): Promise<OCPPResetResponse> {
    return {
      status: OCPPResetStatus.REJECTED
    };
  }

  async setChargingProfile(params: OCPPSetChargingProfileRequest): Promise<OCPPSetChargingProfileResponse> {
    return {
      status: OCPPChargingProfileStatus.NOT_SUPPORTED
    };
  }

  async unlockConnector(params: OCPPUnlockConnectorRequest): Promise<OCPPUnlockConnectorResponse> {
    return {
      status: OCPPUnlockStatus.NOT_SUPPORTED
    };
  }

  async updateFirmware(params: OCPPUpdateFirmwareRequest): Promise<void> { }

  /* eslint-disable @typescript-eslint/no-unused-vars */
  // eslint-disable-next-line @typescript-eslint/require-await
  public async dataTransfer(params: OCPPDataTransferRequest): Promise<OCPPDataTransferResponse> {
    throw new Error('Method not implemented.');
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  public async reserveNow(params: OCPPReserveNowRequest): Promise<OCPPReserveNowResponse> {
    throw new Error('Method not implemented.');
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  public async cancelReservation(params: OCPPCancelReservationRequest): Promise<OCPPCancelReservationResponse> {
    throw new Error('Method not implemented.');
  }

}
