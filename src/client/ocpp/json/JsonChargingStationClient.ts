import uuid from 'uuid/v4';
import JsonWSConnection from '../../../server/ocpp/json/JsonWSConnection';
import { Profile } from '../../../types/ChargingProfile';
import { OCPPChangeAvailabilityCommandParam, OCPPChangeAvailabilityCommandResult, OCPPChangeConfigurationCommandParam, OCPPChangeConfigurationCommandResult, OCPPChargingStationCommand, OCPPClearCacheCommandResult, OCPPClearChargingProfileCommandParam, OCPPClearChargingProfileCommandResult, OCPPGetCompositeScheduleCommandParam, OCPPGetCompositeScheduleCommandResult, OCPPGetConfigurationCommandParam, OCPPGetConfigurationCommandResult, OCPPGetDiagnosticsCommandParam, OCPPGetDiagnosticsCommandResult, OCPPRemoteStartTransactionCommandParam, OCPPRemoteStartTransactionCommandResult, OCPPRemoteStopTransactionCommandParam, OCPPRemoteStopTransactionCommandResult, OCPPResetCommandParam, OCPPResetCommandResult, OCPPSetChargingProfileCommandParam, OCPPSetChargingProfileCommandResult, OCPPUnlockConnectorCommandParam, OCPPUnlockConnectorCommandResult, OCPPUpdateFirmwareCommandParam } from '../../../types/ocpp/OCPPClient';
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

  public remoteStartTransaction(params: OCPPRemoteStartTransactionCommandParam): Promise<OCPPRemoteStartTransactionCommandResult> {
    return this.wsConnection.sendMessage(uuid(), params, 2, OCPPChargingStationCommand.REMOTE_START_TRANSACTION);
  }

  public reset(params: OCPPResetCommandParam): Promise<OCPPResetCommandResult> {
    return this.wsConnection.sendMessage(uuid(), params, 2, OCPPChargingStationCommand.RESET);
  }

  public clearCache(): Promise<OCPPClearCacheCommandResult> {
    return this.wsConnection.sendMessage(uuid(), {}, 2, OCPPChargingStationCommand.CLEAR_CACHE);
  }

  public getConfiguration(params: OCPPGetConfigurationCommandParam = {}): Promise<OCPPGetConfigurationCommandResult> {
    return this.wsConnection.sendMessage(uuid(), params, 2, OCPPChargingStationCommand.GET_CONFIGURATION);
  }

  public changeConfiguration(params: OCPPChangeConfigurationCommandParam): Promise<OCPPChangeConfigurationCommandResult> {
    return this.wsConnection.sendMessage(uuid(), params, 2, OCPPChargingStationCommand.CHANGE_CONFIGURATION);
  }

  public remoteStopTransaction(params: OCPPRemoteStopTransactionCommandParam): Promise<OCPPRemoteStopTransactionCommandResult> {
    return this.wsConnection.sendMessage(uuid(), params, 2, OCPPChargingStationCommand.REMOTE_STOP_TRANSACTION);
  }

  public unlockConnector(params: OCPPUnlockConnectorCommandParam): Promise<OCPPUnlockConnectorCommandResult> {
    return this.wsConnection.sendMessage(uuid(), params, 2, OCPPChargingStationCommand.UNLOCK_CONNECTOR);
  }

  public setChargingProfile(params: OCPPSetChargingProfileCommandParam): Promise<OCPPSetChargingProfileCommandResult> {
    return this.wsConnection.sendMessage(uuid(), params, 2, OCPPChargingStationCommand.SET_CHARGING_PROFILE);
  }

  public getCompositeSchedule(params: OCPPGetCompositeScheduleCommandParam): Promise<OCPPGetCompositeScheduleCommandResult> {
    return this.wsConnection.sendMessage(uuid(), params, 2, OCPPChargingStationCommand.GET_COMPOSITE_SCHEDULE);
  }

  public clearChargingProfile(params: OCPPClearChargingProfileCommandParam): Promise<OCPPClearChargingProfileCommandResult> {
    return this.wsConnection.sendMessage(uuid(), params, 2, OCPPChargingStationCommand.CLEAR_CHARGING_PROFILE);
  }

  public changeAvailability(params: OCPPChangeAvailabilityCommandParam): Promise<OCPPChangeAvailabilityCommandResult> {
    return this.wsConnection.sendMessage(uuid(), params, 2, OCPPChargingStationCommand.CHANGE_AVAILABILITY);
  }

  public getDiagnostics(params: OCPPGetDiagnosticsCommandParam): Promise<OCPPGetDiagnosticsCommandResult> {
    return this.wsConnection.sendMessage(uuid(), params, 2, OCPPChargingStationCommand.GET_DIAGNOSTICS);
  }

  public async updateFirmware(params: OCPPUpdateFirmwareCommandParam): Promise<void> {
    return this.wsConnection.sendMessage(uuid(), params, 2, OCPPChargingStationCommand.UPDATE_FIRMWARE);
  }
}
