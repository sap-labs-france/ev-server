const Logging = require('../../utils/Logging');
const Configuration = require('../../utils/Configuration');
const Authorization = require('node-authorization').Authorization;
require('source-map-support').install();

let _configuration;

module.exports = {
	ROLE_ADMIN: "A",
	ROLE_BASIC: "B",
	ROLE_DEMO: "D",
	ROLE_CORPORATE: "C",

	ENTITY_USERS: "Users",
	ENTITY_USER: "User",
	ENTITY_COMPANIES: "Companies",
	ENTITY_COMPANY: "Company",
	ENTITY_SITES: "Sites",
	ENTITY_SITE: "Site",
	ENTITY_SITE_AREAS: "SiteAreas",
	ENTITY_SITE_AREA: "SiteArea",
	ENTITY_CHARGING_STATIONS: "ChargingStations",
	ENTITY_CHARGING_STATION: "ChargingStation",
	ENTITY_TRANSACTIONS: "Transactions",
	ENTITY_TRANSACTION: "Transaction",
	ENTITY_LOGGING: "Logging",
	ENTITY_PRICING: "Pricing",

	ACTION_CREATE: "Create",
	ACTION_READ  : "Read",
	ACTION_UPDATE: "Update",
	ACTION_DELETE: "Delete",
	ACTION_LOGOUT: "Logout",
	ACTION_LIST: "List",
	ACTION_RESET: "Reset",
	ACTION_CLEAR_CACHE: "ClearCache",
	ACTION_STOP_TRANSACTION: "StopTransaction",
	ACTION_UNLOCK_CONNECTOR: "UnlockConnector",
	ACTION_GET_CONFIGURATION: "GetConfiguration",

	canListLogging(loggedUser) {
		// Check
		return this.canPerformAction(loggedUser, this.ENTITY_LOGGING,
			{ "Action": this.ACTION_LIST });
	},

	canListTransactions(loggedUser) {
		// Check
		return this.canPerformAction(loggedUser, this.ENTITY_TRANSACTIONS,
			{ "Action": this.ACTION_LIST });
	},

	canReadTransaction(loggedUser, transaction) {
		// Check
		return this.canPerformAction(loggedUser, this.ENTITY_TRANSACTION,
			{ "Action": this.ACTION_READ });
	},

	canUpdateTransaction(loggedUser, transaction) {
		// Check
		return this.canPerformAction(loggedUser, this.ENTITY_TRANSACTION,
			{ "Action": this.ACTION_UPDATE });
	},

	canDeleteTransaction(loggedUser, transaction) {
		// Check
		return this.canPerformAction(loggedUser, this.ENTITY_TRANSACTION,
			{ "Action": this.ACTION_DELETE });
	},

	canListChargingStations(loggedUser) {
		// Check
		return this.canPerformAction(loggedUser, this.ENTITY_CHARGING_STATIONS,
			{ "Action": this.ACTION_LIST });
	},

	canPerformActionOnChargingStation(loggedUser, chargingStation, action, user=null) {
		// Check
		if (user) {
			return this.canPerformAction(loggedUser, this.ENTITY_CHARGING_STATION,
				{ "Action": action, "UserID": user.id });
		} else {
			return this.canPerformAction(loggedUser, this.ENTITY_CHARGING_STATION,
				{ "Action": action });
		}
	},

	canReadChargingStation(loggedUser, chargingStation) {
		// Check
		return this.canPerformAction(loggedUser, this.ENTITY_CHARGING_STATION,
			{ "Action": this.ACTION_READ });
	},

	canUpdateChargingStation(loggedUser, chargingStation) {
		// Check
		return this.canPerformAction(loggedUser, this.ENTITY_CHARGING_STATION,
			{ "Action": this.ACTION_UPDATE });
	},

	canListUsers(loggedUser) {
		// Check
		return this.canPerformAction(loggedUser, this.ENTITY_USERS,
			{ "Action": this.ACTION_LIST });
	},

	canReadUser(loggedUser, user) {
		// Check
		return this.canPerformAction(loggedUser, this.ENTITY_USER,
			{ "Action": this.ACTION_READ, "UserID": user.id.toString() });
	},

	canLogoutUser(loggedUser, user) {
		// Check
		return this.canPerformAction(loggedUser, this.ENTITY_USER,
			{ "Action": this.ACTION_LOGOUT, "UserID": user.id });
	},

	canCreateUser(loggedUser) {
		// Check
		return this.canPerformAction(loggedUser, this.ENTITY_USER,
			{ "Action": this.ACTION_CREATE });
	},

	canUpdateUser(loggedUser, user) {
		// Check
		return this.canPerformAction(loggedUser, this.ENTITY_USER,
			{ "Action": this.ACTION_UPDATE, "UserID": user.id });
	},

	canDeleteUser(loggedUser, user) {
		// Check
		return this.canPerformAction(loggedUser, this.ENTITY_USER,
			{ "Action": this.ACTION_DELETE, "UserID": user.id });
	},

	canListSites(loggedUser) {
		// Check
		return this.canPerformAction(loggedUser, this.ENTITY_SITES,
			{ "Action": this.ACTION_LIST });
	},

	canReadSite(loggedUser, site) {
		// Check
		return this.canPerformAction(loggedUser, this.ENTITY_SITE,
			{ "Action": this.ACTION_READ });
	},

	canCreateSite(loggedUser) {
		// Check
		return this.canPerformAction(loggedUser, this.ENTITY_SITE,
			{ "Action": this.ACTION_CREATE });
	},

	canUpdateSite(loggedUser, site) {
		// Check
		return this.canPerformAction(loggedUser, this.ENTITY_SITE,
			{ "Action": this.ACTION_UPDATE, "SiteID": site.id });
	},

	canDeleteSite(loggedUser, site) {
		// Check
		return this.canPerformAction(loggedUser, this.ENTITY_SITE,
			{ "Action": this.ACTION_DELETE, "SiteID": site.id });
	},

	canListSiteAreas(loggedUser) {
		// Check
		return this.canPerformAction(loggedUser, this.ENTITY_SITE_AREAS,
			{ "Action": this.ACTION_LIST });
	},

	canReadSiteArea(loggedUser, siteArea) {
		// Check
		return this.canPerformAction(loggedUser, this.ENTITY_SITE_AREA,
			{ "Action": this.ACTION_READ });
	},

	canCreateSiteArea(loggedUser) {
		// Check
		return this.canPerformAction(loggedUser, this.ENTITY_SITE_AREA,
			{ "Action": this.ACTION_CREATE });
	},

	canUpdateSiteArea(loggedUser, siteArea) {
		// Check
		return this.canPerformAction(loggedUser, this.ENTITY_SITE_AREA,
			{ "Action": this.ACTION_UPDATE, "SiteAreaID": siteArea.id });
	},

	canDeleteSiteArea(loggedUser, siteArea) {
		// Check
		return this.canPerformAction(loggedUser, this.ENTITY_SITE_AREA,
			{ "Action": this.ACTION_DELETE, "SiteAreaID": siteArea.id });
	},

	canListCompanies(loggedUser) {
		// Check
		return this.canPerformAction(loggedUser, this.ENTITY_COMPANIES,
			{ "Action": this.ACTION_LIST });
	},

	canReadCompany(loggedUser, company) {
		// Check
		return this.canPerformAction(loggedUser, this.ENTITY_COMPANY,
			{ "Action": this.ACTION_READ });
	},

	canCreateCompany(loggedUser) {
		// Check
		return this.canPerformAction(loggedUser, this.ENTITY_COMPANY,
			{ "Action": this.ACTION_CREATE });
	},

	canUpdateCompany(loggedUser, company) {
		// Check
		return this.canPerformAction(loggedUser, this.ENTITY_COMPANY,
			{ "Action": this.ACTION_UPDATE, "CompanyID": company.id });
	},

	canDeleteCompany(loggedUser, company) {
		// Check
		return this.canPerformAction(loggedUser, this.ENTITY_COMPANY,
			{ "Action": this.ACTION_DELETE, "CompanyID": company.id });
	},

	canReadPricing(loggedUser) {
		// Check
		return this.canPerformAction(loggedUser, this.ENTITY_PRICING,
			{ "Action": this.ACTION_READ });
	},

	canUpdatePricing(loggedUser) {
		// Check
		return this.canPerformAction(loggedUser, this.ENTITY_PRICING,
			{ "Action": this.ACTION_UPDATE });
	},

	canDeleteChargingStation(loggedUser, chargingStation) {
		// Check
		return this.canPerformAction(loggedUser, this.ENTITY_CHARGING_STATION,
			{ "Action": this.ACTION_DELETE });
	},

	isAdmin(loggedUser) {
		return loggedUser.role === this.ROLE_ADMIN;
	},

	isUser(loggedUser) {
		return loggedUser.role === this.ROLE_USER;
	},

	isCorporate(loggedUser) {
		return loggedUser.role === this.ROLE_CORPORATE;
	},

	isDemo(loggedUser) {
		return loggedUser.role === this.ROLE_DEMO;
	},

	getConfiguration() {
		if(!_configuration) {
			// Load it
			_configuration = Configuration.getAuthorizationConfig();
		}
		return _configuration;
	},

	canPerformAction(loggedUser, entity, fieldNamesValues) {
		// Set debug mode?
		if (this.getConfiguration().debug) {
			// Switch on traces
			Authorization.switchTraceOn();
		}
		// Create Auth
		var auth = new Authorization(loggedUser.role, loggedUser.auths);
		// Check
		if(auth.check(entity, fieldNamesValues)) {
			// Authorized!
			return true;
		} else {
			return false;
		}
	}
};
