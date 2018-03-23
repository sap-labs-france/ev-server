const sanitize = require('mongo-sanitize');
const CentralRestServerAuthorization = require('../../CentralRestServerAuthorization');
const Utils = require('../../../../utils/Utils');
const UtilsSecurity = require('./UtilsSecurity');
let CompanySecurity; // Avoid circular deps
let SiteAreaSecurity; // Avoid circular deps

class SiteSecurity {
	static getCompanySecurity() {
		if (!CompanySecurity) {
			CompanySecurity = require('./CompanySecurity');
		}
		return CompanySecurity;
	}

	static getSiteAreaSecurity() {
		if (!SiteAreaSecurity) {
			SiteAreaSecurity = require('./SiteAreaSecurity');
		}
		return SiteAreaSecurity;
	}

	static filterSiteDeleteRequest(request, loggedUser) {
		let filteredRequest = {};
		// Set
		filteredRequest.ID = sanitize(request.ID);
		return filteredRequest;
	}

	static filterSiteRequest(request, loggedUser) {
		let filteredRequest = {};
		filteredRequest.ID = sanitize(request.ID);
		return filteredRequest;
	}

	static filterSitesRequest(request, loggedUser) {
		let filteredRequest = {};
		filteredRequest.Search = sanitize(request.Search);
		filteredRequest.WithSiteAreas = UtilsSecurity.filterBoolean(request.WithSiteAreas);
		filteredRequest.WithChargeBoxes = UtilsSecurity.filterBoolean(request.WithChargeBoxes);
		filteredRequest.WithCompany = UtilsSecurity.filterBoolean(request.WithCompany);
		return filteredRequest;
	}

	static filterSiteUpdateRequest(request, loggedUser) {
		// Set
		let filteredRequest = SiteSecurity._filterSiteRequest(request, loggedUser);
		filteredRequest.id = sanitize(request.id);
		return filteredRequest;
	}

	static filterSiteCreateRequest(request, loggedUser) {
		return SiteSecurity._filterSiteRequest(request, loggedUser);
	}

	static _filterSiteRequest(request, loggedUser) {
		let filteredRequest = {};
		filteredRequest.name = sanitize(request.name);
		filteredRequest.address = UtilsSecurity.filterAddressRequest(request.address, loggedUser);
		filteredRequest.image = sanitize(request.image);
		filteredRequest.gps = sanitize(request.gps);
		filteredRequest.companyID = sanitize(request.companyID);
		return filteredRequest;
	}

	static filterSiteResponse(site, loggedUser) {
		let filteredSite;

		if (!site) {
			return null;
		}
		// Check auth
		if (CentralRestServerAuthorization.canReadSite(loggedUser, site)) {
			// Admin?
			if (CentralRestServerAuthorization.isAdmin(loggedUser)) {
				// Yes: set all params
				filteredSite = site;
			} else {
				// Set only necessary info
				filteredSite = {};
				filteredSite.id = site.id;
				filteredSite.name = site.name;
				filteredSite.gps = site.gps;
				filteredSite.companyID = site.companyID;
			}
			if (site.address) {
				filteredSite.address = UtilsSecurity.filterAddressRequest(site.address, loggedUser);
			}
			if (site.company) {
				filteredSite.company = SiteSecurity.getCompanySecurity().filterCompanyResponse(site.company, loggedUser);;
			}
			if (site.siteAreas) {
				filteredSite.siteAreas = SiteSecurity.getSiteAreaSecurity().filterSiteAreasResponse(site.siteAreas, loggedUser);
			}
			// Created By / Last Changed By
			UtilsSecurity.filterCreatedAndLastChanged(
				filteredSite, site, loggedUser);
		}
		return filteredSite;
	}

	static filterSitesResponse(sites, loggedUser) {
		let filteredSites = [];

		if (!sites) {
			return null;
		}
		if (!CentralRestServerAuthorization.canListSites(loggedUser)) {
			return null;
		}
		sites.forEach(site => {
			// Filter
			let filteredSite = SiteSecurity.filterSiteResponse(site, loggedUser);
			// Ok?
			if (filteredSite) {
				// Add
				filteredSites.push(filteredSite);
			}
		});
		return filteredSites;
	}
}

module.exports = SiteSecurity;
