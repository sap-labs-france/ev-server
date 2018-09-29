const Constants = require('../../utils/Constants');
const Database = require('../../utils/Database');
const Utils = require('../../utils/Utils');
const SiteAreaStorage = require('./SiteAreaStorage');
const AppError = require('../../exception/AppError');
const ObjectID = require('mongodb').ObjectID;

class SiteStorage {
	static async getSite(id, withCompany, withUsers) {
		const Site = require('../../model/Site'); // Avoid fucking circular deps!!!
		const Company = require('../../model/Company'); // Avoid fucking circular deps!!!
		const SiteArea = require('../../model/SiteArea'); // Avoid fucking circular deps!!!
		const User = require('../../model/User'); // Avoid fucking circular deps!!!
		// Create Aggregation
		let aggregation = [];
		// Filters
		aggregation.push({
			$match: { _id: Utils.convertToObjectID(id) }
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
		// Read DB
		let sitesMDB = await global.db.collection('sites')
			.aggregate(aggregation)
			.toArray();
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
	}

	static async getSiteImage(id) {
		// Read DB
		let siteImagesMDB = await global.db.collection('siteimages')
			.find({_id: Utils.convertToObjectID(id)})
			.limit(1)
			.toArray();
		let siteImage = null;
		// Set
		if (siteImagesMDB && siteImagesMDB.length > 0) {
			siteImage = {
				id: siteImagesMDB[0]._id,
				image: siteImagesMDB[0].image
			};
		}
		return siteImage;
	}

	static async getSiteImages() {
		// Read DB
		let siteImagesMDB = await global.db.collection('siteimages')
			.find({})
			.toArray();
		let siteImages = [];
		// Set
		if (siteImagesMDB && siteImagesMDB.length > 0) {
			// Add
			for (const siteImageMDB of siteImagesMDB) {
				siteImages.push({
					id: siteImageMDB._id,
					image: siteImageMDB.image
				});
			}
		}
		return siteImages;
	}

	static async saveSite(siteToSave) {
		const Site = require('../../model/Site'); // Avoid fucking circular deps!!!
		// Check if ID/Name is provided
		if (!siteToSave.id && !siteToSave.name) {
			// ID must be provided!
			throw new AppError(
				Constants.CENTRAL_SERVER,
				`Site has no ID and no Name`,
				550, "SiteStorage", "saveSite");
		}
		let siteFilter = {};
		// Build Request
		if (siteToSave.id) {
			siteFilter._id = Utils.convertUserToObjectID(siteToSave.id);
		} else {
			siteFilter._id = new ObjectID();
		}
		// Check Created By/On
		siteToSave.createdBy = Utils.convertUserToObjectID(siteToSave.createdBy);
		siteToSave.lastChangedBy = Utils.convertUserToObjectID(siteToSave.lastChangedBy);
		// Transfer
		let site = {};
		Database.updateSite(siteToSave, site, false);
		// Modify
	    let result = await global.db.collection('sites').findOneAndUpdate(
			siteFilter,
			{$set: site},
			{upsert: true, new: true, returnOriginal: false});
		// Create
		let updatedSite = new Site(result.value);
		// Update Users?`
		if (siteToSave.users) {
			// Delete first
			await global.db.collection('siteusers')
				.deleteMany( {'siteID': Utils.convertToObjectID(updatedSite.getID())} );
			// At least one?
			if (siteToSave.users.length > 0) {
				let siteUsersMDB = [];
				// Create the list
				for (const user of siteToSave.users) {
					// Add
					siteUsersMDB.push({
						"siteID": Utils.convertToObjectID(updatedSite.getID()),
						"userID": Utils.convertToObjectID(user.id)
					});
				}
				// Execute
				await global.db.collection('siteusers').insertMany(siteUsersMDB);
			}
		}
		return updatedSite;
	}

	static async saveSiteImage(siteImageToSave) {
		// Check if ID is provided
		if (!siteImageToSave.id) {
			// ID must be provided!
			throw new AppError(
				Constants.CENTRAL_SERVER,
				`Site Image has no ID`,
				550, "SiteStorage", "saveSiteImage");
		}
		// Modify
	    await global.db.collection('siteimages').findOneAndUpdate(
			{'_id': Utils.convertToObjectID(siteImageToSave.id)},
			{$set: {image: siteImageToSave.image}},
			{upsert: true, new: true, returnOriginal: false});
	}

	static async getSites(params={}, limit, skip, sort) {
		const ChargingStation = require('../../model/ChargingStation'); // Avoid fucking circular deps!!!
		const Company = require('../../model/Company'); // Avoid fucking circular deps!!!
		const Site = require('../../model/Site'); // Avoid fucking circular deps!!!
		const SiteArea = require('../../model/SiteArea'); // Avoid fucking circular deps!!!
		const User = require('../../model/User'); // Avoid fucking circular deps!!!
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
		// Set Company?
		if (params.companyID) {
			filters.companyID = Utils.convertToObjectID(params.companyID);
		}
		// Create Aggregation
		let aggregation = [];
		// Set User?
		if (params.withUsers || params.userID || params.excludeSitesOfUserID) {
				// Add Users
			aggregation.push({
				$lookup: {
					from: "siteusers",
					localField: "_id",
					foreignField: "siteID",
					as: "siteusers"
				}
			});
			// User ID filter
			if (params.userID) {
				filters["siteusers.userID"] = Utils.convertToObjectID(params.userID);
			}
			// Exclude User ID filter
			if (params.excludeSitesOfUserID) {
				filters["siteusers.userID"] = { $ne: Utils.convertToObjectID(params.excludeSitesOfUserID) };
			}
			if (params.withUsers) {
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
		}
		if (params.withSiteAreas || params.withChargeBoxes) {
			// Add SiteAreas
			aggregation.push({
				$lookup: {
					from: "siteareas",
					localField: "_id",
					foreignField: "siteID",
					as: "siteAreas"
				}
			});
		}
		// With Chargers?
		if (params.withChargeBoxes) {
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
		// Count Records
		let sitesCountMDB = await global.db.collection('sites')
			.aggregate([...aggregation, { $count: "count" }])
			.toArray();
		// Add Created By / Last Changed By
		Utils.pushCreatedLastChangedInAggregation(aggregation);
		// Add Company?
		if (params.withCompany) {
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
		let sitesMDB = await global.db.collection('sites')
			.aggregate(aggregation, { collation: { locale : Constants.DEFAULT_LOCALE, strength: 2 }})
			.toArray();
		let sites = [];
		// Check
		if (sitesMDB && sitesMDB.length > 0) {
			// Create
			for (const siteMDB of sitesMDB) {
				// Create
				let site = new Site(siteMDB);
				// Set Users
				if ((params.userID || params.withUsers) && siteMDB.users) {
					// Set Users
					site.setUsers(siteMDB.users.map((user) => new User(user)));
				}
				// Set Site Areas
				if ((params.withChargeBoxes || params.withSiteAreas) && siteMDB.siteAreas) {
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
			}
		}
		// Ok
		return {
			count: (sitesCountMDB.length > 0 ? sitesCountMDB[0].count : 0),
			result: sites
		};
	}

	static async deleteSite(id) {
		// Delete Site Areas
		let siteAreas = await SiteAreaStorage.getSiteAreas({'siteID': id})
		// Delete
		for (const siteArea of siteAreas.result) {
			//	Delete Site Area
			await siteArea.delete();
		}
		// Delete Site
		await global.db.collection('sites')
			.findOneAndDelete( {'_id': Utils.convertToObjectID(id)} );
		// Delete Image
		await global.db.collection('siteimages')
			.findOneAndDelete( {'_id': Utils.convertToObjectID(id)} );
		// Delete Site's Users
		await global.db.collection('siteusers')
			.deleteMany( {'siteID': Utils.convertToObjectID(id)} );
	}
}

module.exports = SiteStorage;
