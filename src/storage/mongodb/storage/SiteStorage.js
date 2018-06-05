const mongoose = require('mongoose');
const Logging = require('../../../utils/Logging');
const Constants = require('../../../utils/Constants');
const Database = require('../../../utils/Database');
const Utils = require('../../../utils/Utils');
const Configuration = require('../../../utils/Configuration');
const MDBSite = require('../model/MDBSite');
const MDBSiteImage = require('../model/MDBSiteImage');
const MDBSiteArea = require('../model/MDBSiteArea');
const MDBSiteUser = require('../model/MDBSiteUser');
const MDBChargingStation = require('../model/MDBChargingStation');
const Company = require('../../../model/Company');
const ChargingStation = require('../../../model/ChargingStation');
const Site = require('../../../model/Site');
const SiteArea = require('../../../model/SiteArea');
const SiteAreaStorage = require('./SiteAreaStorage');
const User = require('../../../model/User');
const crypto = require('crypto');
const ObjectId = mongoose.Types.ObjectId;

let _centralRestServer;
let _db;

class SiteStorage {
	static setCentralRestServer(centralRestServer) {
		_centralRestServer = centralRestServer;
	}

	static setDatabase(db) {
		_db = db;
	}

	static handleGetSite(id, withCompany, withUsers) {
		// Create Aggregation
		let aggregation = [];
		// Filters
		aggregation.push({
			$match: { _id: ObjectId(id) }
		});
		// Add Created By / Last Changed By
		Utils.pushCreatedLastChangedInAggregation(aggregation);
		// User
		if (withUsers) {
			// Add
			aggregation.push({
				$lookup: {
					from: "siteusers",
					localField: "_id",
					foreignField: "siteID",
					as: "siteusers"
				}
			});
			// Add
			aggregation.push({
				$lookup: {
					from: "users",
					localField: "siteusers.userID",
					foreignField: "_id",
					as: "users"
				}
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
		if (withCompany) {
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
				$unwind: { "path": "$company", "preserveNullAndEmptyArrays": true }
			});
		}
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
				if (withCompany) {
					site.setCompany(new Company(sitesMDB[0].company));
				}
				// Set users
				if (withUsers && sitesMDB[0].users) {
					// Create Users
					sitesMDB[0].users = sitesMDB[0].users.map((user) => {
						return new User(user);
					});
					site.setUsers(sitesMDB[0].users)
				}
			}
			return site;
		});
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

	static handleSaveSite(site) {
		// Check if ID/Name is provided
		if (!site.id && !site.name) {
			// ID must be provided!
			return Promise.reject( new Error("Site has no ID and no Name and cannot be created or updated") );
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
				// Delete old Users
				return MDBSiteUser.remove({ "siteID" : new ObjectId(newSite.getID()) });
			}).then(() => {
				let proms = [];
				// Add new Users
				site.users.forEach((user) => {
					// Update/Insert Tag
					proms.push(
						MDBSiteUser.findOneAndUpdate({
							"siteID": newSite.getID(),
							"userID": user.id
						},{
							"siteID": new ObjectId(newSite.getID()),
							"userID": new ObjectId(user.id)
						},{
							new: true,
							upsert: true
						})
					);
				});
				return Promise.all(proms);
			}).then(() => {
				// Notify Change
				if (!site.id) {
					_centralRestServer.notifySiteCreated(
						{
							"id": newSite.getID(),
							"type": Constants.ENTITY_SITE
						}
					);
				} else {
					_centralRestServer.notifySiteUpdated(
						{
							"id": newSite.getID(),
							"type": Constants.ENTITY_SITE
						}
					);
				}
				return newSite;
			});
		}
	}

	static handleSaveSiteImage(site) {
		// Check if ID is provided
		if (!site.id) {
			// ID must be provided!
			return Promise.reject( new Error("Site has no ID and cannot be created or updated") );
		} else {
			// Save Image
			return MDBSiteImage.findOneAndUpdate({
				"_id": new ObjectId(site.id)
			}, site, {
				new: true,
				upsert: true
			});
			// Notify Change
			_centralRestServer.notifySiteUpdated(
				{
					"id": site.id,
					"type": Constants.ENTITY_SITE
				}
			);
		}
	}

	static handleGetSites(searchValue, companyID, userID, withCompany, withSiteAreas,
			withChargeBoxes, withUsers, numberOfSites) {
		// Check Limit
		numberOfSites = Utils.checkRecordLimit(numberOfSites);
		// Set the filters
		let filters = {};
		// Source?
		if (searchValue) {
			// Build filter
			filters.$or = [
				{ "name" : { $regex : searchValue, $options: 'i' } },
				{ "siteAreas.name" : { $regex : searchValue, $options: 'i' } },
				{ "chargeBoxes._id" : { $regex : searchValue, $options: 'i' } }
			];
		}
		// Set Company?
		if (companyID) {
			filters.companyID = new ObjectId(companyID);
		}
		// Create Aggregation
		let aggregation = [];
		// Add Users
		aggregation.push({
			$lookup: {
				from: "siteusers",
				localField: "_id",
				foreignField: "siteID",
				as: "siteusers"
			}
		});
		// Set User?
		if (userID) {
			filters["siteusers.userID"] = new ObjectId(userID);
		}
		// Number of Users
		aggregation.push({
			$addFields: {
				"numberOfUsers": { $size: "$siteusers" }
			}
		});
		if (withUsers) {
			// Add
			aggregation.push({
				$lookup: {
					from: "users",
					localField: "siteusers.userID",
					foreignField: "_id",
					as: "users"
				}
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
		// Filters
		if (filters) {
			aggregation.push({
				$match: filters
			});
		}
		// Add Created By / Last Changed By
		Utils.pushCreatedLastChangedInAggregation(aggregation);
		// Add Company?
		if (withCompany) {
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
				$unwind: { "path": "$company", "preserveNullAndEmptyArrays": true }
			});
		}
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
			// Filter
			if (searchValue) {
				let matchSite = false, matchSiteArea = false, matchChargingStation = false;
				let searchRegEx = new RegExp(searchValue, "i");
				// Sites
				for (var i = 0; i < sitesMDB.length; i++) {
					if (searchRegEx.test(sitesMDB[i].name)) {
						matchSite = true;
						break;
					}
					// Site Areas
					if (sitesMDB[i].siteAreas) {
						for (var j = 0; j < sitesMDB[i].siteAreas.length; j++) {
							// Check Site Area
							if (searchRegEx.test(sitesMDB[i].siteAreas[j].name)) {
								matchSiteArea = true;
								break;
							}
							// Charge Boxes
							if (sitesMDB[i].chargeBoxes) {
								for (var k = 0; k < sitesMDB[i].chargeBoxes.length; k++) {
									// Check Charging Station
									if (searchRegEx.test(sitesMDB[i].chargeBoxes[k]._id)) {
										matchChargingStation = true;
										break;
									}
								}
							}
						}
					}
				}
				// Match Site Area?
				if (!matchSite && matchSiteArea) {
					// Filter the Site Area
					sitesMDB.forEach((siteMDB) => {
						// Site Areas
						if (siteMDB.siteAreas) {
							// Filter
							siteMDB.siteAreas = siteMDB.siteAreas.filter((siteArea) => {
								return searchRegEx.test(siteArea.name);
							});
						}
					});
				// Match Charging Station?
				} else if (!matchSite && matchChargingStation) {
					// Filter the Site Area
					sitesMDB.forEach((siteMDB) => {
						// Charging Stations
						if (siteMDB.chargeBoxes) {
							// Filter Charging Stations
							siteMDB.chargeBoxes = siteMDB.chargeBoxes.filter((chargeBox) => {
								return searchRegEx.test(chargeBox._id);
							});
						}
						// Site Areas
						if (siteMDB.siteAreas) {
							// Filter Site Areas
							siteMDB.siteAreas = siteMDB.siteAreas.filter((siteArea) => {
								let chargeBoxesPerSiteArea = [];
								// Filter Charging Stations
								if (siteMDB.chargeBoxes) {
									// Filter with Site Area
									chargeBoxesPerSiteArea = siteMDB.chargeBoxes.filter((chargeBox) => {
										return chargeBox.siteAreaID.toString() == siteArea._id;
									});
								}
								return chargeBoxesPerSiteArea.length > 0;
							});
						}
					});
				}
			}
			// Create
			sitesMDB.forEach((siteMDB) => {
				// Create
				let site = new Site(siteMDB);
				// Set Users
				if (withUsers && siteMDB.users) {
					// Set Users
					site.setUsers(siteMDB.users.map((user) => {
						return new User(user);
					}));
				}
				// Set Site Areas
				if (withSiteAreas && siteMDB.siteAreas) {
					// Sort Site Areas
					siteMDB.siteAreas.sort((cb1, cb2) => {
						return cb1.name.localeCompare(cb2.name);
					});
					// Set
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
				// Set Company?
				if (siteMDB.company) {
					site.setCompany(new Company(siteMDB.company));
				}
				// Add
				sites.push(site);
			});
			return sites;
		});
	}

	static handleDeleteSite(id) {
		// Delete Site Areas
		return SiteAreaStorage.handleGetSiteAreas(null, id).then((siteAreas) => {
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
			// Remove Image
			return MDBSiteImage.findByIdAndRemove( id );
		}).then((results) => {
			// Remove Users
			return MDBSiteUser.remove( { siteID: new ObjectId(id) } );
		}).then((results) => {
			// Notify Change
			_centralRestServer.notifySiteDeleted(
				{
					"id": id,
					"type": Constants.ENTITY_SITE
				}
			);
		});
	}
}

module.exports = SiteStorage;
