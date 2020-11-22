import { Action, Entity } from '../../../../types/Authorization';
import { HTTPAuthError, HTTPError } from '../../../../types/HTTPError';
import { NextFunction, Request, Response } from 'express';

import AppAuthError from '../../../../exception/AppAuthError';
import AppError from '../../../../exception/AppError';
import Authorizations from '../../../../authorization/Authorizations';
import CompanyStorage from '../../../../storage/mongodb/CompanyStorage';
import Constants from '../../../../utils/Constants';
import Logging from '../../../../utils/Logging';
import { ServerAction } from '../../../../types/Server';
import Site from '../../../../types/Site';
import SiteSecurity from './security/SiteSecurity';
import SiteStorage from '../../../../storage/mongodb/SiteStorage';
import TenantComponents from '../../../../types/TenantComponents';
import UserSecurity from './security/UserSecurity';
import UserStorage from '../../../../storage/mongodb/UserStorage';
import Utils from '../../../../utils/Utils';
import UtilsService from './UtilsService';

const MODULE_NAME = 'SiteService';

export default class SiteService {

  public static async handleUpdateSiteUserAdmin(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ORGANIZATION,
      Action.UPDATE, Entity.SITE, MODULE_NAME, 'handleUpdateSiteUserAdmin');
    // Filter
    const filteredRequest = SiteSecurity.filterUpdateSiteUserAdminRequest(req.body);
    // Check
    if (!filteredRequest.userID) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'The User ID must be provided',
        module: MODULE_NAME, method: 'handleUpdateSiteUserAdmin',
        user: req.user
      });
    }
    if (!filteredRequest.siteID) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'The Site ID must be provided',
        module: MODULE_NAME, method: 'handleUpdateSiteUserAdmin',
        user: req.user
      });
    }
    if (!Utils.objectHasProperty(filteredRequest, 'siteAdmin')) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'The Site Admin value must be provided',
        module: MODULE_NAME, method: 'handleUpdateSiteUserAdmin',
        user: req.user
      });
    }
    if (req.user.id === filteredRequest.userID) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Cannot change the site Admin on the logged user',
        module: MODULE_NAME, method: 'handleUpdateSiteUserAdmin',
        user: req.user,
        actionOnUser: filteredRequest.userID
      });
    }
    if (!Authorizations.canUpdateSite(req.user, filteredRequest.siteID)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.UPDATE, entity: Entity.SITE,
        module: MODULE_NAME, method: 'handleUpdateSiteUserAdmin',
        value: filteredRequest.siteID
      });
    }
    // Get the Site
    const site = await SiteStorage.getSite(req.user.tenantID, filteredRequest.siteID);
    UtilsService.assertObjectExists(action, site, `Site with ID '${filteredRequest.siteID}' does not exist`,
      MODULE_NAME, 'handleUpdateSiteUserAdmin', req.user);
    // Get the User
    const user = await UserStorage.getUser(req.user.tenantID, filteredRequest.userID);
    UtilsService.assertObjectExists(action, user, `User with ID '${filteredRequest.userID}' does not exist`,
      MODULE_NAME, 'handleUpdateSiteUserAdmin', req.user);
    // Check user
    if (!Authorizations.isBasic(user)) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Only Users with Basic role can be Site Admin',
        module: MODULE_NAME, method: 'handleUpdateSiteUserAdmin',
        user: req.user,
        actionOnUser: filteredRequest.userID
      });
    }
    // Update
    await SiteStorage.updateSiteUserAdmin(req.user.tenantID, filteredRequest.siteID, filteredRequest.userID, filteredRequest.siteAdmin);
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user, actionOnUser: user,
      module: MODULE_NAME, method: 'handleUpdateSiteUserAdmin',
      message: `The User has been ${filteredRequest.siteAdmin ? 'assigned' : 'removed'} the Site Admin role on site '${site.name}'`,
      action: action
    });
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleUpdateSiteOwner(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    if (!Authorizations.canCreateSite(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.UPDATE, entity: Entity.SITE,
        module: MODULE_NAME, method: 'handleUpdateSiteOwner'
      });
    }
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ORGANIZATION,
      Action.UPDATE, Entity.SITE, MODULE_NAME, 'handleUpdateSiteOwner');
    // Filter
    const filteredRequest = SiteSecurity.filterUpdateSiteOwnerRequest(req.body);
    // Check
    if (!filteredRequest.userID) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'The User ID must be provided',
        module: MODULE_NAME, method: 'handleUpdateSiteOwner',
        user: req.user
      });
    }
    if (!filteredRequest.siteID) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'The Site ID must be provided',
        module: MODULE_NAME, method: 'handleUpdateSiteOwner',
        user: req.user
      });
    }
    if (!Utils.objectHasProperty(filteredRequest, 'siteOwner')) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'The Site Owner value must be provided',
        module: MODULE_NAME, method: 'handleUpdateSiteUserOwner',
        user: req.user
      });
    }
    // Get the Site
    const site = await SiteStorage.getSite(req.user.tenantID, filteredRequest.siteID);
    UtilsService.assertObjectExists(action, site, `Site with ID '${filteredRequest.siteID}' does not exist`,
      MODULE_NAME, 'handleUpdateSiteUserOwner', req.user);
    // Get the User
    const user = await UserStorage.getUser(req.user.tenantID, filteredRequest.userID);
    UtilsService.assertObjectExists(action, user, `User with ID '${filteredRequest.userID}' does not exist`,
      MODULE_NAME, 'handleUpdateSiteUserOwner', req.user);
    // Update
    await SiteStorage.updateSiteOwner(req.user.tenantID, filteredRequest.siteID, filteredRequest.userID, filteredRequest.siteOwner);
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user, actionOnUser: user,
      module: MODULE_NAME, method: 'handleUpdateSiteUserOwner',
      message: `The User has been granted Site Owner on Site '${site.name}'`,
      action: action
    });
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleAssignUsersToSite(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ORGANIZATION,
      Action.UPDATE, Entity.SITE, MODULE_NAME, 'handleAssignUsersToSite');
    // Filter
    const filteredRequest = SiteSecurity.filterAssignSiteUsers(req.body);
    if (!Authorizations.canUpdateSite(req.user, filteredRequest.siteID)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.UPDATE, entity: Entity.SITE,
        module: MODULE_NAME, method: 'handleAssignUsersToSite',
        value: filteredRequest.siteID
      });
    }
    UtilsService.assertIdIsProvided(action, filteredRequest.siteID, MODULE_NAME, 'handleAssignUsersToSite', req.user);
    if (!filteredRequest.userIDs || (filteredRequest.userIDs && filteredRequest.userIDs.length <= 0)) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'The User\'s IDs must be provided',
        module: MODULE_NAME, method: 'handleAssignUsersToSite',
        user: req.user
      });
    }
    // Get the Site
    const site = await SiteStorage.getSite(req.user.tenantID, filteredRequest.siteID);
    UtilsService.assertObjectExists(action, site, `Site '${filteredRequest.siteID}' does not exist`,
      MODULE_NAME, 'handleAssignUsersToSite', req.user);
    // OCPI Site
    if (!site.issuer) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: `Site '${site.name}' with ID '${site.id}' not issued by the organization`,
        module: MODULE_NAME, method: 'handleAssignUsersToSite',
        user: req.user,
        action: action
      });
    }
    // Get Users
    for (const userID of filteredRequest.userIDs) {
      // Check the user
      const user = await UserStorage.getUser(req.user.tenantID, userID);
      UtilsService.assertObjectExists(action, user, `User '${userID}' does not exist`,
        MODULE_NAME, 'handleAssignUsersToSite', req.user);
      // Auth
      if (!Authorizations.canReadUser(req.user, userID)) {
        throw new AppAuthError({
          errorCode: HTTPAuthError.ERROR,
          user: req.user,
          action: Action.READ, entity: Entity.USER,
          module: MODULE_NAME, method: 'handleAssignUsersToSite',
          value: userID
        });
      }
      // OCPI User
      if (!user.issuer) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          errorCode: HTTPError.GENERAL_ERROR,
          message: 'User not issued by the organization',
          module: MODULE_NAME, method: 'handleAssignUsersToSite',
          user: req.user, actionOnUser: user,
          action: action
        });
      }
    }
    // Save
    if (action === ServerAction.ADD_USERS_TO_SITE) {
      await SiteStorage.addUsersToSite(req.user.tenantID, filteredRequest.siteID, filteredRequest.userIDs);
    } else {
      await SiteStorage.removeUsersFromSite(req.user.tenantID, filteredRequest.siteID, filteredRequest.userIDs);
    }
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user, module: MODULE_NAME, method: 'handleAssignUsersToSite',
      message: 'Site\'s Users have been removed successfully', action: action
    });
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleGetUsers(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ORGANIZATION,
      Action.UPDATE, Entity.SITE, MODULE_NAME, 'handleGetUsersFromSite');
    // Filter
    const filteredRequest = SiteSecurity.filterSiteUsersRequest(req.query);
    // Check Mandatory fields
    if (!filteredRequest.SiteID) {
      // Not Found!
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'The Site\'s ID must be provided',
        module: MODULE_NAME, method: 'handleGetUsersFromSite',
        user: req.user
      });
    }
    // Get the Site
    const site = await SiteStorage.getSite(req.user.tenantID, filteredRequest.SiteID);
    UtilsService.assertObjectExists(action, site, `Site with ID '${filteredRequest.SiteID}' does not exist`,
      MODULE_NAME, 'handleGetUsersFromSite', req.user);
    // Check auth
    if (!Authorizations.canUpdateSite(req.user, filteredRequest.SiteID)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.UPDATE, entity: Entity.SITE,
        module: MODULE_NAME, method: 'handleGetUsersFromSite',
        value: site.id
      });
    }
    // Get users
    const users = await SiteStorage.getSiteUsers(req.user.tenantID,
      {
        search: filteredRequest.Search,
        siteID: filteredRequest.SiteID
      },
      {
        limit: filteredRequest.Limit,
        skip: filteredRequest.Skip,
        sort: filteredRequest.Sort,
        onlyRecordCount: filteredRequest.OnlyRecordCount
      },
      [ 'user.id', 'user.name', 'user.firstName', 'user.email', 'user.role', 'siteAdmin', 'siteOwner', 'siteID' ]
    );
    res.json(users);
    next();
  }

  public static async handleDeleteSite(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ORGANIZATION,
      Action.DELETE, Entity.SITE, MODULE_NAME, 'handleDeleteSite');
    // Filter
    const siteID = SiteSecurity.filterSiteRequestByID(req.query);
    // Check Mandatory fields
    UtilsService.assertIdIsProvided(action, siteID, MODULE_NAME, 'handleDeleteSite', req.user);
    // Check
    if (!Authorizations.canDeleteSite(req.user, siteID)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.DELETE, entity: Entity.SITE,
        module: MODULE_NAME, method: 'handleDeleteSite',
        value: siteID
      });
    }
    // Get
    const site = await SiteStorage.getSite(req.user.tenantID, siteID);
    UtilsService.assertObjectExists(action, site, `Site with ID '${siteID}' does not exist`,
      MODULE_NAME, 'handleDeleteSite', req.user);
    // OCPI Site
    if (!site.issuer) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: `Site '${site.name}' with ID '${site.id}' not issued by the organization`,
        module: MODULE_NAME, method: 'handleDeleteSite',
        user: req.user,
        action: action
      });
    }
    // Delete
    await SiteStorage.deleteSite(req.user.tenantID, site.id);
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user, module: MODULE_NAME, method: 'handleDeleteSite',
      message: `Site '${site.name}' has been deleted successfully`,
      action: action,
      detailedMessages: { site }
    });
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleGetSite(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ORGANIZATION,
      Action.READ, Entity.SITE, MODULE_NAME, 'handleGetSite');
    // Filter
    const filteredRequest = SiteSecurity.filterSiteRequest(req.query);
    UtilsService.assertIdIsProvided(action, filteredRequest.ID, MODULE_NAME, 'handleGetSite', req.user);
    // Check auth
    if (!Authorizations.canReadSite(req.user, filteredRequest.ID)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.READ, entity: Entity.SITE,
        module: MODULE_NAME, method: 'handleGetSite',
        value: filteredRequest.ID
      });
    }
    // Get it
    const site = await SiteStorage.getSite(req.user.tenantID, filteredRequest.ID,
      { withCompany: filteredRequest.WithCompany },
      [ 'id', 'name', 'issuer', 'image', 'address', 'companyID', 'company.name', 'autoUserSiteAssignment', 'public' ]);
    UtilsService.assertObjectExists(action, site, `Site with ID '${filteredRequest.ID}' does not exist`,
      MODULE_NAME, 'handleGetSite', req.user);
    // Return
    res.json(site);
    next();
  }

  public static async handleGetSites(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ORGANIZATION,
      Action.LIST, Entity.SITES, MODULE_NAME, 'handleGetSites');
    // Check auth
    if (!Authorizations.canListSites(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.LIST, entity: Entity.SITES,
        module: MODULE_NAME, method: 'handleGetSites'
      });
    }
    // Filter
    const filteredRequest = SiteSecurity.filterSitesRequest(req.query);
    // Check User
    let userProject: string[] = [];
    if (Authorizations.canListUsers(req.user)) {
      userProject = [ 'createdBy.name', 'createdBy.firstName', 'lastChangedBy.name', 'lastChangedBy.firstName' ];
    }
    // Get the sites
    const sites = await SiteStorage.getSites(req.user.tenantID,
      {
        search: filteredRequest.Search,
        userID: filteredRequest.UserID,
        issuer: filteredRequest.Issuer,
        companyIDs: (filteredRequest.CompanyID ? filteredRequest.CompanyID.split('|') : null),
        siteIDs: Authorizations.getAuthorizedSiteIDs(req.user, filteredRequest.SiteID ? filteredRequest.SiteID.split('|') : null),
        withCompany: filteredRequest.WithCompany,
        excludeSitesOfUserID: filteredRequest.ExcludeSitesOfUserID,
        withAvailableChargingStations: filteredRequest.WithAvailableChargers,
        locCoordinates: filteredRequest.LocCoordinates,
        locMaxDistanceMeters: filteredRequest.LocMaxDistanceMeters,
      },
      {
        limit: filteredRequest.Limit,
        skip: filteredRequest.Skip,
        sort: filteredRequest.Sort,
        onlyRecordCount: filteredRequest.OnlyRecordCount
      },
      [
        'id', 'name', 'address', 'companyID', 'company.name', 'autoUserSiteAssignment', 'issuer',
        'autoUserSiteAssignment', 'distanceMeters', 'public', 'createdOn', 'lastChangedOn',
        ...userProject
      ]
    );
    res.json(sites);
    next();
  }

  public static async handleGetSiteImage(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = SiteSecurity.filterSiteImageRequest(req.query);
    UtilsService.assertIdIsProvided(action, filteredRequest.ID, MODULE_NAME, 'handleGetSiteImage', req.user);
    // Get the image
    const siteImage = await SiteStorage.getSiteImage(filteredRequest.TenantID, filteredRequest.ID);
    // Return
    if (siteImage?.image) {
      let header = 'image';
      let encoding: BufferEncoding = 'base64';
      // Remove encoding header
      if (siteImage.image.startsWith('data:image/')) {
        header = siteImage.image.substring(5, siteImage.image.indexOf(';'));
        encoding = siteImage.image.substring(siteImage.image.indexOf(';') + 1, siteImage.image.indexOf(',')) as BufferEncoding;
        siteImage.image = siteImage.image.substring(siteImage.image.indexOf(',') + 1);
      }
      res.setHeader('content-type', header);
      res.send(siteImage.image ? Buffer.from(siteImage.image, encoding) : null);
    } else {
      res.send(null);
    }
    next();
  }

  public static async handleCreateSite(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ORGANIZATION,
      Action.CREATE, Entity.SITE, MODULE_NAME, 'handleCreateSite');
    // Check auth
    if (!Authorizations.canCreateSite(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.CREATE, entity: Entity.SITE,
        module: MODULE_NAME, method: 'handleCreateSite'
      });
    }
    // Filter
    const filteredRequest = SiteSecurity.filterSiteCreateRequest(req.body);
    // Check
    Utils.checkIfSiteValid(filteredRequest, req);
    // Check Company
    const company = await CompanyStorage.getCompany(req.user.tenantID, filteredRequest.companyID);
    UtilsService.assertObjectExists(action, company, `Company ID '${filteredRequest.companyID}' does not exist`,
      MODULE_NAME, 'handleCreateSite', req.user);
    // OCPI Company
    if (!company.issuer) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: `Company '${company.name}' with ID '${company.id}' not issued by the organization`,
        module: MODULE_NAME, method: 'handleCreateSite',
        user: req.user,
        action: action
      });
    }
    // Create site
    const site: Site = {
      ...filteredRequest,
      issuer: true,
      createdBy: { id: req.user.id },
      createdOn: new Date()
    } as Site;
    // Save
    site.id = await SiteStorage.saveSite(req.user.tenantID, site);
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user, module: MODULE_NAME, method: 'handleCreateSite',
      message: `Site '${site.name}' has been created successfully`,
      action: action,
      detailedMessages: { site }
    });
    // Ok
    res.json(Object.assign({ id: site.id }, Constants.REST_RESPONSE_SUCCESS));
    next();
  }

  public static async handleUpdateSite(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ORGANIZATION,
      Action.UPDATE, Entity.SITE, MODULE_NAME, 'handleUpdateSite');
    // Filter
    const filteredRequest = SiteSecurity.filterSiteUpdateRequest(req.body);
    // Check auth
    if (!Authorizations.canUpdateSite(req.user, filteredRequest.id)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.UPDATE, entity: Entity.SITE,
        module: MODULE_NAME, method: 'handleUpdateSite',
        value: filteredRequest.id
      });
    }
    // Check Company
    const company = await CompanyStorage.getCompany(req.user.tenantID, filteredRequest.companyID);
    UtilsService.assertObjectExists(action, company, `Company ID '${filteredRequest.companyID}' does not exist`,
      MODULE_NAME, 'handleUpdateSite', req.user);
    // Check
    Utils.checkIfSiteValid(filteredRequest, req);
    // OCPI Company
    if (!company.issuer) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: `Company '${company.name}' with ID '${company.id}' not issued by the organization`,
        module: MODULE_NAME, method: 'handleCreateSite',
        user: req.user,
        action: action
      });
    }
    // Get Site
    const site: Site = await SiteStorage.getSite(req.user.tenantID, filteredRequest.id);
    UtilsService.assertObjectExists(action, site, `Site with ID '${filteredRequest.id}' does not exist`,
      MODULE_NAME, 'handleUpdateSite', req.user);
    // OCPI Site
    if (!company.issuer) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: `Site '${site.name}' with ID '${site.id}' not issued by the organization`,
        module: MODULE_NAME, method: 'handleUpdateSite',
        user: req.user,
        action: action
      });
    }
    // Update
    site.name = filteredRequest.name;
    site.public = filteredRequest.public;
    site.autoUserSiteAssignment = filteredRequest.autoUserSiteAssignment;
    site.companyID = filteredRequest.companyID;
    site.address = filteredRequest.address;
    site.lastChangedBy = { 'id': req.user.id };
    site.lastChangedOn = new Date();
    if (Utils.objectHasProperty(filteredRequest, 'image')) {
      site.image = filteredRequest.image;
    }
    // Save
    await SiteStorage.saveSite(req.user.tenantID, site, Utils.objectHasProperty(filteredRequest, 'image') ? true : false);
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user, module: MODULE_NAME, method: 'handleUpdateSite',
      message: `Site '${site.name}' has been updated successfully`,
      action: action,
      detailedMessages: { site }
    });
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }
}
