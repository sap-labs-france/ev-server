import { OCPIBusinessDetails } from './OCPIBusinessDetails';
import { OCPIDisplayText } from './OCPIDisplayText';
import { OCPIEvse } from './OCPIEvse';

export interface OCPIPeriod {
  period_begin: Date;
  period_end: Date;
}
// Begin of the regular period given in hours and minutes.
// Must be in 24h format with leading zeros. Example:
// “18:15”. Hour/Minute separator: “:” Regex:
// [0-2][0-9]:[0-5][0-9]

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
  suboperator?: OCPIBusinessDetails;
  owner?: OCPIBusinessDetails;
  evses: OCPIEvse[];
  directions?: OCPIDisplayText[];
  last_updated: Date;
  // OCPI specify that attribute as optional but Gireve requires it
  opening_times: OCPIOpeningTimes;
  charging_when_closed?: boolean;
}

export interface OCPIOpeningTimes {
  regular_hours?: OCPIDayPeriod[];
  twentyfourseven?: boolean;
  exceptional_openings?: OCPIPeriod[];
  exceptional_closings?: OCPIPeriod[];
}

export enum OCPILocationType {
  ON_STREET = 'ON_STREET',
  PARKING_GARAGE = 'PARKING_GARAGE',
  UNDERGROUND_GARAGE = 'UNDERGROUND_GARAGE',
  PARKING_LOT = 'PARKING_LOT',
  OTHER = 'OTHER',
  UNKNOWN = 'UNKNOWN'
}

export interface OCPILocationOptions {
  countryID: string;
  partyID: string;
  addChargeBoxAndOrgIDs?: boolean;
}

export interface OCPILocationReference {
  location_id: string;
  evse_uids: string[];
  connector_ids?: string[];
}

