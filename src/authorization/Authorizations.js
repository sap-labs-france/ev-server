const Logging = require('../utils/Logging');
const Constants = require('../utils/Constants');
const Configuration = require('../utils/Configuration');
const Authorization = require('node-authorization').Authorization;
const NotificationHandler = require('../notification/NotificationHandler');
const Mustache = require('mustache');
const compileProfile = require('node-authorization').profileCompiler;
const AppError = require('../exception/AppError');
const AppAuthError = require('../exception/AppAuthError');
const Utils = require('../utils/Utils');
const User = require('../model/User');
const AuthorizationsDefinition = require('./AuthorizationsDefinition');
const UserStorage = require('../storage/mongodb/UserStorage')
require('source-map-support').install();

let _configuration;

module.exports = {
	ROLE_ADMIN: "A",
	ROLE_BASIC: "B",
	ROLE_DEMO: "D",

	ACTION_READ  : "Read",
	ACTION_CREATE: "Create",
	ACTION_UPDATE: "Update",
	ACTION_DELETE: "Delete",
	ACTION_LOGOUT: "Logout",
	ACTION_LIST: "List",
	ACTION_RESET: "Reset",
	ACTION_AUTHORIZE: "Authorize",
	ACTION_CLEAR_CACHE: "ClearCache",
	ACTION_STOP_TRANSACTION: "StopTransaction",
	ACTION_START_TRANSACTION: "StartTransaction",
	ACTION_REFUND_TRANSACTION: "RefundTransaction",
	ACTION_UNLOCK_CONNECTOR: "UnlockConnector",
	ACTION_GET_CONFIGURATION: "GetConfiguration",

	canRefundTransaction(loggedUser, transaction) {
		// Check auth
		if (transaction.user) {
			// Check
			return this.canPerformAction(loggedUser, Constants.ENTITY_TRANSACTION,
				{ "Action": this.ACTION_REFUND_TRANSACTION, "UserID": transaction.user.id.toString()});
		// Admin?
		} else if (!this.isAdmin(loggedUser)) {
			return false;
		}
		return true;
	},

	canStartTransaction(user, chargingStation) {
		// Can perform stop?
		if (!this.canPerformActionOnChargingStation(
				user.getModel(),
				chargingStation.getModel(),
				this.ACTION_START_TRANSACTION)) {
			// Ko
			return false;
		}
		// Ok
		return true;
	},

	canStopTransaction(user, chargingStation) {
		// Can perform stop?
		if (!this.canPerformActionOnChargingStation(
				user.getModel(),
				chargingStation.getModel(),
				this.ACTION_STOP_TRANSACTION)) {
			// Ko
			return false;
		}
		// Ok
		return true;
	},

	// Build Auth
	async buildAuthorizations(user) {
		// Password OK
		let companies = [],
			sites,
			siteAreas = [],
			chargingStations = [],
			users = [];

		// Get sites
		sites = await user.getSites();
		// Get all the companies and site areas
		for (const site of sites) {
			// Get Company
			let company = await site.getCompany();
			// Check
			let foundCompany = companies.find((existingCompany) => {
				return existingCompany.getID() === company.getID();
			});
			// Found?
			if (!foundCompany) {
				// No: Add it
				companies.push(company);
			}
			// Get site areas
			siteAreas.push(...await site.getSiteAreas());
		}
		// Get all the charging stations
		for (const siteArea of siteAreas) {
			chargingStations.push(...await siteArea.getChargingStations());
		}
		// Convert to IDs
		let companyIDs = companies.map((company) => {
			return company.getID();
		});
		let siteIDs = sites.map((site) => {
			return site.getID();
		});
		let siteAreaIDs = siteAreas.map((siteArea) => {
			return siteArea.getID();
		});
		let chargingStationIDs = chargingStations.map((chargingStation) => {
			return chargingStation.getID();
		});
		// Get authorisation
		let authsDefinition = AuthorizationsDefinition.getAuthorizations();
		// Add user
		users.push(user.getID());
		// Parse the auth and replace values
		let authsDefinitionParsed = Mustache.render(
			authsDefinition,
			{
				"userID": users,
				"companyID": companyIDs,
				"siteID": siteIDs,
				"siteAreaID": siteAreaIDs,
				"chargingStationID": chargingStationIDs,
				"trim": () => {
					return (text, render) => {
						// trim trailing comma and whitespace
						return render(text).replace(/(,\s*$)/g, '');
					}
				}
			}
		);
		let userAuthDefinition = this.getAuthorizationFromRoleID(
			JSON.parse(authsDefinitionParsed), user.getRole());
		// Compile auths of the role
		let compiledAuths = compileProfile(userAuthDefinition.auths);
		// Return
		return compiledAuths;
	},

	async getOrCreateUserByTagID(chargingStation, siteArea, tagID, action) {
		let newUserCreated = false;
		// Get the user
		let user = await UserStorage.getUserByTagId(tagID);
		// Found?
		if (!user) {
			// No: Create an empty user
			let newUser = new User({
				name: (siteArea.isAccessControlEnabled() ? "Unknown" : "Anonymous"),
				firstName: "User",
				status: (siteArea.isAccessControlEnabled() ? Constants.USER_STATUS_PENDING : Constants.USER_STATUS_ACTIVE),
				role: Constants.USER_ROLE_BASIC,
				email: tagID + "@chargeangels.fr",
				tagIDs: [tagID],
				createdOn: new Date().toISOString()
			});
			// Set the flag
			newUserCreated = true;
			// Save the user
			user = await newUser.save();
		// Check User Deleted?
		} else if (user.getStatus() == Constants.USER_STATUS_DELETED) {
			// Restore it
			user.setDeleted(false);
			// Set default user's value
			user.setStatus((siteArea.isAccessControlEnabled() ? Constants.USER_STATUS_INACTIVE : Constants.USER_STATUS_ACTIVE));
			user.setName((siteArea.isAccessControlEnabled() ? "Unknown" : "Anonymous"));
			user.setFirstName("User");
			user.setEMail(tagID + "@chargeangels.fr");
			user.setPhone("");
			user.setMobile("");
			user.setImage("");
			user.setINumber("");
			user.setCostCenter("");
			// Log
			Logging.logSecurityInfo({
				user: user,
				module: "Authorizations", method: "getOrCreateUserByTagID",
				message: `User with ID '${user.getID()}' has been restored`,
				action: action
			});
			// Save
			user = user.save();
		}
		// New User?
		if (newUserCreated) {
			// Notify
			NotificationHandler.sendUnknownUserBadged(
				Utils.generateGUID(),
				chargingStation.getModel(),
				{
					"chargingBoxID": chargingStation.getID(),
					"badgeId": tagID,
					"evseDashboardURL" : Utils.buildEvseURL(),
					"evseDashboardUserURL" : Utils.buildEvseUserURL(user)
				}
			);
		}
		// Access Control enabled?
		if (newUserCreated && siteArea.isAccessControlEnabled()) {
			// Yes
			throw new AppError(
				chargingStation.getID(),
				`User with Tag ID '${tagID}' not found but saved as inactive user`,
				"Authorizations", "getOrCreateUserByTagID",
				user.getModel()
			);
		}
		// Check User status
		if (user.getStatus() !== Constants.USER_STATUS_ACTIVE) {
			// Reject but save ok
			throw new AppError(
				chargingStation.getID(),
				`User with TagID '${tagID}' is '${User.getStatusDescription(user.getStatus())}'`, 500,
				"Authorizations", "getOrCreateUserByTagID",
				user.getModel());
		}
		return user;
	},

	async checkAndGetIfUserIsAuthorizedForChargingStation(action, chargingStation, tagID, alternateTagID) {
		// Site Area -----------------------------------------------
		// Check first if the site area access control is active
		let siteArea = await chargingStation.getSiteArea();
		// Site is mandatory
		if (!siteArea) {
			// Reject Site Not Found
			throw new AppError(
				chargingStation.getID(),
				`Charging Station '${chargingStation.getID()}' is not assigned to a Site Area!`, 525,
				"Authorizations", "checkAndGetIfUserIsAuthorizedForChargingStation");
		}
		// User -------------------------------------------------
		// Get and Check User
		let user = await this.getOrCreateUserByTagID(chargingStation, siteArea, tagID, action);
		let alternateUser;
		// Get and Check Alternate User
		if (alternateTagID) {
			alternateUser = await this.getOrCreateUserByTagID(chargingStation, siteArea, alternateTagID, action);
		}
		// Set current user
		let currentUser = (alternateUser ? alternateUser : user);
		// Check Auth
		let auths = await this.buildAuthorizations(currentUser);
		// Set
		currentUser.setAuthorisations(auths);
		// Get the Site
		let site = await siteArea.getSite(null, true);
		if (!site) {
			// Reject Site Not Found
			throw new AppError(
				chargingStation.getID(),
				`Site Area '${siteArea.getName()}' is not assigned to a Site!`, 525,
				"Authorizations", "checkAndGetIfUserIsAuthorizedForChargingStation",
				user.getModel());
		}
		// Get Users
		let siteUsers = await site.getUsers();
		// Check User ------------------------------------------
		let foundUser = siteUsers.find((siteUser) => {
			return siteUser.getID() == user.getID();
		});
		// User not found and Access Control Enabled?
		if (!foundUser && siteArea.isAccessControlEnabled()) {
			// Yes: Reject the User
			throw new AppError(
				chargingStation.getID(),
				`User is not assigned to the Site '${site.getName()}'!`, 525,
				"Authorizations", "checkAndGetIfUserIsAuthorizedForChargingStation",
				user.getModel());
		}
		// Check Alternate User --------------------------------
		let foundAlternateUser;
		if (alternateUser) {
			foundAlternateUser = siteUsers.find((siteUser) => {
				return siteUser.getID() == alternateUser.getID();
			});
		}
		// Alternate User not found and Access Control Enabled?
		if (alternateUser && !foundAlternateUser && siteArea.isAccessControlEnabled()) {
			// Reject the User
			throw new AppError(
				chargingStation.getID(),
				`User is not assigned to the Site '${site.getName()}'!`, 525,
				"Authorizations", "checkAndGetIfUserIsAuthorizedForChargingStation",
				alternateUser.getModel());
		}
		// Check if users are differents
		if (alternateUser && (user.getID() != alternateUser.getID()) &&
				!alternateUser.isAdmin() && !site.isAllowAllUsersToStopTransactionsEnabled()) {
			// Reject the User
			throw new AppError(
				chargingStation.getID(),
				`User '${alternateUser.getFullName()}' is not allowed to perform '${action}' on User '${user.getFullName()}' on Site '${site.getName()}'!`,
				525, "Authorizations", "checkAndGetIfUserIsAuthorizedForChargingStation",
				alternateUser.getModel(), user.getModel());
		}
		// Can perform action?
		if (!this.canPerformActionOnChargingStation(
				currentUser.getModel(),
				chargingStation.getModel(),
				action)) {
			// Not Authorized!
			throw new AppAuthError(
				action,
				Constants.ENTITY_CHARGING_STATION,
				chargingStation.getID(),
				500, "Authorizations", "checkAndGetIfUserIsAuthorizedForChargingStation",
				currentUser.getModel());
		}
		// Return
		return {
			"user": user,
			"alternateUser": alternateUser
		};
	},

	// Read the config file
	getAuthorizationFromRoleID(authorisations, roleID) {
		// Filter
		let matchingAuthorisation = authorisations.filter((authorisation) => {
			return authorisation.id === roleID;
		});
		// Only one role
		return (matchingAuthorisation.length > 0 ? matchingAuthorisation[0] : []);
	},

	canListLogging(loggedUser) {
		// Check
		return this.canPerformAction(loggedUser, Constants.ENTITY_LOGGINGS,
			{ "Action": this.ACTION_LIST });
	},

	canReadLogging(loggedUser, logging) {
		// Check
		return this.canPerformAction(loggedUser, Constants.ENTITY_LOGGING,
			{ "Action": this.ACTION_READ, "LogID": logging.id.toString()});
	},

	canListTransactions(loggedUser) {
		// Check
		return this.canPerformAction(loggedUser, Constants.ENTITY_TRANSACTIONS,
			{ "Action": this.ACTION_LIST });
	},

	canReadTransaction(loggedUser, transaction) {
		// Check auth
		if (transaction.user && transaction.user.id) {
			// Check
			return this.canPerformAction(loggedUser, Constants.ENTITY_TRANSACTION,
				{ "Action": this.ACTION_READ, "UserID": transaction.user.id.toString()});
		// Admin?
		} else if (!this.isAdmin(loggedUser)) {
			return false;
		}
		return true;
	},

	canUpdateTransaction(loggedUser, transaction) {
		// Check auth
		if (transaction.user) {
			// Check
			return this.canPerformAction(loggedUser, Constants.ENTITY_TRANSACTION,
				{ "Action": this.ACTION_UPDATE, "UserID": transaction.user.id.toString()});
		// Admin?
		} else if (!this.isAdmin(loggedUser)) {
			return false;
		}
		return true;
	},

	canDeleteTransaction(loggedUser, transaction) {
		// Check auth
		if (transaction.user) {
			// Check
			return this.canPerformAction(loggedUser, Constants.ENTITY_TRANSACTION,
				{ "Action": this.ACTION_DELETE, "UserID": transaction.user.id.toString()});
		// Admin?
		} else if (!this.isAdmin(loggedUser)) {
			return false;
		}
		return true;
	},

	canListChargingStations(loggedUser) {
		// Check
		return this.canPerformAction(loggedUser, Constants.ENTITY_CHARGING_STATIONS,
			{ "Action": this.ACTION_LIST });
	},

	canPerformActionOnChargingStation(loggedUser, chargingStation, action) {
		return this.canPerformAction(loggedUser, Constants.ENTITY_CHARGING_STATION,
			{ "Action": action, "ChargingStationID": chargingStation.id });
	},

	canReadChargingStation(loggedUser, chargingStation) {
		// Check
		return this.canPerformAction(loggedUser, Constants.ENTITY_CHARGING_STATION,
			{ "Action": this.ACTION_READ, "ChargingStationID": chargingStation.id });
	},

	canUpdateChargingStation(loggedUser, chargingStation) {
		// Check
		return this.canPerformAction(loggedUser, Constants.ENTITY_CHARGING_STATION,
			{ "Action": this.ACTION_UPDATE, "ChargingStationID": chargingStation.id });
	},

	canDeleteChargingStation(loggedUser, chargingStation) {
		// Check
		return this.canPerformAction(loggedUser, Constants.ENTITY_CHARGING_STATION,
			{ "Action": this.ACTION_DELETE, "ChargingStationID": chargingStation.id });
	},

	canListUsers(loggedUser) {
		// Check
		return this.canPerformAction(loggedUser, Constants.ENTITY_USERS,
			{ "Action": this.ACTION_LIST });
	},

	canReadUser(loggedUser, user) {
		// Check
		return this.canPerformAction(loggedUser, Constants.ENTITY_USER,
			{ "Action": this.ACTION_READ, "UserID": user.id.toString() });
	},

	canLogoutUser(loggedUser, user) {
		// Check
		return this.canPerformAction(loggedUser, Constants.ENTITY_USER,
			{ "Action": this.ACTION_LOGOUT, "UserID": user.id.toString() });
	},

	canCreateUser(loggedUser) {
		// Check
		return this.canPerformAction(loggedUser, Constants.ENTITY_USER,
			{ "Action": this.ACTION_CREATE });
	},

	canUpdateUser(loggedUser, user) {
		// Check
		return this.canPerformAction(loggedUser, Constants.ENTITY_USER,
			{ "Action": this.ACTION_UPDATE, "UserID": user.id.toString() });
	},

	canDeleteUser(loggedUser, user) {
		// Check
		return this.canPerformAction(loggedUser, Constants.ENTITY_USER,
			{ "Action": this.ACTION_DELETE, "UserID": user.id.toString() });
	},

	canListSites(loggedUser) {
		// Check
		return this.canPerformAction(loggedUser, Constants.ENTITY_SITES,
			{ "Action": this.ACTION_LIST });
	},

	canReadSite(loggedUser, site) {
		// Check
		return this.canPerformAction(loggedUser, Constants.ENTITY_SITE,
			{ "Action": this.ACTION_READ, "SiteID": site.id.toString() });
	},

	canCreateSite(loggedUser) {
		// Check
		return this.canPerformAction(loggedUser, Constants.ENTITY_SITE,
			{ "Action": this.ACTION_CREATE });
	},

	canUpdateSite(loggedUser, site) {
		// Check
		return this.canPerformAction(loggedUser, Constants.ENTITY_SITE,
			{ "Action": this.ACTION_UPDATE, "SiteID": site.id.toString() });
	},

	canDeleteSite(loggedUser, site) {
		// Check
		return this.canPerformAction(loggedUser, Constants.ENTITY_SITE,
			{ "Action": this.ACTION_DELETE, "SiteID": site.id.toString() });
	},

	canListVehicles(loggedUser) {
		// Check
		return this.canPerformAction(loggedUser, Constants.ENTITY_VEHICLES,
			{ "Action": this.ACTION_LIST });
	},

	canReadVehicle(loggedUser, vehicle) {
		// Check
		return this.canPerformAction(loggedUser, Constants.ENTITY_VEHICLE,
			{ "Action": this.ACTION_READ, "VehicleID": vehicle.id.toString() });
	},

	canCreateVehicle(loggedUser) {
		// Check
		return this.canPerformAction(loggedUser, Constants.ENTITY_VEHICLE,
			{ "Action": this.ACTION_CREATE });
	},

	canUpdateVehicle(loggedUser, vehicle) {
		// Check
		return this.canPerformAction(loggedUser, Constants.ENTITY_VEHICLE,
			{ "Action": this.ACTION_UPDATE, "VehicleID": vehicle.id.toString() });
	},

	canDeleteVehicle(loggedUser, vehicle) {
		// Check
		return this.canPerformAction(loggedUser, Constants.ENTITY_VEHICLE,
			{ "Action": this.ACTION_DELETE, "VehicleID": vehicle.id.toString() });
	},

	canListVehicleManufacturers(loggedUser) {
		// Check
		return this.canPerformAction(loggedUser, Constants.ENTITY_VEHICLE_MANUFACTURERS,
			{ "Action": this.ACTION_LIST });
	},

	canReadVehicleManufacturer(loggedUser, vehicleManufacturer) {
		// Check
		return this.canPerformAction(loggedUser, Constants.ENTITY_VEHICLE_MANUFACTURER,
			{ "Action": this.ACTION_READ, "VehicleManufacturerID": vehicleManufacturer.id.toString() });
	},

	canCreateVehicleManufacturer(loggedUser) {
		// Check
		return this.canPerformAction(loggedUser, Constants.ENTITY_VEHICLE_MANUFACTURER,
			{ "Action": this.ACTION_CREATE });
	},

	canUpdateVehicleManufacturer(loggedUser, vehicleManufacturer) {
		// Check
		return this.canPerformAction(loggedUser, Constants.ENTITY_VEHICLE_MANUFACTURER,
			{ "Action": this.ACTION_UPDATE, "VehicleManufacturerID": vehicleManufacturer.id.toString() });
	},

	canDeleteVehicleManufacturer(loggedUser, vehicleManufacturer) {
		// Check
		return this.canPerformAction(loggedUser, Constants.ENTITY_VEHICLE_MANUFACTURER,
			{ "Action": this.ACTION_DELETE, "VehicleManufacturerID": vehicleManufacturer.id.toString() });
	},

	canListSiteAreas(loggedUser) {
		// Check
		return this.canPerformAction(loggedUser, Constants.ENTITY_SITE_AREAS,
			{ "Action": this.ACTION_LIST });
	},

	canReadSiteArea(loggedUser, siteArea) {
		// Check
		return this.canPerformAction(loggedUser, Constants.ENTITY_SITE_AREA,
			{ "Action": this.ACTION_READ, "SiteAreaID": siteArea.id.toString() });
	},

	canCreateSiteArea(loggedUser) {
		// Check
		return this.canPerformAction(loggedUser, Constants.ENTITY_SITE_AREA,
			{ "Action": this.ACTION_CREATE });
	},

	canUpdateSiteArea(loggedUser, siteArea) {
		// Check
		return this.canPerformAction(loggedUser, Constants.ENTITY_SITE_AREA,
			{ "Action": this.ACTION_UPDATE, "SiteAreaID": siteArea.id.toString() });
	},

	canDeleteSiteArea(loggedUser, siteArea) {
		// Check
		return this.canPerformAction(loggedUser, Constants.ENTITY_SITE_AREA,
			{ "Action": this.ACTION_DELETE, "SiteAreaID": siteArea.id.toString() });
	},

	canListCompanies(loggedUser) {
		// Check
		return this.canPerformAction(loggedUser, Constants.ENTITY_COMPANIES,
			{ "Action": this.ACTION_LIST });
	},

	canReadCompany(loggedUser, company) {
		// Check
		return this.canPerformAction(loggedUser, Constants.ENTITY_COMPANY,
			{ "Action": this.ACTION_READ, "CompanyID": company.id.toString() });
	},

	canCreateCompany(loggedUser) {
		// Check
		return this.canPerformAction(loggedUser, Constants.ENTITY_COMPANY,
			{ "Action": this.ACTION_CREATE });
	},

	canUpdateCompany(loggedUser, company) {
		// Check
		return this.canPerformAction(loggedUser, Constants.ENTITY_COMPANY,
			{ "Action": this.ACTION_UPDATE, "CompanyID": company.id.toString() });
	},

	canDeleteCompany(loggedUser, company) {
		// Check
		return this.canPerformAction(loggedUser, Constants.ENTITY_COMPANY,
			{ "Action": this.ACTION_DELETE, "CompanyID": company.id.toString() });
	},

	canReadPricing(loggedUser) {
		// Check
		return this.canPerformAction(loggedUser, Constants.ENTITY_PRICING,
			{ "Action": this.ACTION_READ });
	},

	canUpdatePricing(loggedUser) {
		// Check
		return this.canPerformAction(loggedUser, Constants.ENTITY_PRICING,
			{ "Action": this.ACTION_UPDATE });
	},

	isAdmin(loggedUser) {
		return loggedUser.role === this.ROLE_ADMIN;
	},

	isBasic(loggedUser) {
		return loggedUser.role === this.ROLE_BASIC;
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
		const auth = new Authorization(loggedUser.role, loggedUser.auths);
		// Check
		if(auth.check(entity, fieldNamesValues)) {
			// Authorized!
			return true;
		} else {
			return false;
		}
	}
};
