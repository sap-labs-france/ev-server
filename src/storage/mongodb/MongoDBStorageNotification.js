const Logging = require('../../utils/Logging');
const Constants = require('../../utils/Constants');
const TransactionStorage = require('./storage/TransactionStorage');
const NotificationStorage = require('./storage/NotificationStorage');
const VehicleStorage = require('./storage/VehicleStorage');
const SiteStorage = require('./storage/SiteStorage');
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
let _mongoDBClient;

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
		// Log
		console.log(`Starting to pull Notifications from '${_dbConfig.implementation}'...`);
		// Check
		if (_dbConfig.replica) {
			// Build EVSE URL
			let mongoOpLogUrl;
			// URI provided?
			if (_dbConfig.replica.uri) {
				// Yes: use it
				mongoOpLogUrl = _dbConfig.replica.uri;
			} else {
				// Build Replica URL
				mongoOpLogUrl = mongoUriBuilder({
					host: urlencode(_dbConfig.host),
					port: urlencode(_dbConfig.port),
					username: urlencode(_dbConfig.replica.user),
					password: urlencode(_dbConfig.replica.password),
					database: urlencode(_dbConfig.replica.database),
					options: {
						replicaSet: _dbConfig.replicaSet
					}
				});
			}
			// Connect to Replica DB
			_mongoDBClient = await MongoClient.connect(
				mongoOpLogUrl,
				{
					useNewUrlParser: true,
					poolSize: _dbConfig.poolSize,
					replicaSet: _dbConfig.replicaSet,
					loggerLevel: (_dbConfig.debug ? "debug" : null)
				}
			);
		}
		// Get the Local DB
		_localDB = _mongoDBClient.db("local");
		// Start Listening
		setInterval(this.checkChangedCollections.bind(this),
			_dbConfig.replica.intervalPullSecs * 1000);
		// Log
		Logging.logInfo({
			module: "MongoDBStorage", method: "start", action: "Startup",
			message: `Started to pull Notifications from '${_dbConfig.implementation}' successfully` });
		console.log(`Started to pull Notifications from '${_dbConfig.implementation}' successfully`);
	}

	getObjectIDFromOpLogDocument(document) {
		// Check
		switch (document.op) {
			case 'i': // Insert/Create
				return document.o._id.toString();
			case 'u': // Update
				return document.o2._id.toString();
			case 'd': // Delete
				return document.o._id.toString();
		}
		return null;
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
		// Aggregate
		let action, notification;
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
							"id": this.getObjectIDFromOpLogDocument(lastUpdatedEvseDoc)
						});
						break;
					// Charging Station
					case "evse.chargingstations":
						// Notify
						_centralRestServer.notifyChargingStation(action, {
							"id": this.getObjectIDFromOpLogDocument(lastUpdatedEvseDoc)
						});
						break;
					// Vehicle Manufacturer
					case "evse.vehiclemanufacturers":
					case "evse.vehiclemanufacturerlogos":
						// Notify
						_centralRestServer.notifyVehicleManufacturer(action, {
							"id": this.getObjectIDFromOpLogDocument(lastUpdatedEvseDoc)
						});
						break;
					// Vehicle
					case "evse.vehicles":
					case "evse.vehicleimages":
						// Notify
						_centralRestServer.notifyVehicle(action, {
							"id": this.getObjectIDFromOpLogDocument(lastUpdatedEvseDoc)
						});
						break;
					// Company
					case "evse.companies":
					case "evse.companylogos":
						// Notify
						_centralRestServer.notifyCompany(action, {
							"id": this.getObjectIDFromOpLogDocument(lastUpdatedEvseDoc)
						});
						break;
					// Site Area
					case "evse.siteareas":
					case "evse.siteareaimages":
						// Notify
						_centralRestServer.notifySiteArea(action, {
							"id": this.getObjectIDFromOpLogDocument(lastUpdatedEvseDoc)
						});
						break;
					// Site
					case "evse.sites":
					case "evse.siteimages":
						// Notify
						_centralRestServer.notifySite(action, {
							"id": this.getObjectIDFromOpLogDocument(lastUpdatedEvseDoc)
						});
						break;
					// Transaction
					case "evse.transactions":
						notification = {
							"id": this.getObjectIDFromOpLogDocument(lastUpdatedEvseDoc)
						};
						// Operation
						switch (lastUpdatedEvseDoc.op) {
							case 'i': // Insert/Create
								notification.connectorId = lastUpdatedEvseDoc.o.connectorId;
								notification.chargeBoxID = lastUpdatedEvseDoc.o.chargeBoxID;
								break;
							case 'u': // Update
								if (lastUpdatedEvseDoc.o.$set.stop) {
									notification.type = Constants.ENTITY_TRANSACTION_STOP;
								}
								break;
						}
						// Notify
						_centralRestServer.notifyTransaction(action, notification);
						break;
					// Meter Values
					case "evse.metervalues":
						notification = {};
						// Insert/Create?
						if (lastUpdatedEvseDoc.op == 'i') {
							notification.id = lastUpdatedEvseDoc.o.transactionId;
							notification.type = Constants.ENTITY_TRANSACTION_METER_VALUES;
							notification.chargeBoxID = lastUpdatedEvseDoc.o.chargeBoxID;
							notification.connectorId = lastUpdatedEvseDoc.o.connectorId;
							// Notify, Force Transaction Update
							_centralRestServer.notifyTransaction(Constants.ACTION_UPDATE, notification);
						}
						break;
					// Charging Stations Configuration
					case "evse.configurations":
						// Notify
						_centralRestServer.notifyChargingStation(action, {
							"type": Constants.NOTIF_TYPE_CHARGING_STATION_CONFIGURATION,
							"id": this.getObjectIDFromOpLogDocument(lastUpdatedEvseDoc)
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
	}
}

module.exports = MongoDBStorageNotification;
