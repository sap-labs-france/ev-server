const mongoose = require('mongoose');
const Logging = require('../../../utils/Logging');
const Utils = require('../../../utils/Utils');
const Constants = require('../../../utils/Constants');
const Database = require('../../../utils/Database');
const MDBConfiguration = require('../model/MDBConfiguration');
const MDBStatusNotification = require('../model/MDBStatusNotification');
const MDBBootNotification = require('../model/MDBBootNotification');
const MDBDataTransfer = require('../model/MDBDataTransfer');
const MDBDiagnosticsStatusNotification = require('../model/MDBDiagnosticsStatusNotification');
const MDBFirmwareStatusNotification = require('../model/MDBFirmwareStatusNotification');
const MDBChargingStation = require('../model/MDBChargingStation');
const MDBAuthorize = require('../model/MDBAuthorize');
const ChargingStation = require('../../../model/ChargingStation');
const SiteArea = require('../../../model/SiteArea');
const crypto = require('crypto');
const ObjectId = mongoose.Types.ObjectId;

let _centralRestServer;
let _db;

class ChargingStationStorage {
	static setCentralRestServer(centralRestServer) {
		_centralRestServer = centralRestServer;
	}

	static setDatabase(db) {
		_db = db;
	}

	static handleGetChargingStation(id) {
		// Create Aggregation
		let aggregation = [];
		// Filters
		aggregation.push({
			$match: { _id: id }
		});
		// Add Created By / Last Changed By
		Utils.pushCreatedLastChangedInAggregation(aggregation);
		// Add
		aggregation.push({
			$lookup: {
				from: "siteareas",
				localField: "siteAreaID",
				foreignField: "_id",
				as: "siteArea"
			}
		});
		// Add
		aggregation.push({
			$unwind: { "path": "$siteArea", "preserveNullAndEmptyArrays": true }
		});
		// Execute
		return MDBChargingStation.aggregate(aggregation)
				.exec().then((chargingStationMDB) => {
			let chargingStation = null;
			// Found
			if (chargingStationMDB && chargingStationMDB.length > 0) {
				// Create
				chargingStation = new ChargingStation(chargingStationMDB[0]);
				// Set Site Area
				if (chargingStationMDB[0].siteArea) {
					chargingStation.setSiteArea(
						new SiteArea(chargingStationMDB[0].siteArea));
				}
			}
			return chargingStation;
		});
	}

	static handleGetChargingStations(searchValue, siteAreaID, withNoSiteArea, numberOfChargingStations) {
		// Check Limit
		numberOfChargingStations = Utils.checkRecordLimit(numberOfChargingStations);
		// Create Aggregation
		let aggregation = [];
		// Set the filters
		let filters = {
			"$and": [
				{
					"$or": [
						{ "deleted": { $exists: false } },
						{ "deleted": false }
					]
				}
			]
		};
		// Source?
		if (searchValue) {
			// Build filter
			filters.$and.push({
				"$or": [
					{ "_id" : { $regex : searchValue, $options: 'i' } }
				]
			});
		}
		// Source?
		if (siteAreaID) {
			// Build filter
			filters.$and.push({
				"siteAreaID": new ObjectId(siteAreaID)
			});
		}
		// With no Site Area
		if (withNoSiteArea) {
			// Build filter
			// Build filter
			filters.$and.push({
				"siteAreaID": null
			});
		}
		// Filters
		aggregation.push({
			$match: filters
		});
		// Add Created By / Last Changed By
		Utils.pushCreatedLastChangedInAggregation(aggregation);
		// Single Record
		aggregation.push({
			$sort: { _id : 1 }
		});
		// Limit
		if (numberOfChargingStations > 0) {
			aggregation.push({
				$limit: numberOfChargingStations
			});
		}
		// Execute
		return MDBChargingStation.aggregate(aggregation)
				.exec().then((chargingStationsMDB) => {
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
		// Check Site Area
		if (chargingStation.siteArea && chargingStation.siteArea.id) {
			// Set the ID
			chargingStation.siteAreaID = chargingStation.siteArea.id;
		} else {
			// Set it to null
			chargingStation.siteAreaID = null;
		}
		// Check Created By
		if (chargingStation.createdBy && typeof chargingStation.createdBy == "object") {
			// This is the User Model
			chargingStation.createdBy = new ObjectId(chargingStation.createdBy.id);
		}
		// Check Last Changed By
		if (chargingStation.lastChangedBy && typeof chargingStation.lastChangedBy == "object") {
			// This is the User Model
			chargingStation.lastChangedBy = new ObjectId(chargingStation.lastChangedBy.id);
		}
		// Update
		return MDBChargingStation.findOneAndUpdate(
			{"_id": chargingStation.id},
			chargingStation,
			{new: true, upsert: true}).then((chargingStationMDB) => {
				let newChargingStation = new ChargingStation(chargingStationMDB);
				// Notify Change
				if (!chargingStation.id) {
					_centralRestServer.notifyChargingStationCreated(
						{
							"id" : newChargingStation.id,
							"type": Constants.NOTIF_ENTITY_CHARGING_STATION
						}
					);
				} else {
					_centralRestServer.notifyChargingStationUpdated(
						{
							"id" : chargingStation.id,
							"type": Constants.NOTIF_ENTITY_CHARGING_STATION
						}
					);
				}
				return newChargingStation;
		});
	}

	static handleSaveChargingStationConnector(chargingStation, connectorId) {
		let updatedFields = {};
		updatedFields["connectors." + (connectorId-1)] = chargingStation.connectors[connectorId-1];
		// Update
		return MDBChargingStation.findByIdAndUpdate(
				chargingStation.id,
				updatedFields).then((chargingStationMDB) => {
			let newChargingStation = new ChargingStation(chargingStationMDB);
			_centralRestServer.notifyChargingStationUpdated(
				{
					"id" : chargingStation.id,
					"connectorId": connectorId,
					"type": Constants.NOTIF_ENTITY_CHARGING_STATION_STATUS
				}
			);
			return newChargingStation;
		});
	}

	static handleSaveChargingStationParams(chargingStation) {
		let updatedFields = {};
		updatedFields["chargingStationURL"] = chargingStation.chargingStationURL;
		updatedFields["numberOfConnectedPhase"] = chargingStation.numberOfConnectedPhase;
		// Update
		return MDBChargingStation.findByIdAndUpdate(
				chargingStation.id,
				updatedFields).then((chargingStationMDB) => {
			let newChargingStation = new ChargingStation(chargingStationMDB);
			_centralRestServer.notifyChargingStationUpdated(
				{
					"id" : chargingStation.id,
					"type": Constants.NOTIF_ENTITY_CHARGING_STATION
				}
			);
			return newChargingStation;
		});
	}

	static handleSaveChargingStationHeartBeat(chargingStation) {
		let updatedFields = {};
		updatedFields["lastHeartBeat"] = chargingStation.lastHeartBeat;
		// Update
		return MDBChargingStation.findByIdAndUpdate(
				chargingStation.id,
				updatedFields).then((chargingStationMDB) => {
			let newChargingStation = new ChargingStation(chargingStationMDB);
			_centralRestServer.notifyChargingStationUpdated(
				{
					"id" : chargingStation.id,
					"type": Constants.NOTIF_ENTITY_CHARGING_STATION
				}
			);
			return newChargingStation;
		});
	}

	static handleSaveChargingStationSiteArea(chargingStation) {
		let updatedFields = {};
		updatedFields["siteAreaID"] = (chargingStation.siteArea ? chargingStation.siteArea.id : null);
		// Check Last Changed By
		if (chargingStation.lastChangedBy && typeof chargingStation.lastChangedBy == "object") {
			// This is the User Model
			updatedFields["lastChangedBy"] = new ObjectId(chargingStation.lastChangedBy.id);
			updatedFields["lastChangedOn"] = chargingStation.lastChangedOn;
		}
		// Update
		return MDBChargingStation.findByIdAndUpdate(
				chargingStation.id,
				updatedFields).then((chargingStationMDB) => {
			let newChargingStation = new ChargingStation(chargingStationMDB);
			_centralRestServer.notifyChargingStationUpdated(
				{
					"id" : chargingStation.id,
					"type": Constants.NOTIF_ENTITY_CHARGING_STATION
				}
			);
			return newChargingStation;
		});
	}

	static handleDeleteChargingStation(id) {
		// Remove Configuration
		return MDBConfiguration.findByIdAndRemove( id ).then((result) => {
			// Remove Charging Station
			return MDBChargingStation.findByIdAndRemove( id );
		}).then((result) => {
			// Notify Change
			_centralRestServer.notifyChargingStationDeleted(
				{
					"id": id,
					"type": Constants.NOTIF_ENTITY_CHARGING_STATION
				}
			);
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
		if (authorize.user) {
			authorizeMDB.userID = authorize.user.getID();
		}
		authorizeMDB.tagID = authorize.idTag;
		// Create new
		return authorizeMDB.save().then(() => {
			// No notification
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
				_centralRestServer.notifyChargingStationUpdated(
					{
						"id" : configuration.chargeBoxID,
						"type": Constants.NOTIF_ENTITY_CHARGING_STATION_CONFIG
					}
				);
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
			// No notification
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
			// No Notification
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
			// No Notification
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
			// No Notification
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
			_centralRestServer.notifyChargingStationUpdated(
				{
					"id": statusNotification.chargeBoxID,
					"connectorId": statusNotification.connectorId,
					"type": Constants.NOTIF_ENTITY_CHARGING_STATION_STATUS
				}
			);
		});
	}

	static handleGetLastStatusNotification(chargeBoxID, connectorId) {
		// Get the Status Notification
		let filter = {};
		filter.chargeBoxID = chargeBoxID;
		filter.connectorId = connectorId;
		// Exec request
		return MDBStatusNotification.find(filter)
				.sort({timestamp: -1})
				.limit(1).exec().then((statusNotificationsMDB) => {
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

	static handleGetStatusNotifications(chargeBoxID, connectorId) {
		let filter = {};
		if (chargeBoxID) {
			filter.chargeBoxID = chargeBoxID;
		}
		if (connectorId) {
			filter.connectorId = connectorId;
		}
		// Exec request
		return MDBStatusNotification.find(filter)
				.sort({timestamp: 1})
				.exec().then((statusNotificationsMDB) => {
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

	static handleGetConfigurationParamValue(chargeBoxID, paramName) {
		// Get the config
		return ChargingStationStorage.getConfiguration(chargeBoxID).then((configuration) => {
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

	static handleGetConfiguration(chargeBoxID) {
		// Exec request
		return MDBConfiguration.findById({"_id": chargeBoxID }).then((configurationMDB) => {
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
