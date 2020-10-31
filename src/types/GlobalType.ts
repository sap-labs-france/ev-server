import JsonCentralSystemServer from '../server/ocpp/json/JsonCentralSystemServer';
import MongoDBStorage from '../storage/mongodb/MongoDBStorage';
import SoapCentralSystemServer from '../server/ocpp/soap/SoapCentralSystemServer';
import bluebird from 'bluebird';
import path from 'path';
import Global = NodeJS.Global;

export interface Data {
  id: string;
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

export interface FilterParams {
  [param: string]: any | string[];
}

export interface ActionsResponse {
  inSuccess: number;
  inError: number;
}

export enum DocumentType {
  PDF = 'pdf',
}

export enum DocumentEncoding {
  BASE64 = 'base64',
}

interface TSGlobal extends Global {
  database: MongoDBStorage;
  appRoot: string;
  centralSystemJsonServer: JsonCentralSystemServer;
  centralSystemSoapServer: SoapCentralSystemServer;
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
