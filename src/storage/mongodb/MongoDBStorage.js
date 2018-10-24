const Logging = require('../../utils/Logging');
const MongoClient = require('mongodb').MongoClient;
const mongoUriBuilder = require('mongo-uri-builder');
const urlencode = require('urlencode');
const MongoDBStorageNotification = require('./MongoDBStorageNotification');

require('source-map-support').install();

let _dbConfig;
let _mongoDBClient;
let _db;
let _mongoDBStorageNotification;

class MongoDBStorage {
	// Create database access
	constructor(dbConfig) {
		// Keep local
		_dbConfig = dbConfig;
	}

	async checkAndCreateCollection(db, allCollections, name, indexes) {
		// Check Logs
		let foundCollection = allCollections.find((collection) => {
			return collection.name == name;
    });
		// Check if it exists
		if (!foundCollection) {
      // Create
			await db.createCollection(name);
		}
		// Indexes?
		if (indexes) {
			// Get current indexes
			let existingIndexes = await db.collection(name).listIndexes().toArray();
			// Check each index
			for (const index of indexes) {
				// Create
				// Check if it exists
				let foundIndex = existingIndexes.find((existingIndex) => {
					return (JSON.stringify(existingIndex.key) === JSON.stringify(index.fields));
				});
				// Found?
				if (!foundIndex) {
					// No: Create Index
					await db.collection(name).createIndex(index.fields, index.options);
				}
			}
		}
	}

	async createTenantDatabase(db, tenant) {
		let filter = {};
		let prefix = '';
		if (tenant) {
			filter.name = new RegExp(`^${tenant}\.`);
			prefix = `${tenant}.`;
		} else {
			filter.name = new RegExp(`[^\.]`);
		}
		// Get all the tenant collections
		let collections = await db.listCollections(filter).toArray();
		// Users
		await this.checkAndCreateCollection(db, collections, `${prefix}users`, [
			{ fields: { email: 1 }, options: { unique: true } } 
		]);
		await this.checkAndCreateCollection(db, collections, `${prefix}eulas`);
		// Logs
		await this.checkAndCreateCollection(db, collections, `${prefix}logs`, [
			{ fields: { timestamp: 1 } },
			{ fields: { level: 1 } },
			{ fields: { type: 1 }	} 
		]);
		// MeterValues
		await this.checkAndCreateCollection(db, collections, `${prefix}metervalues`, [
			{ fields: { timestamp: 1 } },
			{ fields: { transactionId: 1 } }
		]);
		// Tags
		await this.checkAndCreateCollection(db, collections, `${prefix}tags`, [
			{ fields: { userID: 1 } }
		]);
		// Sites/Users
		await this.checkAndCreateCollection(db, collections, `${prefix}siteusers`, [
			{ fields: { siteID: 1 } },
			{ fields: { userID: 1 } }
		]);
		// Transactions
		await this.checkAndCreateCollection(db, collections, `${prefix}transactions`, [
			{ fields: { timestamp: 1 } },
			{ fields: { chargeBoxID: 1 } },
			{ fields: { userID: 1 } }
		]);
	}

	async checkDatabaseDefaultContent(db) {
		// Tenant
		let tenantsMDB = await db.collection('tenants').find({ subdomain: '' }).toArray();
		// Found?
		if (tenantsMDB.length === 0) {
			// No: Create it
			await db.collection('tenants').insert(
				{ 
					"createdOn" : new Date(), 
					"name": "Master Tenant", 
					"subdomain" : ""
				}
			);
		}
	}

	async checkDatabase(db) {
		// Get all the collections
		let collections = await db.listCollections().toArray();
		// Check only collections with indexes
		// Tenants
		await this.checkAndCreateCollection(db, collections, 'tenants', [
			{ fields: { subdomain: 1 }, options: { unique: true } },
			{ fields: { name: 1 }, options: { unique: true } } 
    ]);
    // Create Tenant DB
		await this.createTenantDatabase(db);
	}

	async start() {
		// Log
		console.log(`Connecting to '${_dbConfig.implementation}'...`);
		// Build EVSE URL
		let mongoUrl;
		// URI provided?
		if (_dbConfig.uri) {
			// Yes: use it
			mongoUrl = _dbConfig.uri;
		} else {
			// No: Build it
			mongoUrl = mongoUriBuilder({
				host: urlencode(_dbConfig.host),
				port: urlencode(_dbConfig.port),
				username: urlencode(_dbConfig.user),
				password: urlencode(_dbConfig.password),
				database: urlencode(_dbConfig.database),
				options: {
					replicaSet: _dbConfig.replicaSet
				}
			});
		}
		// Connect to EVSE
		_mongoDBClient = await MongoClient.connect(
			mongoUrl,
			{
				useNewUrlParser: true,
				poolSize: _dbConfig.poolSize,
				replicaSet: _dbConfig.replicaSet,
				loggerLevel: (_dbConfig.debug ? 'debug' : null),
				reconnectTries: Number.MAX_VALUE,
				reconnectInterval: 1000,
				autoReconnect: true
			}
		);
		// Get the EVSE DB
		_db = _mongoDBClient.db(_dbConfig.schema);

		// Check Database
		await this.checkDatabase(_db);

		// Check Database Default Content
		await this.checkDatabaseDefaultContent(_db);

		// Keep the DB access global
		global.db = _db;

		// Log
		Logging.logInfo({
			module: 'MongoDBStorage', method: 'start', action: 'Startup',
			message: `Connected to '${_dbConfig.implementation}' successfully`
		});
		console.log(`Connected to '${_dbConfig.implementation}' successfully`);
	}

	async setCentralRestServer(centralRestServer) {
		if (_dbConfig.monitorDBChange) {
			// Monitor MongoDB for Notifications
			_mongoDBStorageNotification = new MongoDBStorageNotification(
				_dbConfig, _db);
			// Set Central Rest Server
			_mongoDBStorageNotification.setCentralRestServer(centralRestServer);
			// Start
			await _mongoDBStorageNotification.start();
		}
	}
}

module.exports = MongoDBStorage;
