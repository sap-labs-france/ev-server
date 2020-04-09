import { NextFunction, Request, Response } from 'express';
import Authorizations from '../../../authorization/Authorizations';
import AppAuthError from '../../../exception/AppAuthError';
import AppError from '../../../exception/AppError';
import SiteAreaStorage from '../../../storage/mongodb/SiteAreaStorage';
import SiteStorage from '../../../storage/mongodb/SiteStorage';
import { Action, Entity } from '../../../types/Authorization';
import { HTTPAuthError, HTTPError } from '../../../types/HTTPError';
import SiteArea from '../../../types/SiteArea';
import TenantComponents from '../../../types/TenantComponents';
import Constants from '../../../utils/Constants';
import Logging from '../../../utils/Logging';
import Utils from '../../../utils/Utils';
import OCPPUtils from '../../ocpp/utils/OCPPUtils';
import SiteAreaSecurity from './security/SiteAreaSecurity';
import UtilsService from './UtilsService';
import { ActionsResponse } from '../../../types/GlobalType';
import SmartChargingFactory from '../../../integration/smart-charging/SmartChargingFactory';

export default class SiteAreaService {
  public static async handleDeleteSiteArea(action: Action, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ORGANIZATION,
      Action.DELETE, Entity.SITE_AREA, 'SiteAreaService', 'handleDeleteSiteArea');
    // Filter
    const siteAreaID = SiteAreaSecurity.filterSiteAreaRequestByID(req.query);
    // Check Mandatory fields
    UtilsService.assertIdIsProvided(action, siteAreaID, 'SiteAreaService', 'handleDeleteSiteArea', req.user);
    // Get
    const siteArea = await SiteAreaStorage.getSiteArea(req.user.tenantID, siteAreaID);
    // Found?
    UtilsService.assertObjectExists(action, siteArea, `Site Area with ID '${siteAreaID}' does not exist`,
      'SiteAreaService', 'handleDeleteSiteArea', req.user);
    // Check auth
    if (!Authorizations.canDeleteSiteArea(req.user, siteArea.siteID)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.DELETE,
        entity: Entity.SITE_AREA,
        module: 'SiteAreaService',
        method: 'handleDeleteSiteArea',
        value: siteAreaID
      });
    }
    // Delete
    await SiteAreaStorage.deleteSiteArea(req.user.tenantID, siteArea.id);
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user, module: 'SiteAreaService', method: 'handleDeleteSiteArea',
      message: `Site Area '${siteArea.name}' has been deleted successfully`,
      action: action,
      detailedMessages: { siteArea }
    }
    );
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleGetSiteArea(action: Action, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ORGANIZATION,
      Action.READ, Entity.SITE_AREA, 'SiteAreaService', 'handleGetSiteArea');
    // Filter
    const filteredRequest = SiteAreaSecurity.filterSiteAreaRequest(req.query);
    // ID is mandatory
    UtilsService.assertIdIsProvided(action, filteredRequest.ID, 'SiteAreaService', 'handleGetSiteArea', req.user);
    // Get it
    const siteArea = await SiteAreaStorage.getSiteArea(req.user.tenantID, filteredRequest.ID,
      { withSite: filteredRequest.WithSite, withChargeBoxes: filteredRequest.WithChargeBoxes });
    // Found?
    UtilsService.assertObjectExists(action, siteArea, `Site Area with ID '${filteredRequest.ID}' does not exist`,
      'SiteAreaService', 'handleGetSiteArea', req.user);
    // Check auth
    if (!Authorizations.canReadSiteArea(req.user, siteArea.siteID)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.READ,
        entity: Entity.SITE_AREA,
        module: 'SiteAreaService',
        method: 'handleGetSiteArea',
        value: filteredRequest.ID
      });
    }
    // Return
    res.json(
      // Filter
      SiteAreaSecurity.filterSiteAreaResponse(siteArea, req.user)
    );
    next();
  }

  public static async handleGetSiteAreaImage(action: Action, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ORGANIZATION,
      Action.READ, Entity.SITE_AREA, 'SiteAreaService', 'handleGetSiteAreaImage');
    // Filter
    const siteAreaID = SiteAreaSecurity.filterSiteAreaRequestByID(req.query);
    // Charge Box is mandatory
    UtilsService.assertIdIsProvided(action, siteAreaID, 'SiteAreaService', 'handleGetSiteAreaImage', req.user);
    // Get it
    const siteArea = await SiteAreaStorage.getSiteArea(req.user.tenantID, siteAreaID);
    UtilsService.assertObjectExists(action, siteArea, `Site Area with ID '${siteAreaID}' does not exist`,
      'SiteAreaService', 'handleGetSiteAreaImage', req.user);
    // Check auth
    if (!Authorizations.canReadSiteArea(req.user, siteArea.siteID)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.READ,
        entity: Entity.SITE_AREA,
        module: 'SiteAreaService',
        method: 'handleGetSiteAreaImage',
        value: siteAreaID
      });
    }
    // Get it
    const siteAreaImage = await SiteAreaStorage.getSiteAreaImage(req.user.tenantID, siteAreaID);
    UtilsService.assertObjectExists(action, siteAreaImage, `Site Area Image with ID '${siteAreaID}' does not exist`,
      'SiteAreaService', 'handleGetSiteAreaImage', req.user);
    // Return
    res.json({ id: siteAreaImage.id, image: siteAreaImage.image });
    next();
  }

  public static async handleGetSiteAreas(action: Action, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ORGANIZATION,
      Action.LIST, Entity.SITE_AREAS, 'SiteAreaService', 'handleGetSiteAreas');
    // Check auth
    if (!Authorizations.canListSiteAreas(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.LIST,
        entity: Entity.SITE_AREAS,
        module: 'SiteAreaService',
        method: 'handleGetSiteAreas'
      });
    }
    // Filter
    const filteredRequest = SiteAreaSecurity.filterSiteAreasRequest(req.query);
    // Get the sites
    const siteAreas = await SiteAreaStorage.getSiteAreas(req.user.tenantID,
      {
        issuer: filteredRequest.Issuer,
        search: filteredRequest.Search,
        withSite: filteredRequest.WithSite,
        withChargeBoxes: filteredRequest.WithChargeBoxes,
        withAvailableChargers: filteredRequest.WithAvailableChargers,
        siteIDs: Authorizations.getAuthorizedSiteIDs(req.user, filteredRequest.SiteID ? filteredRequest.SiteID.split('|') : null),
      },
      { limit: filteredRequest.Limit, skip: filteredRequest.Skip, sort: filteredRequest.Sort, onlyRecordCount: filteredRequest.OnlyRecordCount },
      ['id', 'name', 'siteID', 'address.coordinates', 'address.city', 'address.country', 'site.id', 'site.name', 'issuer']
    );
    // Filter
    SiteAreaSecurity.filterSiteAreasResponse(siteAreas, req.user);
    // Return
    res.json(siteAreas);
    next();
  }

  public static async handleCreateSiteArea(action: Action, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ORGANIZATION,
      Action.CREATE, Entity.SITE_AREAS, 'SiteAreaService', 'handleCreateSiteArea');
    // Filter
    const filteredRequest = SiteAreaSecurity.filterSiteAreaCreateRequest(req.body);
    // Check
    Utils.checkIfSiteAreaValid(filteredRequest, req);
    // Check auth
    if (!Authorizations.canCreateSiteArea(req.user, filteredRequest.siteID)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.CREATE,
        entity: Entity.SITE_AREA,
        module: 'SiteAreaService',
        method: 'handleCreateSiteArea'
      });
    }
    // Check Site
    const site = await SiteStorage.getSite(req.user.tenantID, filteredRequest.siteID);
    UtilsService.assertObjectExists(action, site, `Site ID '${filteredRequest.siteID}' does not exist`,
      'SiteAreaService', 'handleCreateSiteArea', req.user);
    // Create site
    const newSiteArea: SiteArea = {
      ...filteredRequest,
      issuer: true,
      createdBy: { id: req.user.id },
      createdOn: new Date()
    } as SiteArea;
    // Save
    newSiteArea.id = await SiteAreaStorage.saveSiteArea(req.user.tenantID, newSiteArea, true);
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user, module: 'SiteAreaService', method: 'handleCreateSiteArea',
      message: `Site Area '${newSiteArea.name}' has been created successfully`,
      action: action,
      detailedMessages: { siteArea: newSiteArea }
    });
    // Ok
    res.json(Object.assign({ id: newSiteArea.id }, Constants.REST_RESPONSE_SUCCESS));
    next();
  }

  public static async handleUpdateSiteArea(action: Action, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ORGANIZATION,
      Action.UPDATE, Entity.SITE_AREA, 'SiteAreaService', 'handleUpdateSiteArea');
    // Filter
    const filteredRequest = SiteAreaSecurity.filterSiteAreaUpdateRequest(req.body);
    // Get
    const siteArea = await SiteAreaStorage.getSiteArea(req.user.tenantID, filteredRequest.id, { withChargeBoxes: true });
    UtilsService.assertObjectExists(action, siteArea, `Site Area with ID '${filteredRequest.id}' does not exist`,
      'SiteAreaService', 'handleUpdateSiteArea', req.user);
    // Check auth
    if (!Authorizations.canUpdateSiteArea(req.user, siteArea.siteID)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.UPDATE,
        entity: Entity.SITE_AREA,
        module: 'SiteAreaService',
        method: 'handleUpdateSiteArea',
        value: filteredRequest.id
      });
    }
    // Check Mandatory fields
    Utils.checkIfSiteAreaValid(filteredRequest, req);
    // Check Site
    const site = await SiteStorage.getSite(req.user.tenantID, filteredRequest.siteID);
    UtilsService.assertObjectExists(action, site, `Site ID '${filteredRequest.siteID}' does not exist`,
      'SiteAreaService', 'handleUpdateSiteArea', req.user);
    // Update
    siteArea.name = filteredRequest.name;
    siteArea.address = filteredRequest.address;
    siteArea.image = filteredRequest.image;
    if (siteArea.maximumPower !== filteredRequest.maximumPower && filteredRequest.smartCharging) {
      try {
        const smartCharging = await SmartChargingFactory.getSmartChargingImpl(req.user.tenantID);
        if (smartCharging) {
          await smartCharging.computeAndApplyChargingProfiles(siteArea);
        }
      } catch (error) {
        Logging.logError({
          tenantID: req.user.tenantID,
          source: Constants.CENTRAL_SERVER,
          module: 'SiteAreaService', method: 'handleUpdateSiteArea',
          action: Action.UPDATE,
          message: `An error occurred while trying to call smart charging`,
          detailedMessages: { error }
        });
      }
    }
    siteArea.maximumPower = filteredRequest.maximumPower;
    let actionsResponse: ActionsResponse;
    if (siteArea.smartCharging && !filteredRequest.smartCharging) {
      actionsResponse = await OCPPUtils.clearAndDeleteChargingProfilesForSiteArea(req.user.tenantID, siteArea, req.user);
    }
    siteArea.smartCharging = filteredRequest.smartCharging;
    siteArea.accessControl = filteredRequest.accessControl;
    siteArea.siteID = filteredRequest.siteID;
    siteArea.lastChangedBy = { 'id': req.user.id };
    siteArea.lastChangedOn = new Date();
    // Update Site Area
    await SiteAreaStorage.saveSiteArea(req.user.tenantID, siteArea, true);
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user, module: 'SiteAreaService', method: 'handleUpdateSiteArea',
      message: `Site Area '${siteArea.name}' has been updated successfully`,
      action: action,
      detailedMessages: { siteArea }
    });
    if (actionsResponse && actionsResponse.inError > 0) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        action: action,
        errorCode: HTTPError.CLEAR_CHARGING_PROFILE_NOT_SUCCESSFUL,
        message: 'Error occurred while clearing Charging Profiles for Site Area',
        module: 'SiteAreaService', method: 'handleUpdateSiteArea',
        user: req.user, actionOnUser: req.user
      });
    }
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }
}
