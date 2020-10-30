import { OICPEvseDataRecord } from './OICPEvse';
import { OICPIdentification } from './OICPIdentification';

export interface OICPSession {
  id: string;
  identification: OICPIdentification;
  // Authorization_id?: string; // To be reviewed if needed.
  start_datetime: Date;
  end_datetime?: Date;
  kwh: number;
  // Auth_id: string; // To be reviewed if needed.
  // auth_method: OICPAuthMethod; // To be reviewed if needed. OICPIdentification is the contains auth method
  evse: OICPEvseDataRecord;
  meter_id?: string;
  currency: string;
  // Charging_periods?: OICPChargingPeriod[]; // To be reviewed if needed.
  total_cost?: number;
  status: OICPSessionStatus;
  last_updated: Date;
}

export enum OICPSessionStatus {
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  INVALID = 'INVALID',
  PENDING = 'PENDING',
}
