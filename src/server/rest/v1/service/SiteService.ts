import { Action, DynamicAuthorizationDataSourceName, Entity } from '../../../../types/Authorization';
import { HTTPAuthError, HTTPError } from '../../../../types/HTTPError';
import { NextFunction, Request, Response } from 'express';

import AppAuthError from '../../../../exception/AppAuthError';
import AppError from '../../../../exception/AppError';
import AuthorizationService from './AuthorizationService';
import ChargingStationStorage from '../../../../storage/mongodb/ChargingStationStorage';
import Constants from '../../../../utils/Constants';
import DynamicAuthorizationFactory from '../../../../authorization/DynamicAuthorizationFactory';
import Logging from '../../../../utils/Logging';
import LoggingHelper from '../../../../utils/LoggingHelper';
import { ServerAction } from '../../../../types/Server';
import Site from '../../../../types/Site';
import { SiteDataResult } from '../../../../types/DataResult';
import SiteStorage from '../../../../storage/mongodb/SiteStorage';
import SiteValidator from '../validator/SiteValidator';
import SitesAdminDynamicAuthorizationDataSource from '../../../../authorization/dynamic-data-source/SitesAdminDynamicAuthorizationDataSource';
import { TenantComponents } from '../../../../types/Tenant';
import TenantStorage from '../../../../storage/mongodb/TenantStorage';
import Utils from '../../../../utils/Utils';
import UtilsService from './UtilsService';

const MODULE_NAME = 'SiteService';

export default class SiteService {
  public static async handleUpdateSiteUserAdmin(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ORGANIZATION,
      Action.UPDATE, Entity.SITE, MODULE_NAME, 'handleUpdateSiteUserAdmin');
    // Filter request
    const filteredRequest = SiteValidator.getInstance().validateSiteAdminReq(req.body);
    if (req.user.id === filteredRequest.userID) {
      throw new AppError({
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Cannot change the site Admin on the logged user',
        module: MODULE_NAME, method: 'handleUpdateSiteUserAdmin',
        user: req.user,
        actionOnUser: filteredRequest.userID
      });
    }
    // Check and Get Site
    const site = await UtilsService.checkAndGetSiteAuthorization(
      req.tenant, req.user, filteredRequest.siteID, Action.UPDATE, action);
    // Check and Get User
    const user = await UtilsService.checkAndGetUserAuthorization(
      req.tenant, req.user, filteredRequest.userID, Action.READ, action);
    // Update
    await SiteStorage.updateSiteUserAdmin(req.tenant, filteredRequest.siteID, filteredRequest.userID, filteredRequest.siteAdmin);
    // Log
    await Logging.logInfo({
      ...LoggingHelper.getSiteProperties(site),
      tenantID: req.user.tenantID,
      user: req.user, actionOnUser: user,
      module: MODULE_NAME, method: 'handleUpdateSiteUserAdmin',
      message: `The User has been ${filteredRequest.siteAdmin ? 'assigned' : 'removed'} the Site Admin role on site '${site.name}'`,
      action: action
    });
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleUpdateSiteOwner(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ORGANIZATION,
      Action.UPDATE, Entity.SITE, MODULE_NAME, 'handleUpdateSiteOwner');
    // Filter request
    const filteredRequest = SiteValidator.getInstance().validateSiteOwnerReq(req.body);
    // Check and Get Site
    const site = await UtilsService.checkAndGetSiteAuthorization(
      req.tenant, req.user, filteredRequest.siteID, Action.UPDATE, action);
    // Check and Get User
    const user = await UtilsService.checkAndGetUserAuthorization(
      req.tenant, req.user, filteredRequest.userID, Action.READ, action);
    // Update
    await SiteStorage.updateSiteOwner(req.tenant, filteredRequest.siteID, filteredRequest.userID, filteredRequest.siteOwner);
    // Log
    await Logging.logInfo({
      ...LoggingHelper.getSiteProperties(site),
      tenantID: req.user.tenantID,
      user: req.user, actionOnUser: user,
      module: MODULE_NAME, method: 'handleUpdateSiteOwner',
      message: `The User has been granted Site Owner on Site '${site.name}'`,
      action: action
    });
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleAssignUsersToSite(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ORGANIZATION,
      Action.UPDATE, Entity.SITE, MODULE_NAME, 'handleAssignUsersToSite');
    // Filter request
    const filteredRequest = SiteValidator.getInstance().validateSiteAssignUsersReq(req.body);
    // Check and Get Site
    const site = await UtilsService.checkAndGetSiteAuthorization(
      req.tenant, req.user, filteredRequest.siteID, Action.READ, action);
    // Check and Get Users
    const users = await UtilsService.checkSiteUsersAuthorization(
      req.tenant, req.user, site, filteredRequest.userIDs, action);
    // Save
    if (action === ServerAction.ADD_USERS_TO_SITE) {
      await SiteStorage.addUsersToSite(req.tenant, site.id, users.map((user) => user.id));
    } else {
      await SiteStorage.removeUsersFromSite(req.tenant, site.id, users.map((user) => user.id));
    }
    // Log
    await Logging.logInfo({
      ...LoggingHelper.getSiteProperties(site),
      tenantID: req.user.tenantID,
      user: req.user,
      module: MODULE_NAME,
      method: 'handleAssignUsersToSite',
      message: 'Site\'s Users have been removed successfully',
      action: action
    });
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleGetUsers(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ORGANIZATION,
      Action.UPDATE, Entity.SITE, MODULE_NAME, 'handleGetUsers');
    // Filter
    const filteredRequest = SiteValidator.getInstance().validateSiteGetUsersReq(req.query);
    // Check Site Auth
    await UtilsService.checkAndGetSiteAuthorization(req.tenant, req.user, filteredRequest.SiteID, Action.READ, action);
    // Check dynamic auth for reading Users
    const authorizationSiteUsersFilter = await AuthorizationService.checkAndGetSiteUsersAuthorizations(req.tenant,
      req.user, filteredRequest);
    if (!authorizationSiteUsersFilter.authorized) {
      UtilsService.sendEmptyDataResult(res, next);
      return;
    }
    // Get Users
    const users = await SiteStorage.getSiteUsers(req.tenant,
      {
        search: filteredRequest.Search,
        siteIDs: [filteredRequest.SiteID],
        ...authorizationSiteUsersFilter.filters
      },
      {
        limit: filteredRequest.Limit,
        skip: filteredRequest.Skip,
        sort: UtilsService.httpSortFieldsToMongoDB(filteredRequest.SortFields),
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
    const siteID = SiteValidator.getInstance().validateSiteGetReq(req.query).ID;
    // Check and Get Site
    const site = await UtilsService.checkAndGetSiteAuthorization(
      req.tenant, req.user, siteID, Action.DELETE, action);
    // Delete
    await SiteStorage.deleteSite(req.tenant, site.id);
    // Log
    await Logging.logInfo({
      ...LoggingHelper.getSiteProperties(site),
      tenantID: req.user.tenantID,
      user: req.user, module: MODULE_NAME, method: 'handleDeleteSite',
      message: `Site '${site.name}' has been deleted successfully`,
      action: action,
      detailedMessages: { site }
    });
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleGetSite(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ORGANIZATION,
      Action.READ, Entity.SITE, MODULE_NAME, 'handleGetSite');
    // Filter request
    const filteredRequest = SiteValidator.getInstance().validateSiteGetReq(req.query);
    // Check and Get Site
    const site = await UtilsService.checkAndGetSiteAuthorization(
      req.tenant, req.user, filteredRequest.ID, Action.READ, action, null, {
        withCompany: filteredRequest.WithCompany,
        withImage: true,
      }, true);
    res.json(site);
    next();
  }

  public static async handleGetSites(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ORGANIZATION,
      Action.LIST, Entity.SITE, MODULE_NAME, 'handleGetSites');
    // Filter request
    const filteredRequest = SiteValidator.getInstance().validateSitesGetReq(req.query);
    // Create GPS Coordinates
    if (filteredRequest.LocLongitude && filteredRequest.LocLatitude) {
      filteredRequest.LocCoordinates = [
        Utils.convertToFloat(filteredRequest.LocLongitude),
        Utils.convertToFloat(filteredRequest.LocLatitude)
      ];
    }
    // Check dynamic auth
    const authorizationSitesFilter = await AuthorizationService.checkAndGetSitesAuthorizations(
      req.tenant, req.user, filteredRequest);
    if (!authorizationSitesFilter.authorized) {
      UtilsService.sendEmptyDataResult(res, next);
      return;
    }
    // Check Site Admin filter
    if (filteredRequest.SiteAdmin) {
      // Override Site IDs
      const siteAdminDataSource = await DynamicAuthorizationFactory.getDynamicDataSource(
        req.tenant, req.user, DynamicAuthorizationDataSourceName.SITES_ADMIN) as SitesAdminDynamicAuthorizationDataSource;
      authorizationSitesFilter.filters = { ...authorizationSitesFilter.filters, ...siteAdminDataSource.getData() };
    }
    // Get the sites
    const sites = await SiteStorage.getSites(req.tenant,
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
        sort: UtilsService.httpSortFieldsToMongoDB(filteredRequest.SortFields),
        onlyRecordCount: filteredRequest.OnlyRecordCount
      },
      authorizationSitesFilter.projectFields
    );
    // Assign projected fields
    if (authorizationSitesFilter.projectFields) {
      sites.projectFields = authorizationSitesFilter.projectFields;
    }
    // Add Auth flags
    await AuthorizationService.addSitesAuthorizations(req.tenant, req.user, sites as SiteDataResult, authorizationSitesFilter);
    res.json(sites);
    next();
  }

  public static async handleGetSiteImage(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // This endpoint is not protected, so no need to check user's access
    const filteredRequest = SiteValidator.getInstance().validateSiteGetImageReq(req.query);
    UtilsService.assertIdIsProvided(action, filteredRequest.ID, MODULE_NAME, 'handleGetSiteImage', req.user);
    if (!filteredRequest.TenantID) {
      // Object does not exist
      throw new AppError({
        action,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'The ID must be provided',
        module: MODULE_NAME, method: 'handleGetSiteImage',
      });
    }
    // Get Tenant
    const tenant = await TenantStorage.getTenant(filteredRequest.TenantID);
    UtilsService.assertObjectExists(action, tenant, `Tenant ID '${filteredRequest.TenantID}' does not exist`,
      MODULE_NAME, 'handleGetSiteImage', req.user);
    // Get the image
    const siteImage = await SiteStorage.getSiteImage(tenant, filteredRequest.ID);
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
    // Filter request
    const filteredRequest = SiteValidator.getInstance().validateSiteCreateReq(req.body);
    // Check data is valid
    UtilsService.checkIfSiteValid(filteredRequest, req);
    // Get dynamic auth
    const authorizationFilter = await AuthorizationService.checkAndGetSiteAuthorizations(
      req.tenant, req.user, {}, Action.CREATE, filteredRequest);
    if (!authorizationFilter.authorized) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.CREATE, entity: Entity.SITE,
        module: MODULE_NAME, method: 'handleCreateSite'
      });
    }
    // Check Company
    await UtilsService.checkAndGetCompanyAuthorization(
      req.tenant, req.user, filteredRequest.companyID, Action.READ, action);
    // Create site
    const site: Site = {
      ...filteredRequest,
      issuer: true,
      createdBy: { id: req.user.id },
      createdOn: new Date()
    } as Site;
    if (Utils.isComponentActiveFromToken(req.user, TenantComponents.OCPI)) {
      if (!filteredRequest.public) {
        delete site.tariffID;
      }
    }
    // Save
    site.id = await SiteStorage.saveSite(req.tenant, site);
    // Log
    await Logging.logInfo({
      ...LoggingHelper.getSiteProperties(site),
      tenantID: req.user.tenantID,
      user: req.user, module: MODULE_NAME, method: 'handleCreateSite',
      message: `Site '${site.name}' has been created successfully`,
      action: action,
      detailedMessages: { site }
    });
    res.json(Object.assign({ id: site.id }, Constants.REST_RESPONSE_SUCCESS));
    next();
  }

  public static async handleUpdateSite(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ORGANIZATION,
      Action.UPDATE, Entity.SITE, MODULE_NAME, 'handleUpdateSite');
    // Filter request
    const filteredRequest = SiteValidator.getInstance().validateSiteUpdateReq(req.body);
    // Check data is valid
    UtilsService.checkIfSiteValid(filteredRequest, req);
    // Check and Get Site
    const site = await UtilsService.checkAndGetSiteAuthorization(
      req.tenant, req.user, filteredRequest.id, Action.UPDATE, action, filteredRequest);
    // Check and Get Company
    await UtilsService.checkAndGetCompanyAuthorization(
      req.tenant, req.user, filteredRequest.companyID, Action.READ, action, filteredRequest);
    // Update
    site.name = filteredRequest.name;
    site.companyID = filteredRequest.companyID;
    if (Utils.objectHasProperty(filteredRequest, 'public')) {
      if (!filteredRequest.public) {
        // Check that there is no public charging stations
        const publicChargingStations = await ChargingStationStorage.getChargingStations(req.tenant, {
          siteIDs: [site.id],
          public: true,
        }, Constants.DB_PARAMS_SINGLE_RECORD, ['id']);
        if (publicChargingStations.count > 0) {
          throw new AppError({
            ...LoggingHelper.getSiteProperties(site),
            errorCode: HTTPError.FEATURE_NOT_SUPPORTED_ERROR,
            message: `Cannot set site ${site.name} to private as charging station ${publicChargingStations.result[0].id} under site is public`,
            module: MODULE_NAME, method: 'handleUpdateSite',
            user: req.user,
          });
        }
      }
      site.public = filteredRequest.public;
    }
    if (Utils.isComponentActiveFromToken(req.user, TenantComponents.OCPI)) {
      if (Utils.objectHasProperty(filteredRequest, 'tariffID')) {
        site.tariffID = filteredRequest.tariffID;
      }
      if (!filteredRequest.public) {
        delete site.tariffID;
      }
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
    await SiteStorage.saveSite(req.tenant, site, Utils.objectHasProperty(filteredRequest, 'image') ? true : false);
    // Log
    await Logging.logInfo({
      ...LoggingHelper.getSiteProperties(site),
      tenantID: req.user.tenantID,
      user: req.user, module: MODULE_NAME, method: 'handleUpdateSite',
      message: `Site '${site.name}' has been updated successfully`,
      action: action,
      detailedMessages: { site }
    });
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }
}
