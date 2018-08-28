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
			indexes.forEach(async (index) => {
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
			});
		}
	}

	async checkDatabase(db) {
		// Get all the collections
		let collections = await db.listCollections({}).toArray();
		// Check only collections with indexes
		// Users
		await this.checkAndCreateCollection(db, collections, 'users', [
			{ fields: { email: 1 }, options: { unique: true } } 
		]);
		await this.checkAndCreateCollection(db, collections, 'eulas');
		// Logs
		await this.checkAndCreateCollection(db, collections, 'logs', [
			{ fields: { timestamp: 1 } },
			{ fields: { level: 1 } },
			{ fields: { type: 1 }	} 
		]);
		// MeterValues
		await this.checkAndCreateCollection(db, collections, 'metervalues', [
			{ fields: { timestamp: 1 } },
			{ fields: { transactionId: 1 } }
		]);
		// Tags
		await this.checkAndCreateCollection(db, collections, 'tags', [
			{ fields: { userID: 1 } }
		]);
		// Sites/Users
		await this.checkAndCreateCollection(db, collections, 'siteusers', [
			{ fields: { siteID: 1 } },
			{ fields: { userID: 1 } }
		]);
		// Transactions
		await this.checkAndCreateCollection(db, collections, 'transactions', [
			{ fields: { timestamp: 1 } },
			{ fields: { chargeBoxID: 1 } },
			{ fields: { userID: 1 } }
		]);
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
				loggerLevel: (_dbConfig.debug ? 'debug' : null)
			}
		);
		// Get the EVSE DB
		_db = _mongoDBClient.db(_dbConfig.schema);

		// Check EVSE Database
		await this.checkDatabase(_db);

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
