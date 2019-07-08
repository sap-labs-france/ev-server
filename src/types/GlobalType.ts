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
}

// Export global variables
declare const global: TSGlobal;
// AppRoot full path
if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
  global.appRoot = path.resolve(__dirname, '../');
} else if (process.env.NODE_ENV === 'production') {
  global.appRoot = path.resolve(__dirname, '../dist');
} else {
  console.log('Unknown NODE_ENV defined, exiting');
  process.exit();
}
export default global;
