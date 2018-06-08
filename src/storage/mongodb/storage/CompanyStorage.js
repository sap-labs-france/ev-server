const Logging = require('../../../utils/Logging');
const Constants = require('../../../utils/Constants');
const Database = require('../../../utils/Database');
const Utils = require('../../../utils/Utils');
const Company = require('../../../model/Company');
const SiteStorage = require('./SiteStorage');
const Site = require('../../../model/Site');
const ObjectID = require('mongodb').ObjectID;

let _db;

class CompanyStorage {
	static setDatabase(db) {
		_db = db;
	}

	static async handleGetCompany(id) {
		// Create Aggregation
		let aggregation = [];
		// Filters
		aggregation.push({
			$match: { _id: Utils.convertToObjectID(id) }
		});
		// Add Created By / Last Changed By
		Utils.pushCreatedLastChangedInAggregation(aggregation);
		// Read DB
		let companiesMDB = await _db.collection('companies')
			.aggregate(aggregation)
			.limit(1)
			.toArray();
		let company = null;
		// Check
		if (companiesMDB && companiesMDB.length > 0) {
			// Create
			company = new Company(companiesMDB[0]);
		}
		return company;
	}

	static async handleGetCompanyLogo(id) {
		// Read DB
		let companyLogosMDB = await _db.collection('companylogos')
			.find({_id: Utils.convertToObjectID(id)})
			.limit(1)
			.toArray();
		let companyLogo = null;
		// Set
		if (companyLogosMDB && companyLogosMDB.length > 0) {
			companyLogo = {
				id: companyLogosMDB[0]._id,
				logo: companyLogosMDB[0].logo
			};
		}
		return companyLogo;
	}

	static async handleGetCompanyLogos() {
		// Read DB
		let companyLogosMDB = await _db.collection('companylogos')
			.find({})
			.toArray();
		let companyLogo = null;
		// Set
		let companyLogos = [];
		if (companyLogosMDB && companyLogosMDB.length > 0) {
			// Add
			companyLogosMDB.forEach((companyLogoMDB) => {
				companyLogos.push({
					id: companyLogoMDB._id,
					logo: companyLogoMDB.logo
				});
			});
		}
		return companyLogos;
	}

	static async handleSaveCompany(companyToSave) {
		// Check if ID/Name is provided
		if (!companyToSave.id && !companyToSave.name) {
			// ID must be provided!
			throw new AppError(
				Constants.CENTRAL_SERVER,
				`Company has no ID and no Name`,
				550, "CompanyStorage", "handleSaveCompany");
		}
		let companyFilter = {};
		// Build Request
		if (companyToSave.id) {
			companyFilter._id = Utils.convertToObjectID(companyToSave.id);
		} else {
			companyFilter._id = new ObjectID();
		}
		// Check Created By/On
		companyToSave.createdBy = Utils.ensureIsUserObjectID(companyToSave.createdBy);
		companyToSave.createdOn = Utils.convertToDate(companyToSave.createdOn);
		// Check Last Changed By/On
		companyToSave.lastChangedBy = Utils.ensureIsUserObjectID(companyToSave.lastChangedBy);
		companyToSave.lastChangedOn = Utils.convertToDate(companyToSave.lastChangedOn);
		// Transfer
		let company = {};
		Database.updateCompany(companyToSave, company, false);
		// Modify
	    let result = await _db.collection('companies').findOneAndUpdate(
			companyFilter,
			{$set: company},
			{upsert: true, new: true, returnOriginal: false});
		// Create
		return new Company(result.value);
	}

	static async handleSaveCompanyLogo(companyLogoToSave) {
		// Check if ID is provided
		if (!companyLogoToSave.id) {
			// ID must be provided!
			throw new AppError(
				Constants.CENTRAL_SERVER,
				`Company Logo has no ID`,
				550, "CompanyStorage", "handleSaveCompanyLogo");
		}
		// Modify
	    await _db.collection('companylogos').findOneAndUpdate(
			{'_id': Utils.convertToObjectID(companyLogoToSave.id)},
			{$set: {logo: companyLogoToSave.logo}},
			{upsert: true, new: true, returnOriginal: false});
	}

	// Delegate
	static async handleGetCompanies(searchValue, withSites, numberOfCompanies) {
		// Check Limit
		numberOfCompanies = Utils.checkRecordLimit(numberOfCompanies);
		// Set the filters
		let filters = {};
		// Source?
		if (searchValue) {
			// Build filter
			filters.$or = [
				{ "name" : { $regex : searchValue, $options: 'i' } },
				{ "address.city" : { $regex : searchValue, $options: 'i' } },
				{ "address.country" : { $regex : searchValue, $options: 'i' } }
			];
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
				localField: "_id",
				foreignField: "companyID",
				as: "sites"
			}
		});
		aggregation.push({
			$addFields: {
				"numberOfSites": { $size: "$sites" }
			}
		});
		// Add Created By / Last Changed By
		Utils.pushCreatedLastChangedInAggregation(aggregation);
		// Sort
		aggregation.push({
			$sort: { name : 1 }
		});
		// Limit
		if (numberOfCompanies > 0) {
			aggregation.push({
				$limit: numberOfCompanies
			});
		}
		// Read DB
		let companiesMDB = await _db.collection('companies')
			.aggregate(aggregation)
			.toArray();
		let companies = [];
		// Check
		if (companiesMDB && companiesMDB.length > 0) {
			// Create
			companiesMDB.forEach((companyMDB) => {
				// Create
				let company = new Company(companyMDB);
				// Set site
				if (withSites && companyMDB.sites) {
					company.setSites(companyMDB.sites.map((site) => {
						return new Site(site);
					}));
				}
				// Add
				companies.push(company);
			});
		}
		return companies;
	}

	static async handleDeleteCompany(id) {
		// Delete Sites
		let sites = await SiteStorage.handleGetSites(null, id);
		// Delete
		sites.forEach(async (site) => {
			//	Delete Site
			await site.delete();
		});
		// Delete the Company
		await _db.collection('companies')
			.findOneAndDelete( {'_id': Utils.convertToObjectID(id)} );
		// Delete Logo
		await _db.collection('companylogos')
			.findOneAndDelete( {'_id': Utils.convertToObjectID(id)} );
	}
}

module.exports = CompanyStorage;
