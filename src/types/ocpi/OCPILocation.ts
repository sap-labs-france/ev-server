import { OCPIBusinessDetails } from './OCPIBusinessDetails';
import { OCPIEvse } from './OCPIEvse';

export interface OCPIPeriod {
  period_begin: Date;
  period_end: Date;
}

export interface OCPIDayPeriod {
  weekday: number;
  period_begin: string;
  period_end: string;
}

export interface OCPILocation {
  id: string;
  type: OCPILocationType;
  name: string;
  address: string;
  city: string;
  postal_code: string;
  country: string;
  coordinates: {
    latitude: string;
    longitude: string;
  };
  operator?: OCPIBusinessDetails;
  evses: OCPIEvse[];
  last_updated: Date;
  // OCPI specify that attribute as optional but Gireve requires it
  opening_times: {
    regular_hours?: OCPIDayPeriod[];
    twentyfourseven: boolean;
    exceptional_openings?: OCPIPeriod[];
    exceptional_closings?: OCPIPeriod[];
  }
  charging_when_closed?: boolean;
}

export enum OCPILocationType {
  ON_STREET = 'ON_STREET',
  PARKING_GARAGE = 'PARKING_GARAGE',
  UNDERGROUND_GARAGE = 'UNDERGROUND_GARAGE',
  PARKING_LOT = 'PARKING_LOT',
  OTHER = 'OTHER',
  UNKNOWN = 'UNKNOWN'
}

export interface OCPILocationReference {
  location_id: string;
  evse_uids: string[];
  connector_ids?: string[];
}

