import { Action } from './Authorization';
import Asset from './Asset';
import ChargingStation from './ChargingStation';
import Transaction from './Transaction';
import User from './User';

export interface ErrorMessage {
  title: string;
  description: string;
  action: Action;
}

export interface InError {
  errorCode?: string;
  errorMessage?: ErrorMessage;
}

export interface UserInError extends User, InError {
}

export interface ChargingStationInError extends ChargingStation, InError {
}

export interface TransactionInError extends Transaction, InError {
}

export interface AssetInError extends Asset, InError {
}

export enum TransactionInErrorType {
  NO_CONSUMPTION = 'no_consumption',
  LOW_CONSUMPTION = 'low_consumption',
  OVER_CONSUMPTION = 'average_consumption_greater_than_connector_capacity',
  NEGATIVE_ACTIVITY = 'negative_inactivity',
  LONG_INACTIVITY = 'long_inactivity',
  NEGATIVE_DURATION = 'negative_duration',
  LOW_DURATION = 'low_duration',
  INVALID_START_DATE = 'incorrect_starting_date',
  MISSING_PRICE = 'missing_price',
  MISSING_USER = 'missing_user',
  NO_BILLING_DATA = 'no_billing_data'
}

export enum ChargingStationInErrorType {
  MISSING_SETTINGS = 'missing_settings',
  CONNECTION_BROKEN = 'connection_broken',
  MISSING_SITE_AREA = 'missing_site_area',
  CONNECTOR_ERROR = 'connector_error',
}

export enum UserInErrorType {
  NOT_ACTIVE = 'inactive_user',
  NOT_ASSIGNED = 'unassigned_user',
  INACTIVE_USER_ACCOUNT = 'inactive_user_account',
  FAILED_BILLING_SYNCHRO = 'failed_billing_synchro',
}

export enum AssetInErrorType {
  MISSING_SITE_AREA = 'missing_site_area',
}
