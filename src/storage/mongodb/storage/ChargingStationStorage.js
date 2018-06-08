const Logging = require('../../../utils/Logging');
const Utils = require('../../../utils/Utils');
const Constants = require('../../../utils/Constants');
const Database = require('../../../utils/Database');
const ChargingStation = require('../../../model/ChargingStation');
const SiteArea = require('../../../model/SiteArea');
const crypto = require('crypto');

let _db;

class ChargingStationStorage {
	static setDatabase(db) {
		_db = db;
	}

	static async handleGetChargingStation(id) {
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
		// Read DB
		let chargingStationMDB = await _db.collection('chargingstations')
			.aggregate(aggregation)
			.limit(1)
			.toArray();
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
	}

	static async handleGetChargingStations(searchValue, siteAreaID, withNoSiteArea, numberOfChargingStations) {
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
				"siteAreaID": Utils.convertToObjectID(siteAreaID)
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
		// Read DB
		let chargingStationsMDB = await _db.collection('chargingstations')
			.aggregate(aggregation)
			.toArray();
		let chargingStations = [];
		// Create
		chargingStationsMDB.forEach((chargingStationMDB) => {
			chargingStations.push(new ChargingStation(chargingStationMDB));
		});
		// Ok
		return chargingStations;
	}

	static async handleSaveChargingStation(chargingStationToSave) {
		// Check Site Area
		if (chargingStationToSave.siteArea && chargingStationToSave.siteArea.id) {
			// Set the ID
			chargingStationToSave.siteAreaID = chargingStationToSave.siteArea.id;
		} else {
			// Set it to null
			chargingStationToSave.siteAreaID = null;
		}
		// Check Created By/On
		chargingStationToSave.createdBy = Utils.convertUserToObjectID(chargingStationToSave.createdBy);
		chargingStationToSave.lastChangedBy = Utils.convertUserToObjectID(chargingStationToSave.lastChangedBy);
		// Transfer
		let chargingStation = {};
		Database.updateChargingStation(chargingStationToSave, chargingStation, false);
		// Modify and return the modified document
	    let result = await _db.collection('chargingstations').findOneAndUpdate(
			{"_id": chargingStationToSave.id},
			{$set: chargingStation},
			{upsert: true, new: true, returnOriginal: false});
		// Create
		return new ChargingStation(result.value);
	}

	static async handleSaveChargingStationConnector(chargingStation, connectorId) {
		let updatedFields = {};
		updatedFields["connectors." + (connectorId-1)] = chargingStation.connectors[connectorId-1];
		// Modify and return the modified document
	    let result = await _db.collection('chargingstations').findOneAndUpdate(
			{"_id": chargingStation.id},
			{$set: updatedFields},
			{upsert: true, new: true, returnOriginal: false});
		// Create
		return new ChargingStation(result.value);
	}

	static async handleSaveChargingStationHeartBeat(chargingStation) {
		let updatedFields = {};
		updatedFields["lastHeartBeat"] = Utils.convertToDate(chargingStation.lastHeartBeat);
		// Modify and return the modified document
	    let result = await _db.collection('chargingstations').findOneAndUpdate(
			{"_id": chargingStation.id},
			{$set: updatedFields},
			{upsert: true, new: true, returnOriginal: false});
		// Create
		return new ChargingStation(result.value);
	}

	static async handleSaveChargingStationSiteArea(chargingStation) {
		let updatedFields = {};
		updatedFields["siteAreaID"] = (chargingStation.siteArea ? Utils.convertToObjectID(chargingStation.siteArea.id) : null);
		// Check Last Changed By
		if (chargingStation.lastChangedBy && typeof chargingStation.lastChangedBy == "object") {
			// This is the User Model
			updatedFields["lastChangedBy"] = Utils.convertToObjectID(chargingStation.lastChangedBy.id);
			updatedFields["lastChangedOn"] = Utils.convertToDate(chargingStation.lastChangedOn);
		}
		// Modify and return the modified document
	    let result = await _db.collection('chargingstations').findOneAndUpdate(
			{"_id": chargingStation.id},
			{$set: updatedFields},
			{upsert: true, new: true, returnOriginal: false});
		// Create
		return new ChargingStation(result.value);
	}

	static async handleDeleteChargingStation(id) {
		// Delete Configuration
		await _db.collection('configurations')
			.findOneAndDelete( {'_id': id} );
		// Delete Charger
		await _db.collection('chargingstations')
			.findOneAndDelete( {'_id': id} );
		// Keep the rest (bootnotif, authorize...)
	}

	static async handleSaveAuthorize(authorize) {
		// Set the ID
		authorize.id = crypto.createHash('sha256')
			.update(`${authorize.chargeBoxID}~${authorize.timestamp.toISOString()}`)
			.digest("hex");
		// Set the User
		if (authorize.user) {
			authorize.userID = Utils.convertToObjectID(authorize.user.getID());
		}
		// Insert
	    await _db.collection('authorizes')
			.insertOne({
				_id: authorize.id,
				tagID: authorize.idTag,
				chargeBoxID: authorize.chargeBoxID,
				userID: authorize.userID,
				timestamp: Utils.convertToDate(authorize.timestamp)
			});
	}

	static async handleSaveConfiguration(configuration) {
		// Modify
	    await _db.collection('configurations').findOneAndUpdate(
			{"_id": configuration.chargeBoxID},
			{$set: {
				configuration: configuration.configurationKey,
				timestamp: Utils.convertToDate(configuration.timestamp)
			}},
			{upsert: true, new: true, returnOriginal: false});
	}

	static async handleSaveDataTransfer(dataTransfer) {
		// Set the ID
		dataTransfer.id = crypto.createHash('sha256')
			.update(`${dataTransfer.chargeBoxID}~${dataTransfer.data}~${dataTransfer.timestamp}`)
			.digest("hex");
		// Insert
	    await _db.collection('datatransfers')
			.insertOne({
				_id: dataTransfer.id,
				vendorId: dataTransfer.vendorId,
				messageId: dataTransfer.messageId,
				data: dataTransfer.data,
				chargeBoxID: dataTransfer.chargeBoxID,
				timestamp: Utils.convertToDate(dataTransfer.timestamp)
			});
	}

	static async handleSaveBootNotification(bootNotification) {
		// Set the ID
		bootNotification.id = crypto.createHash('sha256')
			.update(`${bootNotification.chargeBoxID}~${bootNotification.timestamp}`)
			.digest("hex");
		// Insert
	    let result = await _db.collection('bootnotifications')
			.insertOne({
				_id: bootNotification.id,
				chargeBoxID: bootNotification.chargeBoxID,
				chargePointVendor: bootNotification.chargePointVendor,
				chargePointModel: bootNotification.chargePointModel,
				chargePointSerialNumber: bootNotification.chargePointSerialNumber,
				chargeBoxSerialNumber: bootNotification.chargeBoxSerialNumber,
				firmwareVersion: bootNotification.firmwareVersion,
				ocppVersion: bootNotification.ocppVersion,
				endpoint: bootNotification.endpoint,
				chargeBoxIdentity: bootNotification.chargeBoxIdentity,
				timestamp: Utils.convertToDate(bootNotification.timestamp)
			});
	}

	static async handleSaveDiagnosticsStatusNotification(diagnosticsStatusNotification) {
		// Set the ID
		diagnosticsStatusNotification.id = crypto.createHash('sha256')
			.update(`${diagnosticsStatusNotification.chargeBoxID}~${diagnosticsStatusNotification.timestamp.toISOString()}`)
			.digest("hex");
		// Insert
	    await _db.collection('diagnosticsstatusnotifications')
			.insertOne({
				_id: diagnosticsStatusNotification.id,
				chargeBoxID: diagnosticsStatusNotification.chargeBoxID,
				status: diagnosticsStatusNotification.status,
				timestamp: Utils.convertToDate(diagnosticsStatusNotification.timestamp)
			});
	}

	static async handleSaveFirmwareStatusNotification(firmwareStatusNotification) {
		// Set the ID
		firmwareStatusNotification.id = crypto.createHash('sha256')
			.update(`${firmwareStatusNotification.chargeBoxID}~${firmwareStatusNotification.timestamp.toISOString()}`)
			.digest("hex");
		// Insert
	    await _db.collection('firmwarestatusnotifications')
			.insertOne({
				_id: firmwareStatusNotification.id,
				chargeBoxID: firmwareStatusNotification.chargeBoxID,
				status: firmwareStatusNotification.status,
				timestamp: Utils.convertToDate(firmwareStatusNotification.timestamp)
			});
	}

	static async handleSaveStatusNotification(statusNotificationToSave) {
		let statusNotification = {};
		// Set the ID
		statusNotification._id = crypto.createHash('sha256')
			.update(`${statusNotificationToSave.chargeBoxID}~${statusNotificationToSave.connectorId}~${statusNotificationToSave.status}~${statusNotificationToSave.timestamp}`)
			.digest("hex");
		// Set
		Database.updateStatusNotification(statusNotificationToSave, statusNotification, false);
		// Insert
	    await _db.collection('statusnotifications')
			.insertOne(statusNotification);
	}

	static async handleGetConfigurationParamValue(chargeBoxID, paramName) {
		// Get the config
		let configuration = await ChargingStationStorage.getConfiguration(chargeBoxID);
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
	}

	static async handleGetConfiguration(chargeBoxID) {
		// Read DB
		let configurationsMDB = await _db.collection('configurations')
			.find({"_id": chargeBoxID })
			.limit(1)
			.toArray();
		// Found?
		let configuration = null;
		if (configurationsMDB && configurationsMDB.length > 0) {
			// Set values
			configuration = {};
			Database.updateConfiguration(configurationsMDB[0], configuration);
		}
		return configuration;
	}
}

module.exports = ChargingStationStorage;
