import { ChargingRateUnitType, ChargingSchedule, Profile } from '../../types/ChargingProfile';
import { OcppParameter } from '../ChargingStation';
import { OCPPDataTransferStatus } from './OCPPServer';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface OCPPResetRequest {
  type: OCPPResetType;
}

export interface OCPPResetResponse {
  status: OCPPResetStatus;
}

export enum OCPPStatus {
  ACCEPTED = 'Accepted',
  REJECTED = 'Rejected',
}

export enum OCPPResetStatus {
  ACCEPTED = 'Accepted',
  REJECTED = 'Rejected',
}

export enum OCPPResetType {
  HARD = 'Hard',
  SOFT = 'Soft',
}

export interface OCPPClearCacheResponse {
  status: OCPPClearCacheStatus;
}

export enum OCPPClearCacheStatus {
  ACCEPTED = 'Accepted',
  REJECTED = 'Rejected',
}

export interface OCPPDataTransferRequest {
  vendorId: string;
  messageId?: string;
  data: string;
}

export interface OCPPDataTransferResponse {
  status: OCPPDataTransferStatus;
}

export interface OCPPGetConfigurationRequest {
  key?: string[];
}

export interface OCPPGetConfigurationResponse {
  configurationKey: OcppParameter[];
  unknownKey?: string[];
}

export interface OCPPChangeConfigurationRequest {
  key: string;
  value: string;
}

export interface OCPPChangeConfigurationResponse {
  status: OCPPConfigurationStatus;
}

export interface OCPPCustomConfigurationRequest extends OCPPChangeConfigurationRequest {
  custom: boolean;
}

export enum OCPPConfigurationStatus {
  ACCEPTED = 'Accepted',
  REJECTED = 'Rejected',
  REBOOT_REQUIRED = 'RebootRequired',
  NOT_SUPPORTED = 'NotSupported',
}

export interface OCPPRemoteStartTransactionRequest {
  connectorId: number;
  idTag: string;
  chargingProfile?: Profile;
}

export interface OCPPRemoteStartTransactionResponse {
  status: OCPPRemoteStartStopStatus;
}

export interface OCPPRemoteStopTransactionRequest {
  transactionId: number;
}

export interface OCPPRemoteStopTransactionResponse {
  status: OCPPRemoteStartStopStatus;
}

export enum OCPPRemoteStartStopStatus {
  ACCEPTED = 'Accepted',
  REJECTED = 'Rejected',
}

export interface OCPPUnlockConnectorRequest {
  connectorId: number;
}

export interface OCPPUnlockConnectorResponse {
  status: OCPPUnlockStatus;
}

export enum OCPPUnlockStatus {
  UNLOCKED = 'Unlocked',
  UNLOCK_FAILED = 'UnlockFailed',
  NOT_SUPPORTED = 'NotSupported',
}

export interface OCPPSetChargingProfileRequest {
  connectorId: number;
  csChargingProfiles?: Profile;
}

export interface OCPPSetChargingProfileResponse {
  status: OCPPChargingProfileStatus;
}

export enum OCPPChargingProfileStatus {
  ACCEPTED = 'Accepted',
  REJECTED = 'Rejected',
  NOT_SUPPORTED = 'NotSupported',
}

export interface OCPPGetCompositeScheduleRequest {
  connectorId: number;
  duration: number;
  chargingRateUnit?: ChargingRateUnitType;
}

export interface OCPPGetCompositeScheduleResponse {
  status: OCPPGetCompositeScheduleStatus;
  connectorId?: number;
  scheduleStart?: Date;
  chargingSchedule?: ChargingSchedule;
}

export enum OCPPGetCompositeScheduleStatus {
  ACCEPTED = 'Accepted',
  REJECTED = 'Rejected',
}

export interface OCPPClearChargingProfileRequest {
  id?: number;
  connectorId?: number;
  chargingProfilePurpose?: OCPPChargingProfilePurposeType;
  stackLevel?: number;
}

export interface OCPPClearChargingProfileResponse {
  status: OCPPClearChargingProfileStatus;
}

export enum OCPPClearChargingProfileStatus {
  ACCEPTED = 'Accepted',
  UNKNOWN = 'Unknown',
}

export enum OCPPChargingProfilePurposeType {
  CHARGE_POINT_MAX_PROFILE = 'ChargePointMaxProfile',
  TX_DEFAULT_PROFILE = 'TxDefaultProfile',
  TX_PROFILE = 'TxProfile',
}

export interface OCPPChangeAvailabilityRequest {
  connectorId: number;
  type: OCPPAvailabilityType;
}

export interface OCPPChangeAvailabilityResponse {
  status: OCPPAvailabilityStatus;
}

export enum OCPPAvailabilityType {
  INOPERATIVE = 'Inoperative',
  OPERATIVE = 'Operative',
}

export enum OCPPAvailabilityStatus {
  ACCEPTED = 'Accepted',
  REJECTED = 'Rejected',
  SCHEDULED = 'Scheduled',
}

export interface OCPPGetDiagnosticsRequest {
  location: string;
  retries?: number;
  retryInterval?: number;
  startTime?: Date;
  stopTime?: Date;
}

export interface OCPPGetDiagnosticsResponse {
  fileName?: string;
}

export interface OCPPUpdateFirmwareRequest {
  location: string;
  retries?: number;
  retrieveDate: Date;
  retryInterval?: number;
}

export interface OCPPReserveNowRequest {
  connectorId: number;
  expiryDate: Date;
  idTag: string;
  parentIdTag?: string;
  reservationId: number;
}

export const OCPPReservationStatus = {
  ...OCPPStatus,
  FAULTED: 'Faulted',
  OCCUPIED: 'Occupied',
  UNAVAILABLE: 'Unavailable',
} as const;

export type OCPPReservationStatus = keyof typeof OCPPReservationStatus;

export interface OCPPReserveNowResponse {
  status: OCPPReservationStatus;
}

export interface OCPPCancelReservationRequest {
  reservationId: number;
}

export const OCPPCancelReservationStatus = {
  ...OCPPStatus,
} as const;

export type OCPPCancelReservationStatus = keyof typeof OCPPCancelReservationStatus;

export interface OCPPCancelReservationResponse {
  status: OCPPCancelReservationStatus;
}
