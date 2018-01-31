const mongoose = require('mongoose');
const Logging = require('../../../utils/Logging');
const Constants = require('../../../utils/Constants');
const Database = require('../../../utils/Database');
const Utils = require('../../../utils/Utils');
const Configuration = require('../../../utils/Configuration');
const MDBSite = require('../model/MDBSite');
const MDBSiteArea = require('../model/MDBSiteArea');
const MDBChargingStation = require('../model/MDBChargingStation');
const Site = require('../../../model/Site');
const SiteArea = require('../../../model/SiteArea');
const crypto = require('crypto');
const ObjectId = mongoose.Types.ObjectId;

let _centralRestServer;

class SiteStorage {
	static setCentralRestServer(centralRestServer) {
		_centralRestServer = centralRestServer;
	}

	static handleGetSite(id) {
		// Create Aggregation
		let aggregation = [];
		// Filters
		aggregation.push({
			$match: { _id: ObjectId(id) }
		});
		// Add SiteAreas
		aggregation.push({
			$lookup: {
				from: "siteareas",
				localField: "_id",
				foreignField: "siteID",
				as: "siteAreas"
			}
		});
		// Exexute
		return MDBSite.aggregate(aggregation)
				.exec().then((sitesMDB) => {
			let site = null;
			// Create
			if (sitesMDB && sitesMDB.length > 0) {
				// Create
				site = new Site(sitesMDB[0]);
				// Set
				site.setSiteAreas(sitesMDB[0].siteAreas.map((siteArea) => {
					return new SiteArea(siteArea);
				}));
			}
			return site;
		});
	}

	static handleSaveSite(site) {
		// Check if ID/Name is provided
		if (!site.id && !site.name) {
			// ID must be provided!
			return Promise.reject( new Error("Error in saving the Site: Site has no ID and no Name and cannot be created or updated") );
		} else {
			let siteFilter = {};
			// Build Request
			if (site.id) {
				siteFilter._id = site.id;
			} else {
				siteFilter._id = ObjectId();
			}
			// Get
			return MDBSite.findOneAndUpdate(siteFilter, site, {
					new: true,
					upsert: true
				}).then((siteMDB) => {
					let newSite = new Site(siteMDB);
					// Notify Change
					if (!site.id) {
						_centralRestServer.notifySiteCreated(
							{
								"id": newSite.getID(),
								"type": Constants.NOTIF_ENTITY_SITE
							}
						);
					} else {
						_centralRestServer.notifySiteUpdated(
							{
								"id": newSite.getID(),
								"type": Constants.NOTIF_ENTITY_SITE
							}
						);
					}
					return newSite;
				});
		}
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
						_centralRestServer.notifySiteCreated(
							{
								"id": newSiteArea.getSiteID(),
								"type": Constants.NOTIF_ENTITY_SITE
							}
						);
					} else {
						_centralRestServer.notifySiteUpdated(
							{
								"id": newSiteArea.getSiteID(),
								"type": Constants.NOTIF_ENTITY_SITE
							}
						);
					}
					return newSiteArea;
				});
		}
	}

	static handleGetSites(searchValue, numberOfSites, withPicture) {
		// Check Limit
		numberOfSites = Utils.checkRecordLimit(numberOfSites);
		// Set the filters
		let filters = {
			"$and": [
				{
					"$or": [
						{ "deleted": { $exists:false } },
						{ deleted: false }
					]
				}
			]
		};
		// Source?
		if (searchValue) {
			// Build filter
			filters.$and.push({
				"$or": [
					{ "name" : { $regex : searchValue, $options: 'i' } }
				]
			});
		}
		// Create Aggregation
		let aggregation = [];
		// Filters
		if (filters) {
			aggregation.push({
				$match: filters
			});
		}
		// Limit
		if (numberOfSites > 0) {
			aggregation.push({
				$limit: numberOfSites
			});
		}
		// Add SiteAreas
		aggregation.push({
			$lookup: {
				from: "siteareas",
				localField: "_id",
				foreignField: "siteID",
				as: "siteAreas"
			}
		});
		// Exexute
		return MDBSite.aggregate(aggregation)
				.exec().then((sitesMDB) => {
			let sites = [];
			// Create
			sitesMDB.forEach((siteMDB) => {
				// Create
				let site = new Site(siteMDB);
				// Set
				site.setSiteAreas(siteMDB.siteAreas.map((siteArea) => {
					return new SiteArea(siteArea);
				}));
				// Add
				sites.push(site);
			});
			return sites;
		});
	}

	static handleDeleteSite(id) {
		return SiteStorage.handleGetSite(id).then((site) => {
			let siteAreas = site.getSiteAreas();
			// Get the areas
			siteAreas.forEach((siteArea) => {
				// Remove Charging Station's Site Area
				MDBChargingStation.update(
					{ siteAreaID: siteArea.getID() },
					{ $set: { siteAreaID: null } }
				).then((result) => {
					// Nothing to do but promise has to be kept to make the update work!
				});
				// Remove Site Area
				MDBSiteArea.findByIdAndRemove(siteArea.getID()
				).then((result) => {
					// Nothing to do but promise has to be kept to make the update work!
				});
			});
			// Remove Site
			return MDBSite.findByIdAndRemove(id).then((result) => {
				// Notify Change
				_centralRestServer.notifySiteDeleted(
					{
						"id": id,
						"type": Constants.NOTIF_ENTITY_SITE
					}
				);
				// Return the result
				return result.result;
			});
		});
	}
}

module.exports = SiteStorage;
