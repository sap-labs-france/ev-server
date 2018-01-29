const SecurityRestObjectFiltering = require('../SecurityRestObjectFiltering');
const CentralRestServerAuthorization = require('../CentralRestServerAuthorization');
const Logging = require('../../../utils/Logging');
const Database = require('../../../utils/Database');
const AppError = require('../../../exception/AppError');
const AppAuthError = require('../../../exception/AppAuthError');
const Sites = require('../../../utils/Sites');
const Utils = require('../../../utils/Utils');
const Users = require('../../../utils/Users');
const Site = require('../../../model/Site');

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
				throw new AppError(`Site with ID ${filteredRequest.ID} does not exist`,
					500, "SiteService", "handleDeleteSite");
			}
			// Check auth
			if (!CentralRestServerAuthorization.canDeleteSite(req.user, site.getModel())) {
				// Not Authorized!
				throw new AppAuthError(req.user, CentralRestServerAuthorization.ACTION_DELETE,
					CentralRestServerAuthorization.SiteENTITY_SITE, site.getID(),
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
				console.log(site);
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
				CentralRestServerAuthorization.ACTION_LIST, CentralRestServerAuthorization.ENTITY_SITES,
				null, req, res, next);
			return;
		}
		// Filter
		let filteredRequest = SecurityRestObjectFiltering.filterSitesRequest(req.query, req.user);
		// Get the sites
		global.storage.getSites(filteredRequest.Search, 100).then((sites) => {
			var sitesJSon = [];
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
		if (Sites.checkIfSiteValid("SiteCreate", filteredRequest, req, res, next)) {
			// Get the logged user
			global.storage.getUser(req.user.id).then((loggedUser) => {
				// Create site
				var newSite = new Site(filteredRequest);
				// Update timestamp
				newSite.setCreatedBy(Utils.buildUserFullName(loggedUser.getModel(), Users.WITHOUT_ID));
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
		if (Sites.checkIfSiteValid("SiteUpdate", filteredRequest, req, res, next)) {
			let siteWithId;
			// Check email
			global.storage.getSite(filteredRequest.id).then((site) => {
				if (!site) {
					throw new AppError(`The site with ID ${filteredRequest.id} does not exist anymore`,
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
}

module.exports = SiteService;
