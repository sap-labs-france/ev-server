import { OCPIConnector } from './OCPIConnector';

export interface OCPIEvse {
  uid: string;
  evse_id: string;
  status: OCPIEvseStatus;
  connectors: OCPIConnector[];
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
