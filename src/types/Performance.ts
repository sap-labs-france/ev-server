import { ServerAction } from './Server';

export default interface PerformanceRecord {
  id?: string;
  tenantSubdomain: string;
  timestamp: Date;
  host: string;
  action: ServerAction|string;
  group: PerformanceRecordGroup;
  server?: string;
  durationMs?: number;
  reqSizeKb?: number;
  resSizeKb?: number;
  httpUrl?: string;
  httpMethod?: string;
  egress?: boolean;
  httpResponseCode?: number;
  chargingStationID?: string;
  userID?: string;
}

export enum PerformanceRecordGroup {
  MONGO_DB = 'mongo-db',
  OCPP = 'ocpp',
  OCPI = 'ocpi',
  OICP = 'oicp',
  REST_PUBLIC = 'rest-public',
  REST_SECURED = 'rest-secured',
  GREENCOM = 'greencom',
  STRIPE = 'stripe',
  RECAPTCHA = 'recaptcha',
  IOTHINK = 'iothink',
  LACROIX = 'lacroix',
  EV_DATABASE = 'ev-database',
  WIT = 'wit',
  SAP_SMART_CHARGING = 'sap-smart-charging',
  SAP_CONCUR = 'sap-concur',
  NOTIFICATION = 'notification',
  UNKNOWN = 'unknown',
}

export interface PerformanceTracingData {
  startTimestamp: number;
  performanceID: string;
}
