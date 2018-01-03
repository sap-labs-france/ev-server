const Logging = require('../../../utils/Logging');
const Database = require('../../../utils/Database');
const MDBConfiguration = require('../model/MDBConfiguration');
const MDBStatusNotification = require('../model/MDBStatusNotification');
const MDBBootNotification = require('../model/MDBBootNotification');
const MDBDataTransfer = require('../model/MDBDataTransfer');
const MDBDiagnosticsStatusNotification = require('../model/MDBDiagnosticsStatusNotification');
const MDBFirmwareStatusNotification = require('../model/MDBFirmwareStatusNotification');
const MDBAuthorize = require('../model/MDBAuthorize');
const ChargingStation = require('../../../model/ChargingStation');
const crypto = require('crypto');

let _centralRestServer;

class ChargingStationStorage {
	static setCentralRestServer(centralRestServer) {
		_centralRestServer = centralRestServer;
	}

	static handleGetChargingStation(chargeBoxIdentity) {
		// Exec request
		return MDBChargingStation.findById({"_id": chargeBoxIdentity}).then(chargingStationMDB => {
			let chargingStation = null;
			// Found
			if (chargingStationMDB) {
				// Create
				chargingStation = new ChargingStation(chargingStationMDB);
			}
			return chargingStation;
		});
	}

	static handleGetChargingStations(searchValue) {
		// Set the filters
		let filters = {};
		// Source?
		if (searchValue) {
			// Build filter
			filters.$or = [
				{ "_id" : { $regex : `.*${searchValue}.*` } }
			];
		}
		// Exec request
		return MDBChargingStation.find(filters).sort( {_id: 1} ).exec().then((chargingStationsMDB) => {
			let chargingStations = [];
			// Create
			chargingStationsMDB.forEach((chargingStationMDB) => {
				chargingStations.push(new ChargingStation(chargingStationMDB));
			});
			// Ok
			return chargingStations;
		});
	}

	static handleSaveChargingStation(chargingStation) {
		// Get
		return MDBChargingStation.findOneAndUpdate(
			{"_id": chargingStation.chargeBoxIdentity},
			chargingStation,
			{new: true, upsert: true}).then((chargingStationMDB) => {
				let newChargingStation = new ChargingStation(chargingStationMDB);
				// Notify Change
				if (!chargingStation.id) {
					_centralRestServer.notifyChargingStationCreated(newChargingStation.getModel());
				} else {
					_centralRestServer.notifyChargingStationUpdated(newChargingStation.getModel());
				}
				return newChargingStation;
		});
	}

	static handleDeleteChargingStation(id) {
		return MDBChargingStation.remove({ "_id" : id }).then((result) => {
			// Notify Change
			_centralRestServer.notifyChargingStationDeleted({"id": id});
			// Return the result
			return result.result;
		});
	}

	static handleSaveAuthorize(authorize) {
		// Create model
		let authorizeMDB = new MDBAuthorize(authorize);
		// Set the ID
		authorizeMDB._id = crypto.createHash('sha256')
			.update(`${authorize.chargeBoxID}~${authorize.timestamp.toISOString()}`)
			.digest("hex");
		authorizeMDB.userID = authorize.user.getID();
		authorizeMDB.tagID = authorize.idTag;
		// Create new
		return authorizeMDB.save().then(() => {
			// Notify
			_centralRestServer.notifyChargingStationUpdated({"id" : authorize.chargeBoxID});
		});
	}

	static handleSaveConfiguration(configuration) {
		// Create model
		let configurationMDB = {};
		// Set the ID
		configurationMDB._id = configuration.chargeBoxID;
		configurationMDB.configuration = configuration.configurationKey;
		configurationMDB.timestamp = configuration.timestamp;

		// Get
		return MDBConfiguration.findOneAndUpdate(
			{"_id": configuration.chargeBoxID},
			configurationMDB,
			{new: true, upsert: true}).then((chargingStationMDB) => {
				// Notify
				_centralRestServer.notifyChargingStationUpdated({"id" : configuration.chargeBoxID});
				// Return
				return chargingStationMDB;
		});
	}

	static handleSaveDataTransfer(dataTransfer) {
		// Create model
		let dataTransferMDB = new MDBDataTransfer(dataTransfer);
		// Set the ID
		dataTransferMDB._id = crypto.createHash('sha256')
			.update(`${dataTransfer.chargeBoxID}~${dataTransfer.data}~${dataTransfer.timestamp}`)
			.digest("hex");
		// Create new
		return dataTransferMDB.save().then(() => {
			// Notify
			_centralRestServer.notifyChargingStationUpdated({"id" : dataTransfer.chargeBoxID});
		});
	}

	static handleSaveBootNotification(bootNotification) {
		// Create model
		let bootNotificationMDB = new MDBBootNotification(bootNotification);
		// Set the ID
		bootNotificationMDB._id = crypto.createHash('sha256')
			.update(`${bootNotification.chargeBoxID}~${bootNotification.timestamp}`)
			.digest("hex");
		// Create new
		return bootNotificationMDB.save().then(() => {
			// Notify
			_centralRestServer.notifyChargingStationUpdated({"id" : bootNotification.chargeBoxID});
		});
	}

	static handleSaveDiagnosticsStatusNotification(diagnosticsStatusNotification) {
		// Create model
		let diagnosticsstatusNotificationMDB = new MDBDiagnosticsStatusNotification(diagnosticsStatusNotification);
		// Set the ID
		diagnosticsstatusNotificationMDB._id = crypto.createHash('sha256')
			.update(`${diagnosticsStatusNotification.chargeBoxID}~${diagnosticsStatusNotification.timestamp.toISOString()}`)
			.digest("hex");
		// Create new
		return diagnosticsstatusNotificationMDB.save(() => {
			// Notify
			_centralRestServer.notifyChargingStationUpdated({"id" : diagnosticsStatusNotification.chargeBoxID});
		});
	}

	static handleSaveFirmwareStatusNotification(firmwareStatusNotification) {
		// Create model
		let firmwarestatusNotificationMDB = new MDBFirmwareStatusNotification(firmwareStatusNotification);
		// Set the ID
		firmwarestatusNotificationMDB._id = crypto.createHash('sha256')
			.update(`${firmwareStatusNotification.chargeBoxID}~${firmwareStatusNotification.timestamp.toISOString()}`)
			.digest("hex");
		// Create new
		return firmwarestatusNotificationMDB.save().then(() => {
			// Notify
			_centralRestServer.notifyChargingStationUpdated({"id" : firmwareStatusNotification.chargeBoxID});
		});
	}

	static handleSaveStatusNotification(statusNotification) {
		// Create model
		let statusNotificationMDB = new MDBStatusNotification(statusNotification);
		// Set the ID
		statusNotificationMDB._id = crypto.createHash('sha256')
			.update(`${statusNotification.chargeBoxID}~${statusNotification.connectorId}~${statusNotification.status}~${statusNotification.timestamp}`)
			.digest("hex");
		// Create new
		return statusNotificationMDB.save().then(() => {
			// Notify
			_centralRestServer.notifyChargingStationUpdated({"id" : statusNotification.chargeBoxID});
		});
	}

	static handleGetLastStatusNotification(chargeBoxIdentity, connectorId) {
		// Get the Status Notification
		let filter = {};
		filter.chargeBoxID = chargeBoxIdentity;
		filter.connectorId = connectorId;
		// Exec request
		return MDBStatusNotification.find(filter).sort({timestamp: -1}).limit(1).exec().then((statusNotificationsMDB) => {
			let statusNotification = null;
			// At least one
			if (statusNotificationsMDB[0]) {
				statusNotification = {};
				// Set values
				Database.updateStatusNotification(statusNotificationsMDB[0], statusNotification);
			}
			// Ok
			return statusNotification;
		});
	}

	static handleGetStatusNotifications(chargeBoxIdentity, connectorId) {
		let filter = {};
		if (chargeBoxIdentity) {
			filter.chargeBoxID = chargeBoxIdentity;
		}
		if (connectorId) {
			filter.connectorId = connectorId;
		}
		// Exec request
		return MDBStatusNotification.find(filter).sort({timestamp: 1}).exec().then((statusNotificationsMDB) => {
			let statusNotifications = [];
			// Create
			statusNotificationsMDB.forEach((statusNotificationMDB) => {
				let statusNotification = {};
				// Set values
				Database.updateStatusNotification(statusNotificationMDB, statusNotification);
				// Add
				statusNotifications.push(statusNotification);
			});
			// Ok
			return statusNotifications;
		});
	}

	static handleGetConfigurationParamValue(chargeBoxIdentity, paramName) {
		// Get the config
		return ChargingStationStorage.getConfiguration(chargeBoxIdentity).then((configuration) => {
			let value = null;
			if (configuration) {
				// Get the value
				configuration.configuration.every((param) => {
					// Check
					if (param.key === paramName) {
						// Found!
						value = param.value;
						// Break
						return false;
					} else {
						// Continue
						return true;
					}
				});
			}
			return value;
		});
	}

	static handleGetConfiguration(chargeBoxIdentity) {
		// Exec request
		return MDBConfiguration.findById({"_id": chargeBoxIdentity }).then((configurationMDB) => {
			let configuration = null;
			if (configurationMDB) {
				// Set values
				configuration = {};
				Database.updateConfiguration(configurationMDB, configuration);
			}
			// Ok
			return configuration;
		});
	}
}

module.exports = ChargingStationStorage;
