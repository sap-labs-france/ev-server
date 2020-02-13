import { Action } from './Authorization';
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

export enum TransactionInErrorType {
  NO_CONSUMPTION = 'no_consumption',
  OVER_CONSUMPTION = 'average_consumption_greater_than_connector_capacity',
  NEGATIVE_ACTIVITY = 'negative_inactivity',
  LONG_INACTIVITY = 'long_inactivity',
  NEGATIVE_DURATION = 'negative_duration',
  INVALID_START_DATE = 'incorrect_starting_date',
  MISSING_PRICE = 'missing_price',
  MISSING_USER = 'missing_user'
}

export enum ChargingStationInErrorType {
  MISSING_SETTINGS = 'missingSettings',
  CONNECTION_BROKEN = 'connectionBroken',
  MISSING_SITE_AREA = 'missingSiteArea',
  CONNECTOR_ERROR = 'connectorError',
}

export enum UserInErrorType {
  NOT_ACTIVE = 'inactive_user',
  NOT_ASSIGNED = 'unassigned_user',
  INACTIVE_USER_ACCOUNT = 'inactive_user_account',
}
