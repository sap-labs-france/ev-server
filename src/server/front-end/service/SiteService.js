const SecurityRestObjectFiltering = require('../SecurityRestObjectFiltering');
const CentralRestServerAuthorization = require('../CentralRestServerAuthorization');
const Logging = require('../../../utils/Logging');
const Database = require('../../../utils/Database');
const AppError = require('../../../exception/AppError');
const AppAuthError = require('../../../exception/AppAuthError');
const Companies = require('../../../utils/Companies');
const Sites = require('../../../utils/Sites');
const SiteAreas = require('../../../utils/SiteAreas');
const Constants = require('../../../utils/Constants');
const Utils = require('../../../utils/Utils');
const Users = require('../../../utils/Users');
const Company = require('../../../model/Company');
const Site = require('../../../model/Site');
const SiteArea = require('../../../model/SiteArea');

class SiteService {

	static handleCreateSiteArea(action, req, res, next) {
		Logging.logSecurityInfo({
			user: req.user, action: action,
			module: "SiteService",
			method: "handleCreateSiteArea",
			message: `Create Site Area '${req.body.name}'`,
			detailedMessages: req.body
		});
		// Check auth
		if (!CentralRestServerAuthorization.canCreateSite(req.user)) {
			// Not Authorized!
			Logging.logActionUnauthorizedMessageAndSendResponse(
				CentralRestServerAuthorization.ACTION_CREATE,
				CentralRestServerAuthorization.ENTITY_SITE_AREA, null, req, res, next);
			return;
		}
		// Filter
		let filteredRequest = SecurityRestObjectFiltering.filterSiteAreaCreateRequest( req.body, req.user );
		// Check Mandatory fields
		if (SiteAreas.checkIfSiteAreaValid("SiteAreaCreate", filteredRequest, req, res, next)) {
			// Create site area
			let newSiteArea = new SiteArea(filteredRequest);
			// Check Site
			global.storage.getSite(filteredRequest.siteID).then((site) => {
				// Found?
				if (!site) {
					// Not Found!
					throw new AppError(`The Site ID '${filteredRequest.siteID}' does not exist`,
						500, "SiteService", "handleCreateSiteArea");
				}
				// Save
				return newSiteArea.save();
			}).then((createdSiteArea) => {
				Logging.logSecurityInfo({
					user: req.user, module: "SiteService", method: "handleCreateSiteArea",
					message: `Site Area '${createdSiteArea.getName()}' has been created successfully`,
					action: action, detailedMessages: createdSiteArea});
				// Ok
				res.json({status: `Success`});
				next();
			}).catch((err) => {
				// Log
				Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
			});
		}
	}

	static handleDeleteCompany(action, req, res, next) {
		Logging.logSecurityInfo({
			user: req.user, action: action,
			module: "SiteService",
			method: "handleDeleteCompany",
			message: `Delete Company '${req.query.ID}'`,
			detailedMessages: req.query
		});
		// Filter
		let company;
		let filteredRequest = SecurityRestObjectFiltering.filterCompanyDeleteRequest(
			req.query, req.user);
		// Check Mandatory fields
		if(!filteredRequest.ID) {
			Logging.logActionExceptionMessageAndSendResponse(
				action, new Error(`The Company's ID must be provided`), req, res, next);
			return;
		}
		// Get
		global.storage.getCompany(filteredRequest.ID).then((foundCompany) => {
			company = foundCompany;
			// Found?
			if (!company) {
				// Not Found!
				throw new AppError(`Company with ID '${filteredRequest.ID}' does not exist`,
					500, "SiteService", "handleDeleteCompany");
			}
			// Check auth
			if (!CentralRestServerAuthorization.canDeleteCompany(req.user, company.getModel())) {
				// Not Authorized!
				throw new AppAuthError(req.user, CentralRestServerAuthorization.ACTION_DELETE,
					CentralRestServerAuthorization.ENTITY_COMPANY, company.getID(),
					500, "SiteService", "handleDeleteCompany");
			}
			// Delete
			return company.delete();
		}).then(() => {
			// Log
			Logging.logSecurityInfo({
				user: req.user, module: "SiteService", method: "handleDeleteCompany",
				message: `Company '${company.getName()}' has been deleted successfully`,
				action: action, detailedMessages: company});
			// Ok
			res.json({status: `Success`});
			next();
		}).catch((err) => {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		});
	}

	static handleDeleteSite(action, req, res, next) {
		Logging.logSecurityInfo({
			user: req.user, action: action,
			module: "SiteService",
			method: "handleDeleteSite",
			message: `Delete Site '${req.query.ID}'`,
			detailedMessages: req.query
		});
		// Filter
		let site;
		let filteredRequest = SecurityRestObjectFiltering.filterSiteDeleteRequest(
			req.query, req.user);
		// Check Mandatory fields
		if(!filteredRequest.ID) {
			Logging.logActionExceptionMessageAndSendResponse(
				action, new Error(`The Site's ID must be provided`), req, res, next);
			return;
		}
		// Get
		global.storage.getSite(filteredRequest.ID).then((foundSite) => {
			site = foundSite;
			// Found?
			if (!site) {
				// Not Found!
				throw new AppError(`Site with ID '${filteredRequest.ID}' does not exist`,
					500, "SiteService", "handleDeleteSite");
			}
			// Check auth
			if (!CentralRestServerAuthorization.canDeleteSite(req.user, site.getModel())) {
				// Not Authorized!
				throw new AppAuthError(req.user, CentralRestServerAuthorization.ACTION_DELETE,
					CentralRestServerAuthorization.ENTITY_SITE, site.getID(),
					500, "SiteService", "handleDeleteSite");
			}
			// Delete
			return site.delete();
		}).then(() => {
			// Log
			Logging.logSecurityInfo({
				user: req.user, module: "SiteService", method: "handleDeleteSite",
				message: `Site '${site.getName()}' has been deleted successfully`,
				action: action, detailedMessages: site});
			// Ok
			res.json({status: `Success`});
			next();
		}).catch((err) => {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		});
	}

	static handleGetSiteAreas(action, req, res, next) {
		Logging.logSecurityInfo({
			user: req.user, action: action,
			module: "SiteService",
			method: "handleGetSiteAreas",
			message: `Read All Site Areas`,
			detailedMessages: req.query
		});
		// Check auth
		if (!CentralRestServerAuthorization.canListSiteAreas(req.user)) {
			// Not Authorized!
			Logging.logActionUnauthorizedMessageAndSendResponse(
				CentralRestServerAuthorization.ACTION_LIST,
				CentralRestServerAuthorization.ENTITY_SITE_AREAS, null, req, res, next);
			return;
		}
		// Filter
		let filteredRequest = SecurityRestObjectFiltering.filterSiteAreasRequest(req.query, req.user);
		// Get the sites
		global.storage.getSiteAreas(filteredRequest.Search, filteredRequest.WithPicture, Constants.NO_LIMIT).then((siteAreas) => {
			let siteAreasJSon = [];
			siteAreas.forEach((siteArea) => {
				// Set the model
				siteAreasJSon.push(siteArea.getModel());
			});
			// Return
			res.json(
				// Filter
				SecurityRestObjectFiltering.filterSiteAreasResponse(
					siteAreasJSon, req.user)
			);
			next();
		}).catch((err) => {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		});
	}

	static handleDeleteSiteArea(action, req, res, next) {
		Logging.logSecurityInfo({
			user: req.user, action: action,
			module: "SiteService",
			method: "handleDeleteSiteArea",
			message: `Delete Site Area '${req.query.ID}'`,
			detailedMessages: req.query
		});
		// Filter
		let siteArea;
		let filteredRequest = SecurityRestObjectFiltering.filterSiteAreaDeleteRequest(
			req.query, req.user);
		// Check Mandatory fields
		if(!filteredRequest.ID) {
			Logging.logActionExceptionMessageAndSendResponse(
				action, new Error(`The Site Area's ID must be provided`), req, res, next);
			return;
		}
		// Get
		global.storage.getSiteArea(filteredRequest.ID).then((foundSiteArea) => {
			siteArea = foundSiteArea;
			// Found?
			if (!siteArea) {
				// Not Found!
				throw new AppError(`Site Area with ID '${filteredRequest.ID}' does not exist`,
					500, "SiteService", "handleDeleteSiteArea");
			}
			// Check auth
			if (!CentralRestServerAuthorization.canDeleteSiteArea(req.user,
					{ "id": siteArea.getID() })) {
				// Not Authorized!
				throw new AppAuthError(req.user, CentralRestServerAuthorization.ACTION_DELETE,
					CentralRestServerAuthorization.ENTITY_SITE_AREA, siteArea.getID(),
					500, "SiteService", "handleDeleteSiteArea");
			}
			// Delete
			return siteArea.delete();
		}).then(() => {
			// Log
			Logging.logSecurityInfo({
				user: req.user, module: "SiteService", method: "handleDeleteSiteArea",
				message: `Site Area '${siteArea.getName()}' has been deleted successfully`,
				action: action, detailedMessages: siteArea});
			// Ok
			res.json({status: `Success`});
			next();
		}).catch((err) => {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		});
	}

	static handleGetSite(action, req, res, next) {
		Logging.logSecurityInfo({
			user: req.user, action: action,
			module: "SiteService",
			method: "handleGetSite",
			message: `Read Site '${req.query.ID}'`,
			detailedMessages: req.query
		});
		// Filter
		let filteredRequest = SecurityRestObjectFiltering.filterSiteRequest(req.query, req.user);
		// Charge Box is mandatory
		if(!filteredRequest.ID) {
			Logging.logActionExceptionMessageAndSendResponse(
				action, new Error(`The Site ID is mandatory`), req, res, next);
			return;
		}
		// Get it
		global.storage.getSite(filteredRequest.ID).then((site) => {
			if (site) {
				// Return
				res.json(
					// Filter
					SecurityRestObjectFiltering.filterSiteResponse(
						site.getModel(), req.user)
				);
			} else {
				res.json({});
			}
			next();
		}).catch((err) => {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		});
	}

	static handleGetSiteArea(action, req, res, next) {
		Logging.logSecurityInfo({
			user: req.user, action: action,
			module: "SiteService",
			method: "handleGetSiteArea",
			message: `Read Site Area '${req.query.ID}'`,
			detailedMessages: req.query
		});
		// Filter
		let filteredRequest = SecurityRestObjectFiltering.filterSiteAreaRequest(req.query, req.user);
		// Charge Box is mandatory
		if(!filteredRequest.ID) {
			Logging.logActionExceptionMessageAndSendResponse(
				action, new Error(`The Site Area ID is mandatory`), req, res, next);
			return;
		}
		// Get it
		global.storage.getSiteArea(filteredRequest.ID, SiteAreas.WITH_CHARGING_STATIONS,
				SiteAreas.WITHOUT_SITE).then((siteArea) => {
			if (siteArea) {
				// Return
				res.json(
					// Filter
					SecurityRestObjectFiltering.filterSiteAreaResponse(
						siteArea.getModel(), req.user)
				);
			} else {
				res.json({});
			}
			next();
		}).catch((err) => {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		});
	}

	static handleGetCompany(action, req, res, next) {
		Logging.logSecurityInfo({
			user: req.user, action: action,
			module: "SiteService",
			method: "handleGetCompany",
			message: `Read Company '${req.query.ID}'`,
			detailedMessages: req.query
		});
		// Filter
		let filteredRequest = SecurityRestObjectFiltering.filterCompanyRequest(req.query, req.user);
		// Charge Box is mandatory
		if(!filteredRequest.ID) {
			Logging.logActionExceptionMessageAndSendResponse(
				action, new Error(`The Company ID is mandatory`), req, res, next);
			return;
		}
		// Get it
		global.storage.getCompany(filteredRequest.ID).then((company) => {
			if (company) {
				// Return
				res.json(
					// Filter
					SecurityRestObjectFiltering.filterCompanyResponse(
						company.getModel(), req.user)
				);
			} else {
				res.json({});
			}
			next();
		}).catch((err) => {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		});
	}

	static handleGetCompanies(action, req, res, next) {
		Logging.logSecurityInfo({
			user: req.user, action: action,
			module: "SiteService",
			method: "handleGetCompanies",
			message: `Read All Companies`,
			detailedMessages: req.query
		});
		// Check auth
		if (!CentralRestServerAuthorization.canListCompanies(req.user)) {
			// Not Authorized!
			Logging.logActionUnauthorizedMessageAndSendResponse(
				CentralRestServerAuthorization.ACTION_LIST,
				CentralRestServerAuthorization.ENTITY_COMPANIES,
				null, req, res, next);
			return;
		}
		// Filter
		let filteredRequest = SecurityRestObjectFiltering.filterCompaniesRequest(req.query, req.user);
		// Get the companies
		global.storage.getCompanies(filteredRequest.Search, filteredRequest.WithSites,
				filteredRequest.WithLogo, Constants.NO_LIMIT).then((companies) => {
			let companiesJSon = [];
			companies.forEach((company) => {
				// Set the model
				companiesJSon.push(company.getModel());
			});
			// Return
			res.json(
				// Filter
				SecurityRestObjectFiltering.filterCompaniesResponse(
					companiesJSon, req.user)
			);
			next();
		}).catch((err) => {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		});
	}

	static handleGetSites(action, req, res, next) {
		Logging.logSecurityInfo({
			user: req.user, action: action,
			module: "SiteService",
			method: "handleGetSites",
			message: `Read All Sites`,
			detailedMessages: req.query
		});
		// Check auth
		if (!CentralRestServerAuthorization.canListSites(req.user)) {
			// Not Authorized!
			Logging.logActionUnauthorizedMessageAndSendResponse(
				CentralRestServerAuthorization.ACTION_LIST,
				CentralRestServerAuthorization.ENTITY_SITES, null, req, res, next);
			return;
		}
		// Filter
		let filteredRequest = SecurityRestObjectFiltering.filterSitesRequest(req.query, req.user);
		// Get the sites
		global.storage.getSites(filteredRequest.Search, filteredRequest.WithSiteAreas,
				filteredRequest.WithPicture, Constants.NO_LIMIT).then((sites) => {
			let sitesJSon = [];
			sites.forEach((site) => {
				// Set the model
				sitesJSon.push(site.getModel());
			});
			// Return
			res.json(
				// Filter
				SecurityRestObjectFiltering.filterSitesResponse(
					sitesJSon, req.user)
			);
			next();
		}).catch((err) => {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		});
	}

	static handleCreateSite(action, req, res, next) {
		Logging.logSecurityInfo({
			user: req.user, action: action,
			module: "SiteService",
			method: "handleCreateSite",
			message: `Create Site '${req.body.name}'`,
			detailedMessages: req.body
		});
		// Check auth
		if (!CentralRestServerAuthorization.canCreateSite(req.user)) {
			// Not Authorized!
			Logging.logActionUnauthorizedMessageAndSendResponse(
				CentralRestServerAuthorization.ACTION_CREATE,
				CentralRestServerAuthorization.ENTITY_SITE, null, req, res, next);
			return;
		}
		// Filter
		let filteredRequest = SecurityRestObjectFiltering.filterSiteCreateRequest( req.body, req.user );
		// Check Mandatory fields
		if (Sites.checkIfSiteValid(action, filteredRequest, req, res, next)) {
			// Check Company
			global.storage.getCompany(filteredRequest.companyID).then((company) => {
				// Found?
				if (!company) {
					// Not Found!
					throw new AppError(`The Company ID '${filteredRequest.companyID}' does not exist`,
						500, "SiteService", "handleCreateSite");
				}
				// Get the logged user
				return global.storage.getUser(req.user.id);
			// Logged User
			}).then((loggedUser) => {
				// Create site
				let newSite = new Site(filteredRequest);
				// Update timestamp
				newSite.setCreatedBy(Utils.buildUserFullName(loggedUser.getModel()));
				newSite.setCreatedOn(new Date());
				// Save
				return newSite.save();
			}).then((createdSite) => {
				Logging.logSecurityInfo({
					user: req.user, module: "SiteService", method: "handleCreateSite",
					message: `Site '${createdSite.getName()}' has been created successfully`,
					action: action, detailedMessages: createdSite});
				// Ok
				res.json({status: `Success`});
				next();
			}).catch((err) => {
				// Log
				Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
			});
		}
	}

	static handleCreateCompany(action, req, res, next) {
		Logging.logSecurityInfo({
			user: req.user, action: action,
			module: "SiteService",
			method: "handleCreateCompany",
			message: `Create Company '${req.body.name}'`,
			detailedMessages: req.body
		});
		// Check auth
		if (!CentralRestServerAuthorization.canCreateCompany(req.user)) {
			// Not Authorized!
			Logging.logActionUnauthorizedMessageAndSendResponse(
				CentralRestServerAuthorization.ACTION_CREATE,
				CentralRestServerAuthorization.ENTITY_COMPANY, null, req, res, next);
			return;
		}
		// Filter
		let filteredRequest = SecurityRestObjectFiltering.filterCompanyCreateRequest( req.body, req.user );
		// Check Mandatory fields
		if (Companies.checkIfCompanyValid(action, filteredRequest, req, res, next)) {
			// Get the logged user
			global.storage.getUser(req.user.id).then((loggedUser) => {
				// Create
				let newCompany = new Company(filteredRequest);
				// Update timestamp
				newCompany.setCreatedBy(Utils.buildUserFullName(loggedUser.getModel()));
				newCompany.setCreatedOn(new Date());
				// Save
				return newCompany.save();
			}).then((createdCompany) => {
				Logging.logSecurityInfo({
					user: req.user, module: "SiteService", method: "handleCreateCompany",
					message: `Company '${createdCompany.getName()}' has been created successfully`,
					action: action, detailedMessages: createdCompany});
				// Ok
				res.json({status: `Success`});
				next();
			}).catch((err) => {
				// Log
				Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
			});
		}
	}

	static handleUpdateCompany(action, req, res, next) {
		Logging.logSecurityInfo({
			user: req.user, action: action,
			module: "SiteService",
			method: "handleUpdateCompany",
			message: `Update Company '${req.body.name}' (ID '${req.body.id}')`,
			detailedMessages: req.body
		});
		// Filter
		let filteredRequest = SecurityRestObjectFiltering.filterCompanyUpdateRequest( req.body, req.user );
		// Check Mandatory fields
		if (Companies.checkIfCompanyValid(action, filteredRequest, req, res, next)) {
			// Check email
			global.storage.getCompany(filteredRequest.id).then((company) => {
				if (!company) {
					throw new AppError(`The Company with ID '${filteredRequest.id}' does not exist anymore`,
						550, "SiteService", "handleUpdateCompany");
				}
				// Check auth
				if (!CentralRestServerAuthorization.canUpdateCompany(req.user, company.getModel())) {
					// Not Authorized!
					Logging.logActionUnauthorizedMessageAndSendResponse(
						CentralRestServerAuthorization.ACTION_UPDATE,
						CentralRestServerAuthorization.ENTITY_COMPANY,
						company.getName(), req, res, next);
					return;
				}
				// Update
				Database.updateCompany(filteredRequest, company.getModel());
				// Update timestamp
				company.setLastChangedBy(Utils.buildUserFullName(req.user));
				company.setLastChangedOn(new Date());
				// Update
				return company.save();
			}).then((updatedCompany) => {
				// Log
				Logging.logSecurityInfo({
					user: req.user, module: "SiteService", method: "handleUpdateCompany",
					message: `Company '${updatedCompany.getName()}' has been updated successfully`,
					action: action, detailedMessages: updatedCompany});
				// Ok
				res.json({status: `Success`});
				next();
			}).catch((err) => {
				// Log
				Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
			});
		}
	}

	static handleUpdateSite(action, req, res, next) {
		Logging.logSecurityInfo({
			user: req.user, action: action,
			module: "SiteService",
			method: "handleUpdateSite",
			message: `Update Site '${req.body.name}' (ID '${req.body.id}')`,
			detailedMessages: req.body
		});
		// Filter
		let filteredRequest = SecurityRestObjectFiltering.filterSiteUpdateRequest( req.body, req.user );
		// Check Mandatory fields
		if (Sites.checkIfSiteValid(action, filteredRequest, req, res, next)) {
			let siteWithId;
			// Check email
			global.storage.getSite(filteredRequest.id).then((site) => {
				if (!site) {
					throw new AppError(`The Site with ID '${filteredRequest.id}' does not exist anymore`,
						550, "SiteService", "handleUpdateSite");
				}
				// Check auth
				if (!CentralRestServerAuthorization.canUpdateSite(req.user, site.getModel())) {
					// Not Authorized!
					Logging.logActionUnauthorizedMessageAndSendResponse(
						CentralRestServerAuthorization.ACTION_UPDATE,
						CentralRestServerAuthorization.ENTITY_SITE,
						site.getName(), req, res, next);
					return;
				}
				// Update
				Database.updateSite(filteredRequest, site.getModel());
				// Update timestamp
				site.setLastChangedBy(`${Utils.buildUserFullName(req.user)}`);
				site.setLastChangedOn(new Date());
				// Update
				return site.save();
			}).then((updatedSite) => {
				// Log
				Logging.logSecurityInfo({
					user: req.user, module: "SiteService", method: "handleUpdateSite",
					message: `Site '${updatedSite.getName()}' has been updated successfully`,
					action: action, detailedMessages: updatedSite});
				// Ok
				res.json({status: `Success`});
				next();
			}).catch((err) => {
				// Log
				Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
			});
		}
	}

	static handleUpdateSiteArea(action, req, res, next) {
		Logging.logSecurityInfo({
			user: req.user, action: action,
			module: "SiteService",
			method: "handleUpdateSiteArea",
			message: `Update Site Area '${req.body.name}' (ID '${req.body.id}')`,
			detailedMessages: req.body
		});
		// Filter
		let filteredRequest = SecurityRestObjectFiltering.filterSiteAreaUpdateRequest( req.body, req.user );
		// Check Mandatory fields
		if (SiteAreas.checkIfSiteAreaValid(action, filteredRequest, req, res, next)) {
			let siteArea;
			// Check
			global.storage.getSiteArea(filteredRequest.id).then((foundSiteArea) => {
				siteArea = foundSiteArea;
				if (!siteArea) {
					throw new AppError(`The Site Area with ID '${filteredRequest.id}' does not exist anymore`,
						550, "SiteService", "handleUpdateSiteArea");
				}
				// Check auth
				if (!CentralRestServerAuthorization.canUpdateSiteArea(req.user, siteArea.getModel())) {
					// Not Authorized!
					Logging.logActionUnauthorizedMessageAndSendResponse(
						CentralRestServerAuthorization.ACTION_UPDATE,
						CentralRestServerAuthorization.ENTITY_SITE_AREA,
						siteArea.getName(), req, res, next);
					return;
				}
				// Get Charging Stations
				return siteArea.getChargingStations();
			}).then((assignedChargingStations) => {
				let proms = [];
				// Clear Site Area from Existing Charging Station
				assignedChargingStations.forEach((assignedChargingStation) => {
					assignedChargingStation.setSiteArea(null);
					proms.push(assignedChargingStation.saveChargingStationSiteArea());
				});
				return Promise.all(proms);
			}).then((results) => {
				let proms = [];
				// Assign new Charging Stations
				filteredRequest.chargeBoxIDs.forEach((chargeBoxID) => {
					// Get it
					proms.push(global.storage.getChargingStation(chargeBoxID));
				});
				return Promise.all(proms);
			}).then((assignedChargingStations) => {
				let proms = [];
				// Get it
				assignedChargingStations.forEach((assignedChargingStation) => {
					assignedChargingStation.setSiteArea(siteArea);
					proms.push(assignedChargingStation.saveChargingStationSiteArea());
				});
				return Promise.all(proms);
			}).then((results) => {
				// Update
				Database.updateSiteArea(filteredRequest, siteArea.getModel());
				// Update
				return siteArea.save();
			}).then((updatedSiteArea) => {
				// Log
				Logging.logSecurityInfo({
					user: req.user, module: "SiteService", method: "handleUpdateSiteArea",
					message: `Site Area '${updatedSiteArea.getName()}' has been updated successfully`,
					action: action, detailedMessages: updatedSiteArea});
				// Ok
				res.json({status: `Success`});
				next();
			}).catch((err) => {
				// Log
				Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
			});
		}
	}
}

module.exports = SiteService;
