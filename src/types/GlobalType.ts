import { BillingAccount, BillingInvoice, BillingPaymentMethod, BillingTax, BillingTransfer } from './Billing';
import { Car, CarCatalog } from './Car';
import ChargingStation, { ChargingStationTemplate, Connector } from './ChargingStation';
import Site, { UserSite } from './Site';
import Transaction, { TransactionStop } from './Transaction';
import User, { SiteUser } from './User';

import { Cache } from '../cache/Cache';
import { ChargingProfile } from './ChargingProfile';
import Company from './Company';
import JsonOCPPServer from '../server/ocpp/json/JsonOCPPServer';
import { Log } from './Log';
import MongoDBStorage from '../storage/mongodb/MongoDBStorage';
import MonitoringServer from '../monitoring/MonitoringServer';
import OCPIEndpoint from './ocpi/OCPIEndpoint';
import { PerformanceRecordGroup } from './Performance';
import PricingDefinition from './Pricing';
import RefundReport from './Refund';
import RegistrationToken from './RegistrationToken';
import { ServerType } from './Server';
import { Setting } from './Setting';
import SiteArea from './SiteArea';
import SoapOCPPServer from '../server/ocpp/soap/SoapOCPPServer';
import Tag from './Tag';
import bluebird from 'bluebird';
import path from 'path';

declare global {
  interface Global {}
}

export interface Data {
  id: string;
}

export interface URLInfo {
  httpUrl: string;
  httpFullUrl: string;
  httpMethod: string;
  group: PerformanceRecordGroup;
}

export interface DatabaseCount {
  count?: number;
}

export enum DatabaseDocumentChange {
  INSERT = 'insert',
  UPDATE = 'update',
  REPLACE = 'replace',
  DELETE = 'delete',
  INVALIDATE = 'invalidate',
  DROP = 'drop',
  DROP_DATABASE = 'dropDatabase',
  RENAME = 'rename',
}

export interface KeyValue {
  key: string;
  value: string;
  objectRef?: any;
  readonly?: boolean;
}

export interface Image {
  id: string;
  image: string;
}

export interface Logo {
  id: string;
  logo: string;
}

export interface GroupParams {
  [param: string]: any | string[];
}

export interface FilterParams {
  [param: string]: any | string[];
}

export interface ActionsResponse {
  inSuccess: number;
  inError: number;
}

export enum ImportStatus {
  READY = 'R',
  ERROR = 'E',
}

export type EntityData = Car|User|Company|Site|SiteArea|Tag|CarCatalog|ChargingStation|PricingDefinition|Log|RegistrationToken|BillingInvoice|BillingPaymentMethod|Setting|BillingAccount|ChargingProfile|Connector|Transaction|TransactionStop|BillingTransfer|BillingTax|RefundReport|UserSite|SiteUser|ChargingStationTemplate|OCPIEndpoint;

interface TSGlobal extends Global {
  tenantIdMap: Map<string,string>;
  database: MongoDBStorage;
  appRoot: string;
  centralSystemJsonServer: JsonOCPPServer;
  centralSystemSoapServer: SoapOCPPServer;
  serverType: ServerType;
  monitoringServer : MonitoringServer;
  cache: Cache;
  Promise: any;
}


// Export global variables
declare const global: TSGlobal;
// Use bluebird Promise as default
global.Promise = bluebird as any;
// AppRoot full path
if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
  global.appRoot = path.resolve(__dirname, '../');
} else if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'development-build') {
  global.appRoot = path.resolve(__dirname, '../dist');
} else {
  console.error(`Unknown NODE_ENV '${process.env.NODE_ENV}' defined, exiting`);
  process.exit();
}

export default global;

