const Logging = require('./Logging');
const Configuration = require('./Configuration');
const Authorization = require('node-authorization').Authorization;
const NotificationHandler = require('../notification/NotificationHandler');
const Mustache = require('mustache');
const compileProfile = require('node-authorization').profileCompiler;
const AppError = require('../exception/AppError');
const Users = require('./Users');
const Utils = require('./Utils');
const User = require('../model/User');
require('source-map-support').install();

let _configuration;

module.exports = {
	ROLE_ADMIN: "A",
	ROLE_BASIC: "B",
	ROLE_DEMO: "D",
	ROLE_CORPORATE: "C",

	ENTITY_USERS: "Users",
	ENTITY_USER: "User",
	ENTITY_VEHICLES: "Vehicles",
	ENTITY_VEHICLE: "Vehicle",
	ENTITY_VEHICLE_MANUFACTURERS: "VehicleManufacturers",
	ENTITY_VEHICLE_MANUFACTURER: "VehicleManufacturer",
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
	ACTION_START_TRANSACTION: "StartTransaction",
	ACTION_UNLOCK_CONNECTOR: "UnlockConnector",
	ACTION_GET_CONFIGURATION: "GetConfiguration",

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
	buildAuthorizations(user) {
		// Password OK
		let companies = [],
			sites,
			siteAreas = [],
			chargingStations = [],
			users = [];

		// Get sites
		return user.getSites().then((foundSites) => {
			sites = foundSites;
			if (sites.length == 0) {
				return Promise.resolve([]);
			}
			// Get all the companies
			let proms = [];
			sites.forEach((site) => {
				proms.push(site.getCompany());
			});
			return Promise.all(proms);
		}).then((foundCompanyProms) => {
			// Merge results
			foundCompanyProms.forEach((foundCompanyProm) => {
				companies.push(foundCompanyProm);
			});
			// Get all the site areas
			let proms = [];
			sites.forEach((site) => {
				proms.push(site.getSiteAreas());
			})
			return Promise.all(proms);
		}).then((foundSiteAreasProms) => {
			// Merge results
			foundSiteAreasProms.forEach((foundSiteAreasProm) => {
				siteAreas = siteAreas.concat(foundSiteAreasProm);
			});
			if (siteAreas.length == 0) {
				return Promise.resolve([]);
			}
			// Get all the charging stations
			let proms = [];
			siteAreas.forEach((siteArea) => {
				proms.push(siteArea.getChargingStations());
			})
			return Promise.all(proms);
		}).then((foundChargingStationsProms) => {
			// Merge results
			foundChargingStationsProms.forEach((foundChargingStationsProm) => {
				chargingStations = chargingStations.concat(foundChargingStationsProm);
			});
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
			let authsDefinition = this.getAuthorizations();
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
		});
	},

	getOrCreateUserByTagID(chargingStation, siteArea, tagID) {
		let newUserCreated = false;
		// Get the user
		return global.storage.getUserByTagId(tagID).then((foundUser) => {
			// Found?
			if (!foundUser) {
				// No: Create an empty user
				var newUser = new User({
					name: (siteArea.isAccessControlEnabled() ? "Unknown" : "Anonymous"),
					firstName: "User",
					status: (siteArea.isAccessControlEnabled() ? Users.USER_STATUS_PENDING : Users.USER_STATUS_ACTIVE),
					role: Users.USER_ROLE_BASIC,
					email: tagID + "@chargeangels.fr",
					tagIDs: [tagID],
					createdOn: new Date().toISOString()
				});
				// Set the flag
				newUserCreated = true;
				// Save the user
				return newUser.save();
			} else {
				return foundUser;
			}
		// User -----------------------------------------------
		}).then((foundUser) => {
			let user = foundUser;
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
				return Promise.reject( new AppError(
					chargingStation.getID(),
					`User with Tag ID '${tagID}' not found but saved as inactive user`,
					"Authorizations", "checkIfUserIsAuthorizedForChargingStation",
					null, user.getModel()
				));
			}
			// Check User status
			if (user.getStatus() !== Users.USER_STATUS_ACTIVE) {
				// Reject but save ok
				return Promise.reject( new AppError(
					chargingStation.getID(),
					`User with TagID '${tagID}' is not Active`, 500,
					"Authorizations", "checkIfUserIsAuthorizedForChargingStation",
					null, user.getModel()) );
			}
			return user;
		});
	},

	checkIfUserIsAuthorizedForChargingStation(action, chargingStation, tagID, alternateTagID) {
		// Check first if the site area access control is active
		let user, alternateUser, site, siteArea;
		// Site Area -----------------------------------------------
		return chargingStation.getSiteArea().then((foundSiteArea) => {
			siteArea = foundSiteArea;
			// Site is mandatory
			if (!siteArea) {
				// Reject Site Not Found
				return Promise.reject( new AppError(
					chargingStation.getID(),
					`Charging Station '${chargingStation.getID()}' is not assigned to a Site Area!`, 500,
					"Authorizations", "checkIfUserIsAuthorizedForChargingStation",
					null, null) );
			}
			// Get and Check User
			return this.getOrCreateUserByTagID(chargingStation, siteArea, tagID);
		// User -------------------------------------------------
		}).then((foundUser) => {
			// Set
			user = foundUser;
			// Get and Check Alternate User
			if (alternateTagID) {
				return this.getOrCreateUserByTagID(chargingStation, siteArea, alternateTagID);
			}
		// Alternate User --------------------------------------
		}).then((foundAlternateUser) => {
			// Set
			alternateUser = foundAlternateUser;
			// Get the Charge Box' Site
			return siteArea.getSite(null, true);
		// Site -----------------------------------------------
		}).then((foundSite) => {
			site = foundSite;
			if (!site) {
				// Reject Site Not Found
				return Promise.reject( new AppError(
					chargingStation.getID(),
					`Site Area '${siteArea.getName()}' is not assigned to a Site!`, 500,
					"Authorizations", "checkIfUserIsAuthorizedForChargingStation",
					null, user.getModel()) );
			}
			// Get Users
			return site.getUsers();
		}).then((siteUsers) => {
			// Check User ------------------------------------------
			let foundUser = siteUsers.find((siteUser) => {
				return siteUser.getID() == user.getID();
			});
			// User not found and Access Control Enabled?
			if (!foundUser && siteArea.isAccessControlEnabled()) {
				// Yes: Reject the User
				return Promise.reject( new AppError(
					chargingStation.getID(),
					`User is not assigned to the Site '${site.getName()}'!`, 500,
					"Authorizations", "checkIfUserIsAuthorizedForChargingStation",
					null, user.getModel()) );
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
				// Yes: Reject the User
				return Promise.reject( new AppError(
					chargingStation.getID(),
					`User is not assigned to the Site '${site.getName()}'!`, 500,
					"Authorizations", "checkIfUserIsAuthorizedForChargingStation",
					null, alternateUser.getModel()) );
			}
			// Check if users are differents
			if (alternateUser && user.getID() != alternateUser.getID()) {
				// Site allows this?
				if (!site.isAllowAllUsersToStopTransactionsEnabled()) {
					// Yes: Reject the User
					return Promise.reject( new AppError(
						chargingStation.getID(),
						`User '${alternateUser.getFullName()}' is not allowed to perform '${action}' on User '${user.getFullName()}' on Site '${site.getName()}'!`,
						500, "Authorizations", "checkIfUserIsAuthorizedForChargingStation",
						alternateUser.getModel(), user.getModel()));
				}
			}
			// Return
			return {
				"user": user,
				"alternateUser": alternateUser
			};
		});
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
		return this.canPerformAction(loggedUser, this.ENTITY_LOGGING,
			{ "Action": this.ACTION_LIST });
	},

	canListTransactions(loggedUser) {
		// Check
		return this.canPerformAction(loggedUser, this.ENTITY_TRANSACTIONS,
			{ "Action": this.ACTION_LIST });
	},

	canReadTransaction(loggedUser, transaction) {
		// Check auth
		if (transaction.user) {
			// Check
			return this.canPerformAction(loggedUser, this.ENTITY_TRANSACTION,
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
			return this.canPerformAction(loggedUser, this.ENTITY_TRANSACTION,
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
			return this.canPerformAction(loggedUser, this.ENTITY_TRANSACTION,
				{ "Action": this.ACTION_DELETE, "UserID": transaction.user.id.toString()});
		// Admin?
		} else if (!this.isAdmin(loggedUser)) {
			return false;
		}
		return true;
	},

	canListChargingStations(loggedUser) {
		// Check
		return this.canPerformAction(loggedUser, this.ENTITY_CHARGING_STATIONS,
			{ "Action": this.ACTION_LIST });
	},

	canPerformActionOnChargingStation(loggedUser, chargingStation, action) {
		return this.canPerformAction(loggedUser, this.ENTITY_CHARGING_STATION,
			{ "Action": action, "ChargingStationID": chargingStation.id });
	},

	canReadChargingStation(loggedUser, chargingStation) {
		// Check
		return this.canPerformAction(loggedUser, this.ENTITY_CHARGING_STATION,
			{ "Action": this.ACTION_READ, "ChargingStationID": chargingStation.id });
	},

	canUpdateChargingStation(loggedUser, chargingStation) {
		// Check
		return this.canPerformAction(loggedUser, this.ENTITY_CHARGING_STATION,
			{ "Action": this.ACTION_UPDATE, "ChargingStationID": chargingStation.id });
	},

	canDeleteChargingStation(loggedUser, chargingStation) {
		// Check
		return this.canPerformAction(loggedUser, this.ENTITY_CHARGING_STATION,
			{ "Action": this.ACTION_DELETE, "ChargingStationID": chargingStation.id });
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
			{ "Action": this.ACTION_LOGOUT, "UserID": user.id.toString() });
	},

	canCreateUser(loggedUser) {
		// Check
		return this.canPerformAction(loggedUser, this.ENTITY_USER,
			{ "Action": this.ACTION_CREATE });
	},

	canUpdateUser(loggedUser, user) {
		// Check
		return this.canPerformAction(loggedUser, this.ENTITY_USER,
			{ "Action": this.ACTION_UPDATE, "UserID": user.id.toString() });
	},

	canDeleteUser(loggedUser, user) {
		// Check
		return this.canPerformAction(loggedUser, this.ENTITY_USER,
			{ "Action": this.ACTION_DELETE, "UserID": user.id.toString() });
	},

	canListSites(loggedUser) {
		// Check
		return this.canPerformAction(loggedUser, this.ENTITY_SITES,
			{ "Action": this.ACTION_LIST });
	},

	canReadSite(loggedUser, site) {
		// Check
		return this.canPerformAction(loggedUser, this.ENTITY_SITE,
			{ "Action": this.ACTION_READ, "SiteID": site.id.toString() });
	},

	canCreateSite(loggedUser) {
		// Check
		return this.canPerformAction(loggedUser, this.ENTITY_SITE,
			{ "Action": this.ACTION_CREATE });
	},

	canUpdateSite(loggedUser, site) {
		// Check
		return this.canPerformAction(loggedUser, this.ENTITY_SITE,
			{ "Action": this.ACTION_UPDATE, "SiteID": site.id.toString() });
	},

	canDeleteSite(loggedUser, site) {
		// Check
		return this.canPerformAction(loggedUser, this.ENTITY_SITE,
			{ "Action": this.ACTION_DELETE, "SiteID": site.id.toString() });
	},

	canListVehicles(loggedUser) {
		// Check
		return this.canPerformAction(loggedUser, this.ENTITY_VEHICLES,
			{ "Action": this.ACTION_LIST });
	},

	canReadVehicle(loggedUser, vehicle) {
		// Check
		return this.canPerformAction(loggedUser, this.ENTITY_VEHICLE,
			{ "Action": this.ACTION_READ, "VehicleID": vehicle.id.toString() });
	},

	canCreateVehicle(loggedUser) {
		// Check
		return this.canPerformAction(loggedUser, this.ENTITY_VEHICLE,
			{ "Action": this.ACTION_CREATE });
	},

	canUpdateVehicle(loggedUser, vehicle) {
		// Check
		return this.canPerformAction(loggedUser, this.ENTITY_VEHICLE,
			{ "Action": this.ACTION_UPDATE, "VehicleID": vehicle.id.toString() });
	},

	canDeleteVehicle(loggedUser, vehicle) {
		// Check
		return this.canPerformAction(loggedUser, this.ENTITY_VEHICLE,
			{ "Action": this.ACTION_DELETE, "VehicleID": vehicle.id.toString() });
	},

	canListVehicleManufacturers(loggedUser) {
		// Check
		return this.canPerformAction(loggedUser, this.ENTITY_VEHICLE_MANUFACTURERS,
			{ "Action": this.ACTION_LIST });
	},

	canReadVehicleManufacturer(loggedUser, vehicleManufacturer) {
		// Check
		return this.canPerformAction(loggedUser, this.ENTITY_VEHICLE_MANUFACTURER,
			{ "Action": this.ACTION_READ, "VehicleManufacturerID": vehicleManufacturer.id.toString() });
	},

	canCreateVehicleManufacturer(loggedUser) {
		// Check
		return this.canPerformAction(loggedUser, this.ENTITY_VEHICLE_MANUFACTURER,
			{ "Action": this.ACTION_CREATE });
	},

	canUpdateVehicleManufacturer(loggedUser, vehicleManufacturer) {
		// Check
		return this.canPerformAction(loggedUser, this.ENTITY_VEHICLE_MANUFACTURER,
			{ "Action": this.ACTION_UPDATE, "VehicleManufacturerID": vehicleManufacturer.id.toString() });
	},

	canDeleteVehicleManufacturer(loggedUser, vehicleManufacturer) {
		// Check
		return this.canPerformAction(loggedUser, this.ENTITY_VEHICLE_MANUFACTURER,
			{ "Action": this.ACTION_DELETE, "VehicleManufacturerID": vehicleManufacturer.id.toString() });
	},

	canListSiteAreas(loggedUser) {
		// Check
		return this.canPerformAction(loggedUser, this.ENTITY_SITE_AREAS,
			{ "Action": this.ACTION_LIST });
	},

	canReadSiteArea(loggedUser, siteArea) {
		// Check
		return this.canPerformAction(loggedUser, this.ENTITY_SITE_AREA,
			{ "Action": this.ACTION_READ, "SiteAreaID": siteArea.id.toString() });
	},

	canCreateSiteArea(loggedUser) {
		// Check
		return this.canPerformAction(loggedUser, this.ENTITY_SITE_AREA,
			{ "Action": this.ACTION_CREATE });
	},

	canUpdateSiteArea(loggedUser, siteArea) {
		// Check
		return this.canPerformAction(loggedUser, this.ENTITY_SITE_AREA,
			{ "Action": this.ACTION_UPDATE, "SiteAreaID": siteArea.id.toString() });
	},

	canDeleteSiteArea(loggedUser, siteArea) {
		// Check
		return this.canPerformAction(loggedUser, this.ENTITY_SITE_AREA,
			{ "Action": this.ACTION_DELETE, "SiteAreaID": siteArea.id.toString() });
	},

	canListCompanies(loggedUser) {
		// Check
		return this.canPerformAction(loggedUser, this.ENTITY_COMPANIES,
			{ "Action": this.ACTION_LIST });
	},

	canReadCompany(loggedUser, company) {
		// Check
		return this.canPerformAction(loggedUser, this.ENTITY_COMPANY,
			{ "Action": this.ACTION_READ, "CompanyID": company.id.toString() });
	},

	canCreateCompany(loggedUser) {
		// Check
		return this.canPerformAction(loggedUser, this.ENTITY_COMPANY,
			{ "Action": this.ACTION_CREATE });
	},

	canUpdateCompany(loggedUser, company) {
		// Check
		return this.canPerformAction(loggedUser, this.ENTITY_COMPANY,
			{ "Action": this.ACTION_UPDATE, "CompanyID": company.id.toString() });
	},

	canDeleteCompany(loggedUser, company) {
		// Check
		return this.canPerformAction(loggedUser, this.ENTITY_COMPANY,
			{ "Action": this.ACTION_DELETE, "CompanyID": company.id.toString() });
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
	},

	getAuthorizations() {
		return `
			[
				{
					"id": "A",
					"name": "Admin",
					"auths": [
						{
							"AuthObject": "Users",
							"AuthFieldValue": {
								"Action": ["List"]
							}
						},
						{
							"AuthObject": "User",
							"AuthFieldValue": {
								"UserID": "*",
								"Action": ["Create", "Read", "Update", "Delete", "Logout"]
							}
						},
						{
							"AuthObject": "Companies",
							"AuthFieldValue": {
								"Action": ["List"]
							}
						},
						{
							"AuthObject": "Company",
							"AuthFieldValue": {
								"CompanyID": "*",
								"Action": ["Create", "Read", "Update", "Delete"]
							}
						},
						{
							"AuthObject": "Sites",
							"AuthFieldValue": {
								"Action": ["List"]
							}
						},
						{
							"AuthObject": "Site",
							"AuthFieldValue": {
								"SiteID": "*",
								"Action": ["Create", "Read", "Update", "Delete"]
							}
						},
						{
							"AuthObject": "VehicleManufacturers",
							"AuthFieldValue": {
								"Action": ["List"]
							}
						},
						{
							"AuthObject": "VehicleManufacturer",
							"AuthFieldValue": {
								"VehicleManufacturerID": "*",
								"Action": ["Create", "Read", "Update", "Delete"]
							}
						},
						{
							"AuthObject": "Vehicles",
							"AuthFieldValue": {
								"Action": ["List"]
							}
						},
						{
							"AuthObject": "Vehicle",
							"AuthFieldValue": {
								"VehicleID": "*",
								"Action": ["Create", "Read", "Update", "Delete"]
							}
						},
						{
							"AuthObject": "SiteAreas",
							"AuthFieldValue": {
								"Action": ["List"]
							}
						},
						{
							"AuthObject": "SiteArea",
							"AuthFieldValue": {
								"SiteAreaID": "*",
								"Action": ["Create", "Read", "Update", "Delete"]
							}
						},
						{
							"AuthObject": "ChargingStations",
							"AuthFieldValue": {
								"Action": ["List"]
							}
						},
						{
							"AuthObject": "ChargingStation",
							"AuthFieldValue": {
								"ChargingStationID": "*",
								"Action": ["Create", "Read", "Update", "Delete", "Reset", "ClearCache", "GetConfiguration", "ChangeConfiguration", "StartTransaction", "StopTransaction", "UnlockConnector"]
							}
						},
						{
							"AuthObject": "Transactions",
							"AuthFieldValue": {
								"Action": ["List"]
							}
						},
						{
							"AuthObject": "Transaction",
							"AuthFieldValue": {
								"UserID": "*",
								"Action": ["Read", "Update", "Delete"]
							}
						},
						{
							"AuthObject": "Logging",
							"AuthFieldValue": {
								"Action": ["List"]
							}
						},
						{
							"AuthObject": "Pricing",
							"AuthFieldValue": {
								"Action": ["Read", "Update"]
							}
						}
					]
				},
				{
					"id": "B",
					"name": "Basic",
					"auths": [
						{
							"AuthObject": "Users",
							"AuthFieldValue": {
								"Action": []
							}
						},
						{
							"AuthObject": "User",
							"AuthFieldValue": {
								"UserID": [
									{{#trim}}
										{{#userID}}
											"{{.}}",
										{{/userID}}
									{{/trim}}
								],
								"Action": ["Update","Read","Logout"]
							}
						},
						{
							"AuthObject": "Companies",
							"AuthFieldValue": {
								"Action": ["List"]
							}
						},
						{
							"AuthObject": "Company",
							"AuthFieldValue": {
								"CompanyID": [
									{{#trim}}
										{{#companyID}}
											"{{.}}",
										{{/companyID}}
									{{/trim}}
								],
								"Action": ["Read"]
							}
						},
						{
							"AuthObject": "Sites",
							"AuthFieldValue": {
								"Action": ["List"]
							}
						},
						{
							"AuthObject": "Site",
							"AuthFieldValue": {
								"SiteID": [
									{{#trim}}
										{{#siteID}}
											"{{.}}",
										{{/siteID}}
									{{/trim}}
								],
								"Action": ["Read"]
							}
						},
						{
							"AuthObject": "VehicleManufacturers",
							"AuthFieldValue": {
								"Action": ["List"]
							}
						},
						{
							"AuthObject": "VehicleManufacturer",
							"AuthFieldValue": {
								"VehicleManufacturerID": "*",
								"Action": ["Read"]
							}
						},
						{
							"AuthObject": "Vehicles",
							"AuthFieldValue": {
								"Action": ["List"]
							}
						},
						{
							"AuthObject": "Vehicle",
							"AuthFieldValue": {
								"VehicleID": "*",
								"Action": ["Read"]
							}
						},
						{
							"AuthObject": "SiteAreas",
							"AuthFieldValue": {
								"Action": ["List"]
							}
						},
						{
							"AuthObject": "SiteArea",
							"AuthFieldValue": {
								"SiteAreaID": [
									{{#trim}}
										{{#siteAreaID}}
											"{{.}}",
										{{/siteAreaID}}
									{{/trim}}
								],
								"Action": ["Read"]
							}
						},
						{
							"AuthObject": "ChargingStations",
							"AuthFieldValue": {
								"Action": ["List"]
							}
						},
						{
							"AuthObject": "ChargingStation",
							"AuthFieldValue": {
								"ChargingStationID": [
									{{#trim}}
										{{#chargingStationID}}
											"{{.}}",
										{{/chargingStationID}}
									{{/trim}}
								],
								"Action": ["Read", "StartTransaction", "StopTransaction", "UnlockConnector"]
							}
						},
						{
							"AuthObject": "Transactions",
							"AuthFieldValue": {
								"Action": ["List"]
							}
						},
						{
							"AuthObject": "Transaction",
							"AuthFieldValue": {
								"UserID": [
									{{#trim}}
										{{#userID}}
											"{{.}}",
										{{/userID}}
									{{/trim}}
								],
								"Action": ["Read"]
							}
						},
						{
							"AuthObject": "Logging",
							"AuthFieldValue": {
								"Action": []
							}
						},
						{
							"AuthObject": "Pricing",
							"AuthFieldValue": {
								"Action": []
							}
						}
					]
				},
				{
					"id": "C",
					"name": "Corporate",
					"auths": [
						{
							"AuthObject": "Users",
							"AuthFieldValue": {
								"Action": []
							}
						},
						{
							"AuthObject": "User",
							"AuthFieldValue": {
								"UserID": "*",
								"Action": ["Read"]
							}
						},
						{
							"AuthObject": "Companies",
							"AuthFieldValue": {
								"Action": ["List"]
							}
						},
						{
							"AuthObject": "Company",
							"AuthFieldValue": {
								"CompanyID": "*",
								"Action": ["Read"]
							}
						},
						{
							"AuthObject": "Sites",
							"AuthFieldValue": {
								"Action": ["List"]
							}
						},
						{
							"AuthObject": "Site",
							"AuthFieldValue": {
								"SiteID": "*",
								"Action": ["Read"]
							}
						},
						{
							"AuthObject": "VehicleManufacturers",
							"AuthFieldValue": {
								"Action": ["List"]
							}
						},
						{
							"AuthObject": "VehicleManufacturer",
							"AuthFieldValue": {
								"VehicleManufacturerID": "*",
								"Action": ["Read"]
							}
						},
						{
							"AuthObject": "Vehicles",
							"AuthFieldValue": {
								"Action": ["List"]
							}
						},
						{
							"AuthObject": "Vehicle",
							"AuthFieldValue": {
								"SiteID": "*",
								"Action": ["Read"]
							}
						},
						{
							"AuthObject": "SiteAreas",
							"AuthFieldValue": {
								"Action": ["List"]
							}
						},
						{
							"AuthObject": "SiteArea",
							"AuthFieldValue": {
								"SiteAreaID": "*",
								"Action": ["Read"]
							}
						},
						{
							"AuthObject": "ChargingStations",
							"AuthFieldValue": {
								"Action": ["List"]
							}
						},
						{
							"AuthObject": "ChargingStation",
							"AuthFieldValue": {
								"ChargingStationID": "*",
								"Action": ["Read", "StartTransaction", "StopTransaction", "UnlockConnector"]
							}
						},
						{
							"AuthObject": "Transactions",
							"AuthFieldValue": {
								"Action": ["List"]
							}
						},
						{
							"AuthObject": "Transaction",
							"AuthFieldValue": {
								"UserID": "*",
								"Action": ["Read"]
							}
						},
						{
							"AuthObject": "Logging",
							"AuthFieldValue": {
								"Action": []
							}
						},
						{
							"AuthObject": "Pricing",
							"AuthFieldValue": {
								"Action": []
							}
						}
					]
				},
				{
					"id": "D",
					"name": "Demo",
					"auths": [
						{
							"AuthObject": "Users",
							"AuthFieldValue": {
								"Action": []
							}
						},
						{
							"AuthObject": "User",
							"AuthFieldValue": {
								"UserID": "*",
								"Action": ["Read"]
							}
						},
						{
							"AuthObject": "Companies",
							"AuthFieldValue": {
								"Action": ["List"]
							}
						},
						{
							"AuthObject": "Company",
							"AuthFieldValue": {
								"CompanyID": "*",
								"Action": ["Read"]
							}
						},
						{
							"AuthObject": "Sites",
							"AuthFieldValue": {
								"Action": ["List"]
							}
						},
						{
							"AuthObject": "Site",
							"AuthFieldValue": {
								"SiteID": "*",
								"Action": ["Read"]
							}
						},
						{
							"AuthObject": "VehicleManufacturers",
							"AuthFieldValue": {
								"Action": ["List"]
							}
						},
						{
							"AuthObject": "VehicleManufacturer",
							"AuthFieldValue": {
								"VehicleManufacturerID": "*",
								"Action": ["Read"]
							}
						},
						{
							"AuthObject": "Vehicles",
							"AuthFieldValue": {
								"Action": ["List"]
							}
						},
						{
							"AuthObject": "Vehicle",
							"AuthFieldValue": {
								"SiteID": "*",
								"Action": ["Read"]
							}
						},
						{
							"AuthObject": "SiteAreas",
							"AuthFieldValue": {
								"Action": ["List"]
							}
						},
						{
							"AuthObject": "SiteArea",
							"AuthFieldValue": {
								"SiteAreaID": "*",
								"Action": ["Read"]
							}
						},
						{
							"AuthObject": "ChargingStations",
							"AuthFieldValue": {
								"Action": ["List"]
							}
						},
						{
							"AuthObject": "ChargingStation",
							"AuthFieldValue": {
								"ChargingStationID": "*",
								"Action": ["Read"]
							}
						},
						{
							"AuthObject": "Transactions",
							"AuthFieldValue": {
								"Action": ["List"]
							}
						},
						{
							"AuthObject": "Transaction",
							"AuthFieldValue": {
								"UserID": "*",
								"Action": ["Read"]
							}
						},
						{
							"AuthObject": "Logging",
							"AuthFieldValue": {
								"Action": []
							}
						},
						{
							"AuthObject": "Pricing",
							"AuthFieldValue": {
								"Action": []
							}
						}
					]
				}
			]
		`;
	}
};
