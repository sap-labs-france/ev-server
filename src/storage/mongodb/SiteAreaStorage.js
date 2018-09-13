const Constants = require('../../utils/Constants');
const Database = require('../../utils/Database');
const Utils = require('../../utils/Utils');
const AppError = require('../../exception/AppError');
const ObjectID = require('mongodb').ObjectID;

class SiteAreaStorage {
	static async getSiteAreaImage(id) {
		// Read DB
		let siteAreaImagesMDB = await global.db.collection('siteareaimages')
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

	static async getSiteAreaImages() {
		// Read DB
		let siteAreaImagesMDB = await global.db.collection('siteareaimages')
			.find({})
			.toArray();
		let siteAreaImages = [];
		// Add
		if (siteAreaImagesMDB && siteAreaImagesMDB.length > 0) {
			for (const siteAreaImageMDB of siteAreaImagesMDB) {
				siteAreaImages.push({
					id: siteAreaImageMDB._id,
					image: siteAreaImageMDB.image
				});
			}
		}
		return siteAreaImages;
	}

	static async getSiteArea(id, withChargeBoxes, withSite) {
		const Site = require('../../model/Site');  // Avoid fucking circular deps!!!
		const SiteArea = require('../../model/SiteArea'); // Avoid fucking circular deps!!!
		const ChargingStation = require('../../model/ChargingStation'); // Avoid fucking circular deps!!! 
		// Create Aggregation
		let aggregation = [];
		// Filters
		aggregation.push({
			$match: { _id: Utils.convertToObjectID(id) }
		});
		// Add Created By / Last Changed By
		Utils.pushCreatedLastChangedInAggregation(aggregation);
		// Charging Station
		if (withChargeBoxes) {
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
		let siteAreasMDB = await global.db.collection('siteareas')
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

	static async saveSiteArea(siteAreaToSave) {
		const SiteArea = require('../../model/SiteArea'); // Avoid fucking circular deps!!!
		// Check if ID/Name is provided
		if (!siteAreaToSave.id && !siteAreaToSave.name) {
			// ID must be provided!
			throw new AppError(
				Constants.CENTRAL_SERVER,
				`Site Area has no ID and no Name`,
				550, "SiteAreaStorage", "saveSiteArea");
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
		siteAreaToSave.lastChangedBy = Utils.convertUserToObjectID(siteAreaToSave.lastChangedBy);
		// Transfer
		let siteArea = {};
		Database.updateSiteArea(siteAreaToSave, siteArea, false);
		// Modify
	    let result = await global.db.collection('siteareas').findOneAndUpdate(
			siteAreaFilter,
			{$set: siteArea},
			{upsert: true, new: true, returnOriginal: false});
		// Create
		return new SiteArea(result.value);
	}

	static async saveSiteAreaImage(siteAreaImageToSave) {
		// Check if ID is provided
		if (!siteAreaImageToSave.id) {
			// ID must be provided!
			throw new AppError(
				Constants.CENTRAL_SERVER,
				`Site Area Image has no ID`,
				550, "SiteAreaStorage", "saveSiteAreaImage");
		}
		// Modify
	    await global.db.collection('siteareaimages').findOneAndUpdate(
			{'_id': Utils.convertToObjectID(siteAreaImageToSave.id)},
			{$set: {image: siteAreaImageToSave.image}},
			{upsert: true, new: true, returnOriginal: false});
	}

	static async getSiteAreas(params, limit, skip, sort) {
		const Site = require('../../model/Site');  // Avoid fucking circular deps!!!
		const SiteArea = require('../../model/SiteArea'); // Avoid fucking circular deps!!!
		const ChargingStation = require('../../model/ChargingStation'); // Avoid fucking circular deps!!! 
		// Check Limit
		limit = Utils.checkRecordLimit(limit);
		// Check Skip
		skip = Utils.checkRecordSkip(skip);
		// Set the filters
		let filters = {};
		// Source?
		if (params.search) {
			// Build filter
			filters.$or = [
				{ "name" : { $regex : params.search, $options: 'i' } }
			];
		}
		// Set Site?
		if (params.siteID) {
			filters.siteID = Utils.convertToObjectID(params.siteID);
		}
		// Create Aggregation
		let aggregation = [];
		// Filters
		if (filters) {
			aggregation.push({
				$match: filters
			});
		}
		// Count Records
		let siteAreasCountMDB = await global.db.collection('siteareas')
			.aggregate([...aggregation, { $count: "count" }])
			.toArray();
		// Sites
		if (params.withSite) {
			// Add Sites
			aggregation.push({
				$lookup: {
					from: "sites",
					localField: "siteID",
					foreignField: "_id",
					as: "site"
				}
			});
			// Single Record
			aggregation.push({
				$unwind: { "path": "$site", "preserveNullAndEmptyArrays": true }
			});
		}
		// Charging Stations
		if (params.withChargeBoxes) {
			// Add Charging Stations
			aggregation.push({
				$lookup: {
					from: "chargingstations",
					localField: "_id",
					foreignField: "siteAreaID",
					as: "chargeBoxes"
				}
			});
		}
		// Add Created By / Last Changed By
		Utils.pushCreatedLastChangedInAggregation(aggregation);
		// Sort
		if (sort) {
			// Sort
			aggregation.push({
				$sort: sort
			});
		} else {
			// Default
			aggregation.push({
				$sort: { name : 1 }
			});
		}
		// Skip
		aggregation.push({
			$skip: skip
		});
		// Limit
		aggregation.push({
			$limit: limit
		});
		// Read DB
		let siteAreasMDB = await global.db.collection('siteareas')
			.aggregate(aggregation)
			.toArray();
		let siteAreas = [];
		// Check
		if (siteAreasMDB && siteAreasMDB.length > 0) {
			// Create
			for (const siteAreaMDB of siteAreasMDB) {
				// Create
				let siteArea = new SiteArea(siteAreaMDB);
				// Set Site Areas
				if (params.withChargeBoxes && siteAreaMDB.chargeBoxes) {
					siteArea.setChargingStations(siteAreaMDB.chargeBoxes.map((chargeBox) => {
						return new ChargingStation(chargeBox);
					}));
				}
				// Set Site
				if (params.withSite && siteAreaMDB.site) {
					// Set
					siteArea.setSite(new Site(siteAreaMDB.site));
				}
				// Add
				siteAreas.push(siteArea);
			}
		}
		// Ok
		return {
			count: (siteAreasCountMDB.length > 0 ? siteAreasCountMDB[0].count : 0),
			result: siteAreas
		};
	}

	static async deleteSiteArea(id) {
		// Remove Charging Station's Site Area
	    await global.db.collection('chargingstations').updateMany(
			{ siteAreaID: Utils.convertToObjectID(id) },
			{ $set: { siteAreaID: null } },
			{ upsert: false, new: true, returnOriginal: false });
		// Delete Site
		await global.db.collection('siteareas')
			.findOneAndDelete( {'_id': Utils.convertToObjectID(id)} );
		// Delete Image
		await global.db.collection('sitesareaimages')
			.findOneAndDelete( {'_id': Utils.convertToObjectID(id)} );
	}
}

module.exports = SiteAreaStorage;
