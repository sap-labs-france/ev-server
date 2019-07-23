import cluster from 'cluster';
import mongoUriBuilder from 'mongo-uri-builder';
import { ChangeStream, Collection, Db, MongoClient } from 'mongodb';
import urlencode from 'urlencode';
import Constants from '../../utils/Constants';
import DatabaseUtils from './DatabaseUtils';
import InternalError from '../../exception/InternalError';
import RunLock from './../../utils/Locking';
import StorageCfg from '../../types/configuration/StorageConfiguration';

export default class MongoDBStorage {
  private db: Db;
  private readonly dbConfig: StorageCfg;

  // Create database access
  public constructor(dbConfig: StorageCfg) {
    this.dbConfig = dbConfig;
  }

  public getCollection<type>(tenantID: string, collectionName: string): Collection<type> {
    if (!this.db) {
      throw new InternalError('Not supposed to call getCollection before start', []);
    }
    return this.db.collection<type>(DatabaseUtils.getCollectionName(tenantID, collectionName));
  }

  public watch(pipeline, options): ChangeStream {
    return this.db.watch(pipeline, options);
  }

  public async handleIndexesInCollection(allCollections: { name: string }[], tenantID: string, name: string, indexes?: { fields: any; options?: any }[]): Promise<boolean> {
    // Safety check
    if (!this.db) {
      throw new InternalError('Not supposed to call handleIndexesInCollection before start', []);
    }

    // Check Logs
    const tenantCollectionName = DatabaseUtils.getCollectionName(tenantID, name);
    const foundCollection = allCollections.find((collection) => {
      return collection.name === tenantCollectionName;
    });
    // Check if it exists
    if (!foundCollection) {
      // Create
      await this.db.createCollection(tenantCollectionName);
    }
    // Indexes?
    if (indexes) {
      // Get current indexes
      const databaseIndexes = await this.db.collection(tenantCollectionName).listIndexes().toArray();
      // Check each index that should be created
      for (const index of indexes) {
        // Create
        // Check if it exists
        const foundIndex = databaseIndexes.find((existingIndex) => {
          return (JSON.stringify(existingIndex.key) === JSON.stringify(index.fields));
        });
        // Found?
        if (!foundIndex) {
          // Index creation RunLock
          const indexCreationLock = new RunLock(`Index creation ${tenantID}~${name}~${JSON.stringify(index.fields)}`);

          if (await indexCreationLock.tryAcquire()) {
            // Create Index
            await this.db.collection(tenantCollectionName).createIndex(index.fields, index.options);

            // Release the index creation RunLock
            await indexCreationLock.release();
          }
        }
      }
      // Check each index that should be dropped
      for (const databaseIndex of databaseIndexes) {
        // Bypass ID
        if (databaseIndex.key._id) {
          continue;
        }
        // Exists?
        const foundIndex = indexes.find((index) => {
          return (JSON.stringify(index.fields) === JSON.stringify(databaseIndex.key));
        });
        // Found?
        if (!foundIndex) {
          // Index drop RunLock
          const indexDropLock = new RunLock(`Index drop ${tenantID}~${name}~${JSON.stringify(databaseIndex.key)}`);

          if (await indexDropLock.tryAcquire()) {
            // Drop Index
            await this.db.collection(tenantCollectionName).dropIndex(databaseIndex.key);

            // Release the index drop RunLock
            await indexDropLock.release();
          }
        }
      }
    }
    return false; // TODO: Is this wanted behavior? Previously, sometimes returned bool sometimes nothing.
  }

  public async checkAndCreateTenantDatabase(tenantID: string): Promise<void> {
    // Safety check
    if (!this.db) {
      throw new InternalError('Not supposed to call checkAndCreateTenantDatabase before start', []);
    }

    const name = new RegExp(`^${tenantID}.`);
    // Get all the tenant collections
    const collections = await this.db.listCollections({ name: name }).toArray();
    // Users
    await this.handleIndexesInCollection(collections, tenantID, 'users', [
      { fields: { email: 1 }, options: { unique: true } }
    ]);
    await this.handleIndexesInCollection(collections, tenantID, 'eulas');
    // Logs
    await this.handleIndexesInCollection(collections, tenantID, 'logs', [
      { fields: { timestamp: 1 } },
      { fields: { timestamp: -1 } },
      { fields: { action: 1, timestamp: 1 } },
      { fields: { action: 1, timestamp: -1 } },
      { fields: { level: 1, timestamp: 1 } },
      { fields: { level: 1, timestamp: -1 } },
      { fields: { source: 1, timestamp: 1 } },
      { fields: { source: 1, timestamp: -1 } }
    ]);
    // MeterValues
    await this.handleIndexesInCollection(collections, tenantID, 'metervalues', [
      { fields: { timestamp: 1 } },
      { fields: { transactionId: 1 } }
    ]);
    // Tags
    await this.handleIndexesInCollection(collections, tenantID, 'tags', [
      { fields: { userID: 1 } }
    ]);
    // Sites/Users
    await this.handleIndexesInCollection(collections, tenantID, 'siteusers', [
      { fields: { siteID: 1, userID: 1 }, options: { unique: true } },
      { fields: { userID: 1 } }
    ]);
    // Transactions
    await this.handleIndexesInCollection(collections, tenantID, 'transactions', [
      { fields: { timestamp: 1 } },
      { fields: { chargeBoxID: 1 } },
      { fields: { userID: 1 } }
    ]);
    // Settings
    await this.handleIndexesInCollection(collections, tenantID, 'settings', [
      { fields: { identifier: 1 }, options: { unique: true } }
    ]);
    await this.handleIndexesInCollection(collections, tenantID, 'connections', [
      { fields: { connectorId: 1, userId: 1 }, options: { unique: true } }
    ]);
    await this.handleIndexesInCollection(collections, tenantID, 'consumptions', [
      { fields: { siteID: 1 } },
      { fields: { transactionId: 1, endedAt: 1 } },
      { fields: { siteAreaID: 1 } },
      { fields: { transactionId: 1 } },
      { fields: { chargeBoxID: 1, connectorId: 1 } },
      { fields: { userID: 1 } }
    ]);
  }

  public async deleteTenantDatabase(tenantID: string): Promise<void> {
    // Delay the deletion: there are some collections remaining after Unit Test execution
    setTimeout(async () => {
      // Not the Default tenant
      if (tenantID !== Constants.DEFAULT_TENANT) {
        // Safety check
        if (!this.db) {
          throw new InternalError('Not supposed to call deleteTenantDatabase before start', []);
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
    }, Constants.HTTP_GENERAL_ERROR);
  }

  public async migrateTenantDatabase(tenantID: string): Promise<void> {
    // Safety check
    if (!this.db) {
      throw new InternalError('Not supposed to call migrateTenantDatabase before start', []);
    }
    // Migrate not prefixed collections
    const collections = await this.db.listCollections().toArray();

    for (const collection of collections) {
      if (!DatabaseUtils.getFixedCollections().includes(collection.name) && !collection.name.includes('.')) {
        await this.db.collection(collection.name).rename(DatabaseUtils.getCollectionName(tenantID, collection.name));
      }
    }
  }

  public async checkDatabase(): Promise<void> {
    // Safety check
    if (!this.db) {
      throw new InternalError('Not supposed to call checkDatabase before start', []);
    }
    // Get all the collections
    const collections = await this.db.listCollections().toArray();
    // Check only collections with indexes
    // Tenants
    await this.handleIndexesInCollection(collections, Constants.DEFAULT_TENANT, 'tenants', [
      { fields: { subdomain: 1 }, options: { unique: true } },
      { fields: { name: 1 }, options: { unique: true } }
    ]);
    // Users
    await this.handleIndexesInCollection(collections, Constants.DEFAULT_TENANT, 'users', [
      { fields: { email: 1 }, options: { unique: true } }
    ]);
    // Logs
    await this.handleIndexesInCollection(collections, Constants.DEFAULT_TENANT, 'logs', [
      { fields: { timestamp: 1 } },
      { fields: { level: 1 } },
      { fields: { type: 1 } }
    ]);
    // Locks
    await this.handleIndexesInCollection(collections, Constants.DEFAULT_TENANT, 'locks', [
      { fields: { type: 1, name: 1 }, options: { unique: true } }
    ]);

    for (const collection of collections) {
      if (collection.name === 'migrations') {
        await this.db.collection(collection.name).rename(DatabaseUtils.getCollectionName(Constants.DEFAULT_TENANT, collection.name), { dropTarget: true });
      }
      if (collection.name === 'runningmigrations') {
        await this.db.collection(collection.name).drop();
      }
    }

    // TODO: could create class representing tenant collection for great typechecking
    const tenantsMDB = await this.db.collection(DatabaseUtils.getCollectionName(Constants.DEFAULT_TENANT, 'tenants'))
      .find({})
      .toArray();
    const tenantIds = tenantsMDB.map((t): string => {
      return t._id.toString();
    });
    for (const tenantId of tenantIds) {
      await this.checkAndCreateTenantDatabase(tenantId);
    }
  }

  async start(): Promise<void> {
    // Log
    // eslint-disable-next-line no-console
    console.log(`Connecting to '${this.dbConfig.implementation}' ${cluster.isWorker ? 'in worker ' + cluster.worker.id : 'in master'}...`);
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
        port: Number.parseInt(urlencode(this.dbConfig.port + '')),
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
        reconnectTries: Number.MAX_VALUE,
        reconnectInterval: 1000,
        autoReconnect: true
      }
    );
    // Get the EVSE DB
    this.db = mongoDBClient.db(this.dbConfig.schema);

    // Check Database
    await this.checkDatabase();
    // eslint-disable-next-line no-console
    console.log(`Connected to '${this.dbConfig.implementation}' successfully ${cluster.isWorker ? 'in worker ' + cluster.worker.id : 'in master'}`);
  }
}
