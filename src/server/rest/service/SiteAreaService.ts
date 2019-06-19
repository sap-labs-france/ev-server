import Logging from '../../../utils/Logging';
import Database from '../../../utils/Database';
import AppError from '../../../exception/AppError';
import AppAuthError from '../../../exception/AppAuthError';
import Constants from '../../../utils/Constants';
import SiteAreaSecurity from './security/SiteAreaSecurity';
import Authorizations from '../../../authorization/Authorizations';
import User from '../../../entity/User';
import ChargingStation from '../../../entity/ChargingStation';
import Site from '../../../entity/Site';
import SiteArea from '../../../types/SiteArea';
import UtilsService from './UtilsService';
import OrganizationComponentInactiveError from '../../../exception/OrganizationComponentInactiveError';
import { Request, Response, NextFunction } from 'express';
import Utils from '../../../utils/Utils';
import SiteAreaStorage from '../../../storage/mongodb/SiteAreaStorage';
import SiteStorage from '../../../storage/mongodb/SiteStorage';
import ChargingStationStorage from '../../../storage/mongodb/ChargingStationStorage';
import { filter } from 'bluebird';

export default class SiteAreaService {

  public static async handleCreateSiteArea(action: string, req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Check if organization component is active
      if (!await UtilsService.isOrganizationComponentActive(req.user.tenantID)) {
        throw new OrganizationComponentInactiveError(
          Constants.ACTION_CREATE,
          Constants.ENTITY_SITE_AREA,
          560, 'SiteAreaService', 'handleCreateSiteArea');
      }

      // Filter, check fields, check auth
      const filteredRequest = SiteAreaSecurity.filterSiteAreaCreateRequest( req.body, req.user );

      // Check Site
      if(! SiteStorage.siteExists(req.user.tenantID, filteredRequest.siteID)) {
        Utils.assertObjectExists(null, `The Site ID '${filteredRequest.siteID}' does not exist`, 'SiteAreaService', 'handleCreateSiteArea', req.user);
      }

      // Create site
      const idlessSiteArea: Optional<SiteArea, 'id'|'chargingStations'|'site'> = {
        ...filteredRequest,
        createdBy: new User(req.user.tenantID, {id: req.user.id}),
        createdOn: new Date()
      };

      const siteArea: Optional<SiteArea,'site'> = {
        id: await SiteAreaStorage.saveSiteArea(req.user.tenantID, idlessSiteArea, true),
        chargingStations: [],
        ...idlessSiteArea
      };

      await ChargingStationStorage.addChargingStationsToSiteArea(req.user.tenantID, siteArea.id, filteredRequest.chargeBoxIDs);

      // Ok
      Logging.logSecurityInfo({
        tenantID: req.user.tenantID,
        user: req.user, module: 'SiteAreaService', method: 'handleCreateSiteArea',
        message: `Site Area '${siteArea.name}' has been created successfully`,
        action: action, detailedMessages: siteArea});
      // Ok
      res.json(Object.assign({ id: siteArea.id }, Constants.REST_RESPONSE_SUCCESS));
      next();
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }

  public static async handleGetSiteAreas(action: string, req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Check if organization component is active
      if (!await UtilsService.isOrganizationComponentActive(req.user.tenantID)) {
        throw new OrganizationComponentInactiveError(
          Constants.ACTION_LIST,
          Constants.ENTITY_SITE_AREAS,
          560, 'SiteAreaService', 'handleGetSiteAreas');
      }

      // Filter
      const filteredRequest = SiteAreaSecurity.filterSiteAreasRequest(req.query, req.user);
      // Get the sites
      const siteAreas = await SiteAreaStorage.getSiteAreas(req.user.tenantID,
        {
          'search': filteredRequest.Search,
          'siteIDs': Authorizations.getAuthorizedEntityIDsFromLoggedUser(Constants.ENTITY_SITE, req.user),
          'withSite': filteredRequest.WithSite,
          'withChargeBoxes': filteredRequest.WithChargeBoxes,
          'withAvailableChargers': filteredRequest.WithAvailableChargers,
          'siteID': filteredRequest.SiteID,
          'onlyRecordCount': filteredRequest.OnlyRecordCount
        },
        filteredRequest.Limit, filteredRequest.Skip, filteredRequest.Sort);

      // Filter
      SiteAreaSecurity.filterSiteAreasResponse(siteAreas, req.user);

      // Return
      res.json(siteAreas);
      next();
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }

  public static async handleDeleteSiteArea(action: string, req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Check if organization component is active
      if (!await UtilsService.isOrganizationComponentActive(req.user.tenantID)) {
        throw new OrganizationComponentInactiveError(
          Constants.ACTION_DELETE,
          Constants.ENTITY_SITE_AREA,
          560, 'SiteAreaService', 'handleDeleteSiteArea');
      }

      // Filter
      const searchId = SiteAreaSecurity.filterSiteAreaDeleteRequest(req.query, req.user);

      // Get
      const siteArea = await SiteAreaStorage.getSiteArea(req.user.tenantID, searchId, false, false, false);

      // Found?
      Utils.assertObjectExists(siteArea, 'Site Area not found.', 'SiteAreaService', 'handleDeleteSiteArea', req.user);

      // Check auth
      if (!Authorizations.canDeleteSiteArea(req.user, siteArea)) {
        // Not Authorized!
        throw new AppAuthError(
          Constants.ACTION_DELETE,
          Constants.ENTITY_SITE_AREA,
          siteArea.id,
          560,
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
        action: action, detailedMessages: siteArea});
      // Ok
      res.json(Constants.REST_RESPONSE_SUCCESS);
      next();
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }

  public static async handleGetSiteArea(action: string, req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Check if organization component is active
      if (!await UtilsService.isOrganizationComponentActive(req.user.tenantID)) {
        throw new OrganizationComponentInactiveError(
          Constants.ACTION_READ,
          Constants.ENTITY_SITE_AREA,
          560, 'SiteAreaService', 'handleGetSiteArea');
      }

      // Filter
      const filteredRequest = SiteAreaSecurity.filterSiteAreaRequest(req.query, req.user);
      // Get it
      const siteArea = await SiteAreaStorage.getSiteArea(req.user.tenantID,
        filteredRequest.ID, filteredRequest.WithChargeBoxes, filteredRequest.WithSite, true);
      // Found?
      Utils.assertObjectExists(siteArea, 'Site Area not found.', 'SiteAreaService', 'handleGetSiteArea', req.user);

      // Check auth
      if (!Authorizations.canReadSiteArea(req.user, siteArea)) {
        // Not Authorized!
        throw new AppAuthError(
          Constants.ACTION_READ,
          Constants.ENTITY_SITE_AREA,
          siteArea.id,
          560,
          'SiteAreaService', 'handleGetSiteAreaImage',
          req.user);
      }
      // Return
      res.json(
        // Filter
        SiteAreaSecurity.filterSiteAreaResponse(
          siteArea, req.user)
      );
      next();
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }

  public static async handleGetSiteAreaImage(action: string, req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Check if organization component is active
      if (!await UtilsService.isOrganizationComponentActive(req.user.tenantID)) {
        throw new OrganizationComponentInactiveError(
          Constants.ACTION_READ,
          Constants.ENTITY_SITE_AREA,
          560, 'SiteAreaService', 'handleGetSiteAreaImage');
      }

      // Filter
      const filteredRequest = SiteAreaSecurity.filterSiteAreaRequest(req.query, req.user);
      // Get it
      const siteArea = await SiteAreaStorage.getSiteArea(req.user.tenantID, filteredRequest.ID, false, false, true);
      Utils.assertObjectExists(siteArea, 'Site Area does not exist.', 'SiteAreaService', 'handleGetSiteAreaImage', req.user);

      // Check auth
      if (!Authorizations.canReadSiteArea(req.user, siteArea)) {
        // Not Authorized!
        throw new AppAuthError(
          Constants.ACTION_READ,
          Constants.ENTITY_SITE_AREA,
          siteArea.id,
          560, 'SiteAreaService', 'handleGetSiteAreaImage',
          req.user);
      }
      // Return
      res.json({id: siteArea.id, image: siteArea.image});
      next();
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }

  public static async handleUpdateSiteArea(action: string, req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Check if organization component is active
      if (!await UtilsService.isOrganizationComponentActive(req.user.tenantID)) {
        throw new OrganizationComponentInactiveError(
          Constants.ACTION_UPDATE,
          Constants.ENTITY_SITE_AREA,
          560, 'SiteAreaService', 'handleUpdateSiteArea');
      }

      // Filter
      const filteredRequest = SiteAreaSecurity.filterSiteAreaUpdateRequest(req.body, req.user);
      // Check
      const siteArea = await SiteAreaStorage.getSiteArea(req.user.tenantID, filteredRequest.id, false, false, false);
      Utils.assertObjectExists(siteArea, `The Site Area with ID '${filteredRequest.id}' does not exist anymore`, 'SiteAreaService', 'handleUpdateSiteArea', req.user);
      // Check auth
      if (!Authorizations.canUpdateSiteArea(req.user, siteArea)) {
        // Not Authorized!
        throw new AppAuthError(
          Constants.ACTION_UPDATE,
          Constants.ENTITY_SITE_AREA,
          siteArea.id,
          560, 'SiteAreaService', 'handleUpdateSiteArea',
          req.user);
      }

      siteArea.lastChangedBy = new User(req.user.tenantID, {'id': req.user.id});
      siteArea.lastChangedOn = new Date();
      siteArea.image = filteredRequest.image;
      siteArea.maximumPower = filteredRequest.maximumPower;
      siteArea.name = filteredRequest.name;
      siteArea.address = filteredRequest.address;
      siteArea.accessControl = filteredRequest.accessControl;
      siteArea.siteID = filteredRequest.siteID;

      // Update Site Area
      await SiteAreaStorage.saveSiteArea(req.user.tenantID, siteArea, true);

      // Log
      Logging.logSecurityInfo({
        tenantID: req.user.tenantID,
        user: req.user, module: 'SiteAreaService', method: 'handleUpdateSiteArea',
        message: `Site Area '${siteArea.name}' has been updated successfully`,
        action: action, detailedMessages: siteArea});
      // Ok
      res.json(Constants.REST_RESPONSE_SUCCESS);
      next();
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }
}
