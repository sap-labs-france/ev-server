import path from 'path';
import MongoDBStorage from '../storage/mongodb/MongoDBStorage';
import Global = NodeJS.Global;

interface TSGlobal extends Global {
  database: MongoDBStorage;
  appRoot: string;
  centralSystemJson: any;
  centralSystemSoap: any;
  userHashMapIDs: any;
  tenantHashMapIDs: any;
  Promise: any;
}

// Export global variables
declare const global: TSGlobal;
// AppRoot full path
global.appRoot = path.resolve(__dirname, '../');
export default global;
