import { Action, Entity } from '../../../../types/Authorization';
import { HTTPAuthError, HTTPError } from '../../../../types/HTTPError';
import { NextFunction, Request, Response } from 'express';
import { SiteDataResult, SiteUserDataResult } from '../../../../types/DataResult';

import AppAuthError from '../../../../exception/AppAuthError';
import AppError from '../../../../exception/AppError';
import AuthorizationService from './AuthorizationService';
import BillingStorage from '../../../../storage/mongodb/BillingStorage';
import ChargingStationStorage from '../../../../storage/mongodb/ChargingStationStorage';
import Constants from '../../../../utils/Constants';
import Logging from '../../../../utils/Logging';
import LoggingHelper from '../../../../utils/LoggingHelper';
import { ServerAction } from '../../../../types/Server';
import Site from '../../../../types/Site';
import SiteStorage from '../../../../storage/mongodb/SiteStorage';
import SiteValidatorRest from '../validator/SiteValidatorRest';
import { StatusCodes } from 'http-status-codes';
import { TenantComponents } from '../../../../types/Tenant';
import Utils from '../../../../utils/Utils';
import UtilsService from './UtilsService';

const MODULE_NAME = 'SiteService';

export default class SiteService {
  public static async handleUpdateSiteUserAdmin(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ORGANIZATION,
      Action.UPDATE, Entity.SITE, MODULE_NAME, 'handleUpdateSiteUserAdmin');
    // Filter request
    const filteredRequest = SiteValidatorRest.getInstance().validateSiteAdminUpdateReq(req.body);
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
    const site = await UtilsService.checkAndGetSiteAuthorization(req.tenant, req.user, filteredRequest.siteID, Action.UPDATE, action);
    // Check and Get User
    const user = await UtilsService.checkAndGetUserAuthorization(req.tenant, req.user, filteredRequest.userID, Action.READ, action);
    // Update
    await SiteStorage.updateSiteUserAdmin(req.tenant, filteredRequest.siteID, filteredRequest.userID, filteredRequest.siteAdmin);
    await Logging.logInfo({
      ...LoggingHelper.getSiteProperties(site),
      tenantID: req.tenant.id,
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
    const filteredRequest = SiteValidatorRest.getInstance().validateSiteOwnerUpdateReq(req.body);
    // Check and Get Site
    const site = await UtilsService.checkAndGetSiteAuthorization(
      req.tenant, req.user, filteredRequest.siteID, Action.UPDATE, action);
    // Check and Get User
    const user = await UtilsService.checkAndGetUserAuthorization(
      req.tenant, req.user, filteredRequest.userID, Action.READ, action);
    // Update
    await SiteStorage.updateSiteOwner(req.tenant, filteredRequest.siteID, filteredRequest.userID, filteredRequest.siteOwner);
    await Logging.logInfo({
      ...LoggingHelper.getSiteProperties(site),
      tenantID: req.tenant.id,
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
    const filteredRequest = SiteValidatorRest.getInstance().validateSiteAssignUsersReq(req.body);
    // Check and Get Site
    const site = await UtilsService.checkAndGetSiteAuthorization(req.tenant, req.user, filteredRequest.siteID, Action.ASSIGN_UNASSIGN_USERS, action);
    // Check and Get Users
    const serverAction = action === ServerAction.ADD_USERS_TO_SITE ? Action.ASSIGN_USERS_TO_SITE : Action.UNASSIGN_USERS_FROM_SITE;
    const users = await UtilsService.checkAndGetSiteUsersAuthorization(req.tenant, req.user, site, filteredRequest.userIDs, action);
    // Save
    for (const user of users) {
      const authorized = AuthorizationService.canPerformAction(user, serverAction);
      if (!authorized) {
        throw new AppAuthError({
          errorCode: HTTPAuthError.FORBIDDEN,
          user: req.user,
          action: serverAction, entity: Entity.SITE_USER,
          module: MODULE_NAME, method: 'handleAssignUsersToSite',
          value: site.id
        });
      }
    }
    if (action === ServerAction.ADD_USERS_TO_SITE) {
      await SiteStorage.addUsersToSite(req.tenant, site.id, users.map((user) => user.id));
    } else {
      await SiteStorage.removeUsersFromSite(req.tenant, site.id, users.map((user) => user.id));
    }
    await Logging.logInfo({
      ...LoggingHelper.getSiteProperties(site),
      tenantID: req.tenant.id,
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
    const filteredRequest = SiteValidatorRest.getInstance().validateSiteGetUsersReq(req.query);
    // Check dynamic auth for listing sites users
    const authorizations = await AuthorizationService.checkAndGetSiteUsersAuthorizations(req.tenant,
      req.user, filteredRequest, false);
    if (!authorizations.authorized) {
      UtilsService.sendEmptyDataResult(res, next);
      return;
    }
    // Get Users
    const siteUsers = await SiteStorage.getSiteUsers(req.tenant,
      {
        search: filteredRequest.Search,
        siteIDs: [filteredRequest.SiteID],
        ...authorizations.filters
      },
      {
        limit: filteredRequest.Limit,
        skip: filteredRequest.Skip,
        sort: UtilsService.httpSortFieldsToMongoDB(filteredRequest.SortFields),
        onlyRecordCount: filteredRequest.OnlyRecordCount
      },
      authorizations.projectFields
    );
    // add user auth
    await AuthorizationService.addSiteUsersAuthorizations(req.tenant, req.user, siteUsers as SiteUserDataResult, authorizations);
    res.json(siteUsers);
    next();
  }

  public static async handleDeleteSite(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ORGANIZATION,
      Action.DELETE, Entity.SITE, MODULE_NAME, 'handleDeleteSite');
    // Filter request
    const siteID = SiteValidatorRest.getInstance().validateSiteDeleteReq(req.query).ID;
    // Check and Get Site
    const site = await UtilsService.checkAndGetSiteAuthorization(
      req.tenant, req.user, siteID, Action.DELETE, action);
    // Delete
    await SiteStorage.deleteSite(req.tenant, site.id);
    await Logging.logInfo({
      ...LoggingHelper.getSiteProperties(site),
      tenantID: req.tenant.id,
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
    const filteredRequest = SiteValidatorRest.getInstance().validateSiteGetReq(req.query);
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
    const filteredRequest = SiteValidatorRest.getInstance().validateSitesGetReq(req.query);
    // Create GPS Coordinates
    if (filteredRequest.LocLongitude && filteredRequest.LocLatitude) {
      filteredRequest.LocCoordinates = [
        Utils.convertToFloat(filteredRequest.LocLongitude),
        Utils.convertToFloat(filteredRequest.LocLatitude)
      ];
    }
    // Check dynamic auth
    const authorizations = await AuthorizationService.checkAndGetSitesAuthorizations(
      req.tenant, req.user, filteredRequest, false);
    if (!authorizations.authorized) {
      UtilsService.sendEmptyDataResult(res, next);
      return;
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
        ...authorizations.filters
      },
      {
        limit: filteredRequest.Limit,
        skip: filteredRequest.Skip,
        sort: UtilsService.httpSortFieldsToMongoDB(filteredRequest.SortFields),
        onlyRecordCount: filteredRequest.OnlyRecordCount
      },
      authorizations.projectFields
    );
    // Assign projected fields
    if (authorizations.projectFields) {
      sites.projectFields = authorizations.projectFields;
    }
    // Add Auth flags
    if (filteredRequest.WithAuth) {
      await AuthorizationService.addSitesAuthorizations(req.tenant, req.user, sites as SiteDataResult, authorizations);
    }
    res.json(sites);
    next();
  }

  public static async handleGetSiteImage(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check Tenant
    if (!req.tenant) {
      throw new AppError({
        errorCode: StatusCodes.BAD_REQUEST,
        message: 'Tenant must be provided',
        module: MODULE_NAME, method: 'handleGetSiteImage', action: action,
      });
    }
    // This endpoint is not protected, so no need to check user's access
    const filteredRequest = SiteValidatorRest.getInstance().validateSiteGetImageReq(req.query);
    UtilsService.assertIdIsProvided(action, filteredRequest.ID, MODULE_NAME, 'handleGetSiteImage', req.user);
    // Get the image
    const siteImage = await SiteStorage.getSiteImage(req.tenant, filteredRequest.ID);
    let image = siteImage?.image;
    if (image) {
      // Header
      let header = 'image';
      let encoding: BufferEncoding = 'base64';
      if (image.startsWith('data:image/')) {
        header = image.substring(5, image.indexOf(';'));
        encoding = image.substring(image.indexOf(';') + 1, image.indexOf(',')) as BufferEncoding;
        image = image.substring(image.indexOf(',') + 1);
      }
      res.setHeader('Content-Type', header);
      res.send(Buffer.from(image, encoding));
    } else {
      res.status(StatusCodes.NOT_FOUND);
    }
    next();
  }

  public static async handleCreateSite(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ORGANIZATION,
      Action.CREATE, Entity.SITE, MODULE_NAME, 'handleCreateSite');
    // Filter request
    const filteredRequest = SiteValidatorRest.getInstance().validateSiteCreateReq(req.body);
    // Get dynamic auth
    await AuthorizationService.checkAndGetSiteAuthorizations(
      req.tenant, req.user, {}, Action.CREATE, filteredRequest);
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
    // Connected Account
    if (filteredRequest.accountData) {
      UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.BILLING_PLATFORM,
        Action.CREATE, Entity.SITE, MODULE_NAME, 'handleCreateSite');
      if (filteredRequest.accountData.accountID) {
        const billingAccount = await BillingStorage.getAccountByID(req.tenant, filteredRequest.accountData.accountID);
        UtilsService.assertObjectExists(action, billingAccount, `Billing Account ID '${filteredRequest.accountData.accountID}' does not exist`, MODULE_NAME, 'handleCreateSite', req.user);
      }
    }
    // Save
    site.id = await SiteStorage.saveSite(req.tenant, site, Utils.objectHasProperty(filteredRequest, 'image'));
    await Logging.logInfo({
      ...LoggingHelper.getSiteProperties(site),
      tenantID: req.tenant.id,
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
    const filteredRequest = SiteValidatorRest.getInstance().validateSiteUpdateReq(req.body);
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
      if (Utils.objectHasProperty(filteredRequest, 'ownerName')) {
        site.ownerName = filteredRequest.ownerName;
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
    // Connected Account
    if (filteredRequest.accountData) {
      UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.BILLING_PLATFORM,
        Action.UPDATE, Entity.SITE, MODULE_NAME, 'handleUpdateSite');
      if (filteredRequest.accountData.accountID) {
        const billingAccount = await BillingStorage.getAccountByID(req.tenant, filteredRequest.accountData.accountID);
        UtilsService.assertObjectExists(action, billingAccount, `Billing Account ID '${filteredRequest.accountData.accountID}' does not exist`, MODULE_NAME, 'handleUpdateSite', req.user);
      }
      site.accountData = filteredRequest.accountData;
    }
    site.lastChangedBy = { 'id': req.user.id };
    site.lastChangedOn = new Date();
    // Save
    await SiteStorage.saveSite(req.tenant, site, Utils.objectHasProperty(filteredRequest, 'image'));
    // Update all refs
    void SiteStorage.updateEntitiesWithOrganizationIDs(req.tenant, site.companyID, filteredRequest.id);
    await Logging.logInfo({
      ...LoggingHelper.getSiteProperties(site),
      tenantID: req.tenant.id,
      user: req.user, module: MODULE_NAME, method: 'handleUpdateSite',
      message: `Site '${site.name}' has been updated successfully`,
      action: action,
      detailedMessages: { site }
    });
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }
}
