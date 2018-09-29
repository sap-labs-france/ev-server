const Constants = require('../../utils/Constants');
const Database = require('../../utils/Database');
const Utils = require('../../utils/Utils');
const SiteStorage = require('./SiteStorage');
const ObjectID = require('mongodb').ObjectID;
const AppError = require('../../exception/AppError');

class CompanyStorage {
	static async getCompany(id) {
		const Company = require('../../model/Company'); // Avoid fucking circular deps!!!
		// Create Aggregation
		let aggregation = [];
		// Filters
		aggregation.push({
			$match: { _id: Utils.convertToObjectID(id) }
		});
		// Add Created By / Last Changed By
		Utils.pushCreatedLastChangedInAggregation(aggregation);
		// Read DB
		let companiesMDB = await global.db.collection('companies')
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

	static async getCompanyLogo(id) {
		// Read DB
		let companyLogosMDB = await global.db.collection('companylogos')
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

	static async getCompanyLogos() {
		// Read DB
		let companyLogosMDB = await global.db.collection('companylogos')
			.find({})
			.toArray();
		let companyLogo = null;
		// Set
		let companyLogos = [];
		if (companyLogosMDB && companyLogosMDB.length > 0) {
			// Add
			for (const companyLogoMDB of companyLogosMDB) {
				companyLogos.push({
					id: companyLogoMDB._id,
					logo: companyLogoMDB.logo
				});
			}
		}
		return companyLogos;
	}

	static async saveCompany(companyToSave) {
		const Company = require('../../model/Company'); // Avoid fucking circular deps!!!
		// Check if ID/Name is provided
		if (!companyToSave.id && !companyToSave.name) {
			// ID must be provided!
			throw new AppError(
				Constants.CENTRAL_SERVER,
				`Company has no ID and no Name`,
				550, "CompanyStorage", "saveCompany");
		}
		let companyFilter = {};
		// Build Request
		if (companyToSave.id) {
			companyFilter._id = Utils.convertToObjectID(companyToSave.id);
		} else {
			companyFilter._id = new ObjectID();
		}
		// Check Created By/On
		companyToSave.createdBy = Utils.convertUserToObjectID(companyToSave.createdBy);
		companyToSave.lastChangedBy = Utils.convertUserToObjectID(companyToSave.lastChangedBy);
		// Transfer
		let company = {};
		Database.updateCompany(companyToSave, company, false);
		// Modify
	    let result = await global.db.collection('companies').findOneAndUpdate(
			companyFilter,
			{$set: company},
			{upsert: true, new: true, returnOriginal: false});
		// Create
		return new Company(result.value);
	}

	static async saveCompanyLogo(companyLogoToSave) {
		// Check if ID is provided
		if (!companyLogoToSave.id) {
			// ID must be provided!
			throw new AppError(
				Constants.CENTRAL_SERVER,
				`Company Logo has no ID`,
				550, "CompanyStorage", "saveCompanyLogo");
		}
		// Modify
	    await global.db.collection('companylogos').findOneAndUpdate(
			{'_id': Utils.convertToObjectID(companyLogoToSave.id)},
			{$set: {logo: companyLogoToSave.logo}},
			{upsert: true, new: true, returnOriginal: false});
	}

	// Delegate
	static async getCompanies(params={}, limit, skip, sort) {
		const Company = require('../../model/Company'); // Avoid fucking circular deps!!!
		const Site = require('../../model/Site');  // Avoid fucking circular deps!!!
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
				{ "name" : { $regex : params.search, $options: 'i' } },
				{ "address.city" : { $regex : params.search, $options: 'i' } },
				{ "address.country" : { $regex : params.search, $options: 'i' } }
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
		if (params.withSites) {
			// Add Sites
			aggregation.push({
				$lookup: {
					from: "sites",
					localField: "_id",
					foreignField: "companyID",
					as: "sites"
				}
			});
		}
		// Count Records
		let companiesCountMDB = await global.db.collection('companies')
			.aggregate([...aggregation, { $count: "count" }])
			.toArray();
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
		let companiesMDB = await global.db.collection('companies')
			.aggregate(aggregation, { collation: { locale : Constants.DEFAULT_LOCALE, strength: 2 }})
			.toArray();
		let companies = [];
		// Check
		if (companiesMDB && companiesMDB.length > 0) {
			for (const companyMDB of companiesMDB) {
				// Create
				let company = new Company(companyMDB);
				// Set site
				if (params.withSites && companyMDB.sites) {
					company.setSites(companyMDB.sites.map((site) => {
						return new Site(site);
					}));
				}
				// Add
				companies.push(company);
			}
		}
		// Ok
		return {
			count: (companiesCountMDB.length > 0 ? companiesCountMDB[0].count : 0),
			result: companies
		};
	}

	static async deleteCompany(id) {
		// Delete Sites
		let sites = await SiteStorage.getSites({'companyID': id});
		// Delete
		for (const site of sites.result) {
			//	Delete Site
			await site.delete();
		}
		// Delete the Company
		await global.db.collection('companies')
			.findOneAndDelete( {'_id': Utils.convertToObjectID(id)} );
		// Delete Logo
		await global.db.collection('companylogos')
			.findOneAndDelete( {'_id': Utils.convertToObjectID(id)} );
	}
}

module.exports = CompanyStorage;
