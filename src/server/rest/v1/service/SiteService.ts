import { Action, Entity } from '../../../../types/Authorization';
import { HTTPAuthError, HTTPError } from '../../../../types/HTTPError';
import { NextFunction, Request, Response } from 'express';

import AppAuthError from '../../../../exception/AppAuthError';
import AppError from '../../../../exception/AppError';
import AuthorizationService from './AuthorizationService';
import Authorizations from '../../../../authorization/Authorizations';
import CompanyStorage from '../../../../storage/mongodb/CompanyStorage';
import Constants from '../../../../utils/Constants';
import Logging from '../../../../utils/Logging';
import { ServerAction } from '../../../../types/Server';
import Site from '../../../../types/Site';
import { SiteDataResult } from '../../../../types/DataResult';
import SiteSecurity from './security/SiteSecurity';
import SiteStorage from '../../../../storage/mongodb/SiteStorage';
import TenantComponents from '../../../../types/TenantComponents';
import { UserRole } from '../../../../types/User';
import UserStorage from '../../../../storage/mongodb/UserStorage';
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
    // Check static auth
    if (!Authorizations.canUpdateSite(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.UPDATE, entity: Entity.SITE,
        module: MODULE_NAME, method: 'handleUpdateSiteUserAdmin',
        value: filteredRequest.siteID
      });
    }
    // Check dynamic auth for reading site
    const authorizationSiteFilters = await AuthorizationService.checkAndGetSiteAuthorizationFilters(
      req.tenant, req.user, { ID: filteredRequest.siteID });
    // Get the Site and check it exists
    const site = await SiteStorage.getSite(
      req.user.tenantID, filteredRequest.siteID, authorizationSiteFilters.filters);
    UtilsService.assertObjectExists(action, site, `Site with ID '${filteredRequest.siteID}' does not exist`,
      MODULE_NAME, 'handleUpdateSiteUserAdmin', req.user);
    // Get dynamic auth filters for reading user
    const authorizationUserFilters = await AuthorizationService.checkAndGetUserAuthorizationFilters(
      req.tenant, req.user, { ID: filteredRequest.userID });
    // Get the User and check it exists
    const user = await UserStorage.getUser(
      req.user.tenantID, filteredRequest.userID, authorizationUserFilters.filters);
    UtilsService.assertObjectExists(action, user, `User with ID '${filteredRequest.userID}' does not exist`,
      MODULE_NAME, 'handleUpdateSiteUserAdmin', req.user);
    // Check user role
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
    // check static auth
    if (!Authorizations.canCreateSite(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.UPDATE, entity: Entity.SITE,
        module: MODULE_NAME, method: 'handleUpdateSiteOwner'
      });
    }
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
        module: MODULE_NAME, method: 'handleUpdateSiteUserOwner',
        user: req.user
      });
    }
    // Check dynamic auth for reading site
    const authorizationSiteFilters = await AuthorizationService.checkAndGetSiteAuthorizationFilters(
      req.tenant, req.user, { ID: filteredRequest.siteID });
    // Get the Site and check it exists
    const site = await SiteStorage.getSite(
      req.user.tenantID, filteredRequest.siteID, authorizationSiteFilters.filters);
    UtilsService.assertObjectExists(action, site, `Site with ID '${filteredRequest.siteID}' does not exist`,
      MODULE_NAME, 'handleUpdateSiteUserOwner', req.user);
    // Get dynamic auth filters  for reading user
    const authorizationUserFilters = await AuthorizationService.checkAndGetUserAuthorizationFilters(
      req.tenant, req.user, { ID: filteredRequest.userID });
    // Get the User and check it exists
    const user = await UserStorage.getUser(
      req.user.tenantID, filteredRequest.userID, authorizationUserFilters.filters);
    UtilsService.assertObjectExists(action, user, `User with ID '${filteredRequest.userID}' does not exist`,
      MODULE_NAME, 'handleUpdateSiteUserOwner', req.user);
    // Update
    await SiteStorage.updateSiteOwner(req.user.tenantID, filteredRequest.siteID, filteredRequest.userID, filteredRequest.siteOwner);
    // Log
    await Logging.logSecurityInfo({
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
    // Check static auth
    if (action === ServerAction.ADD_USERS_TO_SITE) {
      if (!Authorizations.canAssignUsersSites(req.user)) {
        throw new AppAuthError({
          errorCode: HTTPAuthError.FORBIDDEN,
          user: req.user,
          action: Action.ASSIGN, entity: Entity.USERS_SITES,
          module: MODULE_NAME, method: 'checkAndAssignSiteUsersAuthorizationFilters'
        });
      }
    } else if (!Authorizations.canUnassignUsersSites(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.UNASSIGN, entity: Entity.USERS_SITES,
        module: MODULE_NAME, method: 'checkAndAssignSiteUsersAuthorizationFilters'
      });
    }
    // Filter request
    const filteredRequest = SiteSecurity.filterAssignSiteUsers(req.body);
    // Check mandatory fields
    UtilsService.assertIdIsProvided(action, filteredRequest.siteID, MODULE_NAME, 'handleAssignUsersToSite', req.user);
    if (!filteredRequest.userIDs || Utils.isEmptyArray(filteredRequest.userIDs)) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'The User\'s IDs must be provided',
        module: MODULE_NAME, method: 'handleAssignUsersToSite',
        user: req.user
      });
    }
    // Check static auth for read
    if (!Authorizations.canReadSite(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.UPDATE, entity: Entity.USER,
        module: MODULE_NAME, method: 'handleAssignUsersToSite',
        value: filteredRequest.siteID
      });
    }
    // Check dynamic auth for reading
    const authorizationSiteFilters = await AuthorizationService.checkAndGetSiteAuthorizationFilters(
      req.tenant, req.user, { ID: filteredRequest.siteID });
    // Get the Site & check that it exists
    const site = await SiteStorage.getSite(
      req.user.tenantID, filteredRequest.siteID, authorizationSiteFilters.filters);
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
    // Check dynamic auth for assignment
    await AuthorizationService.checkAndAssignSiteUsersAuthorizationFilters(
      req.tenant, action, req.user, filteredRequest);
    // Save
    if (action === ServerAction.ADD_USERS_TO_SITE) {
      await SiteStorage.addUsersToSite(req.user.tenantID, filteredRequest.siteID, filteredRequest.userIDs);
    } else {
      await SiteStorage.removeUsersFromSite(req.user.tenantID, filteredRequest.siteID, filteredRequest.userIDs);
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
      Action.UPDATE, Entity.SITE, MODULE_NAME, 'handleGetUsersFromSite');
    // Check auth
    if (!Authorizations.canListUsersSites(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.LIST, entity: Entity.USERS_SITES,
        module: MODULE_NAME, method: 'handleGetUsers'
      });
    }
    // Filter
    const filteredRequest = SiteSecurity.filterSiteUsersRequest(req.query);
    UtilsService.assertIdIsProvided(action, filteredRequest.SiteID, MODULE_NAME, 'handleGetUsersFromSite', req.user);
    // Check auth
    if (!Authorizations.canReadSite(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.UPDATE, entity: Entity.USER,
        module: MODULE_NAME, method: 'handleGetUsers',
        value: filteredRequest.SiteID
      });
    }
    // Check auth
    const authorizationSiteFilters = await AuthorizationService.checkAndGetSiteAuthorizationFilters(
      req.tenant, req.user, { ID: filteredRequest.SiteID });
    if (!authorizationSiteFilters.authorized) {
      UtilsService.sendEmptyDataResult(res, next);
      return;
    }
    // Get the Site
    const site = await SiteStorage.getSite(
      req.user.tenantID, filteredRequest.SiteID, authorizationSiteFilters.filters);
    if (!site) {
      UtilsService.sendEmptyDataResult(res, next);
      return;
    }
    // Check auth
    const authorizationSiteUsersFilters = await AuthorizationService.checkAndGetSiteUsersAuthorizationFilters(
      req.tenant, req.user, filteredRequest);
    if (!authorizationSiteUsersFilters.authorized) {
      UtilsService.sendEmptyDataResult(res, next);
      return;
    }
    // Get users
    const users = await SiteStorage.getSiteUsers(req.user.tenantID,
      {
        search: filteredRequest.Search,
        siteIDs: [ filteredRequest.SiteID ],
        ...authorizationSiteUsersFilters.filters
      },
      {
        limit: filteredRequest.Limit,
        skip: filteredRequest.Skip,
        sort: filteredRequest.SortFields,
        onlyRecordCount: filteredRequest.OnlyRecordCount
      },
      authorizationSiteUsersFilters.projectFields
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
    // Check Mandatory fields
    UtilsService.assertIdIsProvided(action, siteID, MODULE_NAME, 'handleDeleteSite', req.user);
    // Check static auth
    if (!Authorizations.canDeleteSite(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.DELETE, entity: Entity.SITE,
        module: MODULE_NAME, method: 'handleDeleteSite',
        value: siteID
      });
    }
    // Check dynamic auth
    const authorizationSiteFilters = await AuthorizationService.checkAndGetSiteAuthorizationFilters(
      req.tenant, req.user, { ID: siteID });
    // Get the site
    const site = await SiteStorage.getSite(req.user.tenantID, siteID, authorizationSiteFilters.filters);
    // Check that the site exists
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
    // Check static auth
    if (!Authorizations.canReadSite(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.READ, entity: Entity.SITE,
        module: MODULE_NAME, method: 'checkAndGetSiteAuthorizationFilters',
      });
    }
    // Filter request
    const filteredRequest = SiteSecurity.filterSiteRequest(req.query);
    // Check Mandatory fields
    UtilsService.assertIdIsProvided(action, filteredRequest.ID, MODULE_NAME, 'handleGetSite', req.user);
    // Check dynamic auth
    const authorizationSiteFilters = await AuthorizationService.checkAndGetSiteAuthorizationFilters(
      req.tenant, req.user, filteredRequest);
    // Get it
    const site = await SiteStorage.getSite(req.user.tenantID, filteredRequest.ID,
      {
        withCompany: filteredRequest.WithCompany,
        withImage: true,
        ...authorizationSiteFilters.filters
      },
      authorizationSiteFilters.projectFields
    );
    UtilsService.assertObjectExists(action, site, `Site with ID '${filteredRequest.ID}' does not exist`,
      MODULE_NAME, 'handleGetSite', req.user);
    // Add authorization
    const siteAdminIDs = await AuthorizationService.getSiteAdminSiteIDs(req.tenant.id, req.user);
    site.canUpdate = site.issuer && (req.user.role === UserRole.ADMIN || (Authorizations.canUpdateSite(req.user) && siteAdminIDs.includes(site.id)));
    site.canCreate = Authorizations.canCreateSite(req.user);
    // Return
    res.json(site);
    next();
  }

  public static async handleGetSites(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ORGANIZATION,
      Action.LIST, Entity.SITES, MODULE_NAME, 'handleGetSites');
    // Check static auth
    if (!Authorizations.canListSites(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.LIST, entity: Entity.SITES,
        module: MODULE_NAME, method: 'handleGetSites'
      });
    }
    // Filter request
    const filteredRequest = SiteSecurity.filterSitesRequest(req.query);
    // Check dynamic auth
    const authorizationSiteFilters = await AuthorizationService.checkAndGetSitesAuthorizationFilters(
      req.tenant, req.user, filteredRequest);
    if (!authorizationSiteFilters.authorized) {
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
        ...authorizationSiteFilters.filters
      },
      {
        limit: filteredRequest.Limit,
        skip: filteredRequest.Skip,
        sort: filteredRequest.SortFields,
        onlyRecordCount: filteredRequest.OnlyRecordCount
      },
      authorizationSiteFilters.projectFields
    );
    // Add Auth flags
    await AuthorizationService.addSitesAuthorizations(req.tenant, req.user, sites as SiteDataResult);
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
    UtilsService.assertObjectExists(action, site, `Site with ID '${filteredRequest.ID}' does not exist`,
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
    if (!Authorizations.canCreateSite(req.user)) {
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
    // Check Company exists
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
    // Check mandatory fields
    UtilsService.assertIdIsProvided(action, filteredRequest.id, MODULE_NAME, 'handleUpdateSite', req.user);
    // Check auth
    if (!Authorizations.canUpdateSite(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.UPDATE, entity: Entity.SITE,
        module: MODULE_NAME, method: 'handleUpdateSite',
        value: filteredRequest.id
      });
    }
    // Check data is valid
    UtilsService.checkIfSiteValid(filteredRequest, req);
    // Check static auth for reading company
    if (!Authorizations.canReadCompany(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.READ, entity: Entity.COMPANY,
        module: MODULE_NAME, method: 'handleUpdateSite',
        value: filteredRequest.companyID
      });
    }
    // Get Company & check it exists
    const company = await CompanyStorage.getCompany(req.user.tenantID, filteredRequest.companyID);
    UtilsService.assertObjectExists(action, company, `Company ID '${filteredRequest.companyID}' does not exist`,
      MODULE_NAME, 'handleUpdateSite', req.user);
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
    // Check dynamic auth
    const authorizationSiteFilters = await AuthorizationService.checkAndGetUpdateSiteAuthorizationFilters(
      req.tenant, req.user, { ID: filteredRequest.id });
    // Get Site & check it exists
    const site = await SiteStorage.getSite(
      req.user.tenantID, filteredRequest.id, authorizationSiteFilters.filters);
    UtilsService.assertObjectExists(action, site, `Site with ID '${filteredRequest.id}' does not exist`,
      MODULE_NAME, 'handleUpdateSite', req.user);
    // OCPI Site
    if (!site.issuer) {
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
