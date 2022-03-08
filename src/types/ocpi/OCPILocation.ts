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
  coordinates: OCPICoordinates;
  related_locations?: OCPICoordinates[];
  evses?: OCPIEvse[];
  directions?: OCPIDisplayText[];
  operator?: OCPIBusinessDetails;
  suboperator?: OCPIBusinessDetails;
  owner?: OCPIBusinessDetails;
  facilities?: OCPIFacilities[];
  time_zone?: string;
  opening_times?: OCPIOpeningTimes;
  charging_when_closed?: boolean;
  images?: OCPIImage[];
  energy_mix?: OCPIEnergyMix;
  last_updated: Date;
}

export interface OCPIEnergyMix {
  is_green_energy: boolean;
  energy_sources?: OCPIEnergySource[];
  environ_impact?: OCPIEnvironmentalImpact[];
  supplier_name?: string;
  energy_product_name: string;
}

export interface OCPIEnergySource {
  source: OCPIEnergySourceCategory;
  percentage: number;
}

export enum OCPIEnergySourceCategory {
  NUCLEAR = 'NUCLEAR',
  GENERAL_FOSSIL = 'GENERAL_FOSSIL',
  COAL = 'COAL',
  GAS = 'GAS',
  GENERAL_GREEN = 'GENERAL_GREEN',
  SOLAR = 'SOLAR',
  WIND = 'WIND',
  WATER = 'WATER'
}

export interface OCPIEnvironmentalImpact {
  source: OCPIEnvironmentalImpactCategory;
  amount: number;
}

export enum OCPIEnvironmentalImpactCategory {
  NUCLEAR_WASTE = 'NUCLEAR_WASTE',
  CARBON_DIOXIDE = 'CARBON_DIOXIDE'
}
export interface OCPICoordinates {
  latitude: string;
  longitude: string;
}

export enum OCPIFacilities {
  HOTEL = 'HOTEL',
  RESTAURANT = 'RESTAURANT',
  CAFE = 'CAFE',
  MALL = 'MALL',
  SUPERMARKET = 'SUPERMARKET',
  SPORT = 'SPORT',
  RECREATION_AREA = 'RECREATION_AREA',
  NATURE = 'NATURE',
  MUSEUM = 'MUSEUM',
  BUS_STOP = 'BUS_STOP',
  TAXI_STAND = 'TAXI_STAND',
  TRAIN_STATION = 'TRAIN_STATION',
  AIRPORT = 'AIRPORT',
  CARPOOL_PARKING = 'CARPOOL_PARKING',
  FUEL_STATION = 'FUEL_STATION',
  WIFI = 'WIFI'
}

export interface OCPIImage {
  url: string;
  thumbnail?: string;
  category: OCPIImageCategory;
  type: string;
  width?: number;
  height?: number;
}

export enum OCPIImageCategory {
  CHARGER = 'CHARGER',
  ENTRANCE = 'ENTRANCE',
  LOCATION = 'LOCATION',
  NETWORK = 'NETWORK',
  OPERATOR = 'OPERATOR',
  OTHER = 'OTHER',
  OWNER = 'OWNER'
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

