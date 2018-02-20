const mongoose = require('mongoose');
const Logging = require('../../../utils/Logging');
const Constants = require('../../../utils/Constants');
const Database = require('../../../utils/Database');
const Utils = require('../../../utils/Utils');
const Configuration = require('../../../utils/Configuration');
const MDBCompany = require('../model/MDBCompany');
const MDBSite = require('../model/MDBSite');
const MDBSiteArea = require('../model/MDBSiteArea');
const MDBChargingStation = require('../model/MDBChargingStation');
const Company = require('../../../model/Company');
const ChargingStation = require('../../../model/ChargingStation');
const Site = require('../../../model/Site');
const SiteArea = require('../../../model/SiteArea');
const crypto = require('crypto');
const ObjectId = mongoose.Types.ObjectId;

let _centralRestServer;

class SiteAreaStorage {
	static setCentralRestServer(centralRestServer) {
		_centralRestServer = centralRestServer;
	}

	static handleGetSiteArea(id, withChargingStations, withSite) {
		// Create Aggregation
		let aggregation = [];
		// Filters
		aggregation.push({
			$match: { _id: ObjectId(id) }
		});
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
				$unwind: "$site"
			});
		}
		// Execute
		return MDBSiteArea.aggregate(aggregation)
				.exec().then((siteAreasMDB) => {
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
		});
	}

	static handleSaveSiteArea(siteArea) {
		// Check if ID/Name is provided
		if (!siteArea.id && !siteArea.name) {
			// ID must be provided!
			return Promise.reject( new Error("Error in saving the Site: Site has no ID and no Name and cannot be created or updated") );
		} else {
			let siteAreaFilter = {};
			// Build Request
			if (siteArea.id) {
				siteAreaFilter._id = siteArea.id;
			} else {
				siteAreaFilter._id = ObjectId();
			}
			// Get
			return MDBSiteArea.findOneAndUpdate(siteAreaFilter, siteArea, {
					new: true,
					upsert: true
				}).then((siteAreaMDB) => {
					let newSiteArea = new SiteArea(siteAreaMDB);
					// Notify Change
					if (!siteArea.id) {
						_centralRestServer.notifySiteAreaCreated(
							{
								"id": newSiteArea.getID(),
								"type": Constants.NOTIF_ENTITY_SITE_AREA
							}
						);
					} else {
						_centralRestServer.notifySiteUpdated(
							{
								"id": newSiteArea.getID(),
								"type": Constants.NOTIF_ENTITY_SITE_AREA
							}
						);
					}
					return newSiteArea;
				});
		}
	}

	static handleGetSiteAreas(searchValue, withChargeBoxes, withPicture, numberOfSiteAreas) {
		// Check Limit
		numberOfSiteAreas = Utils.checkRecordLimit(numberOfSiteAreas);
		// Set the filters
		let filters = {};
		// Source?
		if (searchValue) {
			// Build filter
			filters.$and = [];
			filters.$and.push({
				"$or": [
					{ "name" : { $regex : searchValue, $options: 'i' } }
				]
			});
		}
		// Create Aggregation
		let aggregation = [];
		// Picture?
		if (!withPicture) {
			aggregation.push({
				$project: {
					image: 0
				}
			});
		}
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
		// Picture?
		if (!withPicture) {
			aggregation.push({
				$project: {
					"site.image": 0
				}
			});
		}
		// Single Record
		aggregation.push({
			$unwind: "$site"
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
		// Exexute
		return MDBSiteArea.aggregate(aggregation)
				.exec().then((siteAreasMDB) => {
			let siteAreas = [];
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
			return siteAreas;
		});
	}

	static handleGetSiteAreasFromSite(siteID) {
		// Exec request
		return MDBSiteArea.find({"siteID": siteID}).then((siteAreasMDB) => {
			let siteAreas = [];
			// Create
			siteAreasMDB.forEach((siteAreaMDB) => {
				// Create
				let siteArea = new SiteArea(siteAreaMDB);
				// Add
				siteAreas.push(siteArea);
			});
			return siteAreas;
		});
	}

	static handleDeleteSiteArea(id) {
		// Remove Charging Station's Site Area
		return MDBChargingStation.update(
			{ siteAreaID: id },
			{ $set: { siteAreaID: null } },
		 	{ multi: true }
		).then((result) => {
			// Remove Site Area
			return MDBSiteArea.findByIdAndRemove(id).then(() => {
				// Notify Change
				_centralRestServer.notifySiteAreaDeleted(
					{
						"id": id,
						"type": Constants.NOTIF_ENTITY_SITE_AREA
					}
				);
				return;
			});
		});
	}
}

module.exports = SiteAreaStorage;
