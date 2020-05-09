import { OCPIChargingPeriod } from './OCPIChargingPeriod';
import { OCPILocation } from './OCPILocation';

export interface OCPISession {
  id: string;
  authorization_id?: string;
  start_datetime: Date;
  end_datetime?: Date;
  kwh: number;
  auth_id: string;
  auth_method: OCPIAuthMethod;
  location: OCPILocation;
  meter_id?: string;
  currency: string;
  charging_periods?: OCPIChargingPeriod[];
  total_cost?: number;
  status: OCPISessionStatus;
  last_updated: Date;
}

export enum OCPISessionStatus {
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  INVALID = 'INVALID',
  PENDING = 'PENDING',
}

export enum OCPIAuthMethod {
  AUTH_REQUEST = 'AUTH_REQUEST',
  WHITELIST = 'WHITELIST'
}
