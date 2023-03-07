import { ChangeStreamDocument, Collection, CollectionOptions, CreateIndexesOptions, Db, GridFSBucket, IndexSpecification, MongoClient, ReadPreference, ReadPreferenceMode } from 'mongodb';
import global, { DatabaseDocumentChange } from '../../types/GlobalType';
import mongoUriBuilder, { MongoUriConfig } from 'mongo-uri-builder';

import BackendError from '../../exception/BackendError';
import Configuration from '../../utils/Configuration';
import Constants from '../../utils/Constants';
import DatabaseUtils from './DatabaseUtils';
import { LockEntity } from '../../types/Locking';
import LockingManager from '../../locking/LockingManager';
import Logging from '../../utils/Logging';
import MigrationConfiguration from '../../types/configuration/MigrationConfiguration';
import { ServerAction } from '../../types/Server';
import StorageConfiguration from '../../types/configuration/StorageConfiguration';
import Tenant from '../../types/Tenant';
import Utils from '../../utils/Utils';
import urlencode from 'urlencode';

const MODULE_NAME = 'MongoDBStorage';

export default class MongoDBStorage {
  private mongoDBClient: MongoClient;
  private database: Db;
  private dbPingFailed = 0;
  private readonly dbConfig: StorageConfiguration;
  private readonly migrationConfig: MigrationConfiguration;

  // Create database access
  public constructor(dbConfig: StorageConfiguration) {
    this.dbConfig = dbConfig;
    this.migrationConfig = Configuration.getMigrationConfig();
  }

  public getDatabase(): Db {
    return this.database;
  }

  public getCollection<T>(tenantID: string, collectionName: string): Collection<T> {
    if (!this.database) {
      throw new BackendError({
        module: MODULE_NAME,
        method: 'getCollection',
        message: 'Not supposed to call getCollection before database start',
        action: ServerAction.MONGO_DB
      });
    }
    return this.database.collection<T>(DatabaseUtils.getCollectionName(tenantID, collectionName));
  }

  public async watchDatabaseCollection(tenant: Tenant, collectionName: string,
      callback: (documentID: unknown, documentChange: DatabaseDocumentChange, document: unknown) => void): Promise<void> {
    if (!this.database) {
      throw new BackendError({
        module: MODULE_NAME,
        method: 'watchDatabaseCollection',
        message: 'Database has not yet started',
        action: ServerAction.MONGO_DB
      });
    }
    // Get the DB collection
    const dbCollection = this.getCollection(tenant.id, collectionName);
    if (!dbCollection) {
      throw new BackendError({
        module: MODULE_NAME,
        method: 'watchDatabaseCollection',
        message: `Database collection '${tenant.id}.${collectionName}' has not been found!`,
        action: ServerAction.MONGO_DB
      });
    }
    // Watch
    const changeStream = dbCollection.watch([], { fullDocument: 'updateLookup' });
    const message = `Database collection '${tenant.id}.${collectionName}' is being watched`;
    Utils.isDevelopmentEnv() && Logging.logConsoleDebug(message);
    await Logging.logDebug({
      tenantID: tenant.id,
      action: ServerAction.MONGO_DB,
      message, module: MODULE_NAME, method: 'watchDatabaseCollection'
    });
    // Trigger callbacks
    changeStream.on('change', (changeStreamDocument: ChangeStreamDocument) => {
      const documentID = changeStreamDocument['documentKey'] ? changeStreamDocument['documentKey']['_id'] : null;
      const documentChange = changeStreamDocument.operationType;
      const fullDocument = changeStreamDocument['fullDocument'];
      // Callback
      callback(documentID, documentChange as DatabaseDocumentChange, fullDocument);
    });
  }

  public async checkAndCreateTenantDatabase(tenantID: string): Promise<void> {
    // Safety check
    if (!this.database) {
      throw new BackendError({
        module: MODULE_NAME,
        method: 'checkAndCreateTenantDatabase',
        message: 'Database has not yet started',
        action: ServerAction.MONGO_DB
      });
    }
    await Logging.logDebug({
      tenantID: tenantID,
      action: ServerAction.MONGO_DB,
      message: 'Check of MongoDB database...',
      module: MODULE_NAME, method: 'checkAndCreateTenantDatabase'
    });
    // Users
    await this.handleIndexesInCollection(tenantID, 'users', [
      { fields: { issuer: 1, name: 1 } },
      { fields: { email: 1 }, options: { unique: true } },
      { fields: { 'address.coordinates': '2dsphere' } },
    ]);
    // Users Import
    await this.handleIndexesInCollection(tenantID, 'importedusers', [
      { fields: { email: 1 }, options: { unique: true } }
    ]);
    // Invoices
    await this.handleIndexesInCollection(tenantID, 'invoices', [
      { fields: { invoiceID: 1 }, options: { unique: true } },
      { fields: { createdOn: 1 } },
    ]);
    // Logs
    await this.handleIndexesInCollection(tenantID, 'logs', [
      { fields: { timestamp: 1 }, options: { expireAfterSeconds: 14 * 24 * 3600 } },
      { fields: { action: 1, timestamp: 1 } },
      { fields: { level: 1, timestamp: 1 } },
      { fields: { source: 1, timestamp: 1 } },
      { fields: { chargingStationID: 1, timestamp: 1 } },
      { fields: { siteID: 1, timestamp: 1 } },
      { fields: { host: 1, timestamp: 1 } },
      { fields: { message: 'text' } },
    ]);
    // Raw Notifications
    await this.handleIndexesInCollection(tenantID, 'rawnotifications', [
      { fields: { timestamp: 1 }, options: { expireAfterSeconds: 1 * 24 * 3600 } }, // To be clarified - too short when checking the user inactivity
      { fields: { discriminator: 1 } } // Necessary to avoid scanning all documents when checking whether the notification has already been sent
    ]);
    // Raw MeterValues
    await this.handleIndexesInCollection(tenantID, 'rawmetervalues', [
      { fields: { beginAt: 1 }, options: { expireAfterSeconds: 2 * 24 * 3600 } }
    ]);
    // MeterValues
    await this.handleIndexesInCollection(tenantID, 'metervalues', [
      { fields: { transactionId: 1 } }
    ]);
    // Status Notifications
    await this.handleIndexesInCollection(tenantID, 'statusnotifications', [
      { fields: { timestamp: 1 } }
    ]);
    // Tags
    await this.handleIndexesInCollection(tenantID, 'tags', [
      { fields: { visualID: 1 }, options: { unique: true } },
      { fields: { issuer: 1, createdOn: 1 } },
      { fields: { userID: 1 } },
      { fields: { createdOn: 1 } },
      { fields: { _id: 'text', description: 'text', visualID: 'text' } },
    ]);
    // Tags Import
    await this.handleIndexesInCollection(tenantID, 'importedtags', [
      { fields: { visualID: 1 }, options: { unique: true } }
    ]);
    // Sites/Users
    await this.handleIndexesInCollection(tenantID, 'siteusers', [
      { fields: { siteID: 1, userID: 1 }, options: { unique: true } },
      { fields: { userID: 1 } }
    ]);
    // Cars
    await this.handleIndexesInCollection(tenantID, 'cars', [
      { fields: { vin: 1, licensePlate: 1 }, options: { unique: true } },
    ]);
    // Transactions
    await this.handleIndexesInCollection(tenantID, 'transactions', [
      { fields: { timestamp: 1 } },
      { fields: { issuer: 1, timestamp: 1 } },
      { fields: { chargeBoxID: 1 } },
      { fields: { tagID: 1 } },
      { fields: { userID: 1 } },
    ]);
    // Settings
    await this.handleIndexesInCollection(tenantID, 'settings', [
      { fields: { identifier: 1 }, options: { unique: true } }
    ]);
    await this.handleIndexesInCollection(tenantID, 'connections', [
      { fields: { connectorId: 1, userId: 1 }, options: { unique: true } }
    ]);
    await this.handleIndexesInCollection(tenantID, 'consumptions', [
      { fields: { transactionId: 1 } },
      { fields: { assetID: 1, startedAt: 1 } },
      { fields: { siteAreaID: 1, startedAt: 1 } }
    ]);
    // Companies
    await this.handleIndexesInCollection(tenantID, 'companies', [
      { fields: { 'address.coordinates': '2dsphere' } },
    ]);
    // Sites
    await this.handleIndexesInCollection(tenantID, 'sites', [
      { fields: { 'address.coordinates': '2dsphere' } },
      { fields: { 'ocpiData.location.id': 1 }, options: { partialFilterExpression: { ocpiData: { $exists: true } } } }
    ]);
    // Site Area
    await this.handleIndexesInCollection(tenantID, 'siteareas', [
      { fields: { 'address.coordinates': '2dsphere' } },
      { fields: { 'ocpiData.location.id': 1 }, options: { partialFilterExpression: { ocpiData: { $exists: true } } } }
    ]);
    // Charging Stations
    await this.handleIndexesInCollection(tenantID, 'chargingstations', [
      { fields: { coordinates: '2dsphere' } },
      { fields: { deleted: 1, issuer: 1 } },
      { fields: { 'connectors.status': 1 } },
      { fields: { 'ocpiData.evses.uid': 1 }, options: { partialFilterExpression: { 'ocpiData.evses': { $exists: true } } } }
    ]);
    await Logging.logDebug({
      tenantID: tenantID,
      action: ServerAction.MONGO_DB,
      message: 'Check of MongoDB database done',
      module: MODULE_NAME, method: 'checkAndCreateTenantDatabase'
    });
  }

  public async deleteTenantDatabase(tenantID: string): Promise<void> {
    // Not the Default tenant
    if (tenantID !== Constants.DEFAULT_TENANT_ID) {
      // Safety check
      if (!this.database) {
        throw new BackendError({
          module: MODULE_NAME,
          method: 'deleteTenantDatabase',
          message: 'Not supposed to call deleteTenantDatabase before database start',
          action: ServerAction.MONGO_DB
        });
      }
      // Get all the collections
      const collections = await this.database.listCollections().toArray();
      // Check and Delete
      for (const collection of collections) {
        if (collection.name.startsWith(`${tenantID}.`)) {
          // Delete
          await this.database.collection(collection.name).drop();
        }
      }
    }
  }

  public getGridFSBucket(name: string): GridFSBucket {
    return new GridFSBucket(this.database, { bucketName: name });
  }

  public async stop(): Promise<void> {
    if (this.mongoDBClient) {
      await this.mongoDBClient.close();
      this.database = null;
      this.mongoDBClient = null;
    }
  }

  public async start(): Promise<void> {
    Logging.logConsoleDebug(`Connecting to '${this.dbConfig.implementation}'...`);
    // Build EVSE URL
    let mongoUrl: string;
    // URI provided?
    if (this.dbConfig.uri) {
      // Yes: use it
      mongoUrl = this.dbConfig.uri;
    // Build URI without replicaset
    } else {
      const uri: MongoUriConfig = {
        host: urlencode(this.dbConfig.host),
        port: Utils.convertToInt(urlencode(this.dbConfig.port.toString())),
        username: urlencode(this.dbConfig.user),
        password: urlencode(this.dbConfig.password),
        database: urlencode(this.dbConfig.database),
        options: {
          readPreference: this.dbConfig.readPreference ? this.dbConfig.readPreference as ReadPreferenceMode : ReadPreferenceMode.secondaryPreferred
        }
      };
      // Set the Replica Set
      if (this.dbConfig.replicaSet) {
        uri.options.replicaSet = this.dbConfig.replicaSet;
      }
      mongoUrl = mongoUriBuilder(uri);
    }
    // Connect to EVSE
    Logging.logConsoleDebug(`Connecting to '${mongoUrl}'`);
    // Connection pool size
    let minPoolSize: number, maxPoolSize: number;
    if (this.dbConfig.minPoolSize && this.dbConfig.maxPoolSize) {
      // New configuration (K8S)
      minPoolSize = this.dbConfig.minPoolSize;
      maxPoolSize = this.dbConfig.maxPoolSize;
    } else if (this.dbConfig.poolSize) {
      // Legacy configuration (AWS FARGATE)
      minPoolSize = Math.floor(this.dbConfig.poolSize / 2);
      maxPoolSize = this.dbConfig.poolSize;
    } else {
      // Default values
      minPoolSize = 10;
      maxPoolSize = 100;
    }
    // Mongo Client to EVSE DB
    this.mongoDBClient = await MongoClient.connect(
      mongoUrl,
      {
        minPoolSize,
        maxPoolSize,
        loggerLevel: this.dbConfig.debug ? 'debug' : null,
        readPreference: this.dbConfig.readPreference ? this.dbConfig.readPreference as ReadPreferenceMode : ReadPreferenceMode.secondaryPreferred
      }
    );
    this.database = this.mongoDBClient.db();
    // Keep a global reference
    global.database = this;
    // Check Database only when migration is active
    if (this.migrationConfig?.active) {
      await this.checkDatabase();
    }
    Logging.logConsoleDebug(`Connected to '${this.dbConfig.implementation}' successfully`);
  }

  public async ping(): Promise<boolean> {
    if (this.database) {
      const startTime = Logging.traceDatabaseRequestStart();
      try {
        // Ping the DB
        const result = await this.database.command({ ping: 1 });
        // Check time spent
        const totalTime = Date.now() - startTime;
        if (totalTime > Constants.DB_MAX_PING_TIME_MILLIS) {
          throw new Error(`Database ping took ${totalTime} ms instead of ${Constants.DB_MAX_PING_TIME_MILLIS}`);
        }
        this.dbPingFailed = 0;
        return (result.ok === 1);
      } catch (error) {
        this.dbPingFailed++;
        const message = `${this.dbPingFailed} database ping(s) failed: ${error.message as string}`;
        Logging.logConsoleError(message);
        await Logging.logError({
          tenantID: Constants.DEFAULT_TENANT_ID,
          action: ServerAction.MONGO_DB,
          module: MODULE_NAME, method: 'ping',
          message, detailedMessages: { error: error.stack }
        });
        return false;
      } finally {
        await Logging.traceDatabaseRequestEnd(Constants.DEFAULT_TENANT_OBJECT, MODULE_NAME, 'ping', startTime, {});
      }
    }
    return true;
  }

  private async checkDatabase(): Promise<void> {
    // Safety check
    if (!this.database) {
      throw new BackendError({
        module: MODULE_NAME,
        method: 'checkDatabase',
        message: 'Not supposed to call checkDatabase before database start',
        action: ServerAction.MONGO_DB
      });
    }
    // Handle Default Tenant
    await this.handleCheckDefaultTenant();
    // Handle Tenants
    await this.handleCheckTenants();
  }

  private async handleCheckDefaultTenant() {
    try {
      // Database creation Lock
      const databaseLock = LockingManager.createExclusiveLock(Constants.DEFAULT_TENANT_ID, LockEntity.DATABASE, 'check-database');
      if (await LockingManager.acquire(databaseLock)) {
        try {
          // Check only collections with indexes
          // Locks
          await this.handleIndexesInCollection(Constants.DEFAULT_TENANT_ID, 'locks', []);
          // Tenants
          await this.handleIndexesInCollection(Constants.DEFAULT_TENANT_ID, 'tenants', [
            { fields: { subdomain: 1 }, options: { unique: true } },
          ]);
          // Performances
          await this.handleIndexesInCollection(Constants.DEFAULT_TENANT_ID, 'performances', [
            { fields: { timestamp: 1 }, options: { expireAfterSeconds: 2 * 24 * 3600 } },
            // { fields: { timestamp: 1, group: 1, tenantSubdomain: 1 } }, - this index seems wrong and useless
          ]);
          // Users
          await this.handleIndexesInCollection(Constants.DEFAULT_TENANT_ID, 'users', [
            { fields: { email: 1 }, options: { unique: true } }
          ]);
          // Car Catalogs
          await this.handleIndexesInCollection(Constants.DEFAULT_TENANT_ID, 'carcatalogimages', [
            { fields: { carID: 1 } }
          ]);
          // Logs
          await this.handleIndexesInCollection(Constants.DEFAULT_TENANT_ID, 'logs', [
            { fields: { timestamp: 1 }, options: { expireAfterSeconds: 14 * 24 * 3600 } },
            { fields: { type: 1, timestamp: 1 } },
            { fields: { action: 1, timestamp: 1 } },
            { fields: { level: 1, timestamp: 1 } },
            { fields: { source: 1, timestamp: 1 } },
            { fields: { host: 1, timestamp: 1 } },
            { fields: { message: 'text', source: 'text', chargingStationID: 'text' } },
          ]);
        } finally {
          // Release the database creation Lock
          await LockingManager.release(databaseLock);
        }
      }
    } catch (error) {
      const message = 'Error while checking Database in tenant \'default\'';
      Logging.logConsoleError(message);
      await Logging.logError({
        tenantID: Constants.DEFAULT_TENANT_ID,
        action: ServerAction.MONGO_DB,
        module: MODULE_NAME, method: 'handleIndexesInCollection',
        message, detailedMessages: { error: error.stack }
      });
    }
  }

  private async handleCheckTenants() {
    // Get all the Tenants
    const tenantsMDB = await this.database.collection(DatabaseUtils.getCollectionName(Constants.DEFAULT_TENANT_ID, 'tenants'))
      .find({}).toArray();
    const tenantIds = tenantsMDB.map((t): string => t._id.toString());
    for (const tenantId of tenantIds) {
      try {
        // Database creation Lock
        const databaseLock = LockingManager.createExclusiveLock(tenantId, LockEntity.DATABASE, 'check-database');
        if (await LockingManager.acquire(databaseLock)) {
          try {
            // Create tenant collections
            await this.checkAndCreateTenantDatabase(tenantId);
          } finally {
            // Release the database creation Lock
            await LockingManager.release(databaseLock);
          }
        }
      } catch (error) {
        const message = `Error while checking Database in tenant '${tenantId}'`;
        Logging.logConsoleError(message);
        await Logging.logError({
          tenantID: Constants.DEFAULT_TENANT_ID,
          action: ServerAction.MONGO_DB,
          module: MODULE_NAME, method: 'handleIndexesInCollection',
          message, detailedMessages: { error: error.stack }
        });
      }
    }
  }

  private async handleIndexesInCollection(tenantID: string,
      name: string, indexes?: { fields: IndexSpecification; options?: CreateIndexesOptions }[]): Promise<void> {
    // Safety check
    if (!this.database) {
      throw new BackendError({
        module: MODULE_NAME,
        method: 'handleIndexesInCollection',
        message: 'Not supposed to call handleIndexesInCollection before database start',
        action: ServerAction.MONGO_DB
      });
    }
    // We force read preference to target the primary node
    const collectionOptions: CollectionOptions = { readPreference: ReadPreference.PRIMARY };
    try {
      // Get all the collections
      const tenantCollectionName = DatabaseUtils.getCollectionName(tenantID, name);
      const currentCollections = await this.database.listCollections({ name: tenantCollectionName }, collectionOptions).toArray();
      const foundCollection = currentCollections.find((collection) => collection.name === tenantCollectionName);
      // Create
      if (!foundCollection) {
        try {
          await this.database.createCollection(tenantCollectionName);
        } catch (error) {
          const message = `Error in creating collection '${tenantID}.${tenantCollectionName}': ${error.message as string}`;
          Logging.logConsoleError(message);
          await Logging.logError({
            tenantID: Constants.DEFAULT_TENANT_ID,
            action: ServerAction.MONGO_DB,
            module: MODULE_NAME, method: 'handleIndexesInCollection',
            message, detailedMessages: { error: error.stack, tenantCollectionName, name, indexes }
          });
        }
      }
      // Indexes?
      if (indexes) {
        // Get current indexes
        let databaseIndexes = await this.database.collection(tenantCollectionName, collectionOptions).listIndexes().toArray();
        // Drop indexes
        for (const databaseIndex of databaseIndexes) {
          if (databaseIndex.key._id) {
            continue;
          }
          let foundIndex = indexes.find((index) => this.buildIndexName(index.fields) === databaseIndex.name);
          // Check DB 'unique' index option
          if (!Utils.areObjectPropertiesEqual(databaseIndex, foundIndex?.options, 'unique')) {
            // Force not found: Create
            foundIndex = null;
          }
          // Check DB 'expireAfterSeconds' index option
          if (!Utils.areObjectPropertiesEqual(databaseIndex, foundIndex?.options, 'expireAfterSeconds')) {
            // expiration date
            foundIndex = null;
          }
          // Check DB 'expireAfterSeconds' index option
          if (!Utils.areObjectPropertiesEqual(databaseIndex, foundIndex?.options, 'partialFilterExpression')) {
            // partial index
            foundIndex = null;
          }
          // Delete the index
          if (!foundIndex) {
            if (Utils.isDevelopmentEnv()) {
              const message = `Drop index '${databaseIndex.name as string}' in collection ${tenantCollectionName}`;
              Utils.isDevelopmentEnv() && Logging.logConsoleDebug(message);
              await Logging.logInfo({
                tenantID: Constants.DEFAULT_TENANT_ID,
                action: ServerAction.MONGO_DB,
                module: MODULE_NAME, method: 'handleIndexesInCollection',
                message, detailedMessages: { tenantCollectionName, indexes, indexName: databaseIndex.name }
              });
            }
            try {
              await this.database.collection(tenantCollectionName, collectionOptions).dropIndex(databaseIndex.key);
            } catch (error) {
              const message = `Error in dropping index '${databaseIndex.name as string}' in '${tenantCollectionName}': ${error.message as string}`;
              Logging.logConsoleError(message);
              await Logging.logError({
                tenantID: Constants.DEFAULT_TENANT_ID,
                action: ServerAction.MONGO_DB,
                module: MODULE_NAME, method: 'handleIndexesInCollection',
                message, detailedMessages: { error: error.stack, tenantCollectionName, name, indexes, indexName: databaseIndex.name }
              });
            }
          }
        }
        // Get updated indexes
        databaseIndexes = await this.database.collection(tenantCollectionName, collectionOptions).listIndexes().toArray();
        // Create indexes
        for (const index of indexes) {
          const foundDatabaseIndex = databaseIndexes.find((databaseIndex) => this.buildIndexName(index.fields) === databaseIndex.name);
          // Create the index
          if (!foundDatabaseIndex) {
            if (Utils.isDevelopmentEnv()) {
              const message = `Create index ${JSON.stringify(index)} in collection ${tenantCollectionName}`;
              Utils.isDevelopmentEnv() && Logging.logConsoleDebug(message);
              await Logging.logInfo({
                tenantID: Constants.DEFAULT_TENANT_ID,
                action: ServerAction.MONGO_DB,
                module: MODULE_NAME, method: 'handleIndexesInCollection',
                message, detailedMessages: { tenantCollectionName, name, indexes, indexFields: index.fields, indexOptions: index.options }
              });
            }
            try {
              await this.database.collection(tenantCollectionName, collectionOptions).createIndex(index.fields, index.options);
            } catch (error) {
              const message = `Error in creating index '${JSON.stringify(index.fields)}' with options '${JSON.stringify(index.options)}' in '${tenantCollectionName}': ${error.message as string}`;
              Logging.logConsoleError(message);
              await Logging.logError({
                tenantID: Constants.DEFAULT_TENANT_ID,
                action: ServerAction.MONGO_DB,
                module: MODULE_NAME, method: 'handleIndexesInCollection',
                message, detailedMessages: { error: error.stack, tenantCollectionName, name, indexes, indexFields: index.fields, indexOptions: index.options }
              });
            }
          }
        }
      }
    } catch (error) {
      const message = `Unexpected error in handling Collection '${tenantID}.${name}': ${error.message as string}`;
      Logging.logConsoleError(message);
      await Logging.logError({
        tenantID: Constants.DEFAULT_TENANT_ID,
        action: ServerAction.MONGO_DB,
        module: MODULE_NAME, method: 'handleIndexesInCollection',
        message, detailedMessages: { error: error.stack, tenantID, name, indexes }
      });
    }
  }

  private buildIndexName(indexes: IndexSpecification): string {
    const indexNameValues: string[] = [];
    for (const indexKey in indexes as any) {
      indexNameValues.push(indexKey);
      indexNameValues.push(indexes[indexKey]);
    }
    return indexNameValues.join('_');
  }
}
