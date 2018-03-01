const mongoose = require('mongoose');
const Logging = require('../../../utils/Logging');
const Constants = require('../../../utils/Constants');
const Database = require('../../../utils/Database');
const Utils = require('../../../utils/Utils');
const Configuration = require('../../../utils/Configuration');
const MDBCompany = require('../model/MDBCompany');
const MDBSite = require('../model/MDBSite');
const MDBSiteImage = require('../model/MDBSiteImage');
const MDBSiteArea = require('../model/MDBSiteArea');
const MDBChargingStation = require('../model/MDBChargingStation');
const Company = require('../../../model/Company');
const ChargingStation = require('../../../model/ChargingStation');
const Site = require('../../../model/Site');
const SiteArea = require('../../../model/SiteArea');
const SiteAreaStorage = require('./SiteAreaStorage');
const crypto = require('crypto');
const ObjectId = mongoose.Types.ObjectId;

let _centralRestServer;

class SiteStorage {
	static setCentralRestServer(centralRestServer) {
		_centralRestServer = centralRestServer;
	}

	static handleGetSiteImage(id) {
		// Exec request
		return MDBSiteImage.findById(id)
				.exec().then((siteImageMDB) => {
			let siteImage = null;
			// Set
			if (siteImageMDB) {
				siteImage = {
					id: siteImageMDB._id,
					image: siteImageMDB.image
				};
			}
			return siteImage;
		});
	}

	static handleGetSiteImages() {
		// Exec request
		return MDBSiteImage.find({})
				.exec().then((siteImagesMDB) => {
			let siteImages = [];
			// Add
			siteImagesMDB.forEach((siteImageMDB) => {
				siteImages.push({
					id: siteImageMDB._id,
					image: siteImageMDB.image
				});
			});
			return siteImages;
		});
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
		// Add Company
		aggregation.push({
			$lookup: {
				from: "companies",
				localField: "companyID",
				foreignField: "_id",
				as: "company"
			}
		});
		// Single Record
		aggregation.push({
			$unwind: "$company"
		});
		// Exexute
		return MDBSite.aggregate(aggregation)
				.exec().then((sitesMDB) => {
			let site = null;
			// Create
			if (sitesMDB && sitesMDB.length > 0) {
				// Create
				site = new Site(sitesMDB[0]);
				// Set Site Areas
				site.setSiteAreas(sitesMDB[0].siteAreas.map((siteArea) => {
					return new SiteArea(siteArea);
				}));
				// Set Company
				site.setCompany(new Company(sitesMDB[0].company));
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
			// Check Created By
			if (site.createdBy && typeof site.createdBy == "object") {
				// This is the User Model
				site.createdBy = new ObjectId(site.createdBy.id);
			}
			// Check Last Changed By
			if (site.lastChangedBy && typeof site.lastChangedBy == "object") {
				// This is the User Model
				site.lastChangedBy = new ObjectId(site.lastChangedBy.id);
			}
			// Get
			let newSite;
			return MDBSite.findOneAndUpdate(siteFilter, site, {
				new: true,
				upsert: true
			}).then((siteMDB) => {
				newSite = new Site(siteMDB);
				// Save Logo
				return MDBSiteImage.findOneAndUpdate({
					"_id": new ObjectId(newSite.getID())
				}, site, {
					new: true,
					upsert: true
				});
			}).then(() => {
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

	static handleGetSites(searchValue, withSiteAreas, withChargeBoxes,
			withCompanyLogo, numberOfSites) {
		// Check Limit
		numberOfSites = Utils.checkRecordLimit(numberOfSites);
		// Set the filters
		let filters = {};
		// Source?
		if (searchValue) {
			// Build filter
			filters.$and = [];
			filters.$and.push({
				"$or": [
					{ "name" : { $regex : searchValue, $options: 'i' } },
					{ "address.city" : { $regex : searchValue, $options: 'i' } },
					{ "address.country" : { $regex : searchValue, $options: 'i' } }
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
		// Add SiteAreas
		aggregation.push({
			$lookup: {
				from: "siteareas",
				localField: "_id",
				foreignField: "siteID",
				as: "siteAreas"
			}
		});
		aggregation.push({
			$addFields: {
				"numberOfSiteAreas": { $size: "$siteAreas" }
			}
		});
		// With Chargers?
		if (withChargeBoxes) {
			aggregation.push({
				$lookup: {
					from: "chargingstations",
					localField: "siteAreas._id",
					foreignField: "siteAreaID",
					as: "chargeBoxes"
				}
			});
		}
		// Created By
		aggregation.push({
			$lookup: {
				from: "users",
				localField: "createdBy",
				foreignField: "_id",
				as: "createdBy"
			}
		});
		// Single Record
		aggregation.push({
			$unwind: { "path": "$createdBy", "preserveNullAndEmptyArrays": true }
		});
		// Last Changed By
		aggregation.push({
			$lookup: {
				from: "users",
				localField: "lastChangedBy",
				foreignField: "_id",
				as: "lastChangedBy"
			}
		});
		// Single Record
		aggregation.push({
			$unwind: { "path": "$lastChangedBy", "preserveNullAndEmptyArrays": true }
		});
		// Add Company
		aggregation.push({
			$lookup: {
				from: "companies",
				localField: "companyID",
				foreignField: "_id",
				as: "company"
			}
		});
		// Logo?
		if (!withCompanyLogo) {
			aggregation.push({
				$project: {
					"company.logo": 0
				}
			});
		}
		// Single Record
		aggregation.push({
			$unwind: "$company"
		});
		// Single Record
		aggregation.push({
			$sort: { name : 1 }
		});
		// Limit
		if (numberOfSites > 0) {
			aggregation.push({
				$limit: numberOfSites
			});
		}
		// Exexute
		return MDBSite.aggregate(aggregation)
				.exec().then((sitesMDB) => {
			let sites = [];
			// Create
			sitesMDB.forEach((siteMDB) => {
				// Create
				let site = new Site(siteMDB);
				// Set Site Areas
				if (withSiteAreas && siteMDB.siteAreas) {
					site.setSiteAreas(siteMDB.siteAreas.map((siteArea) => {
						let siteAreaObj = new SiteArea(siteArea);
						// Set Site Areas
						if (siteMDB.chargeBoxes) {
							// Filter with Site Area`
							let chargeBoxesPerSiteArea = siteMDB.chargeBoxes.filter((chargeBox) => {
								return !chargeBox.deleted && chargeBox.siteAreaID.toString() == siteArea._id;
							});
							// Sort Charging Stations
							chargeBoxesPerSiteArea.sort((cb1, cb2) => {
								return cb1._id.localeCompare(cb2._id);
							});
							siteAreaObj.setChargingStations(chargeBoxesPerSiteArea.map((chargeBoxPerSiteArea) => {
								return new ChargingStation(chargeBoxPerSiteArea);
							}));
						}
						return siteAreaObj;
					}));
				}
				// Set Company
				site.setCompany(new Company(siteMDB.company));
				// Add
				sites.push(site);
			});
			return sites;
		});
	}

	static handleGetSitesFromCompany(companyID) {
		// Exec request
		return MDBSite.find({"companyID": companyID}).then((sitesMDB) => {
			let sites = [];
			// Create
			sitesMDB.forEach((siteMDB) => {
				// Create
				let site = new Site(siteMDB);
				// Add
				sites.push(site);
			});
			return sites;
		});
	}

	static handleDeleteSite(id) {
		// Delete Site Areas
		return SiteAreaStorage.handleGetSiteAreasFromSite(id).then((siteAreas) => {
			// Delete
			let proms = [];
			siteAreas.forEach((siteArea) => {
				//	Delete Site Area
				proms.push(siteArea.delete());
			});
			// Execute all promises
			return Promise.all(proms);
		}).then((results) => {
			// Delete Site
			return MDBSite.findByIdAndRemove(id);
		}).then((results) => {
			// Remove Logo
			return MDBSiteImage.findByIdAndRemove( id );
		}).then((results) => {
			// Notify Change
			_centralRestServer.notifySiteDeleted(
				{
					"id": id,
					"type": Constants.NOTIF_ENTITY_SITE
				}
			);
		});
	}
}

module.exports = SiteStorage;
