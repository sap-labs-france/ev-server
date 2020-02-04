import { ChargingProfile, ChargingSchedule, PowerLimitUnits } from '../ChargingStation';
import { KeyValue } from '../GlobalType';

export enum OCPPChargingStationCommand {
  CLEAR_CACHE = 'ClearCache',
  GET_CONFIGURATION = 'GetConfiguration',
  CHANGE_CONFIGURATION = 'ChangeConfiguration',
  REMOTE_STOP_TRANSACTION = 'RemoteStopTransaction',
  REMOTE_START_TRANSACTION = 'RemoteStartTransaction',
  UNLOCK_CONNECTOR = 'UnlockConnector',
  RESET = 'Reset',
  SET_CHARGING_PROFILE = 'SetChargingProfile',
  GET_COMPOSITE_SCHEDULE = 'GetCompositeSchedule',
  CLEAR_CHARGING_PROFILE = 'ClearChargingProfile',
  GET_DIAGNOSTICS = 'GetDiagnostics',
  CHANGE_AVAILABILITY = 'ChangeAvailability',
  UPDATE_FIRMWARE = 'UpdateFirmware',
}

export interface OCPPCommandParam {
}

export interface OCPPResetCommandParam extends OCPPCommandParam {
  type: OCPPResetType;
}

export interface OCPPResetCommandResult {
  status: OCPPResetStatus;
}

export enum OCPPStatus {
  ACCEPTED = 'Accepted',
  REJECTED = 'Rejected'
}

export enum OCPPResetStatus {
  ACCEPTED = 'Accepted',
  REJECTED = 'Rejected'
}

export enum OCPPResetType {
  HARD = 'Hard',
  SOFT = 'Soft'
}

export interface OCPPClearCacheCommandResult {
  status: OCPPClearCacheStatus;
}

export enum OCPPClearCacheStatus {
  ACCEPTED = 'Accepted',
  REJECTED = 'Rejected'
}

export interface OCPPGetConfigurationCommandParam extends OCPPCommandParam {
  key?: string[];
}

export interface OCPPGetConfigurationCommandResult {
  configurationKey: KeyValue[];
  unknownKey?: string[];
}

export interface OCPPChangeConfigurationCommandParam extends OCPPCommandParam {
  key: string;
  value: string;
}

export interface OCPPChangeConfigurationCommandResult {
  status: OCPPConfigurationStatus;
}

export enum OCPPConfigurationStatus {
  ACCEPTED = 'Accepted',
  REJECTED = 'Rejected',
  REBOOT_REQUIRED = 'RebootRequired',
  NOT_SUPPORTED = 'NotSupported'
}

export interface OCPPRemoteStartTransactionCommandParam extends OCPPCommandParam {
  connectorId: string;
  idTag: string;
  chargingProfile?: ChargingProfile;
}

export interface OCPPRemoteStartTransactionCommandResult {
  status: OCPPRemoteStartStopStatus;
}

export interface OCPPRemoteStopTransactionCommandParam extends OCPPCommandParam {
  transactionId: number;
}

export interface OCPPRemoteStopTransactionCommandResult {
  status: OCPPRemoteStartStopStatus;
}

export enum OCPPRemoteStartStopStatus {
  ACCEPTED = 'Accepted',
  REJECTED = 'Rejected'
}

export interface OCPPUnlockConnectorCommandParam extends OCPPCommandParam {
  connectorId: number;
}

export interface OCPPUnlockConnectorCommandResult {
  status: OCPPUnlockStatus;
}

export enum OCPPUnlockStatus {
  UNLOCKED = 'Unlocked',
  UNLOCK_FAILED = 'UnlockFailed',
  NOT_SUPPORTED = 'NotSupported'
}

export interface OCPPSetChargingProfileCommandParam extends OCPPCommandParam {
  connectorId: number;
  csChargingProfiles?: ChargingProfile;
}

export interface OCPPSetChargingProfileCommandResult {
  status: OCPPSetCompositeScheduleStatus;
}

export enum OCPPSetCompositeScheduleStatus {
  ACCEPTED = 'Accepted',
  REJECTED = 'Rejected',
  NOT_SUPPORTED = 'NotSupported'
}

export interface OCPPGetCompositeScheduleCommandParam extends OCPPCommandParam {
  connectorId: number;
  duration: number;
  chargingRateUnit?: PowerLimitUnits;
}

export interface OCPPGetCompositeScheduleCommandResult {
  status: OCPPGetCompositeScheduleStatus;
  connectorId?: number;
  scheduleStart?: Date;
  chargingSchedule: ChargingSchedule;
}

export enum OCPPGetCompositeScheduleStatus {
  ACCEPTED = 'Accepted',
  REJECTED = 'Rejected'
}

export interface OCPPClearChargingProfileCommandParam extends OCPPCommandParam {
  id?: number;
  connectorId?: number;
  chargingProfilePurpose?: OCPPChargingProfilePurposeType;
  stackLevel?: number;
}

export interface OCPPClearChargingProfileCommandResult {
  status: OCPPClearChargingProfileStatus;
}

export enum OCPPClearChargingProfileStatus {
  ACCEPTED = 'Accepted',
  UNKNOWN = 'Unknown'
}

export enum OCPPChargingProfilePurposeType {
  CHARGE_POINT_MAX_PROFILE = 'ChargePointMaxProfile',
  TX_DEFAULT_PROFILE = 'TxDefaultProfile',
  TX_PROFILE = 'TxProfile'
}

export interface OCPPChangeAvailabilityCommandParam extends OCPPCommandParam {
  connectorId?: number;
  type?: OCPPAvailabilityType;
}

export interface OCPPChangeAvailabilityCommandResult {
  status: OCPPAvailabilityStatus;
}

export enum OCPPAvailabilityType {
  INOPERATIVE = 'Inoperative',
  OPERATIVE = 'Operative'
}

export enum OCPPAvailabilityStatus {
  ACCEPTED = 'Accepted',
  REJECTED = 'Rejected',
  SCHEDULED = 'Scheduled'
}

export interface OCPPGetDiagnosticsCommandParam extends OCPPCommandParam {
  location: string;
  retries?: number;
  retryInterval?: number;
  startTime?: Date;
  stopTime?: Date;
}

export interface OCPPGetDiagnosticsCommandResult {
  fileName?: string;
}

export interface OCPPUpdateFirmwareCommandParam extends OCPPCommandParam {
  location: string;
  retries?: number;
  retrieveDate: Date;
  retryInterval?: number;
}
