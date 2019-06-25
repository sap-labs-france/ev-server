import Logging from '../../../utils/Logging';
import Database from '../../../utils/Database';
import AppError from '../../../exception/AppError';
import AppAuthError from '../../../exception/AppAuthError';
import Authorizations from '../../../authorization/Authorizations';
import Constants from '../../../utils/Constants';
import Site from '../../../types/Site';
import User from '../../../entity/User';
import SiteSecurity from './security/SiteSecurity';
import UtilsService from './UtilsService';
import CompanyStorage from '../../../storage/mongodb/CompanyStorage';
import SiteStorage from '../../../storage/mongodb/SiteStorage';
import UserSecurity from "./security/UserSecurity";
import { Request, Response, NextFunction } from 'express';
import Utils from '../../../utils/Utils';

export default class SiteService {

  public static async handleAddUsersToSite(action: string, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    await UtilsService.assertComponentIsActive(
      req.user.tenantID, Constants.COMPONENTS.ORGANIZATION,
      Constants.ACTION_UPDATE, Constants.ENTITY_SITE, 'SiteService', 'handleAddUsersToSite');

    // Filter
    const filteredRequest = SiteSecurity.filterAssignSiteUsers(req.body, req.user);

    // Check auth
    if (!Authorizations.canUpdateSite(req.user)) {
      throw new AppAuthError(
        Constants.ACTION_UPDATE,
        Constants.ENTITY_SITE,
        filteredRequest.siteID,
        560,
        'SiteService', 'handleAddUsersToSite',
        req.user);
    }

    // Get the Site
    const site = await SiteStorage.getSite(req.user.tenantID, filteredRequest.siteID);
    if (!site) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `The Site with ID '${filteredRequest.siteID}' does not exist anymore`, 550,
        'SiteService', 'handleAddUsersToSite', req.user);
    }
    
    // Get Sites
    //const users = UserStorage.getUsers(req.user.tokenID, {}, Constants.MAX_DB_RECORD_COUNT, 0, null); TODO: change getUsers to accept array of userIDs so we can do only one request instead of many
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
    await SiteStorage.addUsersToSite(req.user.tenantID, filteredRequest.siteID, filteredRequest.userIDs);
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user, module: 'SiteService', method: 'handleAddUsersToSite',
      message: `Site's Users have been added successfully`, action: action
    });
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleUpdateSiteUserAdmin(action: string, req: Request, res: Response, next: NextFunction): Promise<void> {
    UtilsService.assertComponentIsActive(req.user.tenantID, 'Organization', Constants.ACTION_UPDATE,
    Constants.ENTITY_SITE, 'SiteService', 'handleUpdateSiteUsersRole');
    
    const filteredRequest = SiteSecurity.filterUpdateSiteUsersRoleRequest(req.body, req.user);
    
    // Get the Site
    const site = await SiteStorage.getSite(req.user.tenantID, filteredRequest.siteID);
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
        `Only Users with Basic role can be Site Admin`, Constants.HTTP_GENERAL_ERROR,
        'SiteService', 'handleUpdateSiteUserAdmin', req.user, filteredRequest.userID);
    }
    await SiteStorage.updateSiteUserAdmin(req.user.tenantID, filteredRequest.siteID, filteredRequest.userID, filteredRequest.siteAdmin);

    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user, module: 'SiteService', method: 'handleUpdateSiteUserAdmin',
      message: `The User '${Utils.buildUserFullName(user)}' has been ${filteredRequest.siteAdmin ? 'assigned' : 'removed'} the Site Admin role on site '${site.name}'`,
      action: action
    });
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleRemoveUsersFromSite(action: string, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    await UtilsService.assertComponentIsActive(
      req.user.tenantID, Constants.COMPONENTS.ORGANIZATION,
      Constants.ACTION_UPDATE, Constants.ENTITY_SITE, 'SiteService', 'handleRemoveUsersFromSite');

    // Filter
    const filteredRequest = SiteSecurity.filterAssignSiteUsers(req.body, req.user);

    // Get the Site
    const site = await SiteStorage.getSite(req.user.tenantID, filteredRequest.siteID);
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
    await SiteStorage.removeUsersFromSite(req.user.tenantID, filteredRequest.siteID, filteredRequest.userIDs);
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user, module: 'SiteService', method: 'handleRemoveUsersFromSite',
      message: `Site's Users have been removed successfully`, action: action
    });
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleGetUsers(action: string, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    await UtilsService.assertComponentIsActive(
      req.user.tenantID, Constants.COMPONENTS.ORGANIZATION,
      Constants.ACTION_UPDATE, Constants.ENTITY_SITE, 'SiteService', 'handleGetUsersFromSite');

    const filteredRequest = SiteSecurity.filterSiteUsersRequest(req.query);
    // Check Mandatory fields
    if (!filteredRequest.ID) {
      // Not Found!
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `The Site's ID must be provided`, Constants.HTTP_GENERAL_ERROR,
        'SiteService', 'handleGetUsersFromSite', req.user);
    }
    // Get the Site
    const site = await SiteStorage.getSite(req.user.tenantID, filteredRequest.ID);
    if (!site) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `The Site with ID '${filteredRequest.ID}' does not exist anymore`, Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
        'SiteService', 'handleGetUsersFromSite', req.user);
    }
    // Check auth
    if (!Authorizations.canUpdateSite(req.user)) {
      throw new AppAuthError(
        Constants.ACTION_UPDATE,
        Constants.ENTITY_SITE,
        site.id,
        Constants.HTTP_AUTH_ERROR,
        'SiteService', 'handleGetUsersFromSite',
        req.user);
    }

    const users = await SiteStorage.getUsers(req.user.tenantID, filteredRequest.ID,
      filteredRequest.Limit, filteredRequest.Skip, filteredRequest.Sort);

    users.result = users.result.map((user) => {
      return user.getModel();
    });
    UserSecurity.filterUsersResponse(users, req.user);
    res.json(users);
    next();
  }

  public static async handleDeleteSite(action: string, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    await UtilsService.assertComponentIsActive(
      req.user.tenantID, Constants.COMPONENTS.ORGANIZATION,
      Constants.ACTION_DELETE, Constants.ENTITY_SITE, 'SiteService', 'handleDeleteSite');

    // Filter
    const id = SiteSecurity.filterSiteDeleteRequest(req.query, req.user);
    // Check Mandatory fields
    UtilsService.assertIdIsProvided(id, 'SiteService', 'handleDeleteSite', req.user);
    
    // Get
    const site = await SiteStorage.getSite(req.user.tenantID, id);
    UtilsService.assertObjectExists(site, `Site with ID '${id}' does not exist`, 'SiteService', 'handleDeleteSite', req.user);
    
    // Delete
    await SiteStorage.deleteSite(req.user.tenantID, site.id);
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user, module: 'SiteService', method: 'handleDeleteSite',
      message: `Site '${site.name}' has been deleted successfully`,
      action: action, detailedMessages: site
    });
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleGetSite(action: string, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    await UtilsService.assertComponentIsActive(
      req.user.tenantID, Constants.COMPONENTS.ORGANIZATION,
      Constants.ACTION_READ, Constants.ENTITY_SITE, 'SiteService', 'handleGetSite');

    // Filter
    const id = SiteSecurity.filterSiteRequest(req.query);
    UtilsService.assertIdIsProvided(id, 'SiteService', 'handleGetSite', req.user);

    // Get it
    const site = await SiteStorage.getSite(req.user.tenantID, id);
    UtilsService.assertObjectExists(site, `The Site with ID '${id}' does not exist anymore`, 'SiteService', 'handleGetSite', req.user);
    
    // Return
    res.json(
      // Filter
      SiteSecurity.filterSiteResponse(
        site, req.user)
    );
    next();
  }

  public static async handleGetSites(action: string, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    await UtilsService.assertComponentIsActive(
      req.user.tenantID, Constants.COMPONENTS.ORGANIZATION,
      Constants.ACTION_LIST, Constants.ENTITY_SITES, 'SiteService', 'handleGetSites');

    
    // Filter
    const filteredRequest = SiteSecurity.filterSitesRequest(req.query, req.user);

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

    // Get the sites
    const sites = await SiteStorage.getSites(req.user.tenantID,
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

    // Filter
    SiteSecurity.filterSitesResponse(sites, req.user);
    // Return
    res.json(sites);
    next();
  }

  public static async handleGetSiteImage(action: string, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    await UtilsService.assertComponentIsActive(
      req.user.tenantID, Constants.COMPONENTS.ORGANIZATION,
      Constants.ACTION_READ, Constants.ENTITY_SITE, 'SiteService', 'handleGetSiteImage');

    // Filter
    const id = SiteSecurity.filterSiteRequest(req.query);
    UtilsService.assertIdIsProvided(id, 'SiteService', 'handleGetSiteImage', req.user);

    // Check auth
    if (!Authorizations.canReadSite(req.user, id)) {
      // Not Authorized!
      throw new AppAuthError(
        Constants.ACTION_READ,
        Constants.ENTITY_SITE,
        id,
        Constants.HTTP_AUTH_ERROR,
        'SiteService', 'handleGetSiteImage',
        req.user);
    }
    // Get it
    const site = await SiteStorage.getSite(req.user.tenantID, id);
    UtilsService.assertObjectExists(site, `Site does not exist anymore.`, 'SiteService', 'handleGetSiteImage', req.user);
    
    // Get the image
    const siteImage = await SiteStorage.getSiteImage(req.user.tenantID, id);
    // Return
    res.json(siteImage);
    next();
  }

  public static async handleCreateSite(action: string, req: Request, res: Response, next: NextFunction): Promise<void> {
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

    // Check Company
    const company = await CompanyStorage.getCompany(req.user.tenantID, filteredRequest.companyID);
    UtilsService.assertObjectExists(company, `The Company ID '${filteredRequest.companyID}' does not exist`, 'SiteService', 'handleCreateSite', req.user);
  
    // Create site
    let usr = new User(req.user.tenantID, {id: req.user.id});
    let date = new Date();
    const newSite: Site = {
      ...filteredRequest,
      createdBy: usr,
      createdOn: date,
      lastChangedBy: usr,
      lastChangedOn: date
    } as Site;
    newSite.id = await SiteStorage.saveSite(req.user.tenantID, newSite, true);
    
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user, module: 'SiteService', method: 'handleCreateSite',
      message: `Site '${newSite.name}' has been created successfully`,
      action: action, detailedMessages: newSite
    });
    // Ok
    res.json(Object.assign({ id: newSite.id }, Constants.REST_RESPONSE_SUCCESS));
    next();
  }

  public static async handleUpdateSite(action: string, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    await UtilsService.assertComponentIsActive(
      req.user.tenantID, Constants.COMPONENTS.ORGANIZATION,
      Constants.ACTION_UPDATE, Constants.ENTITY_SITE, 'SiteService', 'handleUpdateSite');

    // Filter
    const filteredRequest = SiteSecurity.filterSiteUpdateRequest(req.body, req.user);
    
    // Get Site
    let site: Site = await SiteStorage.getSite(req.user.tenantID, filteredRequest.id);
    UtilsService.assertObjectExists(site, `Site does not exist.`, 'SiteService', 'handleUpdateSite', req.user);
    
    // Check auth
    if (!Authorizations.canUpdateSite(req.user)) {
      // Not Authorized!
      throw new AppAuthError(
        Constants.ACTION_UPDATE,
        Constants.ENTITY_SITE,
        filteredRequest.id,
        Constants.HTTP_AUTH_ERROR,
        'SiteService', 'handleUpdateSite',
        req.user);
    }

    site.lastChangedBy = new User(req.user.tenantID, {'id': req.user.id});
    site.lastChangedOn = new Date();

    site.id = await SiteStorage.saveSite(req.user.tenantID, site, true);

    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user, module: 'SiteService', method: 'handleUpdateSite',
      message: `Site '${site.name}' has been updated successfully`,
      action: action, detailedMessages: site
    });
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }
}
