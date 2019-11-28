import { OCPIAuthMethod } from './OCPISession';
import { OCPILocation } from './OCPILocation';
import { OCPIChargingPeriod } from './OCPIChargingPeriod';

export interface OCPICdr {
  id: string;
  start_date_time: Date;
  stop_date_time?: Date;
  auth_id: string;
  auth_method: OCPIAuthMethod;
  location: OCPILocation;
  meter_id?: string;
  currency: string;
  charging_periods: OCPIChargingPeriod[];
  total_cost: number;
  total_energy: number;
  total_time: number;
  total_parking_time?: number;
  remark?: string;
  last_updated: Date;
}
