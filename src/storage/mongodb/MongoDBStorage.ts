import { ChangeStream, Collection, Db, GridFSBucket, MongoClient } from 'mongodb';

import BackendError from '../../exception/BackendError';
import Configuration from '../../utils/Configuration';
import Constants from '../../utils/Constants';
import DatabaseUtils from './DatabaseUtils';
import { LockEntity } from '../../types/Locking';
import LockingManager from '../../locking/LockingManager';
import Logging from '../../utils/Logging';
import MigrationConfiguration from '../../types/configuration/MigrationConfiguration';
import { ServerAction } from '../../types/Server';
import StorageCfg from '../../types/configuration/StorageConfiguration';
import Utils from '../../utils/Utils';
import cluster from 'cluster';
import mongoUriBuilder from 'mongo-uri-builder';
import urlencode from 'urlencode';

const MODULE_NAME = 'MongoDBStorage';

export default class MongoDBStorage {
  private db: Db;
  private readonly dbConfig: StorageCfg;
  private readonly migrationConfig: MigrationConfiguration;

  // Create database access
  public constructor(dbConfig: StorageCfg) {
    this.dbConfig = dbConfig;
    this.migrationConfig = Configuration.getMigrationConfig();
  }

  public getCollection<type>(tenantID: string, collectionName: string): Collection<type> {
    if (!this.db) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME,
        method: 'getCollection',
        message: 'Not supposed to call getCollection before database start',
        action: ServerAction.MONGO_DB
      });
    }
    return this.db.collection<type>(DatabaseUtils.getCollectionName(tenantID, collectionName));
  }

  public watch(pipeline, options): ChangeStream {
    return this.db.watch(pipeline, options);
  }

  public async checkAndCreateTenantDatabase(tenantID: string): Promise<void> {
    // Safety check
    if (!this.db) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME,
        method: 'checkAndCreateTenantDatabase',
        message: 'Not supposed to call checkAndCreateTenantDatabase before database start',
        action: ServerAction.MONGO_DB
      });
    }
    Logging.logDebug({
      tenantID: tenantID,
      action: ServerAction.MONGO_DB,
      message: 'Check of MongoDB database...',
      module: MODULE_NAME, method: 'checkAndCreateTenantDatabase'
    });
    // Users
    await this.handleIndexesInCollection(tenantID, 'users', [
      { fields: { deleted: 1, name: 1 } },
      { fields: { issuer: 1, name: 1 } },
      { fields: { email: 1 }, options: { unique: true } },
      { fields: { 'address.coordinates': '2dsphere' } },
    ]);
    await this.handleIndexesInCollection(tenantID, 'eulas');
    // Assets
    await this.handleIndexesInCollection(tenantID, 'assets', [
    ]);
    // Invoices
    await this.handleIndexesInCollection(tenantID, 'invoices', [
      { fields: { invoiceID: 1 }, options: { unique: true } },
    ]);
    // Logs
    await this.handleIndexesInCollection(tenantID, 'logs', [
      { fields: { timestamp: 1 } },
      { fields: { type: 1, timestamp: 1 } },
      { fields: { action: 1, timestamp: 1 } },
      { fields: { level: 1, timestamp: 1 } },
      { fields: { source: 1, timestamp: 1 } },
      { fields: { host: 1, timestamp: 1 } },
      { fields: { message: 'text', source: 'text', host: 'text', action: 'text' } },
    ]);
    // MeterValues
    await this.handleIndexesInCollection(tenantID, 'metervalues', [
      { fields: { timestamp: 1 } },
      { fields: { transactionId: 1 } }
    ]);
    // Status Notifications
    await this.handleIndexesInCollection(tenantID, 'statusnotifications', [
      { fields: { timestamp: 1 } }
    ]);
    // Tags
    await this.handleIndexesInCollection(tenantID, 'tags', [
      { fields: { deleted: 1, createdOn: 1 } },
      { fields: { issuer: 1, createdOn: 1 } },
      { fields: { userID: 1 } }
    ]);
    // Sites/Users
    await this.handleIndexesInCollection(tenantID, 'siteusers', [
      { fields: { siteID: 1, userID: 1 }, options: { unique: true } },
      { fields: { userID: 1 } }
    ]);
    // User Cars
    await this.handleIndexesInCollection(tenantID, 'carusers', [
      { fields: { userID: 1, carID: 1 }, options: { unique: true } }
    ]);
    // Cars
    await this.handleIndexesInCollection(tenantID, 'cars', [
      { fields: { vin: 1, licensePlate: 1 }, options: { unique: true } },
    ]);
    // Car Catalogs
    await this.handleIndexesInCollection(tenantID, 'carcatalogimages', [
      { fields: { carID: 1 } }
    ]);
    // Transactions
    await this.handleIndexesInCollection(tenantID, 'transactions', [
      { fields: { issuer: 1, timestamp: 1 } },
      { fields: { chargeBoxID: 1 } },
      { fields: { tagID: 1 } },
      { fields: { userID: 1 } }
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
    ]);
    // Site Area
    await this.handleIndexesInCollection(tenantID, 'siteareas', [
      { fields: { 'address.coordinates': '2dsphere' } },
    ]);
    // Charging Stations
    await this.handleIndexesInCollection(tenantID, 'chargingstations', [
      { fields: { coordinates: '2dsphere' } },
    ]);
    Logging.logDebug({
      tenantID: tenantID,
      action: ServerAction.MONGO_DB,
      message: 'Check of MongoDB database done',
      module: MODULE_NAME, method: 'checkAndCreateTenantDatabase'
    });
  }

  public async deleteTenantDatabase(tenantID: string): Promise<void> {
    // Not the Default tenant
    if (tenantID !== Constants.DEFAULT_TENANT) {
      // Safety check
      if (!this.db) {
        throw new BackendError({
          source: Constants.CENTRAL_SERVER,
          module: MODULE_NAME,
          method: 'deleteTenantDatabase',
          message: 'Not supposed to call deleteTenantDatabase before database start',
          action: ServerAction.MONGO_DB
        });
      }
      // Get all the collections
      const collections = await this.db.listCollections().toArray();
      // Check and Delete
      for (const collection of collections) {
        // Check
        if (collection.name.startsWith(`${tenantID}.`)) {
          // Delete
          await this.db.collection(collection.name).drop();
        }
      }
    }
  }

  public getGridFSBucket(name: string): GridFSBucket {
    return new GridFSBucket(this.db, { bucketName: name });
  }

  public async start(): Promise<void> {
    // Log
    console.log(`Connecting to '${this.dbConfig.implementation}' ${cluster.isWorker ? 'in worker ' + cluster.worker.id.toString() : 'in master'}...`);
    // Build EVSE URL
    let mongoUrl: string;
    // URI provided?
    if (this.dbConfig.uri) {
      // Yes: use it
      mongoUrl = this.dbConfig.uri;
    } else {
      // No: Build it
      mongoUrl = mongoUriBuilder({
        host: urlencode(this.dbConfig.host),
        port: Utils.convertToInt(urlencode(this.dbConfig.port.toString())),
        username: urlencode(this.dbConfig.user),
        password: urlencode(this.dbConfig.password),
        database: urlencode(this.dbConfig.database),
        options: {
          replicaSet: this.dbConfig.replicaSet
        }
      });
    }
    // Connect to EVSE
    const mongoDBClient = await MongoClient.connect(
      mongoUrl,
      {
        useNewUrlParser: true,
        poolSize: this.dbConfig.poolSize,
        replicaSet: this.dbConfig.replicaSet,
        loggerLevel: (this.dbConfig.debug ? 'debug' : null),
        useUnifiedTopology: true
      }
    );
    // Get the EVSE DB
    this.db = mongoDBClient.db(this.dbConfig.schema);
    // Check Database only when migration is active
    if (this.migrationConfig.active) {
      await this.checkDatabase();
    }
    console.log(`Connected to '${this.dbConfig.implementation}' successfully ${cluster.isWorker ? 'in worker ' + cluster.worker.id.toString() : 'in master'}`);
  }

  private async checkDatabase(): Promise<void> {
    // Safety check
    if (!this.db) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME,
        method: 'checkDatabase',
        message: 'Not supposed to call checkDatabase before database start',
        action: ServerAction.MONGO_DB
      });
    }
    // Check only collections with indexes
    // Tenants
    await this.handleIndexesInCollection(Constants.DEFAULT_TENANT, 'tenants', [
      { fields: { subdomain: 1 }, options: { unique: true } },
      { fields: { name: 1 }, options: { unique: true } }
    ]);
    // Users
    await this.handleIndexesInCollection(Constants.DEFAULT_TENANT, 'users', [
      { fields: { email: 1 }, options: { unique: true } }
    ]);
    // Logs
    await this.handleIndexesInCollection(Constants.DEFAULT_TENANT, 'logs', [
      { fields: { timestamp: 1 } },
      { fields: { type: 1, timestamp: 1 } },
      { fields: { action: 1, timestamp: 1 } },
      { fields: { level: 1, timestamp: 1 } },
      { fields: { source: 1, timestamp: 1 } },
      { fields: { host: 1, timestamp: 1 } },
      { fields: { message: 'text', source: 'text', host: 'text', action: 'text' } },
    ]);
    // Locks
    await this.handleIndexesInCollection(Constants.DEFAULT_TENANT, 'locks', [
    ]);
    // Get all the collections
    const collections = await this.db.listCollections().toArray();
    for (const collection of collections) {
      if (collection.name === 'migrations') {
        await this.db.collection(collection.name).rename(DatabaseUtils.getCollectionName(Constants.DEFAULT_TENANT, collection.name), { dropTarget: true });
      }
      if (collection.name === DatabaseUtils.getCollectionName(Constants.DEFAULT_TENANT, 'runningmigrations')) {
        await this.db.collection(collection.name).drop();
      }
    }
    const tenantsMDB = await this.db.collection(DatabaseUtils.getCollectionName(Constants.DEFAULT_TENANT, 'tenants'))
      .find({}).toArray();
    const tenantIds = tenantsMDB.map((t): string => t._id.toString());
    for (const tenantId of tenantIds) {
      // Database creation Lock
      const createDatabaseLock = LockingManager.createExclusiveLock(tenantId, LockEntity.DATABASE, 'check-database');
      if (await LockingManager.acquire(createDatabaseLock)) {
        try {
          // Create tenant collections
          await this.checkAndCreateTenantDatabase(tenantId);
        } finally {
          // Release the database creation Lock
          await LockingManager.release(createDatabaseLock);
        }
      }
    }
  }

  private async handleIndexesInCollection(tenantID: string,
    name: string, indexes?: { fields: any; options?: any }[]): Promise<void> {
    // Safety check
    if (!this.db) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME,
        method: 'handleIndexesInCollection',
        message: 'Not supposed to call handleIndexesInCollection before database start',
        action: ServerAction.MONGO_DB
      });
    }
    // Get all the collections
    const currentCollections = await this.db.listCollections().toArray();
    const tenantCollectionName = DatabaseUtils.getCollectionName(tenantID, name);
    const foundCollection = currentCollections.find((collection) => collection.name === tenantCollectionName);
    // Create
    if (!foundCollection) {
      try {
        await this.db.createCollection(tenantCollectionName);
      } catch (error) {
        console.error(`>>>>> Error in creating collection '${tenantCollectionName}': ${error.message}`);
      }
    }
    // Indexes?
    if (indexes) {
      // Get current indexes
      const databaseIndexes = await this.db.collection(tenantCollectionName).listIndexes().toArray();
      // Drop indexes
      for (const databaseIndex of databaseIndexes) {
        if (databaseIndex.key._id) {
          continue;
        }
        const foundIndex = indexes.find((index) => this.buildIndexName(index.fields) === databaseIndex.name);
        if (!foundIndex) {
          if (Utils.isDevelopmentEnv()) {
            console.log(`Drop index ${databaseIndex.name} on collection ${tenantID}.${name}`);
          }
          try {
            await this.db.collection(tenantCollectionName).dropIndex(databaseIndex.key);
          } catch (error) {
            console.error(`>>>>> Error in dropping index '${databaseIndex.name}' in '${tenantCollectionName}': ${error.message}`);
          }
        }
      }
      // Create indexes
      for (const index of indexes) {
        const foundIndex = databaseIndexes.find((databaseIndex) => this.buildIndexName(index.fields) === databaseIndex.name);
        if (!foundIndex) {
          if (Utils.isDevelopmentEnv()) {
            console.log(`Create index ${JSON.stringify(index)} on collection ${tenantID}.${name}`);
          }
          try {
            // eslint-disable-next-line @typescript-eslint/await-thenable
            await this.db.collection(tenantCollectionName).createIndex(index.fields, index.options);
          } catch (error) {
            console.error(`>>>>> Error in creating index '${JSON.stringify(index.fields)}' with options '${JSON.stringify(index.options)}' in '${tenantCollectionName}': ${error.message}`);
          }
        }
      }
    }
  }

  private buildIndexName(indexes: { [key: string]: string }): string {
    const indexNameValues: string[] = [];
    for (const indexKey in indexes) {
      indexNameValues.push(indexKey);
      indexNameValues.push(indexes[indexKey]);
    }
    return indexNameValues.join('_');
  }
}
