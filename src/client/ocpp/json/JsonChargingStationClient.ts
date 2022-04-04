import { OCPPCancelReservationRequest, OCPPCancelReservationResponse, OCPPChangeAvailabilityRequest, OCPPChangeAvailabilityResponse, OCPPChangeConfigurationRequest, OCPPChangeConfigurationResponse, OCPPClearCacheResponse, OCPPClearChargingProfileRequest, OCPPClearChargingProfileResponse, OCPPDataTransferRequest, OCPPDataTransferResponse, OCPPGetCompositeScheduleRequest, OCPPGetCompositeScheduleResponse, OCPPGetConfigurationRequest, OCPPGetConfigurationResponse, OCPPGetDiagnosticsRequest, OCPPGetDiagnosticsResponse, OCPPRemoteStartTransactionRequest, OCPPRemoteStartTransactionResponse, OCPPRemoteStopTransactionRequest, OCPPRemoteStopTransactionResponse, OCPPReserveNowRequest, OCPPReserveNowResponse, OCPPResetRequest, OCPPResetResponse, OCPPSetChargingProfileRequest, OCPPSetChargingProfileResponse, OCPPUnlockConnectorRequest, OCPPUnlockConnectorResponse, OCPPUpdateFirmwareRequest } from '../../../types/ocpp/OCPPClient';

import ChargingStationClient from '../../ocpp/ChargingStationClient';
import { Command } from '../../../types/ChargingStation';
import JsonWSConnection from '../../../server/ocpp/json/web-socket/JsonWSConnection';
import Logging from '../../../utils/Logging';
import { OCPPMessageType } from '../../../types/ocpp/OCPPCommon';
import OCPPUtils from '../../../server/ocpp/utils/OCPPUtils';
import Tenant from '../../../types/Tenant';
import Utils from '../../../utils/Utils';

const MODULE_NAME = 'JsonChargingStationClient';

export default class JsonChargingStationClient extends ChargingStationClient {
  private chargingStationID: string;
  private siteID: string;
  private siteAreaID: string;
  private companyID: string;
  private tenant: Tenant;
  private wsConnection: JsonWSConnection;

  public constructor(wsConnection: JsonWSConnection, tenant: Tenant, chargingStationID: string) {
    super();
    this.wsConnection = wsConnection;
    this.tenant = tenant;
    this.chargingStationID = chargingStationID;
    this.companyID = wsConnection.getCompanyID();
    this.siteID = wsConnection.getSiteID();
    this.siteAreaID = wsConnection.getSiteAreaID();
  }

  public getChargingStationID(): string {
    return this.wsConnection.getChargingStationID();
  }

  public async remoteStartTransaction(params: OCPPRemoteStartTransactionRequest): Promise<OCPPRemoteStartTransactionResponse> {
    return this.sendMessage(Command.REMOTE_START_TRANSACTION, params);
  }

  public async reset(params: OCPPResetRequest): Promise<OCPPResetResponse> {
    return this.sendMessage(Command.RESET, params);
  }

  public async clearCache(): Promise<OCPPClearCacheResponse> {
    return this.sendMessage(Command.CLEAR_CACHE, {});
  }

  public async getConfiguration(params: OCPPGetConfigurationRequest = {}): Promise<OCPPGetConfigurationResponse> {
    return this.sendMessage(Command.GET_CONFIGURATION, params);
  }

  public async changeConfiguration(params: OCPPChangeConfigurationRequest): Promise<OCPPChangeConfigurationResponse> {
    return this.sendMessage(Command.CHANGE_CONFIGURATION, params);
  }

  public async remoteStopTransaction(params: OCPPRemoteStopTransactionRequest): Promise<OCPPRemoteStopTransactionResponse> {
    return this.sendMessage(Command.REMOTE_STOP_TRANSACTION, params);
  }

  public async unlockConnector(params: OCPPUnlockConnectorRequest): Promise<OCPPUnlockConnectorResponse> {
    return this.sendMessage(Command.UNLOCK_CONNECTOR, params);
  }

  public async setChargingProfile(params: OCPPSetChargingProfileRequest): Promise<OCPPSetChargingProfileResponse> {
    return this.sendMessage(Command.SET_CHARGING_PROFILE, params);
  }

  public async getCompositeSchedule(params: OCPPGetCompositeScheduleRequest): Promise<OCPPGetCompositeScheduleResponse> {
    return this.sendMessage(Command.GET_COMPOSITE_SCHEDULE, params);
  }

  public async clearChargingProfile(params: OCPPClearChargingProfileRequest): Promise<OCPPClearChargingProfileResponse> {
    return this.sendMessage(Command.CLEAR_CHARGING_PROFILE, params);
  }

  public async changeAvailability(params: OCPPChangeAvailabilityRequest): Promise<OCPPChangeAvailabilityResponse> {
    return this.sendMessage(Command.CHANGE_AVAILABILITY, params);
  }

  public async getDiagnostics(params: OCPPGetDiagnosticsRequest): Promise<OCPPGetDiagnosticsResponse> {
    return this.sendMessage(Command.GET_DIAGNOSTICS, params);
  }

  public async updateFirmware(params: OCPPUpdateFirmwareRequest): Promise<void> {
    return this.sendMessage(Command.UPDATE_FIRMWARE, params);
  }

  public async dataTransfer(params: OCPPDataTransferRequest): Promise<OCPPDataTransferResponse> {
    return this.sendMessage(Command.DATA_TRANSFER, params);
  }

  public async reserveNow(params: OCPPReserveNowRequest): Promise<OCPPReserveNowResponse> {
    return this.sendMessage(Command.RESERVE_NOW, params);
  }

  public async cancelReservation(params: OCPPCancelReservationRequest): Promise<OCPPCancelReservationResponse> {
    return this.sendMessage(Command.CANCEL_RESERVATION, params);
  }

  private async sendMessage(command: Command, params: any): Promise<any> {
    // Trace
    const performanceTracingData = await Logging.traceOcppMessageRequest(MODULE_NAME, this.tenant, this.chargingStationID,
      OCPPUtils.buildServerActionFromOcppCommand(command), params, '<<',
      { siteAreaID: this.siteAreaID, siteID: this.siteID, companyID: this.companyID });
    // Execute
    const result = await this.wsConnection.sendMessage(Utils.generateUUID(), OCPPMessageType.CALL_MESSAGE, command, params);
    // Trace
    await Logging.traceOcppMessageResponse(MODULE_NAME, this.tenant, this.chargingStationID,
      OCPPUtils.buildServerActionFromOcppCommand(command), params, result, '>>',
      { siteAreaID: this.siteAreaID, siteID: this.siteID, companyID: this.companyID },
      performanceTracingData
    );
    return result;
  }
}
