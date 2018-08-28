const User = require('../../../model/User');
const Logging = require('../../../utils/Logging');
const Database = require('../../../utils/Database');
const AppError = require('../../../exception/AppError');
const AppAuthError = require('../../../exception/AppAuthError');
const Authorizations = require('../../../authorization/Authorizations');
const Constants = require('../../../utils/Constants');
const Site = require('../../../model/Site');
const SiteSecurity = require('./security/SiteSecurity');
const SiteStorage = require('../../../storage/mongodb/SiteStorage');
const UserStorage = require('../../../storage/mongodb/UserStorage');
const CompanyStorage = require('../../../storage/mongodb/CompanyStorage'); 

class SiteService {
	static async handleDeleteSite(action, req, res, next) {
		try {
			// Filter
			let filteredRequest = SiteSecurity.filterSiteDeleteRequest(req.query, req.user);
			// Check Mandatory fields
			if(!filteredRequest.ID) {
				// Not Found!
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The Site's ID must be provided`, 500, 
					'SiteService', 'handleDeleteSite', req.user);
			}
			// Get
			let site = await SiteStorage.getSite(filteredRequest.ID);
			if (!site) {
				// Not Found!
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`Site with ID '${filteredRequest.ID}' does not exist`, 550, 
					'SiteService', 'handleDeleteSite', req.user);
			}
			// Check auth
			if (!Authorizations.canDeleteSite(req.user, site.getModel())) {
				// Not Authorized!
				throw new AppAuthError(
					Authorizations.ACTION_DELETE,
					Constants.ENTITY_SITE,
					site.getID(),
					560, 
					'SiteService', 'handleDeleteSite',
					req.user);
			}
			// Delete
			await site.delete();
			// Log
			Logging.logSecurityInfo({
				user: req.user, module: 'SiteService', method: 'handleDeleteSite',
				message: `Site '${site.getName()}' has been deleted successfully`,
				action: action, detailedMessages: site});
			// Ok
			res.json({status: `Success`});
			next();
		} catch (error) {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
		}
	}

	static async handleGetSite(action, req, res, next) {
		try {
			// Filter
			let filteredRequest = SiteSecurity.filterSiteRequest(req.query, req.user);
			// Charge Box is mandatory
			if(!filteredRequest.ID) {
				// Not Found!
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The Site's ID must be provided`, 500, 
					'SiteService', 'handleGetSite', req.user);
			}
			// Get it
			let site = await SiteStorage.getSite(filteredRequest.ID, null, filteredRequest.WithUsers);
			if (!site) {
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The Site with ID '${filteredRequest.ID}' does not exist anymore`, 550, 
					'SiteService', 'handleGetSite', req.user);
			}
			// Return
			res.json(
				// Filter
				SiteSecurity.filterSiteResponse(
					site.getModel(), req.user)
			);
			next();
		} catch (error) {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
		}
	}

	static async handleGetSites(action, req, res, next) {
		try {
			// Check auth
			if (!Authorizations.canListSites(req.user)) {
				// Not Authorized!
				throw new AppAuthError(
					Authorizations.ACTION_LIST,
					Constants.ENTITY_SITES,
					null,
					560, 
					'SiteService', 'handleGetSites',
					req.user);
			}
			// Filter
			let filteredRequest = SiteSecurity.filterSitesRequest(req.query, req.user);
			// Get the sites
			let sites = await SiteStorage.getSites(filteredRequest.Search, null,
				filteredRequest.UserID, filteredRequest.WithCompany,
				filteredRequest.WithSiteAreas, filteredRequest.WithChargeBoxes,
				filteredRequest.WithUsers, filteredRequest.Limit, filteredRequest.Skip, filteredRequest.Sort);
			// Set
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
		} catch (error) {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
		}
	}

	static async handleGetSiteImage(action, req, res, next) {
		try {
			// Filter
			let filteredRequest = SiteSecurity.filterSiteRequest(req.query, req.user);
			// Charge Box is mandatory
			if(!filteredRequest.ID) {
				// Not Found!
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The Site's ID must be provided`, 500, 
					'SiteService', 'handleGetSiteImage', req.user);
			}
			// Get it
			let site = await SiteStorage.getSite(filteredRequest.ID);
			if (!site) {
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The Site with ID '${filteredRequest.ID}' does not exist anymore`, 550, 
					'SiteService', 'handleGetSite', req.user);
			}
			// Check auth
			if (!Authorizations.canReadSite(req.user, site.getModel())) {
				// Not Authorized!
				throw new AppAuthError(
					Authorizations.ACTION_READ,
					Constants.ENTITY_SITE,
					site.getID(),
					560, 
					'SiteService', 'handleGetSiteImage',
					req.user);
			}
			// Get the image
			let siteImage = await SiteStorage.getSiteImage(filteredRequest.ID);
			// Return
			res.json(siteImage);
			next();
		} catch (error) {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
		}
	}

	static async handleGetSiteImages(action, req, res, next) {
		try {
			// Check auth
			if (!Authorizations.canListSites(req.user)) {
				// Not Authorized!
				throw new AppAuthError(
					Authorizations.ACTION_LIST,
					Constants.ENTITY_SITES,
					null,
					560, 
					'SiteService', 'handleGetSiteImages',
					req.user);
			}
			// Get the site image
			let siteImages = await SiteStorage.getSiteImages();
			// Return
			res.json(siteImages);
			next();
		} catch (error) {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
		}
	}

	static async handleCreateSite(action, req, res, next) {
		try {
			// Check auth
			if (!Authorizations.canCreateSite(req.user)) {
				// Not Authorized!
				throw new AppAuthError(
					Authorizations.ACTION_CREATE,
					Constants.ENTITY_SITE,
					null,
					560, 
					'SiteService', 'handleCreateSite',
					req.user);
			}
			// Filter
			let filteredRequest = SiteSecurity.filterSiteCreateRequest( req.body, req.user );
			// Check Company
			let company = await CompanyStorage.getCompany(filteredRequest.companyID);
			// Check Mandatory fields
			Site.checkIfSiteValid(filteredRequest, req);
			// Found?
			if (!company) {
				// Not Found!
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The Company ID '${filteredRequest.companyID}' does not exist`, 550, 
					'SiteService', 'handleCreateSite', req.user);
			}
			// Create site
			let site = new Site(filteredRequest);
			// Update timestamp
			site.setCreatedBy(new User({'id': req.user.id}));
			site.setCreatedOn(new Date());
			// Get the users
			let users = [];
			for (const userID of filteredRequest.userIDs) {
				// Get User
				let user = await UserStorage.getUser(userID);
				// Add
				users.push(user);
			}
			// Set Users
			site.setUsers(users);
			// Save Site
			let newSite = await site.save();
			// Save Site's Image
			newSite.setImage(site.getImage());
			// Save
			await newSite.saveImage();
			// Log
			Logging.logSecurityInfo({
				user: req.user, module: 'SiteService', method: 'handleCreateSite',
				message: `Site '${newSite.getName()}' has been created successfully`,
				action: action, detailedMessages: newSite});
			// Ok
			res.json({status: `Success`});
			next();
		} catch (error) {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
		}
	}

	static async handleUpdateSite(action, req, res, next) {
		try {
			// Filter
			let filteredRequest = SiteSecurity.filterSiteUpdateRequest( req.body, req.user );
			// Check email
			let site = await SiteStorage.getSite(filteredRequest.id);
			if (!site) {
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The Site with ID '${filteredRequest.id}' does not exist anymore`, 550, 
					'SiteService', 'handleUpdateSite', req.user);
			}
			// Check Mandatory fields
			Site.checkIfSiteValid(filteredRequest, req);
			// Check auth
			if (!Authorizations.canUpdateSite(req.user, site.getModel())) {
				// Not Authorized!
				throw new AppAuthError(
					Authorizations.ACTION_UPDATE,
					Constants.ENTITY_SITE,
					site.getID(),
					560, 
					'SiteService', 'handleUpdateSite',
					req.user);
			}
			// Update
			Database.updateSite(filteredRequest, site.getModel());
			// Update timestamp
			site.setLastChangedBy(new User({'id': req.user.id}));
			site.setLastChangedOn(new Date());
			// Update Site's Image
			await site.saveImage();
			// Get the users
			let users = [];
			for (const userID of filteredRequest.userIDs) {
				// Get User
				let user = await UserStorage.getUser(userID);
				// Add
				users.push(user);
			}
			// Set Users
			site.setUsers(users);
			// Update Site
			let updatedSite = await site.save();
			// Log
			Logging.logSecurityInfo({
				user: req.user, module: 'SiteService', method: 'handleUpdateSite',
				message: `Site '${updatedSite.getName()}' has been updated successfully`,
				action: action, detailedMessages: updatedSite});
			// Ok
			res.json({status: `Success`});
			next();
		} catch (error) {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
		}
	}
}

module.exports = SiteService;
