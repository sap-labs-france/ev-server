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
const SiteStorage = require('./SiteStorage');
const ChargingStation = require('../../../model/ChargingStation');
const Site = require('../../../model/Site');
const SiteArea = require('../../../model/SiteArea');
const crypto = require('crypto');
const ObjectId = mongoose.Types.ObjectId;

let _centralRestServer;

class CompanyStorage {
	static setCentralRestServer(centralRestServer) {
		_centralRestServer = centralRestServer;
	}

	static handleGetCompany(id) {
		// Exec request
		return MDBCompany.findById(id).exec().then((companyMDB) => {
			let company = null;
			// Check
			if (companyMDB) {
				// Create
				company = new Company(companyMDB);
			}
			return company;
		});
	}

	static handleSaveCompany(company) {
		// Check if ID/Name is provided
		if (!company.id && !company.name) {
			// ID must be provided!
			return Promise.reject( new Error(
				"Error in saving the Company: Company has no ID and no Name and cannot be created or updated") );
		} else {
			let companyFilter = {};
			// Build Request
			if (company.id) {
				companyFilter._id = company.id;
			} else {
				companyFilter._id = ObjectId();
			}
			// Get
			return MDBCompany.findOneAndUpdate(companyFilter, company, {
					new: true,
					upsert: true
				}).then((companyMDB) => {
					let newCompany = new Company(companyMDB);
					// Notify Change
					if (!company.id) {
						_centralRestServer.notifyCompanyCreated(
							{
								"id": newCompany.getID(),
								"type": Constants.NOTIF_ENTITY_COMPANY
							}
						);
					} else {
						_centralRestServer.notifyCompanyUpdated(
							{
								"id": newCompany.getID(),
								"type": Constants.NOTIF_ENTITY_COMPANY
							}
						);
					}
					return newCompany;
				});
		}
	}

	// Delegate
	static handleGetCompanies(searchValue, withSites, withLogo, numberOfCompanies) {
		// Check Limit
		numberOfCompanies = Utils.checkRecordLimit(numberOfCompanies);
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
		// Picture?
		if (!withLogo) {
			aggregation.push({
				$project: {
					logo: 0
				}
			});
		}
		// Filters
		if (filters) {
			aggregation.push({
				$match: filters
			});
		}
		// Limit
		if (numberOfCompanies > 0) {
			aggregation.push({
				$limit: numberOfCompanies
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
		// Picture?
		if (!withLogo) {
			aggregation.push({
				$project: {
					"sites.image": 0
				}
			});
		}
		// Execute
		return MDBCompany.aggregate(aggregation)
				.exec().then((companiesMDB) => {
			let companies = [];
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
			return companies;
		});
	}

	static handleDeleteCompany(id) {
		// Delete Sites
		SiteStorage.handleGetSitesFromCompany(id).then((sites) => {
			// Delete
			sites.forEach((site) => {
				//	Delete Site
				site.delete().then((result) => {
					// Nothing to do but promise has to be kept to make the update work!
				});
			});
		});
		// Remove the Company
		return MDBCompany.findByIdAndRemove(id).then((result) => {
			// Notify Change
			_centralRestServer.notifyCompanyDeleted(
				{
					"id": id,
					"type": Constants.NOTIF_ENTITY_COMPANY
				}
			);
			// Return the result
			return result.result;
		});
	}
}

module.exports = CompanyStorage;
