import bluebird from 'bluebird';
import path from 'path';
import JsonCentralSystemServer from '../server/ocpp/json/JsonCentralSystemServer';
import MongoDBStorage from '../storage/mongodb/MongoDBStorage';
import Global = NodeJS.Global;
import SoapCentralSystemServer from '../server/ocpp/soap/SoapCentralSystemServer';

interface TSGlobal extends Global {
  database: MongoDBStorage;
  appRoot: string;
  centralSystemJson: JsonCentralSystemServer;
  centralSystemSoap: SoapCentralSystemServer;
  userHashMapIDs: Map<string, string>;
  tenantHashMapIDs: Map<string, string>;
}

// Export global variables
declare const global: TSGlobal;
// Use bluebird Promise as default
global.Promise = bluebird;
// AppRoot full path
if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
  global.appRoot = path.resolve(__dirname, '../');
} else if (process.env.NODE_ENV === 'production') {
  global.appRoot = path.resolve(__dirname, '../dist');
} else {
  console.log(`Unknown NODE_ENV '${process.env.NODE_ENV}' defined, exiting`);
  process.exit();
}
export default global;
