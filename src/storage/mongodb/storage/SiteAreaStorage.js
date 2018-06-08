const Logging = require('../../../utils/Logging');
const Constants = require('../../../utils/Constants');
const Database = require('../../../utils/Database');
const Utils = require('../../../utils/Utils');
const Configuration = require('../../../utils/Configuration');
const ChargingStation = require('../../../model/ChargingStation');
const Site = require('../../../model/Site');
const SiteArea = require('../../../model/SiteArea');
const AppError = require('../../../exception/AppError');
const ObjectID = require('mongodb').ObjectID;

let _db;

class SiteAreaStorage {
	static setDatabase(db) {
		_db = db;
	}

	static async handleGetSiteAreaImage(id) {
		// Read DB
		let siteAreaImagesMDB = await _db.collection('siteareaimages')
			.find({_id: Utils.convertToObjectID(id)})
			.limit(1)
			.toArray();
		let siteAreaImage = null;
		// Set
		if (siteAreaImagesMDB && siteAreaImagesMDB.length > 0) {
			siteAreaImage = {
				id: siteAreaImagesMDB[0]._id,
				image: siteAreaImagesMDB[0].image
			};
		}
		return siteAreaImage;
	}

	static async handleGetSiteAreaImages() {
		// Read DB
		let siteAreaImagesMDB = await _db.collection('siteareaimages')
			.find({})
			.toArray();
		let siteAreaImages = [];
		// Add
		if (siteAreaImagesMDB && siteAreaImagesMDB.length > 0) {
			siteAreaImagesMDB.forEach((siteAreaImageMDB) => {
				siteAreaImages.push({
					id: siteAreaImageMDB._id,
					image: siteAreaImageMDB.image
				});
			});
		}
		return siteAreaImages;
	}

	static async handleGetSiteArea(id, withChargingStations, withSite) {
		// Create Aggregation
		let aggregation = [];
		// Filters
		aggregation.push({
			$match: { _id: Utils.convertToObjectID(id) }
		});
		// Add Created By / Last Changed By
		Utils.pushCreatedLastChangedInAggregation(aggregation);
		// Charging Station
		if (withChargingStations) {
			// Add
			aggregation.push({
				$lookup: {
					from: "chargingstations",
					localField: "_id",
					foreignField: "siteAreaID",
					as: "chargingStations"
				}
			});
		}
		// Site
		if (withSite) {
			// Add
			aggregation.push({
				$lookup: {
					from: "sites",
					localField: "siteID",
					foreignField: "_id",
					as: "site"
				}
			});
			// Add
			aggregation.push({
				$unwind: { "path": "$site", "preserveNullAndEmptyArrays": true }
			});
		}
		// Read DB
		let siteAreasMDB = await _db.collection('siteareas')
			.aggregate(aggregation)
			.toArray();
		let siteArea = null;
		// Create
		if (siteAreasMDB && siteAreasMDB.length > 0) {
			// Create
			siteArea = new SiteArea(siteAreasMDB[0]);
			// Set Charging Station
			if (siteAreasMDB[0].chargingStations) {
				// Sort Charging Stations
				siteAreasMDB[0].chargingStations.sort((cb1, cb2) => {
					return cb1._id.localeCompare(cb2._id);
				});
				// Set
				siteArea.setChargingStations(siteAreasMDB[0].chargingStations.map((chargingStation) => {
					return new ChargingStation(chargingStation);
				}));
			}
			// Set Site
			if (siteAreasMDB[0].site) {
				siteArea.setSite(new Site(siteAreasMDB[0].site));
			}
		}
		return siteArea;
	}

	static async handleSaveSiteArea(siteAreaToSave) {
		// Check if ID/Name is provided
		if (!siteAreaToSave.id && !siteAreaToSave.name) {
			// ID must be provided!
			throw new AppError(
				Constants.CENTRAL_SERVER,
				`Site Area has no ID and no Name`,
				550, "SiteAreaStorage", "handleSaveSiteArea");
		}
		let siteAreaFilter = {};
		// Build Request
		if (siteAreaToSave.id) {
			siteAreaFilter._id = Utils.convertToObjectID(siteAreaToSave.id);
		} else {
			siteAreaFilter._id = new ObjectID();
		}
		// Check Created By/On
		siteAreaToSave.createdBy = Utils.convertUserToObjectID(siteAreaToSave.createdBy);
		siteAreaToSave.createdOn = Utils.convertToDate(siteAreaToSave.createdOn);
		// Check Last Changed By/On
		siteAreaToSave.lastChangedBy = Utils.convertUserToObjectID(siteAreaToSave.lastChangedBy);
		siteAreaToSave.lastChangedOn = Utils.convertToDate(siteAreaToSave.lastChangedOn);
		// Check ID
		siteAreaToSave.siteID = Utils.convertToObjectID(siteAreaToSave.siteID);
		// Transfer
		let siteArea = {};
		Database.updateSiteArea(siteAreaToSave, siteArea, false);
		// Modify
	    let result = await _db.collection('siteareas').findOneAndUpdate(
			siteAreaFilter,
			{$set: siteArea},
			{upsert: true, new: true, returnOriginal: false});
		// Create
		return new SiteArea(result.value);
	}

	static async handleSaveSiteAreaImage(siteAreaImageToSave) {
		// Check if ID is provided
		if (!siteAreaImageToSave.id) {
			// ID must be provided!
			throw new AppError(
				Constants.CENTRAL_SERVER,
				`Site Area Image has no ID`,
				550, "SiteAreaStorage", "handleSaveSiteAreaImage");
		}
		// Modify
	    await _db.collection('siteareaimages').findOneAndUpdate(
			{'_id': Utils.convertToObjectID(siteAreaImageToSave.id)},
			{$set: {image: siteAreaImageToSave.image}},
			{upsert: true, new: true, returnOriginal: false});
	}

	static async handleGetSiteAreas(searchValue, siteID, withChargeBoxes, numberOfSiteAreas) {
		// Check Limit
		numberOfSiteAreas = Utils.checkRecordLimit(numberOfSiteAreas);
		// Set the filters
		let filters = {};
		// Source?
		if (searchValue) {
			// Build filter
			filters.$or = [
				{ "name" : { $regex : searchValue, $options: 'i' } }
			];
		}
		// Set Site?
		if (siteID) {
			filters.siteID = Utils.convertToObjectID(siteID);
		}
		// Create Aggregation
		let aggregation = [];
		// Filters
		if (filters) {
			aggregation.push({
				$match: filters
			});
		}
		// Add Sites
		aggregation.push({
			$lookup: {
				from: "sites",
				localField: "siteID",
				foreignField: "_id",
				as: "site"
			}
		});
		// Add Charge Stations
		aggregation.push({
			$lookup: {
				from: "chargingstations",
				localField: "_id",
				foreignField: "siteAreaID",
				as: "chargeBoxes"
			}
		});
		aggregation.push({
			$addFields: {
				"numberOfChargeBoxes": { $size: "$chargeBoxes" }
			}
		});
		// Add Created By / Last Changed By
		Utils.pushCreatedLastChangedInAggregation(aggregation);
		// Single Record
		aggregation.push({
			$unwind: { "path": "$site", "preserveNullAndEmptyArrays": true }
		});
		// Sort
		aggregation.push({
			$sort: {
				"site.name": 1,
				"name": 1
			}
		});
		// Limit
		if (numberOfSiteAreas > 0) {
			aggregation.push({
				$limit: numberOfSiteAreas
			});
		}
		// Read DB
		let siteAreasMDB = await _db.collection('siteareas')
			.aggregate(aggregation)
			.toArray();
		let siteAreas = [];
		// Check
		if (siteAreasMDB && siteAreasMDB.length > 0) {
			// Create
			siteAreasMDB.forEach((siteAreaMDB) => {
				// Create
				let siteArea = new SiteArea(siteAreaMDB);
				// Set Site Areas
				if (withChargeBoxes && siteAreaMDB.chargeBoxes) {
					siteArea.setChargingStations(siteAreaMDB.chargeBoxes.map((chargeBox) => {
						return new ChargingStation(chargeBox);
					}));
				}
				// Set
				siteArea.setSite(new Site(siteAreaMDB.site));
				// Add
				siteAreas.push(siteArea);
			});
		}
		return siteAreas;
	}

	static async handleDeleteSiteArea(id) {
		// Remove Charging Station's Site Area
	    await _db.collection('chargingstations').updateMany(
			{ siteAreaID: Utils.convertToObjectID(id) },
			{$set: { siteAreaID: null }},
			{upsert: true, new: true, returnOriginal: false});
		// Delete Site
		await _db.collection('siteareas')
			.findOneAndDelete( {'_id': Utils.convertToObjectID(id)} );
		// Delete Image
		await _db.collection('sitesareaimages')
			.findOneAndDelete( {'_id': Utils.convertToObjectID(id)} );
	}
}

module.exports = SiteAreaStorage;
