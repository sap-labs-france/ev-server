const sanitize = require('mongo-sanitize');
const Authorizations = require('../../../../authorization/Authorizations');
const UtilsSecurity = require('./UtilsSecurity');

let CompanySecurity; // Avoid circular deps
let SiteAreaSecurity; // Avoid circular deps
let UserSecurity; // Avoid circular deps

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

	static getUserSecurity() {
		if (!UserSecurity) {
			UserSecurity = require('./UserSecurity');
		}
		return UserSecurity;
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
		filteredRequest.WithUsers = UtilsSecurity.filterBoolean(request.WithUsers);
		return filteredRequest;
	}

	static filterSitesRequest(request, loggedUser) {
		let filteredRequest = {};
		filteredRequest.Search = sanitize(request.Search);
		filteredRequest.UserID = sanitize(request.UserID);
		filteredRequest.ExcludeSitesOfUserID = sanitize(request.ExcludeSitesOfUserID);
		filteredRequest.WithSiteAreas = UtilsSecurity.filterBoolean(request.WithSiteAreas);
		filteredRequest.WithChargeBoxes = UtilsSecurity.filterBoolean(request.WithChargeBoxes);
		filteredRequest.WithCompany = UtilsSecurity.filterBoolean(request.WithCompany);
		filteredRequest.WithUsers = UtilsSecurity.filterBoolean(request.WithUsers);
		UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
		UtilsSecurity.filterSort(request, filteredRequest);
		return filteredRequest;
	}

	static filterSiteUpdateRequest(request, loggedUser) {
		// SetSites
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
		filteredRequest.allowAllUsersToStopTransactions =
			UtilsSecurity.filterBoolean(request.allowAllUsersToStopTransactions);
		filteredRequest.gps = sanitize(request.gps);
		if (request.userIDs) {
			// Handle Users
			filteredRequest.userIDs = request.userIDs.map((userID) => {
				return sanitize(userID);
			});
			filteredRequest.userIDs = request.userIDs.filter((userID) => {
				// Check auth
				if (Authorizations.canReadUser(loggedUser, {id: userID})) {
					return true;
				}
				return false;
			});
		}
		filteredRequest.companyID = sanitize(request.companyID);
		return filteredRequest;
	}

	static filterSiteResponse(site, loggedUser) {
		let filteredSite;

		if (!site) {
			return null;
		}
		// Check auth
		if (Authorizations.canReadSite(loggedUser, site)) {
			// Admin?
			if (Authorizations.isAdmin(loggedUser)) {
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
			if (site.users) {
				filteredSite.users = site.users.map((user) => {
					return SiteSecurity.getUserSecurity().filterMinimalUserResponse(user, loggedUser);
				})
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
		if (!Authorizations.canListSites(loggedUser)) {
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
