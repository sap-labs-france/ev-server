import ChargingStation, { Command } from '../../../types/ChargingStation';
import { OCPPCancelReservationCommandParam, OCPPCancelReservationCommandResult, OCPPChangeAvailabilityCommandParam, OCPPChangeAvailabilityCommandResult, OCPPChangeConfigurationCommandParam, OCPPChangeConfigurationCommandResult, OCPPClearCacheCommandResult, OCPPClearChargingProfileCommandParam, OCPPClearChargingProfileCommandResult, OCPPDataTransferCommandParam, OCPPDataTransferCommandResult, OCPPGetCompositeScheduleCommandParam, OCPPGetCompositeScheduleCommandResult, OCPPGetConfigurationCommandParam, OCPPGetConfigurationCommandResult, OCPPGetDiagnosticsCommandParam, OCPPGetDiagnosticsCommandResult, OCPPRemoteStartTransactionCommandParam, OCPPRemoteStartTransactionCommandResult, OCPPRemoteStopTransactionCommandParam, OCPPRemoteStopTransactionCommandResult, OCPPReserveNowCommandParam, OCPPReserveNowCommandResult, OCPPResetCommandParam, OCPPResetCommandResult, OCPPSetChargingProfileCommandParam, OCPPSetChargingProfileCommandResult, OCPPUnlockConnectorCommandParam, OCPPUnlockConnectorCommandResult, OCPPUpdateFirmwareCommandParam } from '../../../types/ocpp/OCPPClient';

import ChargingStationClient from '../../ocpp/ChargingStationClient';
import JsonWSConnection from '../../../server/ocpp/json/JsonWSConnection';
import Logging from '../../../utils/Logging';
import { OCPPMessageType } from '../../../types/ocpp/OCPPCommon';
import { ServerAction } from '../../../types/Server';
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

  constructor(wsConnection: JsonWSConnection, tenant: Tenant, chargingStationID: string) {
    super();
    this.wsConnection = wsConnection;
    this.tenant = tenant;
    this.chargingStationID = chargingStationID;
  }

  getChargingStationID(): string {
    return this.wsConnection.getChargingStationID();
  }

  public async remoteStartTransaction(params: OCPPRemoteStartTransactionCommandParam): Promise<OCPPRemoteStartTransactionCommandResult> {
    return this.sendMessage(Command.REMOTE_START_TRANSACTION, params);
  }

  public async reset(params: OCPPResetCommandParam): Promise<OCPPResetCommandResult> {
    return this.sendMessage(Command.RESET, params);
  }

  public async clearCache(): Promise<OCPPClearCacheCommandResult> {
    return this.sendMessage(Command.CLEAR_CACHE, {});
  }

  public async getConfiguration(params: OCPPGetConfigurationCommandParam = {}): Promise<OCPPGetConfigurationCommandResult> {
    return this.sendMessage(Command.GET_CONFIGURATION, params);
  }

  public async changeConfiguration(params: OCPPChangeConfigurationCommandParam): Promise<OCPPChangeConfigurationCommandResult> {
    return this.sendMessage(Command.CHANGE_CONFIGURATION, params);
  }

  public async remoteStopTransaction(params: OCPPRemoteStopTransactionCommandParam): Promise<OCPPRemoteStopTransactionCommandResult> {
    return this.sendMessage(Command.REMOTE_STOP_TRANSACTION, params);
  }

  public async unlockConnector(params: OCPPUnlockConnectorCommandParam): Promise<OCPPUnlockConnectorCommandResult> {
    return this.sendMessage(Command.UNLOCK_CONNECTOR, params);
  }

  public async setChargingProfile(params: OCPPSetChargingProfileCommandParam): Promise<OCPPSetChargingProfileCommandResult> {
    return this.sendMessage(Command.SET_CHARGING_PROFILE, params);
  }

  public async getCompositeSchedule(params: OCPPGetCompositeScheduleCommandParam): Promise<OCPPGetCompositeScheduleCommandResult> {
    return this.sendMessage(Command.GET_COMPOSITE_SCHEDULE, params);
  }

  public async clearChargingProfile(params: OCPPClearChargingProfileCommandParam): Promise<OCPPClearChargingProfileCommandResult> {
    return this.sendMessage(Command.CLEAR_CHARGING_PROFILE, params);
  }

  public async changeAvailability(params: OCPPChangeAvailabilityCommandParam): Promise<OCPPChangeAvailabilityCommandResult> {
    return this.sendMessage(Command.CHANGE_AVAILABILITY, params);
  }

  public async getDiagnostics(params: OCPPGetDiagnosticsCommandParam): Promise<OCPPGetDiagnosticsCommandResult> {
    return this.sendMessage(Command.GET_DIAGNOSTICS, params);
  }

  public async updateFirmware(params: OCPPUpdateFirmwareCommandParam): Promise<void> {
    return this.sendMessage(Command.UPDATE_FIRMWARE, params);
  }

  public async dataTransfer(params: OCPPDataTransferCommandParam): Promise<OCPPDataTransferCommandResult> {
    return this.sendMessage(Command.DATA_TRANSFER, params);
  }

  public async reserveNow(params: OCPPReserveNowCommandParam): Promise<OCPPReserveNowCommandResult> {
    return this.sendMessage(Command.RESERVE_NOW, params);
  }

  public async cancelReservation(params: OCPPCancelReservationCommandParam): Promise<OCPPCancelReservationCommandResult> {
    return this.sendMessage(Command.CANCEL_RESERVATION, params);
  }

  public setChargingStationDetails(chargingStation: ChargingStation): void {
    this.siteID = chargingStation?.siteID;
    this.siteAreaID = chargingStation?.siteAreaID;
    this.companyID = chargingStation?.companyID;
  }

  private async sendMessage(command: Command, params: any): Promise<any> {
    // Trace
    const performanceTracingData = await Logging.traceOcppMessageRequest(MODULE_NAME, this.tenant, this.chargingStationID,
      `ChargingStation${command}` as ServerAction, params, '<<',
      { siteAreaID: this.siteAreaID, siteID: this.siteID, companyID: this.companyID });
    // Execute
    const result = await this.wsConnection.sendMessage(Utils.generateUUID(), OCPPMessageType.CALL_MESSAGE, command, params);
    // Trace
    await Logging.traceOcppMessageResponse(MODULE_NAME, this.tenant, this.chargingStationID,
      `ChargingStation${command}` as ServerAction, params, result, '>>',
      { siteAreaID: this.siteAreaID, siteID: this.siteID, companyID: this.companyID },
      performanceTracingData
    );
    return result;
  }
}
