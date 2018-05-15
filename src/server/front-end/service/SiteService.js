const Logging = require('../../../utils/Logging');
const Database = require('../../../utils/Database');
const AppError = require('../../../exception/AppError');
const AppAuthError = require('../../../exception/AppAuthError');
const CentralRestServerAuthorization = require('../CentralRestServerAuthorization');
const Companies = require('../../../utils/Companies');
const Sites = require('../../../utils/Sites');
const SiteAreas = require('../../../utils/SiteAreas');
const Constants = require('../../../utils/Constants');
const Utils = require('../../../utils/Utils');
const Users = require('../../../utils/Users');
const Company = require('../../../model/Company');
const Site = require('../../../model/Site');
const SiteArea = require('../../../model/SiteArea');
const SiteSecurity = require('./security/SiteSecurity');

class SiteService {
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
		let filteredRequest = SiteSecurity.filterSiteDeleteRequest(
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
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`Site with ID '${filteredRequest.ID}' does not exist`,
					550, "SiteService", "handleDeleteSite");
			}
			// Check auth
			if (!CentralRestServerAuthorization.canDeleteSite(req.user, site.getModel())) {
				// Not Authorized!
				throw new AppAuthError(
					CentralRestServerAuthorization.ACTION_DELETE,
					CentralRestServerAuthorization.ENTITY_SITE,
					site.getID(),
					560, "SiteService", "handleDeleteSite",
					req.user);
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

	static handleGetSite(action, req, res, next) {
		Logging.logSecurityInfo({
			user: req.user, action: action,
			module: "SiteService",
			method: "handleGetSite",
			message: `Read Site '${req.query.ID}'`,
			detailedMessages: req.query
		});
		// Filter
		let filteredRequest = SiteSecurity.filterSiteRequest(req.query, req.user);
		// Charge Box is mandatory
		if(!filteredRequest.ID) {
			Logging.logActionExceptionMessageAndSendResponse(
				action, new Error(`The Site ID is mandatory`), req, res, next);
			return;
		}
		// Get it
		global.storage.getSite(filteredRequest.ID, null, filteredRequest.WithUsers).then((site) => {
			if (!site) {
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The Site with ID '${filteredRequest.ID}' does not exist anymore`,
					550, "SiteService", "handleGetSite");
			}
			// Return
			res.json(
				// Filter
				SiteSecurity.filterSiteResponse(
					site.getModel(), req.user)
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
			throw new AppAuthError(
				CentralRestServerAuthorization.ACTION_LIST,
				CentralRestServerAuthorization.ENTITY_SITES,
				null,
				560, "SiteService", "handleGetSites",
				req.user);
		}
		// Filter
		let filteredRequest = SiteSecurity.filterSitesRequest(req.query, req.user);
		// Get the sites
		global.storage.getSites(filteredRequest.Search, null,
				filteredRequest.UserID, filteredRequest.WithCompany,
				filteredRequest.WithSiteAreas, filteredRequest.WithChargeBoxes,
				filteredRequest.WithUsers, Constants.NO_LIMIT).then((sites) => {
			let sitesJSon = [];
			sites.forEach((site) => {
				// Set the model
				sitesJSon.push(site.getModel());
			});
			// Return
			res.json(
				// Filter
				SiteSecurity.filterSitesResponse(
					sitesJSon, req.user)
			);
			next();
		}).catch((err) => {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		});
	}

	static handleGetSiteImage(action, req, res, next) {
		Logging.logSecurityInfo({
			user: req.user, action: action,
			module: "SiteService",
			method: "handleGetSiteImage",
			message: `Read Site Image '${req.query.ID}'`,
			detailedMessages: req.query
		});
		// Filter
		let filteredRequest = SiteSecurity.filterSiteRequest(req.query, req.user);
		// Charge Box is mandatory
		if(!filteredRequest.ID) {
			Logging.logActionExceptionMessageAndSendResponse(
				action, new Error(`The Site ID is mandatory`), req, res, next);
			return;
		}
		// Get it
		global.storage.getSite(filteredRequest.ID).then((site) => {
			if (!site) {
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The Site with ID '${filteredRequest.ID}' does not exist anymore`,
					550, "SiteService", "handleGetSite");
			}
			// Check auth
			if (!CentralRestServerAuthorization.canReadSite(req.user, site.getModel())) {
				// Not Authorized!
				throw new AppAuthError(
					CentralRestServerAuthorization.ACTION_READ,
					CentralRestServerAuthorization.ENTITY_SITE,
					site.getID(),
					560, "SiteService", "handleGetSiteImage",
					req.user);
			}
			// Get the image
			return global.storage.getSiteImage(filteredRequest.ID);
		}).then((siteImage) => {
			// Found?
			if (siteImage) {
				Logging.logSecurityInfo({
					user: req.user,
					action: action,
					module: "SiteService", method: "handleGetSiteImage",
					message: 'Read Site Image'
				});
				// Set the user
				res.json(siteImage);
			} else {
				res.json(null);
			}
			next();
		}).catch((err) => {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		});
	}

	static handleGetSiteImages(action, req, res, next) {
		Logging.logSecurityInfo({
			user: req.user, action: action,
			module: "SiteService", method: "handleGetSiteImages",
			message: `Read Site Images`,
			detailedMessages: req.query
		});
		// Check auth
		if (!CentralRestServerAuthorization.canListSites(req.user)) {
			// Not Authorized!
			throw new AppAuthError(
				CentralRestServerAuthorization.ACTION_LIST,
				CentralRestServerAuthorization.ENTITY_SITES,
				null,
				560, "SiteService", "handleGetSiteImages",
				req.user);
		}
		// Get the site image
		global.storage.getSiteImages().then((siteImages) => {
			Logging.logSecurityInfo({
				user: req.user,
				action: action,
				module: "SiteService", method: "handleGetSiteImages",
				message: 'Read Site Images'
			});
			res.json(siteImages);
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
			throw new AppAuthError(
				CentralRestServerAuthorization.ACTION_CREATE,
				CentralRestServerAuthorization.ENTITY_SITE,
				null,
				560, "SiteService", "handleCreateSite",
				req.user);
		}
		// Filter
		let filteredRequest = SiteSecurity.filterSiteCreateRequest( req.body, req.user );
		let site, newSite;
		// Check Company
		global.storage.getCompany(filteredRequest.companyID).then((company) => {
			// Check Mandatory fields
			Sites.checkIfSiteValid(filteredRequest, req);
			// Found?
			if (!company) {
				// Not Found!
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The Company ID '${filteredRequest.companyID}' does not exist`,
					550, "SiteService", "handleCreateSite");
			}
			// Get the logged user
			return global.storage.getUser(req.user.id);
		// Logged User
		}).then((loggedUser) => {
			// Create site
			site = new Site(filteredRequest);
			// Update timestamp
			site.setCreatedBy(loggedUser);
			site.setCreatedOn(new Date());
			// Save Site
			return site.save();
		}).then((createdSite) => {
			newSite = createdSite;
			// Save Site's Image
			newSite.setImage(site.getImage());
			// Save
			return newSite.saveImage();
		}).then(() => {
			Logging.logSecurityInfo({
				user: req.user, module: "SiteService", method: "handleCreateSite",
				message: `Site '${newSite.getName()}' has been created successfully`,
				action: action, detailedMessages: newSite});
			// Ok
			res.json({status: `Success`});
			next();
		}).catch((err) => {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		});
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
		let filteredRequest = SiteSecurity.filterSiteUpdateRequest( req.body, req.user );
		let site;
		// Check email
		global.storage.getSite(filteredRequest.id).then((foundSite) => {
			site = foundSite;
			if (!site) {
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The Site with ID '${filteredRequest.id}' does not exist anymore`,
					550, "SiteService", "handleUpdateSite");
			}
			// Check Mandatory fields
			Sites.checkIfSiteValid(filteredRequest, req);
			// Check auth
			if (!CentralRestServerAuthorization.canUpdateSite(req.user, site.getModel())) {
				// Not Authorized!
				throw new AppAuthError(
					CentralRestServerAuthorization.ACTION_UPDATE,
					CentralRestServerAuthorization.ENTITY_SITE,
					site.getID(),
					560, "SiteService", "handleUpdateSite",
					req.user);
			}
			// Get the logged user
			return global.storage.getUser(req.user.id);
		// Logged User
		}).then((loggedUser) => {
			// Update
			Database.updateSite(filteredRequest, site.getModel());
			// Update timestamp
			site.setLastChangedBy(loggedUser);
			site.setLastChangedOn(new Date());
			// Update Site's Image
			return site.saveImage();
		}).then(() => {
			// Update Site
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

module.exports = SiteService;
