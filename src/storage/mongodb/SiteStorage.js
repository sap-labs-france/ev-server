const Constants = require('../../utils/Constants');
const Database = require('../../utils/Database');
const Utils = require('../../utils/Utils');
const SiteAreaStorage = require('./SiteAreaStorage');
const AppError = require('../../exception/AppError');
const ObjectID = require('mongodb').ObjectID;

class SiteStorage {
	static async getSite(tenant, id, withCompany, withUsers) {
		const Site = require('../../entity/Site'); // Avoid fucking circular deps!!!
		const Company = require('../../entity/Company'); // Avoid fucking circular deps!!!
		const SiteArea = require('../../entity/SiteArea'); // Avoid fucking circular deps!!!
		const User = require('../../entity/User'); // Avoid fucking circular deps!!!
		// Create Aggregation
		const aggregation = [];
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
		const sitesMDB = await global.database.getCollection(tenant, 'sites')
			.aggregate(aggregation)
			.toArray();
		let site = null;
		// Create
		if (sitesMDB && sitesMDB.length > 0) {
			// Create
			site = new Site(tenant, sitesMDB[0]);
			// Set Site Areas
			site.setSiteAreas(sitesMDB[0].siteAreas.map((siteArea) => {
				return new SiteArea(tenant, siteArea);
			}));
			// Set Company
			if (withCompany) {
				site.setCompany(new Company(tenant, sitesMDB[0].company));
			}
			// Set users
			if (withUsers && sitesMDB[0].users) {
				// Create Users
				sitesMDB[0].users = sitesMDB[0].users.map((user) => {
					return new User(tenant, user);
				});
				site.setUsers(sitesMDB[0].users)
			}
		}
		return site;
	}

	static async getSiteImage(tenant, id) {
		// Read DB
		const siteImagesMDB = await global.database.getCollection(tenant, 'siteimages')
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

	static async getSiteImages(tenant) {
		// Read DB
		const siteImagesMDB = await global.database.getCollection(tenant, 'siteimages')
			.find({})
			.toArray();
		const siteImages = [];
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

	static async saveSite(tenant, siteToSave) {
		const Site = require('../../entity/Site'); // Avoid fucking circular deps!!!
		// Check if ID/Name is provided
		if (!siteToSave.id && !siteToSave.name) {
			// ID must be provided!
			throw new AppError(
				Constants.CENTRAL_SERVER,
				`Site has no ID and no Name`,
				550, "SiteStorage", "saveSite");
		}
		const siteFilter = {};
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
		const site = {};
		Database.updateSite(siteToSave, site, false);
		// Modify
	    const result = await global.database.getCollection(tenant, 'sites').findOneAndUpdate(
			siteFilter,
			{$set: site},
			{upsert: true, new: true, returnOriginal: false});
		// Create
		const updatedSite = new Site(tenant, result.value);
		// Update Users?`
		if (siteToSave.users) {
			// Delete first
			await global.database.getCollection(tenant, 'siteusers')
				.deleteMany( {'siteID': Utils.convertToObjectID(updatedSite.getID())} );
			// At least one?
			if (siteToSave.users.length > 0) {
				const siteUsersMDB = [];
				// Create the list
				for (const user of siteToSave.users) {
					// Add
					siteUsersMDB.push({
						"siteID": Utils.convertToObjectID(updatedSite.getID()),
						"userID": Utils.convertToObjectID(user.id)
					});
				}
				// Execute
				await global.database.getCollection(tenant, 'siteusers').insertMany(siteUsersMDB);
			}
		}
		return updatedSite;
	}

	static async saveSiteImage(tenant, siteImageToSave) {
		// Check if ID is provided
		if (!siteImageToSave.id) {
			// ID must be provided!
			throw new AppError(
				Constants.CENTRAL_SERVER,
				`Site Image has no ID`,
				550, "SiteStorage", "saveSiteImage");
		}
		// Modify
	    await global.database.getCollection(tenant, 'siteimages').findOneAndUpdate(
			{'_id': Utils.convertToObjectID(siteImageToSave.id)},
			{$set: {image: siteImageToSave.image}},
			{upsert: true, new: true, returnOriginal: false});
	}

	static async getSites(tenant, params={}, limit, skip, sort) {
		const ChargingStation = require('../../entity/ChargingStation'); // Avoid fucking circular deps!!!
		const Company = require('../../entity/Company'); // Avoid fucking circular deps!!!
		const Site = require('../../entity/Site'); // Avoid fucking circular deps!!!
		const SiteArea = require('../../entity/SiteArea'); // Avoid fucking circular deps!!!
		const User = require('../../entity/User'); // Avoid fucking circular deps!!!
		// Check Limit
		limit = Utils.checkRecordLimit(limit);
		// Check Skip
		skip = Utils.checkRecordSkip(skip);
		// Set the filters
		const filters = {};
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
		const aggregation = [];
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
		if (params.withSiteAreas || params.withChargeBoxes || params.withAvailableChargers) {
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
		if (params.withChargeBoxes || params.withAvailableChargers) {
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
		const sitesCountMDB = await global.database.getCollection(tenant, 'sites')
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
		const sitesMDB = await global.database.getCollection(tenant, 'sites')
			.aggregate(aggregation, { collation: { locale : Constants.DEFAULT_LOCALE, strength: 2 }})
			.toArray();
		const sites = [];
		// Check
		if (sitesMDB && sitesMDB.length > 0) {
			// Create
			for (const siteMDB of sitesMDB) {
				// Create
				const site = new Site(tenant, siteMDB);
				// Set Users
				if ((params.userID || params.withUsers) && siteMDB.users) {
					// Set Users
					site.setUsers(siteMDB.users.map((user) => new User(tenant, user)));
				}
				// Count Available Charger
				if (params.withAvailableChargers) {
					let availableChargers = 0;
					// Chargers
					for (const chargeBox of siteMDB.chargeBoxes) {
						// Connectors
						for (const connector of chargeBox.connectors) {
							// Check if Available
							if (connector.status === Constants.CONN_STATUS_AVAILABLE) {
								// Add 1
								availableChargers++;
								break;
							}
						}
					}
					// Set
					site.setAvailableChargers(availableChargers);
				}
				// Set Site Areas
				if ((params.withChargeBoxes || params.withSiteAreas) && siteMDB.siteAreas) {
					// Sort Site Areas
					siteMDB.siteAreas.sort((cb1, cb2) => {
						return cb1.name.localeCompare(cb2.name);
					});
					// Set
					site.setSiteAreas(siteMDB.siteAreas.map((siteArea) => {
						const siteAreaObj = new SiteArea(tenant, siteArea);
						// Set Site Areas
						if (siteMDB.chargeBoxes) {
							// Filter with Site Area`
							const chargeBoxesPerSiteArea = siteMDB.chargeBoxes.filter((chargeBox) => {
								return !chargeBox.deleted && chargeBox.siteAreaID.toString() == siteArea._id;
							});
							// Sort Charging Stations
							chargeBoxesPerSiteArea.sort((cb1, cb2) => {
								return cb1._id.localeCompare(cb2._id);
							});
							// Set Charger to Site Area
							siteAreaObj.setChargingStations(chargeBoxesPerSiteArea.map((chargeBoxPerSiteArea) => {
								// Create the Charger
								const chargingStation = new ChargingStation(tenant, chargeBoxPerSiteArea);
								// Set Site Area to Charger
								chargingStation.setSiteArea(new SiteArea(tenant, siteAreaObj.getModel())); // To avoid circular deps Charger -> Site Area -> Charger
								// Return
								return chargingStation;
							}));
						}
						return siteAreaObj;
					}));
				}
				// Set Company?
				if (siteMDB.company) {
					site.setCompany(new Company(tenant, siteMDB.company));
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

	static async deleteSite(tenant, id) {
		// Delete Site Areas
		const siteAreas = await SiteAreaStorage.getSiteAreas({'siteID': id})
		// Delete
		for (const siteArea of siteAreas.result) {
			//	Delete Site Area
			await siteArea.delete();
		}
		// Delete Site
		await global.database.getCollection(tenant, 'sites')
			.findOneAndDelete( {'_id': Utils.convertToObjectID(id)} );
		// Delete Image
		await global.database.getCollection(tenant, 'siteimages')
			.findOneAndDelete( {'_id': Utils.convertToObjectID(id)} );
		// Delete Site's Users
		await global.database.getCollection(tenant, 'siteusers')
			.deleteMany( {'siteID': Utils.convertToObjectID(id)} );
	}
}

module.exports = SiteStorage;
