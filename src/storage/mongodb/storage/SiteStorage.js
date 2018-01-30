const mongoose = require('mongoose');
const Logging = require('../../../utils/Logging');
const Constants = require('../../../utils/Constants');
const Database = require('../../../utils/Database');
const Utils = require('../../../utils/Utils');
const Configuration = require('../../../utils/Configuration');
const MDBSite = require('../model/MDBSite');
const MDBSiteArea = require('../model/MDBSiteArea');
const Site = require('../../../model/Site');
const SiteArea = require('../../../model/SiteArea');
const crypto = require('crypto');

let _centralRestServer;

class SiteStorage {
	static setCentralRestServer(centralRestServer) {
		_centralRestServer = centralRestServer;
	}

	static handleGetSite(id) {
		// Exec request
		return MDBSite.findById(id).exec().then((siteMDB) => {
			// Check deleted
			if (siteMDB && siteMDB.deleted) {
				// Return empty site
				return Promise.resolve();
			} else {
				// Ok
				return SiteStorage._createSite(siteMDB);
			}
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
				siteFilter._id = mongoose.Types.ObjectId();
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
				siteAreaFilter._id = mongoose.Types.ObjectId();
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
		// // Exec request
		// return MDBSite.find(filters, (withPicture?{}:{image:0}))
		// 		.sort( {name: 1} )
		// 		.collation({ locale: Constants.APPLICATION_LOCALE, caseLevel: true })
		// 		.limit(numberOfSites)
		// 		.exec().then((sitesMDB) => {
		// 	let sites = [];
		// 	// Create
		// 	sitesMDB.forEach((siteMDB) => {
		// 		// Create
		// 		let site = new Site(siteMDB);
		// 		// Add
		// 		sites.push(site);
		// 	});
		// 	// Ok
		// 	return sites;
		// });
	}

	static handleDeleteSite(id) {
		return MDBSite.remove({ "_id" : id }).then((result) => {
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
	}

	static _createSite(siteMDB) {
		let site = null;
		// Check
		if (siteMDB) {
			// Create
			site = new Site(siteMDB);
		}
		return site;
	}
}

module.exports = SiteStorage;
