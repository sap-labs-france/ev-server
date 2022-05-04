import { OCPICoordinates, OCPIImage } from './OCPILocation';

import { OCPIConnector } from './OCPIConnector';
import { OCPIDisplayText } from './OCPIDisplayText';

export interface OCPIEvse {
  uid: string;
  evse_id?: string;
  status: OCPIEvseStatus;
  status_schedule?: OCPIStatusSchedule[];
  capabilities?: OCPICapability[];
  connectors: OCPIConnector[];
  floor_level?: string;
  coordinates?: OCPICoordinates;
  physical_reference?: string;
  directions?: OCPIDisplayText[];
  parking_restrictions?: OCPIParkingRestriction[];
  images?: OCPIImage[];
  last_updated: Date;
  location_id: string;
  chargingStationID?: string;
  siteID?: string;
  siteAreaID?: string;
  companyID?: string;
}

export enum OCPIParkingRestriction {
  EV_ONLY = 'EV_ONLY',
  PLUGGED = 'PLUGGED',
  DISABLED = 'DISABLED',
  CUSTOMERS = 'CUSTOMERS',
  MOTORCYCLES = 'MOTORCYCLES',
}

export interface OCPIStatusSchedule {
  period_begin: Date;
  period_end?: Date;
  status: OCPIEvseStatus;
}

export enum OCPIEvseStatus {
  AVAILABLE = 'AVAILABLE',
  BLOCKED = 'BLOCKED',
  CHARGING = 'CHARGING',
  INOPERATIVE = 'INOPERATIVE',
  OUTOFORDER = 'OUTOFORDER',
  PLANNED = 'PLANNED',
  REMOVED = 'REMOVED',
  RESERVED = 'RESERVED',
  UNKNOWN = 'UNKNOWN'
}

export enum OCPICapability {
  CHARGING_PROFILE_CAPABLE = 'CHARGING_PROFILE_CAPABLE',
  CREDIT_CARD_PAYABLE = 'CREDIT_CARD_PAYABLE',
  REMOTE_START_STOP_CAPABLE = 'REMOTE_START_STOP_CAPABLE',
  RESERVABLE = 'RESERVABLE',
  RFID_READER = 'RFID_READER',
  UNLOCK_CAPABLE = 'UNLOCK_CAPABLE'
}
