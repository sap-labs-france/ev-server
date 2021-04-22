import { Action, Entity } from '../../../../types/Authorization';
import { HTTPAuthError, HTTPError } from '../../../../types/HTTPError';
import { NextFunction, Request, Response } from 'express';

import AppAuthError from '../../../../exception/AppAuthError';
import AppError from '../../../../exception/AppError';
import AuthorizationService from './AuthorizationService';
import Authorizations from '../../../../authorization/Authorizations';
import Constants from '../../../../utils/Constants';
import Logging from '../../../../utils/Logging';
import { ServerAction } from '../../../../types/Server';
import Site from '../../../../types/Site';
import { SiteDataResult } from '../../../../types/DataResult';
import SiteSecurity from './security/SiteSecurity';
import SiteStorage from '../../../../storage/mongodb/SiteStorage';
import TenantComponents from '../../../../types/TenantComponents';
import Utils from '../../../../utils/Utils';
import UtilsService from './UtilsService';

const MODULE_NAME = 'SiteService';

export default class SiteService {

  public static async handleUpdateSiteUserAdmin(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ORGANIZATION,
      Action.UPDATE, Entity.SITE, MODULE_NAME, 'handleUpdateSiteUserAdmin');
    // Filter request
    const filteredRequest = SiteSecurity.filterUpdateSiteUserAdminRequest(req.body);
    // Check mandatory fields
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
    // Check and Get Site
    const site = await UtilsService.checkAndGetSiteAuthorization(
      req.tenant, req.user, filteredRequest.siteID, Action.UPDATE, action, {});
    // Check and Get User
    const user = await UtilsService.checkAndGetUserAuthorization(
      req.tenant, req.user, filteredRequest.userID, Action.READ, action, {});
    // Update
    await SiteStorage.updateSiteUserAdmin(req.user.tenantID, filteredRequest.siteID, filteredRequest.userID, filteredRequest.siteAdmin);
    // Log
    await Logging.logSecurityInfo({
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
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ORGANIZATION,
      Action.UPDATE, Entity.SITE, MODULE_NAME, 'handleUpdateSiteOwner');
    // Filter request
    const filteredRequest = SiteSecurity.filterUpdateSiteOwnerRequest(req.body);
    // Check mandatory fields
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
        module: MODULE_NAME, method: 'handleUpdateSiteOwner',
        user: req.user
      });
    }
    // Check and Get Site
    const site = await UtilsService.checkAndGetSiteAuthorization(
      req.tenant, req.user, filteredRequest.siteID, Action.UPDATE, action, {});
    // Check and Get User
    const user = await UtilsService.checkAndGetUserAuthorization(
      req.tenant, req.user, filteredRequest.userID, Action.READ, action, {});
    // Update
    await SiteStorage.updateSiteOwner(req.user.tenantID, filteredRequest.siteID, filteredRequest.userID, filteredRequest.siteOwner);
    // Log
    await Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user, actionOnUser: user,
      module: MODULE_NAME, method: 'handleUpdateSiteOwner',
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
    // Filter request
    const filteredRequest = SiteSecurity.filterAssignSiteUsers(req.body);
    // Check mandatory fields
    UtilsService.assertIdIsProvided(action, filteredRequest.siteID, MODULE_NAME, 'handleAssignUsersToSite', req.user);
    if (Utils.isEmptyArray(filteredRequest.userIDs)) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'The User\'s IDs must be provided',
        module: MODULE_NAME, method: 'handleAssignUsersToSite',
        user: req.user
      });
    }
    // Check and Get Site
    const site = await UtilsService.checkAndGetSiteAuthorization(
      req.tenant, req.user, filteredRequest.siteID, Action.UPDATE, action, {});
    // Check and Get Users
    const users = await UtilsService.checkSiteUsersAuthorization(
      req.tenant, req.user, site, filteredRequest.userIDs, action, {});
    // Save
    if (action === ServerAction.ADD_USERS_TO_SITE) {
      await SiteStorage.addUsersToSite(req.user.tenantID, site.id, users.map((user) => user.id));
    } else {
      await SiteStorage.removeUsersFromSite(req.user.tenantID, site.id, users.map((user) => user.id));
    }
    // Log
    await Logging.logSecurityInfo({
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
      Action.UPDATE, Entity.SITE, MODULE_NAME, 'handleGetUsers');
    // Filter
    const filteredRequest = SiteSecurity.filterSiteUsersRequest(req.query);
    UtilsService.assertIdIsProvided(action, filteredRequest.SiteID, MODULE_NAME, 'handleGetUsers', req.user);
    // Check Site - is this needed? it works without.
    try {
      await UtilsService.checkAndGetSiteAuthorization(
        req.tenant, req.user, filteredRequest.SiteID, Action.READ, action, {}, true);
    } catch (error) {
      UtilsService.sendEmptyDataResult(res, next);
      return;
    }
    // Check dynamic auth for reading Users
    const authorizationSiteUsersFilter = await AuthorizationService.checkAndGetSiteUsersAuthorizationFilters(
      req.tenant, req.user, filteredRequest);
    if (!authorizationSiteUsersFilter.authorized) {
      UtilsService.sendEmptyDataResult(res, next);
      return;
    }
    // Get users
    const users = await SiteStorage.getSiteUsers(req.user.tenantID,
      {
        search: filteredRequest.Search,
        siteIDs: [ filteredRequest.SiteID ],
        ...authorizationSiteUsersFilter.filters
      },
      {
        limit: filteredRequest.Limit,
        skip: filteredRequest.Skip,
        sort: filteredRequest.SortFields,
        onlyRecordCount: filteredRequest.OnlyRecordCount
      },
      authorizationSiteUsersFilter.projectFields
    );
    res.json(users);
    next();
  }

  public static async handleDeleteSite(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ORGANIZATION,
      Action.DELETE, Entity.SITE, MODULE_NAME, 'handleDeleteSite');
    // Filter request
    const siteID = SiteSecurity.filterSiteRequestByID(req.query);
    UtilsService.assertIdIsProvided(action, siteID, MODULE_NAME, 'handleDeleteSite', req.user);
    // Check and Get Site
    const site = await UtilsService.checkAndGetSiteAuthorization(
      req.tenant, req.user, siteID, Action.DELETE, action, {});
    // Delete
    await SiteStorage.deleteSite(req.user.tenantID, site.id);
    // Log
    await Logging.logSecurityInfo({
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
    // Filter request
    const filteredRequest = SiteSecurity.filterSiteRequest(req.query);
    UtilsService.assertIdIsProvided(action, filteredRequest.ID, MODULE_NAME, 'handleGetSite', req.user);
    // Check and Get Site
    const site = await UtilsService.checkAndGetSiteAuthorization(
      req.tenant, req.user, filteredRequest.ID, Action.READ, action, {
        withCompany: filteredRequest.WithCompany,
        withImage: true,
      }, true);
    // Return
    res.json(site);
    next();
  }

  public static async handleGetSites(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ORGANIZATION,
      Action.LIST, Entity.SITES, MODULE_NAME, 'handleGetSites');
    // Filter request
    const filteredRequest = SiteSecurity.filterSitesRequest(req.query);
    // Check dynamic auth
    const authorizationSitesFilter = await AuthorizationService.checkAndGetSitesAuthorizationFilters(
      req.tenant, req.user, filteredRequest);
    if (!authorizationSitesFilter.authorized) {
      UtilsService.sendEmptyDataResult(res, next);
      return;
    }
    // Get the sites
    const sites = await SiteStorage.getSites(req.user.tenantID,
      {
        search: filteredRequest.Search,
        userID: filteredRequest.UserID,
        issuer: filteredRequest.Issuer,
        companyIDs: filteredRequest.CompanyID ? filteredRequest.CompanyID.split('|') : null,
        siteIDs: filteredRequest.SiteID ? filteredRequest.SiteID.split('|') : null,
        withCompany: filteredRequest.WithCompany,
        excludeSitesOfUserID: filteredRequest.ExcludeSitesOfUserID,
        withAvailableChargingStations: filteredRequest.WithAvailableChargers,
        locCoordinates: filteredRequest.LocCoordinates,
        locMaxDistanceMeters: filteredRequest.LocMaxDistanceMeters,
        ...authorizationSitesFilter.filters
      },
      {
        limit: filteredRequest.Limit,
        skip: filteredRequest.Skip,
        sort: filteredRequest.SortFields,
        onlyRecordCount: filteredRequest.OnlyRecordCount
      },
      authorizationSitesFilter.projectFields
    );
    // Add Auth flags
    await AuthorizationService.addSitesAuthorizations(req.tenant, req.user, sites as SiteDataResult, authorizationSitesFilter, filteredRequest);
    // Return
    res.json(sites);
    next();
  }

  public static async handleGetSiteImage(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // This endpoint is not protected, so no need to check user's access
    // Filter
    const filteredRequest = SiteSecurity.filterSiteImageRequest(req.query);
    UtilsService.assertIdIsProvided(action, filteredRequest.ID, MODULE_NAME, 'handleGetSiteImage', req.user);
    if (!filteredRequest.TenantID) {
      // Object does not exist
      throw new AppError({
        action,
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'The ID must be provided',
        module: MODULE_NAME, method: 'handleGetSiteImage',
      });
    }
    // Get
    const site = await SiteStorage.getSite(filteredRequest.TenantID, filteredRequest.ID);
    UtilsService.assertObjectExists(action, site, `Site ID '${filteredRequest.ID}' does not exist`,
      MODULE_NAME, 'handleDeleteSite', req.user);
    // Get the image
    const siteImage = await SiteStorage.getSiteImage(filteredRequest.TenantID, filteredRequest.ID);
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
    // Check static auth
    if (!await Authorizations.canCreateSite(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.CREATE, entity: Entity.SITE,
        module: MODULE_NAME, method: 'handleCreateSite'
      });
    }
    // Filter request
    const filteredRequest = SiteSecurity.filterSiteCreateRequest(req.body);
    // Check data is valid
    UtilsService.checkIfSiteValid(filteredRequest, req);
    // Check and Get Company
    await UtilsService.checkAndGetCompanyAuthorization(
      req.tenant, req.user, filteredRequest.companyID, Action.READ, action, {});
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
    await Logging.logSecurityInfo({
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
    // Filter request
    const filteredRequest = SiteSecurity.filterSiteUpdateRequest(req.body);
    UtilsService.assertIdIsProvided(action, filteredRequest.id, MODULE_NAME, 'handleUpdateSite', req.user);
    // Check data is valid
    UtilsService.checkIfSiteValid(filteredRequest, req);
    // Check and Get Company
    await UtilsService.checkAndGetCompanyAuthorization(
      req.tenant, req.user, filteredRequest.companyID, Action.READ, action, {});
    // Check and Get Site
    const site = await UtilsService.checkAndGetSiteAuthorization(
      req.tenant, req.user, filteredRequest.id, Action.UPDATE, action, {});
    // Update
    site.name = filteredRequest.name;
    site.companyID = filteredRequest.companyID;
    if (Utils.objectHasProperty(filteredRequest, 'public')) {
      site.public = filteredRequest.public;
    }
    if (Utils.objectHasProperty(filteredRequest, 'autoUserSiteAssignment')) {
      site.autoUserSiteAssignment = filteredRequest.autoUserSiteAssignment;
    }
    if (Utils.objectHasProperty(filteredRequest, 'address')) {
      site.address = filteredRequest.address;
    }
    if (Utils.objectHasProperty(filteredRequest, 'image')) {
      site.image = filteredRequest.image;
    }
    site.lastChangedBy = { 'id': req.user.id };
    site.lastChangedOn = new Date();
    // Save
    await SiteStorage.saveSite(req.user.tenantID, site, Utils.objectHasProperty(filteredRequest, 'image') ? true : false);
    // Log
    await Logging.logSecurityInfo({
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
