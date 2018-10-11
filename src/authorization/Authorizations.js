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

class Authorizations {
	static canRefundTransaction(loggedUser, transaction) {
		// Check auth
		if (transaction.user) {
			// Check
			return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_TRANSACTION,
				{ "Action": Constants.ACTION_REFUND_TRANSACTION, "UserID": transaction.user.id.toString()});
		// Admin?
		} else if (!Authorizations.isAdmin(loggedUser)) {
			return false;
		}
		return true;
	}

	static canStartTransaction(user, chargingStation) {
		// Can perform stop?
		if (!Authorizations.canPerformActionOnChargingStation(
				user.getModel(),
				chargingStation.getModel(),
				Constants.ACTION_START_TRANSACTION)) {
			// Ko
			return false;
		}
		// Ok
		return true;
	}

	static canStopTransaction(user, chargingStation) {
		// Can perform stop?
		if (!Authorizations.canPerformActionOnChargingStation(
				user.getModel(),
				chargingStation.getModel(),
				Constants.ACTION_STOP_TRANSACTION)) {
			// Ko
			return false;
		}
		// Ok
		return true;
	}

	// Build Auth
	static async buildAuthorizations(user) {
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
		let userAuthDefinition = Authorizations.getAuthorizationFromRoleID(
			JSON.parse(authsDefinitionParsed), user.getRole());
		// Compile auths of the role
		let compiledAuths = compileProfile(userAuthDefinition.auths);
		// Return
		return compiledAuths;
	}

	static async getOrCreateUserByTagID(chargingStation, siteArea, tagID, action) {
		let newUserCreated = false;
		// Get the user
		let user = await UserStorage.getUserByTagId(tagID);
		// Found?
		if (!user) {
			// No: Create an empty user
			let newUser = new User({
				name: (siteArea.isAccessControlEnabled() ? "Unknown" : "Anonymous"),
				firstName: "User",
				status: (siteArea.isAccessControlEnabled() ? Constants.USER_STATUS_INACTIVE : Constants.USER_STATUS_ACTIVE),
				role: Constants.ROLE_BASIC,
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
		return user;
	}

	static async checkAndGetIfUserIsAuthorizedForChargingStation(action, chargingStation, tagID, alternateTagID) {
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
		let user = await Authorizations.getOrCreateUserByTagID(chargingStation, siteArea, tagID, action);
		let alternateUser;
		// Get and Check Alternate User
		if (alternateTagID) {
			alternateUser = await Authorizations.getOrCreateUserByTagID(chargingStation, siteArea, alternateTagID, action);
		}
		// Set current user
		let currentUser = (alternateUser ? alternateUser : user);
		// Check User status
		if (currentUser.getStatus() !== Constants.USER_STATUS_ACTIVE) {
			// Reject but save ok
			throw new AppError(
				chargingStation.getID(),
				`User with TagID '${tagID}' is '${User.getStatusDescription(currentUser.getStatus())}'`, 500,
				"Authorizations", "checkAndGetIfUserIsAuthorizedForChargingStation",
				user.getModel());
		}
		// Check Auth
		let auths = await Authorizations.buildAuthorizations(currentUser);
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
				!Authorizations.isAdmin(alternateUser) && !site.isAllowAllUsersToStopTransactionsEnabled()) {
			// Reject the User
			throw new AppError(
				chargingStation.getID(),
				`User '${alternateUser.getFullName()}' is not allowed to perform '${action}' on User '${user.getFullName()}' on Site '${site.getName()}'!`,
				525, "Authorizations", "checkAndGetIfUserIsAuthorizedForChargingStation",
				alternateUser.getModel(), user.getModel());
		}
		// Can perform action?
		if (!Authorizations.canPerformActionOnChargingStation(
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
	}

	// Read the config file
	static getAuthorizationFromRoleID(authorisations, roleID) {
		// Filter
		let matchingAuthorisation = authorisations.filter((authorisation) => {
			return authorisation.id === roleID;
		});
		// Only one role
		return (matchingAuthorisation.length > 0 ? matchingAuthorisation[0] : []);
	}

	static canListLogging(loggedUser) {
		// Check
		return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_LOGGINGS,
			{ "Action": Constants.ACTION_LIST });
	}

	static canReadLogging(loggedUser, logging) {
		// Check
		return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_LOGGING,
			{ "Action": Constants.ACTION_READ, "LogID": logging.id.toString()});
	}

	static canListTransactions(loggedUser) {
		// Check
		return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_TRANSACTIONS,
			{ "Action": Constants.ACTION_LIST });
	}

	static canReadTransaction(loggedUser, transaction) {
		// Check auth
		if (transaction.user && transaction.user.id) {
			// Check
			return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_TRANSACTION,
				{ "Action": Constants.ACTION_READ, "UserID": transaction.user.id.toString()});
		// Admin?
		} else if (!Authorizations.isAdmin(loggedUser)) {
			return false;
		}
		return true;
	}

	static canUpdateTransaction(loggedUser, transaction) {
		// Check auth
		if (transaction.user) {
			// Check
			return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_TRANSACTION,
				{ "Action": Constants.ACTION_UPDATE, "UserID": transaction.user.id.toString()});
		// Admin?
		} else if (!Authorizations.isAdmin(loggedUser)) {
			return false;
		}
		return true;
	}

	static canDeleteTransaction(loggedUser, transaction) {
		// Check auth
		if (transaction.user) {
			// Check
			return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_TRANSACTION,
				{ "Action": Constants.ACTION_DELETE, "UserID": transaction.user.id.toString()});
		// Admin?
		} else if (!Authorizations.isAdmin(loggedUser)) {
			return false;
		}
		return true;
	}

	static canListChargingStations(loggedUser) {
		// Check
		return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_CHARGING_STATIONS,
			{ "Action": Constants.ACTION_LIST });
	}

	static canPerformActionOnChargingStation(loggedUser, chargingStation, action) {
		return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_CHARGING_STATION,
			{ "Action": action, "ChargingStationID": chargingStation.id });
	}

	static canReadChargingStation(loggedUser, chargingStation) {
		// Check
		return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_CHARGING_STATION,
			{ "Action": Constants.ACTION_READ, "ChargingStationID": chargingStation.id });
	}

	static canUpdateChargingStation(loggedUser, chargingStation) {
		// Check
		return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_CHARGING_STATION,
			{ "Action": Constants.ACTION_UPDATE, "ChargingStationID": chargingStation.id });
	}

	static canDeleteChargingStation(loggedUser, chargingStation) {
		// Check
		return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_CHARGING_STATION,
			{ "Action": Constants.ACTION_DELETE, "ChargingStationID": chargingStation.id });
	}

	static canListUsers(loggedUser) {
		// Check
		return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_USERS,
			{ "Action": Constants.ACTION_LIST });
	}

	static canReadUser(loggedUser, user) {
		// Check
		return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_USER,
			{ "Action": Constants.ACTION_READ, "UserID": user.id.toString() });
	}

	static canLogoutUser(loggedUser, user) {
		// Check
		return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_USER,
			{ "Action": Constants.ACTION_LOGOUT, "UserID": user.id.toString() });
	}

	static canCreateUser(loggedUser) {
		// Check
		return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_USER,
			{ "Action": Constants.ACTION_CREATE });
	}

	static canUpdateUser(loggedUser, user) {
		// Check
		return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_USER,
			{ "Action": Constants.ACTION_UPDATE, "UserID": user.id.toString() });
	}

	static canDeleteUser(loggedUser, user) {
		// Check
		return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_USER,
			{ "Action": Constants.ACTION_DELETE, "UserID": user.id.toString() });
	}

	static canListSites(loggedUser) {
		// Check
		return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_SITES,
			{ "Action": Constants.ACTION_LIST });
	}

	static canReadSite(loggedUser, site) {
		// Check
		return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_SITE,
			{ "Action": Constants.ACTION_READ, "SiteID": site.id.toString() });
	}

	static canCreateSite(loggedUser) {
		// Check
		return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_SITE,
			{ "Action": Constants.ACTION_CREATE });
	}

	static canUpdateSite(loggedUser, site) {
		// Check
		return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_SITE,
			{ "Action": Constants.ACTION_UPDATE, "SiteID": site.id.toString() });
	}

	static canDeleteSite(loggedUser, site) {
		// Check
		return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_SITE,
			{ "Action": Constants.ACTION_DELETE, "SiteID": site.id.toString() });
	}

	static canListVehicles(loggedUser) {
		// Check
		return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_VEHICLES,
			{ "Action": Constants.ACTION_LIST });
	}

	static canReadVehicle(loggedUser, vehicle) {
		// Check
		return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_VEHICLE,
			{ "Action": Constants.ACTION_READ, "VehicleID": vehicle.id.toString() });
	}

	static canCreateVehicle(loggedUser) {
		// Check
		return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_VEHICLE,
			{ "Action": Constants.ACTION_CREATE });
	}

	static canUpdateVehicle(loggedUser, vehicle) {
		// Check
		return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_VEHICLE,
			{ "Action": Constants.ACTION_UPDATE, "VehicleID": vehicle.id.toString() });
	}

	static canDeleteVehicle(loggedUser, vehicle) {
		// Check
		return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_VEHICLE,
			{ "Action": Constants.ACTION_DELETE, "VehicleID": vehicle.id.toString() });
	}

	static canListVehicleManufacturers(loggedUser) {
		// Check
		return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_VEHICLE_MANUFACTURERS,
			{ "Action": Constants.ACTION_LIST });
	}

	static canReadVehicleManufacturer(loggedUser, vehicleManufacturer) {
		// Check
		return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_VEHICLE_MANUFACTURER,
			{ "Action": Constants.ACTION_READ, "VehicleManufacturerID": vehicleManufacturer.id.toString() });
	}

	static canCreateVehicleManufacturer(loggedUser) {
		// Check
		return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_VEHICLE_MANUFACTURER,
			{ "Action": Constants.ACTION_CREATE });
	}

	static canUpdateVehicleManufacturer(loggedUser, vehicleManufacturer) {
		// Check
		return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_VEHICLE_MANUFACTURER,
			{ "Action": Constants.ACTION_UPDATE, "VehicleManufacturerID": vehicleManufacturer.id.toString() });
	}

	static canDeleteVehicleManufacturer(loggedUser, vehicleManufacturer) {
		// Check
		return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_VEHICLE_MANUFACTURER,
			{ "Action": Constants.ACTION_DELETE, "VehicleManufacturerID": vehicleManufacturer.id.toString() });
	}

	static canListSiteAreas(loggedUser) {
		// Check
		return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_SITE_AREAS,
			{ "Action": Constants.ACTION_LIST });
	}

	static canReadSiteArea(loggedUser, siteArea) {
		// Check
		return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_SITE_AREA,
			{ "Action": Constants.ACTION_READ, "SiteAreaID": siteArea.id.toString() });
	}

	static canCreateSiteArea(loggedUser) {
		// Check
		return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_SITE_AREA,
			{ "Action": Constants.ACTION_CREATE });
	}

	static canUpdateSiteArea(loggedUser, siteArea) {
		// Check
		return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_SITE_AREA,
			{ "Action": Constants.ACTION_UPDATE, "SiteAreaID": siteArea.id.toString() });
	}

	static canDeleteSiteArea(loggedUser, siteArea) {
		// Check
		return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_SITE_AREA,
			{ "Action": Constants.ACTION_DELETE, "SiteAreaID": siteArea.id.toString() });
	}

	static canListCompanies(loggedUser) {
		// Check
		return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_COMPANIES,
			{ "Action": Constants.ACTION_LIST });
	}

	static canReadCompany(loggedUser, company) {
		// Check
		return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_COMPANY,
			{ "Action": Constants.ACTION_READ, "CompanyID": company.id.toString() });
	}

	static canCreateCompany(loggedUser) {
		// Check
		return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_COMPANY,
			{ "Action": Constants.ACTION_CREATE });
	}

	static canUpdateCompany(loggedUser, company) {
		// Check
		return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_COMPANY,
			{ "Action": Constants.ACTION_UPDATE, "CompanyID": company.id.toString() });
	}

	static canDeleteCompany(loggedUser, company) {
		// Check
		return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_COMPANY,
			{ "Action": Constants.ACTION_DELETE, "CompanyID": company.id.toString() });
	}

	static canReadPricing(loggedUser) {
		// Check
		return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_PRICING,
			{ "Action": Constants.ACTION_READ });
	}

	static canUpdatePricing(loggedUser) {
		// Check
		return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_PRICING,
			{ "Action": Constants.ACTION_UPDATE });
	}

	static canListVariants(loggedUser) {
		// Check
		return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_VARIANT,
			{ "Action": Constants.ACTION_LIST });
	}

	static canReadVariant(loggedUser, variant) {
		// Check
		return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_VARIANT,
			{ "Action": Constants.ACTION_READ, "VariantID": variant.ID.toString() });
	}

	static canCreateVariant(loggedUser) {
		// Check
		return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_VARIANT,
			{ "Action": Constants.ACTION_CREATE });
	}

	static canUpdateVariant(loggedUser, variant) {
		// Check
		return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_VARIANT,
			{ "Action": Constants.ACTION_UPDATE, "VariantID": variant.id.toString() });
	}

	static canDeleteVariant(loggedUser, variant) {
		// Check
		return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_VARIANT,
			{ "Action": Constants.ACTION_DELETE, "VariantID": variant.ID.toString() });
	}

	static isSuperAdmin(loggedUser) {
		return loggedUser.role === Constants.ROLE_SUPER_ADMIN;
	}

	static isAdmin(loggedUser) {
		return this.isSuperAdmin(loggedUser) || loggedUser.role === Constants.ROLE_ADMIN;
	}

	static isBasic(loggedUser) {
		return loggedUser.role === Constants.ROLE_BASIC;
	}

	static isDemo(loggedUser) {
		return loggedUser.role === Constants.ROLE_DEMO;
	}

	static getConfiguration() {
		if(!_configuration) {
			// Load it
			_configuration = Configuration.getAuthorizationConfig();
		}
		return _configuration;
	}

	static canPerformAction(loggedUser, entity, fieldNamesValues) {
		// Set debug mode?
		if (Authorizations.getConfiguration().debug) {
			// Switch on traces
			Authorizations.switchTraceOn();
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
}

module.exports = Authorizations;
