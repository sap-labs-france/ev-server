import AppAuthError from '../../../exception/AppAuthError';
import AppError from '../../../exception/AppError';
import Authorizations from '../../../authorization/Authorizations';
import CompanyStorage from '../../../storage/mongodb/CompanyStorage';
import Constants from '../../../utils/Constants';
import Database from '../../../utils/Database';
import Logging from '../../../utils/Logging';
import Site from '../../../entity/Site';
import SiteSecurity from './security/SiteSecurity';
import SiteStorage from '../../../storage/mongodb/SiteStorage';
import User from '../../../entity/User';
import UserSecurity from './security/UserSecurity';
import Utils from '../../../utils/Utils';
import UtilsService from './UtilsService';

export default class SiteService {
  static async handleAddUsersToSite(action, req, res, next) {
    try {
      // Check if component is active
      await UtilsService.assertComponentIsActive(
        req.user.tenantID, Constants.COMPONENTS.ORGANIZATION,
        Constants.ACTION_UPDATE, Constants.ENTITY_SITE, 'SiteService', 'handleAddUsersToSite');

      // Filter
      const filteredRequest = SiteSecurity.filterAddUsersToSiteRequest(req.body, req.user);
      // Check Mandatory fields
      if (!filteredRequest.siteID) {
        // Not Found!
        throw new AppError(
          Constants.CENTRAL_SERVER,
          'The Site\'s ID must be provided', Constants.HTTP_GENERAL_ERROR,
          'SiteService', 'handleAddUsersToSite', req.user);
      }
      if (!filteredRequest.userIDs || (filteredRequest.userIDs && filteredRequest.userIDs.length <= 0)) {
        // Not Found!
        throw new AppError(
          Constants.CENTRAL_SERVER,
          'The User\'s IDs must be provided', Constants.HTTP_GENERAL_ERROR,
          'SiteService', 'handleAddUsersToSite', req.user);
      }
      // Get the Site
      const site = await Site.getSite(req.user.tenantID, filteredRequest.siteID);
      if (!site) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `The Site with ID '${filteredRequest.siteID}' does not exist anymore`, Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
          'SiteService', 'handleAddUsersToSite', req.user);
      }
      // Check auth
      if (!Authorizations.canUpdateSite(req.user, site.getModel())) {
        throw new AppAuthError(
          Constants.ACTION_UPDATE,
          Constants.ENTITY_SITE,
          site.getID(),
          Constants.HTTP_AUTH_ERROR,
          'SiteService', 'handleAddUsersToSite',
          req.user);
      }
      // Get Sites
      for (const userID of filteredRequest.userIDs) {
        // Check the user
        const user = await User.getUser(req.user.tenantID, userID);
        if (!user) {
          throw new AppError(
            Constants.CENTRAL_SERVER,
            `The User with ID '${userID}' does not exist anymore`, Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
            'SiteService', 'handleAddUsersToSite', req.user);
        }
        // Check auth
        if (!Authorizations.canUpdateUser(req.user, userID)) {
          throw new AppAuthError(
            Constants.ACTION_UPDATE,
            Constants.ENTITY_USER,
            userID,
            Constants.HTTP_AUTH_ERROR,
            'SiteService', 'handleAddUsersToSite',
            req.user, user);
        }
      }
      // Save
      await Site.addUsersToSite(req.user.tenantID, filteredRequest.siteID, filteredRequest.userIDs);
      // Log
      Logging.logSecurityInfo({
        tenantID: req.user.tenantID,
        user: req.user, module: 'SiteService', method: 'handleAddUsersToSite',
        message: 'Site\'s Users have been added successfully', action: action
      });
      // Ok
      res.json(Constants.REST_RESPONSE_SUCCESS);
      next();
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }

  static async handleUpdateSiteUserAdmin(action, req, res, next) {
    try {
      // Check if component is active
      await UtilsService.assertComponentIsActive(
        req.user.tenantID, Constants.COMPONENTS.ORGANIZATION,
        Constants.ACTION_UPDATE, Constants.ENTITY_SITE, 'SiteService', 'handleUpdateSiteUserAdmin');
      // Filter
      const filteredRequest = SiteSecurity.filterUpdateSiteUserRoleRequest(req.body);
      // Check
      if (!filteredRequest.userID) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          'The User ID must be provided', Constants.HTTP_GENERAL_ERROR,
          'SiteService', 'handleUpdateSiteUserAdmin', req.user);
      }
      if (!filteredRequest.siteID) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          'The Site ID must be provided', Constants.HTTP_GENERAL_ERROR,
          'SiteService', 'handleUpdateSiteUserAdmin', req.user, filteredRequest.userID);
      }
      if (!('siteAdmin' in filteredRequest)) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          'The Site Admin value must be provided', Constants.HTTP_GENERAL_ERROR,
          'SiteService', 'handleUpdateSiteUserAdmin', req.user, filteredRequest.userID);
      }
      if (req.user.id === filteredRequest.userID) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          'Cannot change the site Admin on the logged user', Constants.HTTP_GENERAL_ERROR,
          'SiteService', 'handleUpdateSiteUserAdmin', req.user, filteredRequest.userID);
      }
      if (!Authorizations.canUpdateSite(req.user, filteredRequest.siteID)) {
        throw new AppAuthError(
          Constants.ACTION_UPDATE,
          Constants.ENTITY_SITE,
          filteredRequest.siteID,
          Constants.HTTP_AUTH_ERROR,
          'SiteService', 'handleUpdateSiteUserAdmin',
          req.user, filteredRequest.userID);
      }
      if (!Authorizations.canUpdateUser(req.user, filteredRequest.userID)) {
        throw new AppAuthError(
          Constants.ACTION_UPDATE,
          Constants.ENTITY_USER,
          filteredRequest.userID,
          Constants.HTTP_AUTH_ERROR,
          'SiteService', 'handleUpdateSiteUserAdmin',
          req.user, filteredRequest.userID);
      }
      // Get the Site
      const site = await Site.getSite(req.user.tenantID, filteredRequest.siteID);
      if (!site) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `The Site with ID '${filteredRequest.siteID}' does not exist anymore`, Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
          'SiteService', 'handleUpdateSiteUserAdmin', req.user, filteredRequest.userID);
      }
      // Get the User
      const user = await User.getUser(req.user.tenantID, filteredRequest.userID);
      if (!user) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `The User with ID '${filteredRequest.userID}' does not exist anymore`, Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
          'SiteService', 'handleUpdateSiteUserAdmin', req.user, filteredRequest.userID);
      }
      // Check user
      if (!Authorizations.isBasic(user.getRole())) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          'Only Users with Basic role can be Site Admin', Constants.HTTP_GENERAL_ERROR,
          'SiteService', 'handleUpdateSiteUserAdmin', req.user, filteredRequest.userID);
      }
      await Site.updateSiteUserAdmin(req.user.tenantID, filteredRequest.siteID, filteredRequest.userID, filteredRequest.siteAdmin);
      // Log
      Logging.logSecurityInfo({
        tenantID: req.user.tenantID,
        user: req.user, module: 'SiteService', method: 'handleUpdateSiteUserAdmin',
        message: `The User '${Utils.buildUserFullName(user)}' has been ${filteredRequest.siteAdmin ? 'assigned' : 'removed'} the Site Admin role on site '${site.getName()}'`,
        action: action
      });
      // Ok
      res.json(Constants.REST_RESPONSE_SUCCESS);
      next();
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }

  static async handleRemoveUsersFromSite(action, req, res, next) {
    try {
      // Check if component is active
      await UtilsService.assertComponentIsActive(
        req.user.tenantID, Constants.COMPONENTS.ORGANIZATION,
        Constants.ACTION_UPDATE, Constants.ENTITY_SITE, 'SiteService', 'handleRemoveUsersFromSite');

      // Filter
      const filteredRequest = SiteSecurity.filterRemoveUsersFromSiteRequest(req.body, req.user);
      // Check Mandatory fields
      if (!filteredRequest.siteID) {
        // Not Found!
        throw new AppError(
          Constants.CENTRAL_SERVER,
          'The Site\'s ID must be provided', Constants.HTTP_GENERAL_ERROR,
          'SiteService', 'handleRemoveUsersFromSite', req.user);
      }
      if (!filteredRequest.userIDs || (filteredRequest.userIDs && filteredRequest.userIDs.length <= 0)) {
        // Not Found!
        throw new AppError(
          Constants.CENTRAL_SERVER,
          'The Site\'s IDs must be provided', Constants.HTTP_GENERAL_ERROR,
          'SiteService', 'handleRemoveUsersFromSite', req.user);
      }
      if (!Authorizations.canUpdateSite(req.user, filteredRequest.siteID)) {
        throw new AppAuthError(
          Constants.ACTION_UPDATE,
          Constants.ENTITY_SITE,
          filteredRequest.siteID,
          Constants.HTTP_AUTH_ERROR,
          'SiteService', 'handleRemoveUsersFromSite',
          req.user);
      }
      // Get the Site
      const site = await Site.getSite(req.user.tenantID, filteredRequest.siteID);
      if (!site) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `The Site with ID '${filteredRequest.siteID}' does not exist anymore`, Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
          'SiteService', 'handleRemoveUsersFromSite', req.user);
      }
      // Get Users
      for (const userID of filteredRequest.userIDs) {
        // Check the user
        const user = await User.getUser(req.user.tenantID, userID);
        if (!user) {
          throw new AppError(
            Constants.CENTRAL_SERVER,
            `The User with ID '${userID}' does not exist anymore`, Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
            'SiteService', 'handleRemoveUsersFromSite', req.user);
        }
        // Check auth
        if (!Authorizations.canUpdateUser(req.user, userID)) {
          throw new AppAuthError(
            Constants.ACTION_UPDATE,
            Constants.ENTITY_USER,
            userID,
            Constants.HTTP_AUTH_ERROR,
            'SiteService', 'handleRemoveUsersFromSite',
            req.user, user);
        }
      }
      // Save
      await Site.removeUsersFromSite(req.user.tenantID, filteredRequest.siteID, filteredRequest.userIDs);
      // Log
      Logging.logSecurityInfo({
        tenantID: req.user.tenantID,
        user: req.user, module: 'SiteService', method: 'handleRemoveUsersFromSite',
        message: 'Site\'s Users have been removed successfully', action: action
      });
      // Ok
      res.json(Constants.REST_RESPONSE_SUCCESS);
      next();
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }

  static async handleGetUsers(action, req, res, next) {
    try {
      // Check if component is active
      await UtilsService.assertComponentIsActive(
        req.user.tenantID, Constants.COMPONENTS.ORGANIZATION,
        Constants.ACTION_UPDATE, Constants.ENTITY_SITE, 'SiteService', 'handleGetUsersFromSite');

      const filteredRequest = SiteSecurity.filterSiteUsersRequest(req.query);
      // Check Mandatory fields
      if (!filteredRequest.siteID) {
        // Not Found!
        throw new AppError(
          Constants.CENTRAL_SERVER,
          'The Site\'s ID must be provided', Constants.HTTP_GENERAL_ERROR,
          'SiteService', 'handleGetUsersFromSite', req.user);
      }
      // Get the Site
      const site = await Site.getSite(req.user.tenantID, filteredRequest.siteID);
      if (!site) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `The Site with ID '${filteredRequest.siteID}' does not exist anymore`, Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
          'SiteService', 'handleGetUsersFromSite', req.user);
      }
      // Check auth
      if (!Authorizations.canUpdateSite(req.user, site.getModel())) {
        throw new AppAuthError(
          Constants.ACTION_UPDATE,
          Constants.ENTITY_SITE,
          site.getID(),
          Constants.HTTP_AUTH_ERROR,
          'SiteService', 'handleGetUsersFromSite',
          req.user);
      }

      const users = await Site.getUsers(req.user.tenantID, filteredRequest.siteID,
        filteredRequest.Limit, filteredRequest.Skip, filteredRequest.Sort);

      users.result = users.result.map((user) => {
        return user.getModel();
      });
      UserSecurity.filterUsersResponse(users, req.user);
      res.json(users);
      next();
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }

  static async handleDeleteSite(action, req, res, next) {
    try {
      // Check if component is active
      await UtilsService.assertComponentIsActive(
        req.user.tenantID, Constants.COMPONENTS.ORGANIZATION,
        Constants.ACTION_DELETE, Constants.ENTITY_SITE, 'SiteService', 'handleDeleteSite');

      // Filter
      const filteredRequest = SiteSecurity.filterSiteDeleteRequest(req.query, req.user);
      // Check Mandatory fields
      if (!filteredRequest.ID) {
        // Not Found!
        throw new AppError(
          Constants.CENTRAL_SERVER,
          'The Site\'s ID must be provided', Constants.HTTP_GENERAL_ERROR,
          'SiteService', 'handleDeleteSite', req.user);
      }
      // Check auth
      if (!Authorizations.canDeleteSite(req.user, filteredRequest.ID)) {
        throw new AppAuthError(
          Constants.ACTION_DELETE,
          Constants.ENTITY_SITE,
          filteredRequest.ID,
          Constants.HTTP_AUTH_ERROR,
          'SiteService', 'handleDeleteSite',
          req.user);
      }
      // Get
      const site = await Site.getSite(req.user.tenantID, filteredRequest.ID);
      if (!site) {
        // Not Found!
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `Site with ID '${filteredRequest.ID}' does not exist`, Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
          'SiteService', 'handleDeleteSite', req.user);
      }
      // Delete
      await SiteStorage.deleteSite(req.user.tenantID, site.getID()); // pragma site.delete();
      // Log
      Logging.logSecurityInfo({
        tenantID: req.user.tenantID,
        user: req.user, module: 'SiteService', method: 'handleDeleteSite',
        message: `Site '${site.getName()}' has been deleted successfully`,
        action: action, detailedMessages: site
      });
      // Ok
      res.json(Constants.REST_RESPONSE_SUCCESS);
      next();
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }

  static async handleGetSite(action, req, res, next) {
    try {
      // Check if component is active
      await UtilsService.assertComponentIsActive(
        req.user.tenantID, Constants.COMPONENTS.ORGANIZATION,
        Constants.ACTION_READ, Constants.ENTITY_SITE, 'SiteService', 'handleGetSite');

      // Filter
      const filteredRequest = SiteSecurity.filterSiteRequest(req.query, req.user);
      // Charge Box is mandatory
      if (!filteredRequest.ID) {
        // Not Found!
        throw new AppError(
          Constants.CENTRAL_SERVER,
          'The Site\'s ID must be provided', Constants.HTTP_GENERAL_ERROR,
          'SiteService', 'handleGetSite', req.user);
      }
      // Get it
      const site = await Site.getSite(req.user.tenantID, filteredRequest.ID);
      if (!site) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `The Site with ID '${filteredRequest.ID}' does not exist anymore`, Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
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
      // Check if component is active
      await UtilsService.assertComponentIsActive(
        req.user.tenantID, Constants.COMPONENTS.ORGANIZATION,
        Constants.ACTION_LIST, Constants.ENTITY_SITES, 'SiteService', 'handleGetSites');

      // Check auth
      if (!Authorizations.canListSites(req.user)) {
        // Not Authorized!
        throw new AppAuthError(
          Constants.ACTION_LIST,
          Constants.ENTITY_SITES,
          null,
          Constants.HTTP_AUTH_ERROR,
          'SiteService', 'handleGetSites',
          req.user);
      }
      // Filter
      const filteredRequest = SiteSecurity.filterSitesRequest(req.query, req.user);
      // Get the sites
      const sites = await Site.getSites(req.user.tenantID,
        {
          'search': filteredRequest.Search,
          'userID': filteredRequest.UserID,
          'companyID': filteredRequest.CompanyID,
          'siteIDs': Authorizations.getAuthorizedEntityIDsFromLoggedUser(Constants.ENTITY_SITE, req.user),
          'withCompany': filteredRequest.WithCompany,
          'excludeSitesOfUserID': filteredRequest.ExcludeSitesOfUserID,
          'withAvailableChargers': filteredRequest.WithAvailableChargers,
          'onlyRecordCount': filteredRequest.OnlyRecordCount
        },
        filteredRequest.Limit, filteredRequest.Skip, filteredRequest.Sort);
      // Set
      sites.result = sites.result.map((site) => {
        return site.getModel();
      });
      // Filter
      SiteSecurity.filterSitesResponse(sites, req.user);
      // Return
      res.json(sites);
      next();
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }

  static async handleGetSiteImage(action, req, res, next) {
    try {
      // Check if component is active
      await UtilsService.assertComponentIsActive(
        req.user.tenantID, Constants.COMPONENTS.ORGANIZATION,
        Constants.ACTION_READ, Constants.ENTITY_SITE, 'SiteService', 'handleGetSiteImage');

      // Filter
      const filteredRequest = SiteSecurity.filterSiteRequest(req.query, req.user);
      // Charge Box is mandatory
      if (!filteredRequest.ID) {
        // Not Found!
        throw new AppError(
          Constants.CENTRAL_SERVER,
          'The Site\'s ID must be provided', Constants.HTTP_GENERAL_ERROR,
          'SiteService', 'handleGetSiteImage', req.user);
      }
      // Check auth
      if (!Authorizations.canReadSite(req.user, filteredRequest.ID)) {
        // Not Authorized!
        throw new AppAuthError(
          Constants.ACTION_READ,
          Constants.ENTITY_SITE,
          filteredRequest.ID,
          Constants.HTTP_AUTH_ERROR,
          'SiteService', 'handleGetSiteImage',
          req.user);
      }
      // Get it
      const site = await Site.getSite(req.user.tenantID, filteredRequest.ID);
      if (!site) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `The Site with ID '${filteredRequest.ID}' does not exist anymore`, Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
          'SiteService', 'handleGetSite', req.user);
      }
      // Get the image
      const siteImage = await Site.getSiteImage(req.user.tenantID, filteredRequest.ID);
      // Return
      res.json(siteImage);
      next();
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }

  static async handleCreateSite(action, req, res, next) {
    try {
      // Check if component is active
      await UtilsService.assertComponentIsActive(
        req.user.tenantID, Constants.COMPONENTS.ORGANIZATION,
        Constants.ACTION_CREATE, Constants.ENTITY_SITE, 'SiteService', 'handleCreateSite');

      // Check auth
      if (!Authorizations.canCreateSite(req.user)) {
        // Not Authorized!
        throw new AppAuthError(
          Constants.ACTION_CREATE,
          Constants.ENTITY_SITE,
          null,
          Constants.HTTP_AUTH_ERROR,
          'SiteService', 'handleCreateSite',
          req.user);
      }
      // Filter
      const filteredRequest = SiteSecurity.filterSiteCreateRequest(req.body, req.user);
      // Check Mandatory fields
      Site.checkIfSiteValid(filteredRequest, req);
      // Check Company
      const company = await CompanyStorage.getCompany(req.user.tenantID, filteredRequest.companyID);
      if (!company) {
        // Not Found!
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `The Company ID '${filteredRequest.companyID}' does not exist`, Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
          'SiteService', 'handleCreateSite', req.user);
      }
      // Create site
      const site = new Site(req.user.tenantID, filteredRequest);
      // Update timestamp
      site.setCreatedBy(new User(req.user.tenantID, { 'id': req.user.id }));
      site.setCreatedOn(new Date());
      // Get the users
      const users = [];
      if (filteredRequest.userIDs) {
        for (const userID of filteredRequest.userIDs) {
          // Get User
          const user = await User.getUser(req.user.tenantID, userID);
          // Add
          users.push(user);
        }
      }
      // Set Users
      site.setUsers(users);
      // Save Site
      const newSite = await site.save();
      // Save Site's Image
      newSite.setImage(site.getImage());
      // Save
      await newSite.saveImage();
      // Log
      Logging.logSecurityInfo({
        tenantID: req.user.tenantID,
        user: req.user, module: 'SiteService', method: 'handleCreateSite',
        message: `Site '${newSite.getName()}' has been created successfully`,
        action: action, detailedMessages: newSite
      });
      // Ok
      res.json(Object.assign({ id: newSite.getID() }, Constants.REST_RESPONSE_SUCCESS));
      next();
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }

  static async handleUpdateSite(action, req, res, next) {
    try {
      // Check if component is active
      await UtilsService.assertComponentIsActive(
        req.user.tenantID, Constants.COMPONENTS.ORGANIZATION,
        Constants.ACTION_UPDATE, Constants.ENTITY_SITE, 'SiteService', 'handleUpdateSite');

      // Filter
      const filteredRequest = SiteSecurity.filterSiteUpdateRequest(req.body, req.user);
      // Get Site
      const site = await Site.getSite(req.user.tenantID, filteredRequest.id);
      if (!site) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `The Site with ID '${filteredRequest.id}' does not exist anymore`, Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
          'SiteService', 'handleUpdateSite', req.user);
      }
      // Check Mandatory fields
      Site.checkIfSiteValid(filteredRequest, req);
      // Check auth
      if (!Authorizations.canUpdateSite(req.user, site.getModel())) {
        // Not Authorized!
        throw new AppAuthError(
          Constants.ACTION_UPDATE,
          Constants.ENTITY_SITE,
          site.getID(),
          Constants.HTTP_AUTH_ERROR,
          'SiteService', 'handleUpdateSite',
          req.user);
      }
      // Update
      Database.updateSite(filteredRequest, site.getModel());
      // Update timestamp
      site.setLastChangedBy(new User(req.user.tenantID, { 'id': req.user.id }));
      site.setLastChangedOn(new Date());
      // Update Site's Image
      await site.saveImage();
      // TODO: logic to be removed when old dashboard is not supported anymore - kept for compatibility reason
      if (filteredRequest.hasOwnProperty('userIDs')) {
        // Get the users
        const users = [];
        if (filteredRequest.userIDs) {
          for (const userID of filteredRequest.userIDs) {
            // Get User
            const user = await User.getUser(req.user.tenantID, userID);
            if (user) {
              // Add
              users.push(user);
            }
          }
        }
        // Set Users
        site.setUsers(users);
      }
      // Update Site
      const updatedSite = await site.save();
      // Log
      Logging.logSecurityInfo({
        tenantID: req.user.tenantID,
        user: req.user, module: 'SiteService', method: 'handleUpdateSite',
        message: `Site '${updatedSite.getName()}' has been updated successfully`,
        action: action, detailedMessages: updatedSite
      });
      // Ok
      res.json(Constants.REST_RESPONSE_SUCCESS);
      next();
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }
}
