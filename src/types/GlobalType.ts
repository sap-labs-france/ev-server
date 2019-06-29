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

//
declare var global: TSGlobal;
export default global;
