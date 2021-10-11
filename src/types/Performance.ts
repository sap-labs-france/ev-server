import { ServerAction } from './Server';

export default interface PerformanceRecord {
  tenantSubdomain: string;
  timestamp: Date;
  host: string;
  action: ServerAction|string;
  group: PerformanceRecordGroup;
  durationMs?: number;
  reqSizeKb?: number;
  resSizeKb?: number;
  httpUrl?: string;
  httpMethod?: string;
  httpResponseCode?: number;
  chargingStationID?: string;
  userID?: string;
}

export enum PerformanceRecordGroup {
  MONGO_DB = 'mongo-db',
  OCPP = 'ocpp',
  OCPI = 'ocpi',
  OICP = 'oicp',
  REST = 'rest',
  GREENCOM = 'greencom',
  STRIPE = 'stripe',
  RECAPTCHA = 'recaptcha',
  IOTHINK = 'iothink',
  LACROIX = 'lacroix',
  EV_DATABASE = 'ev-database',
  WIT = 'wit',
  SAP_SMART_CHARGING = 'sap-smart-charging',
  SAP_CONCUR = 'sap-concur',
  UNKNOWN = 'unknown',
}
