const Logging = require('../../utils/Logging');
const Constants = require('../../utils/Constants');
const MongoClient = require('mongodb').MongoClient;
const mongoUriBuilder = require('mongo-uri-builder');
const urlencode = require('urlencode');
const MongoDBStorageNotification = require('./MongoDBStorageNotification');

require('source-map-support').install();

const FIXED_COLLECTION = ['tenants'];

class MongoDBStorage {

  // Create database access
  constructor(dbConfig){
    // Keep local
    this._dbConfig = dbConfig;
  }

  getCollection(tenantID, collectionName){
    return this._db.collection(MongoDBStorage.getCollectionName(tenantID, collectionName));
  }

  static getCollectionName(tenantID, collectionName){
    if (!tenantID || FIXED_COLLECTION.includes(collectionName)) {
      return collectionName;
    }
    return `${tenantID}.${collectionName}`;
  }

  async checkAndCreateCollection(allCollections, tenantID, name, indexes){
    // Check Logs
    const tenantCollectionName = MongoDBStorage.getCollectionName(tenantID, name);
    const foundCollection = allCollections.find((collection) => {
      return collection.name === tenantCollectionName;
    });
    // Check if it exists
    if (!foundCollection) {
      // Create
      await this._db.createCollection(tenantCollectionName);
    }
    // Indexes?
    if (indexes) {
      // Get current indexes
      const existingIndexes = await this._db.collection(tenantCollectionName).listIndexes().toArray();
      // Check each index
      for (const index of indexes) {
        // Create
        // Check if it exists
        const foundIndex = existingIndexes.find((existingIndex) => {
          return (JSON.stringify(existingIndex.key) === JSON.stringify(index.fields));
        });
        // Found?
        if (!foundIndex) {
          // No: Create Index
          await this._db.collection(tenantCollectionName).createIndex(index.fields, index.options);
        }
      }
    }
  }

  async createTenantDatabase(tenantID){
    const filter = {};
    filter.name = new RegExp(`^${tenantID}.`);
    // Get all the tenant collections
    const collections = await this._db.listCollections(filter).toArray();
    // Users
    await this.checkAndCreateCollection(collections, tenantID, 'users', [
      {fields: {email: 1}, options: {unique: true}}
    ]);
    await this.checkAndCreateCollection(collections, tenantID, 'eulas');
    // Logs
    await this.checkAndCreateCollection(collections, tenantID, 'logs', [
      {fields: {timestamp: 1}},
      {fields: {level: 1}},
      {fields: {type: 1}}
    ]);
    // MeterValues
    await this.checkAndCreateCollection(collections, tenantID, 'metervalues', [
      {fields: {timestamp: 1}},
      {fields: {transactionId: 1}}
    ]);
    // Tags
    await this.checkAndCreateCollection(collections, tenantID, 'tags', [
      {fields: {userID: 1}}
    ]);
    // Sites/Users
    await this.checkAndCreateCollection(collections, tenantID, 'siteusers', [
      {fields: {siteID: 1}},
      {fields: {userID: 1}}
    ]);
    // Transactions
    await this.checkAndCreateCollection(collections, tenantID, 'transactions', [
      {fields: {timestamp: 1}},
      {fields: {chargeBoxID: 1}},
      {fields: {userID: 1}}
    ]);
  }

  async checkDatabaseDefaultContent(){
    // Tenant
    const tenantsMDB = await this._db.collection('tenants').find({subdomain: Constants.DEFAULT_TENANT}).toArray();
    // Found?
    if (tenantsMDB.length === 0) {
      // No: Create it
      const result = await this._db.collection('tenants').insertOne(
        {
          "createdOn": new Date(),
          "name": "Master Tenant",
          "subdomain": ""
        }
      );
      const tenantID = result.insertedId;
      // Migrate not prefixed collections
      const collections = await this._db.listCollections().toArray();

      for (const collection of collections) {
        if (!FIXED_COLLECTION.includes(collection.name) && !collection.name.includes('.')) {
          await this._db.collection(collection.name).rename(MongoDBStorage.getCollectionName(tenantID, collection.name));
        }
      }

      // Create missing collections if required
      await this.createTenantDatabase(tenantID);
    } else {
      await this.createTenantDatabase(tenantsMDB[0]._id);
    }
  }

  async checkDatabase(){
    // Get all the collections
    const collections = await this._db.listCollections().toArray();
    // Check only collections with indexes
    // Tenants
    await this.checkAndCreateCollection(collections, Constants.DEFAULT_TENANT, 'tenants', [
      {fields: {subdomain: 1}, options: {unique: true}},
      {fields: {name: 1}, options: {unique: true}}
    ]);
  }

  async start(){
    // Log
    console.log(`Connecting to '${this._dbConfig.implementation}'...`);
    // Build EVSE URL
    let mongoUrl;
    // URI provided?
    if (this._dbConfig.uri) {
      // Yes: use it
      mongoUrl = this._dbConfig.uri;
    } else {
      // No: Build it
      mongoUrl = mongoUriBuilder({
        host: urlencode(this._dbConfig.host),
        port: urlencode(this._dbConfig.port),
        username: urlencode(this._dbConfig.user),
        password: urlencode(this._dbConfig.password),
        database: urlencode(this._dbConfig.database),
        options: {
          replicaSet: this._dbConfig.replicaSet
        }
      });
    }
    // Connect to EVSE
    this._mongoDBClient = await MongoClient.connect(
      mongoUrl,
      {
        useNewUrlParser: true,
        poolSize: this._dbConfig.poolSize,
        replicaSet: this._dbConfig.replicaSet,
        loggerLevel: (this._dbConfig.debug ? 'debug' : null),
        reconnectTries: Number.MAX_VALUE,
        reconnectInterval: 1000,
        autoReconnect: true
      }
    );
    // Get the EVSE DB
    this._db = this._mongoDBClient.db(this._dbConfig.schema);

    // Check Database
    await this.checkDatabase();

    // Check Database Default Content
    await this.checkDatabaseDefaultContent();

    // Log
    Logging.logInfo({
      module: 'MongoDBStorage', method: 'start', action: 'Startup',
      message: `Connected to '${this._dbConfig.implementation}' successfully`
    });
    console.log(`Connected to '${this._dbConfig.implementation}' successfully`);
  }

  async setCentralRestServer(centralRestServer){
    if (this._dbConfig.monitorDBChange) {
      // Monitor MongoDB for Notifications
      this._mongoDBStorageNotification = new MongoDBStorageNotification(
        this._dbConfig, this._db);
      // Set Central Rest Server
      this._mongoDBStorageNotification.setCentralRestServer(centralRestServer);
      // Start
      await this._mongoDBStorageNotification.start();
    }
  }
}

module.exports = MongoDBStorage;
