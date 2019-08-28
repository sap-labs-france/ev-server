import { NextFunction, Request, Response } from 'express';
import AppAuthError from '../../../exception/AppAuthError';
import Authorizations from '../../../authorization/Authorizations';
import Constants from '../../../utils/Constants';
import Logging from '../../../utils/Logging';
import SiteArea from '../../../types/SiteArea';
import SiteAreaSecurity from './security/SiteAreaSecurity';
import SiteAreaStorage from '../../../storage/mongodb/SiteAreaStorage';
import Utils from '../../../utils/Utils';
import UtilsService from './UtilsService';

export default class SiteAreaService {
  public static async handleDeleteSiteArea(action: string, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(
      req.user, Constants.COMPONENTS.ORGANIZATION,
      Constants.ACTION_DELETE, Constants.ENTITY_SITE_AREA, 'SiteAreaService', 'handleDeleteSiteArea');
    // Filter
    const siteAreaID = SiteAreaSecurity.filterSiteAreaRequestByID(req.query);
    // Check Mandatory fields
    UtilsService.assertIdIsProvided(siteAreaID, 'SiteAreaService', 'handleDeleteSiteArea', req.user);
    // Get
    const siteArea = await SiteAreaStorage.getSiteArea(req.user.tenantID, siteAreaID);
    // Found?
    UtilsService.assertObjectExists(siteArea, `Site Area with ID '${siteAreaID}' does not exist`, 'SiteAreaService', 'handleDeleteSiteArea', req.user);
    // Check auth
    if (!Authorizations.canDeleteSiteArea(req.user, siteArea.siteID)) {
      throw new AppAuthError(
        Constants.ACTION_DELETE,
        Constants.ENTITY_SITE_AREA,
        siteAreaID,
        Constants.HTTP_AUTH_ERROR,
        'SiteAreaService', 'handleDeleteSiteArea',
        req.user);
    }
    // Delete
    await SiteAreaStorage.deleteSiteArea(req.user.tenantID, siteArea.id);
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user, module: 'SiteAreaService', method: 'handleDeleteSiteArea',
      message: `Site Area '${siteArea.name}' has been deleted successfully`,
      action: action, detailedMessages: siteArea
    }
    );
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleGetSiteArea(action: string, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(
      req.user, Constants.COMPONENTS.ORGANIZATION,
      Constants.ACTION_READ, Constants.ENTITY_SITE_AREA, 'SiteAreaService', 'handleGetSiteArea');
    // Filter
    const filteredRequest = SiteAreaSecurity.filterSiteAreaRequest(req.query);
    // ID is mandatory
    UtilsService.assertIdIsProvided(filteredRequest.ID, 'SiteAreaService', 'handleGetSiteArea', req.user);
    // Get it
    const siteArea = await SiteAreaStorage.getSiteArea(req.user.tenantID, filteredRequest.ID,
      { withSite: filteredRequest.WithSite, withChargeBoxes: filteredRequest.WithChargeBoxes });
    // Found?
    UtilsService.assertObjectExists(siteArea, `Site Area with ID '${filteredRequest.ID}' does not exist`, 'SiteAreaService', 'handleGetSiteArea', req.user);
    // Check auth
    if (!Authorizations.canReadSiteArea(req.user, siteArea.siteID)) {
      throw new AppAuthError(
        Constants.ACTION_READ,
        Constants.ENTITY_SITE_AREA,
        filteredRequest.ID,
        Constants.HTTP_AUTH_ERROR,
        'SiteAreaService', 'handleGetSiteAreaImage',
        req.user);
    }
    // Return
    res.json(
      // Filter
      SiteAreaSecurity.filterSiteAreaResponse(siteArea, req.user)
    );
    next();
  }

  public static async handleGetSiteAreaImage(action: string, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(
      req.user, Constants.COMPONENTS.ORGANIZATION,
      Constants.ACTION_READ, Constants.ENTITY_SITE_AREA, 'SiteAreaService', 'handleGetSiteAreaImage');
    // Filter
    const siteAreaID = SiteAreaSecurity.filterSiteAreaRequestByID(req.query);
    // Charge Box is mandatory
    UtilsService.assertIdIsProvided(siteAreaID, 'SiteAreaService', 'handleGetSiteAreaImage', req.user);
    // Get it
    const siteArea = await SiteAreaStorage.getSiteArea(req.user.tenantID, siteAreaID);
    UtilsService.assertObjectExists(siteArea, `Site Area with ID '${siteAreaID}' does not exist`, 'SiteAreaService', 'handleGetSiteAreaImage', req.user);
    // Check auth
    if (!Authorizations.canReadSiteArea(req.user, siteArea.siteID)) {
      throw new AppAuthError(
        Constants.ACTION_READ,
        Constants.ENTITY_SITE_AREA,
        siteAreaID,
        Constants.HTTP_AUTH_ERROR, 'SiteAreaService', 'handleGetSiteAreaImage',
        req.user);
    }
    // Get it
    const siteAreaImage = await SiteAreaStorage.getSiteAreaImage(req.user.tenantID, siteAreaID);
    UtilsService.assertObjectExists(siteAreaImage, `Site Area Image with ID '${siteAreaID}' does not exist`, 'SiteAreaService', 'handleGetSiteAreaImage', req.user);
    // Return
    res.json({ id: siteAreaImage.id, image: siteAreaImage.image });
    next();
  }

  public static async handleGetSiteAreas(action: string, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(
      req.user, Constants.COMPONENTS.ORGANIZATION,
      Constants.ACTION_LIST, Constants.ENTITY_SITE_AREAS, 'SiteAreaService', 'handleGetSiteAreas');
    // Check auth
    if (!Authorizations.canListSiteAreas(req.user)) {
      throw new AppAuthError(
        Constants.ACTION_LIST,
        Constants.ENTITY_SITE_AREAS,
        null,
        Constants.HTTP_AUTH_ERROR, 'SiteAreaService', 'handleGetSiteAreas',
        req.user);
    }
    // Filter
    const filteredRequest = SiteAreaSecurity.filterSiteAreasRequest(req.query);
    // Get the sites
    const siteAreas = await SiteAreaStorage.getSiteAreas(req.user.tenantID,
      {
        search: filteredRequest.Search,
        withSite: filteredRequest.WithSite,
        withChargeBoxes: filteredRequest.WithChargeBoxes,
        withAvailableChargers: filteredRequest.WithAvailableChargers,
        siteIDs: (filteredRequest.SiteID ? filteredRequest.SiteID.split('|') : Authorizations.getAuthorizedSiteIDs(req.user))
      },
      { limit: filteredRequest.Limit, skip: filteredRequest.Skip, sort: filteredRequest.Sort, onlyRecordCount: filteredRequest.OnlyRecordCount },
      ['id', 'name', 'siteID', 'address.latitude', 'address.longitude', 'address.city', 'address.country', 'site.id', 'site.name']
    );
    // Filter
    SiteAreaSecurity.filterSiteAreasResponse(siteAreas, req.user);
    // Return
    res.json(siteAreas);
    next();
  }

  public static async handleCreateSiteArea(action: string, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(
      req.user, Constants.COMPONENTS.ORGANIZATION,
      Constants.ACTION_CREATE, Constants.ENTITY_SITE_AREAS, 'SiteAreaService', 'handleCreateSiteArea');
    // Filter
    const filteredRequest = SiteAreaSecurity.filterSiteAreaCreateRequest(req.body);
    // Check
    Utils.checkIfSiteAreaValid(filteredRequest, req);
    // Check auth
    if (!Authorizations.canCreateSiteArea(req.user, filteredRequest.siteID)) {
      throw new AppAuthError(
        Constants.ACTION_CREATE,
        Constants.ENTITY_SITE_AREA,
        null,
        Constants.HTTP_AUTH_ERROR, 'SiteAreaService', 'handleCreateSiteArea',
        req.user);
    }
    // Create site
    const newSiteArea: SiteArea = {
      ...filteredRequest,
      createdBy: { id: req.user.id },
      createdOn: new Date()
    } as SiteArea;
    // Save
    newSiteArea.id = await SiteAreaStorage.saveSiteArea(req.user.tenantID, newSiteArea, true);
    // Ok
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user, module: 'SiteAreaService', method: 'handleCreateSiteArea',
      message: `Site Area '${newSiteArea.name}' has been created successfully`,
      action: action, detailedMessages: newSiteArea
    });
    // Ok
    res.json(Object.assign({ id: newSiteArea.id }, Constants.REST_RESPONSE_SUCCESS));
    next();
  }

  public static async handleUpdateSiteArea(action: string, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(
      req.user, Constants.COMPONENTS.ORGANIZATION,
      Constants.ACTION_UPDATE, Constants.ENTITY_SITE_AREA, 'SiteAreaService', 'handleUpdateSiteArea');
    // Filter
    const filteredRequest = SiteAreaSecurity.filterSiteAreaUpdateRequest(req.body);
    // Get
    const siteArea = await SiteAreaStorage.getSiteArea(req.user.tenantID, filteredRequest.id);
    // Check
    UtilsService.assertObjectExists(siteArea, `Site Area with ID '${filteredRequest.id}' does not exist`, 'SiteAreaService', 'handleUpdateSiteArea', req.user);
    // Check auth
    if (!Authorizations.canUpdateSiteArea(req.user, siteArea.siteID)) {
      throw new AppAuthError(
        Constants.ACTION_UPDATE,
        Constants.ENTITY_SITE_AREA,
        filteredRequest.id,
        Constants.HTTP_AUTH_ERROR,
        'SiteAreaService', 'handleUpdateSiteArea',
        req.user);
    }
    // Check Mandatory fields
    Utils.checkIfSiteAreaValid(filteredRequest, req);
    // Update
    siteArea.name = filteredRequest.name;
    siteArea.address = filteredRequest.address;
    siteArea.image = filteredRequest.image;
    siteArea.maximumPower = filteredRequest.maximumPower;
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
      action: action, detailedMessages: siteArea
    });
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }
}
