import uuid from 'uuid/v4';
import JsonWSConnection from '../../../server/ocpp/json/JsonWSConnection';
import { Action } from '../../../types/Authorization';
import { Profile } from '../../../types/ChargingProfile';
import { OCPPChangeAvailabilityCommandParam, OCPPChangeAvailabilityCommandResult, OCPPChangeConfigurationCommandParam, OCPPChangeConfigurationCommandResult, OCPPClearCacheCommandResult, OCPPClearChargingProfileCommandParam, OCPPClearChargingProfileCommandResult, OCPPGetCompositeScheduleCommandParam, OCPPGetCompositeScheduleCommandResult, OCPPGetConfigurationCommandParam, OCPPGetConfigurationCommandResult, OCPPGetDiagnosticsCommandParam, OCPPGetDiagnosticsCommandResult, OCPPRemoteStartTransactionCommandParam, OCPPRemoteStartTransactionCommandResult, OCPPRemoteStopTransactionCommandParam, OCPPRemoteStopTransactionCommandResult, OCPPResetCommandParam, OCPPResetCommandResult, OCPPSetChargingProfileCommandParam, OCPPSetChargingProfileCommandResult, OCPPUnlockConnectorCommandParam, OCPPUnlockConnectorCommandResult, OCPPUpdateFirmwareCommandParam } from '../../../types/ocpp/OCPPClient';
import ChargingStationClient from '../../ocpp/ChargingStationClient';

export default class JsonChargingStationClient extends ChargingStationClient {
  public tagID: string;
  public connectorID: number;
  public chargingProfile: Profile;
  public type: string;
  public keys: any;
  public key: string;
  public value: any;
  public transactionId: number;
  public connectorId: number;

  private wsConnection: JsonWSConnection;

  constructor(wsConnection: JsonWSConnection) {
    super();
    this.wsConnection = wsConnection;
  }

  getChargingStationID(): string {
    return this.wsConnection.getChargingStationID();
  }

  public async remoteStartTransaction(params: OCPPRemoteStartTransactionCommandParam): Promise<OCPPRemoteStartTransactionCommandResult> {
    return this.wsConnection.sendMessage(uuid(), params, 2, Action.REMOTE_START_TRANSACTION);
  }

  public async reset(params: OCPPResetCommandParam): Promise<OCPPResetCommandResult> {
    return this.wsConnection.sendMessage(uuid(), params, 2, Action.RESET);
  }

  public async clearCache(): Promise<OCPPClearCacheCommandResult> {
    return this.wsConnection.sendMessage(uuid(), {}, 2, Action.CLEAR_CACHE);
  }

  public async getConfiguration(params: OCPPGetConfigurationCommandParam = {}): Promise<OCPPGetConfigurationCommandResult> {
    return this.wsConnection.sendMessage(uuid(), params, 2, Action.GET_CONFIGURATION);
  }

  public async changeConfiguration(params: OCPPChangeConfigurationCommandParam): Promise<OCPPChangeConfigurationCommandResult> {
    return this.wsConnection.sendMessage(uuid(), params, 2, Action.CHANGE_CONFIGURATION);
  }

  public async remoteStopTransaction(params: OCPPRemoteStopTransactionCommandParam): Promise<OCPPRemoteStopTransactionCommandResult> {
    return this.wsConnection.sendMessage(uuid(), params, 2, Action.REMOTE_STOP_TRANSACTION);
  }

  public async unlockConnector(params: OCPPUnlockConnectorCommandParam): Promise<OCPPUnlockConnectorCommandResult> {
    return this.wsConnection.sendMessage(uuid(), params, 2, Action.UNLOCK_CONNECTOR);
  }

  public async setChargingProfile(params: OCPPSetChargingProfileCommandParam): Promise<OCPPSetChargingProfileCommandResult> {
    return this.wsConnection.sendMessage(uuid(), params, 2, Action.SET_CHARGING_PROFILE);
  }

  public async getCompositeSchedule(params: OCPPGetCompositeScheduleCommandParam): Promise<OCPPGetCompositeScheduleCommandResult> {
    return this.wsConnection.sendMessage(uuid(), params, 2, Action.GET_COMPOSITE_SCHEDULE);
  }

  public async clearChargingProfile(params: OCPPClearChargingProfileCommandParam): Promise<OCPPClearChargingProfileCommandResult> {
    return this.wsConnection.sendMessage(uuid(), params, 2, Action.CLEAR_CHARGING_PROFILE);
  }

  public async changeAvailability(params: OCPPChangeAvailabilityCommandParam): Promise<OCPPChangeAvailabilityCommandResult> {
    return this.wsConnection.sendMessage(uuid(), params, 2, Action.CHANGE_AVAILABILITY);
  }

  public async getDiagnostics(params: OCPPGetDiagnosticsCommandParam): Promise<OCPPGetDiagnosticsCommandResult> {
    return this.wsConnection.sendMessage(uuid(), params, 2, Action.GET_DIAGNOSTICS);
  }

  public async updateFirmware(params: OCPPUpdateFirmwareCommandParam): Promise<void> {
    return this.wsConnection.sendMessage(uuid(), params, 2, Action.UPDATE_FIRMWARE);
  }
}
