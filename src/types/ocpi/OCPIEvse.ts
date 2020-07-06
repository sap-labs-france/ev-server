import { OCPIConnector } from './OCPIConnector';

export interface OCPIEvse {
  uid: string;
  evse_id: string;
  status: OCPIEvseStatus;
  capabilities: OCPICapability[];
  connectors: OCPIConnector[];
  coordinates: {
    latitude: number;
    longitude: number;
  };
  last_updated: Date;
  chargeBoxId?: string;
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
