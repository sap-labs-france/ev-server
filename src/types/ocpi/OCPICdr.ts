import { OCPIAuthMethod } from './OCPISession';
import { OCPIChargingPeriod } from './OCPIChargingPeriod';
import { OCPILocation } from './OCPILocation';

export interface OCPICdr {
  id: string;
  authorization_id?: string;
  start_date_time: Date;
  stop_date_time: Date;
  auth_id: string;
  auth_method: OCPIAuthMethod;
  location: OCPILocation;
  meter_id?: string;
  currency: string;
  charging_periods: OCPIChargingPeriod[];
  total_cost?: number;
  total_energy: number;
  total_time: number;
  total_parking_time?: number;
  remark?: string;
  last_updated: Date;
}
