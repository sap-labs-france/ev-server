import MongoDBStorage from '../storage/mongodb/MongoDBStorage';

export default interface Global {
  database: MongoDBStorage;
  
}
