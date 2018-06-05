const Logging = require('../../utils/Logging');
const Constants = require('../../utils/Constants');
const PricingStorage = require('./storage/PricingStorage');
const TransactionStorage = require('./storage/TransactionStorage');
const NotificationStorage = require('./storage/NotificationStorage');
const VehicleStorage = require('./storage/VehicleStorage');
const SiteStorage = require('./storage/SiteStorage');
const SiteAreaStorage = require('./storage/SiteAreaStorage');
const MigrationStorage = require('./storage/MigrationStorage');
const VehicleManufacturerStorage = require('./storage/VehicleManufacturerStorage');
const assert = require('assert');
const MongoClient = require('mongodb').MongoClient;
const mongoUriBuilder = require('mongo-uri-builder');
const urlencode = require('urlencode');
const Timestamp = require('mongodb').Timestamp;

require('source-map-support').install();

let _dbConfig;
let _localDB;
let _localDBLastTimestampCheck = new Date();
let _centralRestServer;

class MongoDBStorageNotification {
	// Create database access
	constructor(dbConfig) {
		// Keep local
		_dbConfig = dbConfig;
	}

	// Check for permitted operation
	getActionFromOperation(operation) {
		// Check
		switch (operation) {
			case 'i': // Insert/Create
				return Constants.ACTION_CREATE;
			case 'u': // Update
				return Constants.ACTION_UPDATE;
			case 'd': // Delete
				return Constants.ACTION_DELETE;
		}
		return null;
	}

	async start() {
		// Check
		if (_dbConfig.replica) {
			// Build Replica URL
			let mongoOpLogUrl = mongoUriBuilder({
				host: urlencode(_dbConfig.host),
				port: urlencode(_dbConfig.port),
				username: urlencode(_dbConfig.replica.user),
				password: urlencode(_dbConfig.replica.password),
				database: urlencode(_dbConfig.replica.database)
			});
			// Connect to Replica DB
			let clientOpLog = await MongoClient.connect(
				mongoOpLogUrl,
				{
					useNewUrlParser: true,
				});
			// Get the Local DB
			_localDB = clientOpLog.db("local");
			// Start Listening
			setInterval(this.checkChangedCollections.bind(this),
				_dbConfig.replica.intervalPullSecs * 1000);
		}
	}

	async checkChangedCollections()  {
		// Check
		if (!_centralRestServer) {
			return;
		}
		// Get collection
		let lastUpdatedEvseDocs = await _localDB.collection("oplog.rs")
			.find({
				ns : { $regex: new RegExp(`^${_dbConfig.database}`) },
				ts : { $gte : new Timestamp(0, Math.trunc(_localDBLastTimestampCheck.getTime() / 1000)) }
			})
			.toArray();
		console.log(lastUpdatedEvseDocs.length);
		// Aggregate
		let action, notif;
		lastUpdatedEvseDocs.forEach((lastUpdatedEvseDoc) => {
			// Check for permitted operation
			action = this.getActionFromOperation(lastUpdatedEvseDoc.op);
			// Found
			if (action) {
				// Check namespace
				switch (lastUpdatedEvseDoc.ns) {
					// Logs
					case "evse.logs":
						// Notify
						_centralRestServer.notifyLogging(action);
						break;
					// Users
					case "evse.users":
					case "evse.userimages":
						// Notify
						_centralRestServer.notifyUser(action, {
							"id": (lastUpdatedEvseDoc.o2 ? lastUpdatedEvseDoc.o2._id.toString() : lastUpdatedEvseDoc.o._id.toString())
						});
						break;
					// Charging Stations
					case "evse.chargingstations":
						// Notify
						_centralRestServer.notifyChargingStation(action, {
							"id": (lastUpdatedEvseDoc.o2 ? lastUpdatedEvseDoc.o2._id.toString() : lastUpdatedEvseDoc.o._id.toString())
						});
						break;
					// Company
					case "evse.companylogos":
					case "evse.companies":
						// Notify
						_centralRestServer.notifyCompany(action, {
							"id": (lastUpdatedEvseDoc.o2 ? lastUpdatedEvseDoc.o2._id.toString() : lastUpdatedEvseDoc.o._id.toString())
						});
						break;
					// Charging Stations Configuration
					case "evse.configurations":
						// Notify
						_centralRestServer.notifyChargingStation(action, {
							"type": Constants.NOTIF_TYPE_CHARGING_STATION_CONFIGURATION,
							"id": (lastUpdatedEvseDoc.o2 ? lastUpdatedEvseDoc.o2._id.toString() : lastUpdatedEvseDoc.o._id.toString())
						});
						break;
				}
			}
		});
		// Set new last date
		_localDBLastTimestampCheck = new Date();
	}

	setCentralRestServer(centralRestServer) {
		// Set
		_centralRestServer = centralRestServer;
		// Set
		PricingStorage.setCentralRestServer(centralRestServer);
		TransactionStorage.setCentralRestServer(centralRestServer);
		SiteStorage.setCentralRestServer(centralRestServer);
		SiteAreaStorage.setCentralRestServer(centralRestServer);
		VehicleStorage.setCentralRestServer(centralRestServer);
		VehicleManufacturerStorage.setCentralRestServer(centralRestServer);
	}
}

module.exports = MongoDBStorageNotification;
