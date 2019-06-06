import MongoDBStorage from '../storage/mongodb/MongoDBStorage';
import Global = NodeJS.Global;

export default interface TSGlobal extends Global {
  database: MongoDBStorage;
  appRoot: string;
  centralSystemJson: any;
  centralSystemSoap: any;
  userHashMapIDs: any;
  tenantHashMapIDs: any;
}
