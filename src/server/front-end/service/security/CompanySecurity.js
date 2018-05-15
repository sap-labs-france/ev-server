const sanitize = require('mongo-sanitize');
const CentralRestServerAuthorization = require('../../CentralRestServerAuthorization');
const Utils = require('../../../../utils/Utils');
const UtilsSecurity = require('./UtilsSecurity');

let SiteSecurity; // Avoid circular deps

class CompanySecurity {
	static getSiteSecurity() {
		if (!SiteSecurity) {
			SiteSecurity = require('./SiteSecurity');
		}
		return SiteSecurity;
	}

	static filterCompanyDeleteRequest(request, loggedUser) {
		let filteredRequest = {};
		// Set
		filteredRequest.ID = sanitize(request.ID);
		return filteredRequest;
	}

	static filterCompanyRequest(request, loggedUser) {
		let filteredRequest = {};
		filteredRequest.ID = sanitize(request.ID);
		return filteredRequest;
	}

	static filterCompaniesRequest(request, loggedUser) {
		let filteredRequest = {};
		filteredRequest.Search = sanitize(request.Search);
		filteredRequest.WithSites = UtilsSecurity.filterBoolean(request.WithSites);
		return filteredRequest;
	}

	static filterCompanyUpdateRequest(request, loggedUser) {
		// Set
		let filteredRequest = CompanySecurity._filterCompanyRequest(request, loggedUser);
		filteredRequest.id = sanitize(request.id);
		return filteredRequest;
	}

	static filterCompanyCreateRequest(request, loggedUser) {
		return CompanySecurity._filterCompanyRequest(request, loggedUser);
	}

	static _filterCompanyRequest(request, loggedUser) {
		let filteredRequest = {};
		filteredRequest.name = sanitize(request.name);
		filteredRequest.address = UtilsSecurity.filterAddressRequest(request.address, loggedUser);
		filteredRequest.logo = sanitize(request.logo);
		return filteredRequest;
	}

	static filterCompanyResponse(company, loggedUser) {
		let filteredCompany;

		if (!company) {
			return null;
		}
		// Check auth
		if (CentralRestServerAuthorization.canReadCompany(loggedUser, company)) {
			// Admin?
			if (CentralRestServerAuthorization.isAdmin(loggedUser)) {
				// Yes: set all params
				filteredCompany = company;
			} else {
				// Set only necessary info
				filteredCompany = {};
				filteredCompany.id = company.id;
				filteredCompany.name = company.name;
			}
			if (company.address) {
				filteredCompany.address = UtilsSecurity.filterAddressRequest(company.address, loggedUser);
			}
			if (company.sites) {
				filteredCompany.sites = company.sites.map((site) => {
					return CompanySecurity.getSiteSecurity().filterSiteResponse(site, loggedUser);
				})
			}
			// Created By / Last Changed By
			UtilsSecurity.filterCreatedAndLastChanged(
				filteredCompany, company, loggedUser);
		}
		return filteredCompany;
	}

	static filterCompaniesResponse(companies, loggedUser) {
		let filteredCompanies = [];

		if (!companies) {
			return null;
		}
		if (!CentralRestServerAuthorization.canListCompanies(loggedUser)) {
			return null;
		}
		companies.forEach(company => {
			// Filter
			let filteredCompany = CompanySecurity.filterCompanyResponse(company, loggedUser);
			// Ok?
			if (filteredCompany) {
				// Add
				filteredCompanies.push(filteredCompany);
			}
		});
		return filteredCompanies;
	}
}

module.exports = CompanySecurity;
