import { Action, Entity } from '../../../../types/Authorization';
import { HTTPAuthError, HTTPError } from '../../../../types/HTTPError';
import { NextFunction, Request, Response } from 'express';

import { ActionsResponse } from '../../../../types/GlobalType';
import AppAuthError from '../../../../exception/AppAuthError';
import AppError from '../../../../exception/AppError';
import AuthorizationService from './AuthorizationService';
import { ChargingProfilePurposeType } from '../../../../types/ChargingProfile';
import Constants from '../../../../utils/Constants';
import ConsumptionStorage from '../../../../storage/mongodb/ConsumptionStorage';
import LockingHelper from '../../../../locking/LockingHelper';
import LockingManager from '../../../../locking/LockingManager';
import Logging from '../../../../utils/Logging';
import OCPPUtils from '../../../ocpp/utils/OCPPUtils';
import { ServerAction } from '../../../../types/Server';
import SiteArea from '../../../../types/SiteArea';
import { SiteAreaDataResult } from '../../../../types/DataResult';
import SiteAreaStorage from '../../../../storage/mongodb/SiteAreaStorage';
import SiteAreaValidator from '../validator/SiteAreaValidator';
import SmartChargingFactory from '../../../../integration/smart-charging/SmartChargingFactory';
import { TenantComponents } from '../../../../types/Tenant';
import TenantStorage from '../../../../storage/mongodb/TenantStorage';
import Utils from '../../../../utils/Utils';
import UtilsService from './UtilsService';
import moment from 'moment';

const MODULE_NAME = 'SiteAreaService';

export default class SiteAreaService {
  public static async handleAssignAssetsToSiteArea(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ASSET,
      Action.UPDATE, Entity.ASSET, MODULE_NAME, 'handleAssignAssetsToSiteArea');
    // Filter request
    const filteredRequest = SiteAreaValidator.getInstance().validateSiteAreaAssignAssetsReq(req.body);
    // Check and Get Site Area
    const authAction = action === ServerAction.ADD_ASSET_TO_SITE_AREA ? Action.ASSIGN_ASSETS_TO_SITE_AREA : Action.UNASSIGN_ASSETS_FROM_SITE_AREA;
    const siteArea = await UtilsService.checkAndGetSiteAreaAuthorization(
      req.tenant, req.user, filteredRequest.siteAreaID, authAction, action);
    // Check and Get Assets
    const assets = await UtilsService.checkSiteAreaAssetsAuthorization(
      req.tenant, req.user, siteArea, filteredRequest.assetIDs, action);
    // Save
    if (action === ServerAction.ADD_ASSET_TO_SITE_AREA) {
      await SiteAreaStorage.addAssetsToSiteArea(req.tenant, siteArea, assets.map((asset) => asset.id));
    } else {
      await SiteAreaStorage.removeAssetsFromSiteArea(req.tenant, filteredRequest.siteAreaID, assets.map((asset) => asset.id));
    }
    await Logging.logInfo({
      tenantID: req.user.tenantID,
      user: req.user,
      module: MODULE_NAME,
      method: 'handleAssignAssetsToSiteArea',
      message: 'Site Area\'s Assets have been assigned successfully',
      action: action
    });
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleAssignChargingStationsToSiteArea(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ORGANIZATION,
      Action.UPDATE, Entity.CHARGING_STATION, MODULE_NAME, 'handleAssignChargingStationsToSiteArea');
    // Filter request
    const filteredRequest = SiteAreaValidator.getInstance().validateSiteAreaAssignChargingStationsReq(req.body);
    // Check and Get Site Area
    const authAction = action === ServerAction.ADD_CHARGING_STATIONS_TO_SITE_AREA ? Action.ASSIGN_CHARGING_STATIONS_TO_SITE_AREA : Action.UNASSIGN_CHARGING_STATIONS_FROM_SITE_AREA;
    const siteArea = await UtilsService.checkAndGetSiteAreaAuthorization(
      req.tenant, req.user, filteredRequest.siteAreaID, authAction, action, null, { withSite: true });
    // Check and Get Charging Stations
    const chargingStations = await UtilsService.checkSiteAreaChargingStationsAuthorization(
      req.tenant, req.user, siteArea, filteredRequest.chargingStationIDs, action);
    // Check if Charging Station has 3 phases on 1 phase Site Area
    if (siteArea.numberOfPhases === 1) {
      for (const chargingStation of chargingStations) {
        for (const connector of chargingStation.connectors) {
          const chargePoint = Utils.getChargePointFromID(chargingStation, connector.chargePointID);
          const numberOfConnectedPhase = Utils.getNumberOfConnectedPhases(chargingStation, chargePoint, connector.connectorId);
          if (numberOfConnectedPhase !== 1 && action === ServerAction.ADD_CHARGING_STATIONS_TO_SITE_AREA) {
            throw new AppError({
              action: action,
              errorCode: HTTPError.THREE_PHASE_CHARGER_ON_SINGLE_PHASE_SITE_AREA,
              message: `Error occurred while assigning charging station: '${chargingStation.id}'. Charging Station is not single phased`,
              module: MODULE_NAME, method: 'handleAssignChargingStationsToSiteArea',
              user: req.user
            });
          }
        }
      }
    }
    // Save
    if (action === ServerAction.ADD_CHARGING_STATIONS_TO_SITE_AREA) {
      await SiteAreaStorage.addChargingStationsToSiteArea(
        req.tenant, siteArea, chargingStations.map((chargingStation) => chargingStation.id));
    } else {
      await SiteAreaStorage.removeChargingStationsFromSiteArea(
        req.tenant, filteredRequest.siteAreaID, chargingStations.map((chargingStation) => chargingStation.id));
    }
    // Log
    await Logging.logInfo({
      tenantID: req.user.tenantID,
      user: req.user,
      module: MODULE_NAME, method: 'handleAssignChargingStationsToSiteArea',
      message: 'Site Area\'s Charging Stations have been assigned successfully',
      action: action
    });
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleDeleteSiteArea(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ORGANIZATION,
      Action.DELETE, Entity.SITE_AREA, MODULE_NAME, 'handleDeleteSiteArea');
    // Filter request
    const siteAreaID = SiteAreaValidator.getInstance().validateSiteAreaGetReq(req.query).ID;
    UtilsService.assertIdIsProvided(action, siteAreaID, MODULE_NAME, 'handleDeleteSiteArea', req.user);
    // Check and Get Site Area
    const siteArea = await UtilsService.checkAndGetSiteAreaAuthorization(
      req.tenant, req.user, siteAreaID, Action.DELETE, action);
    // Check if site area ha dependencies on other site areas
    await UtilsService.checkIfSiteAreaHasDependencies(siteArea.id, req);
    // Delete
    await SiteAreaStorage.deleteSiteArea(req.tenant, siteArea.id);
    // Log
    await Logging.logInfo({
      tenantID: req.user.tenantID,
      user: req.user, module: MODULE_NAME, method: 'handleDeleteSiteArea',
      message: `Site Area '${siteArea.name}' has been deleted successfully`,
      action: action,
      detailedMessages: { siteArea }
    });
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleGetSiteArea(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ORGANIZATION,
      Action.READ, Entity.SITE_AREA, MODULE_NAME, 'handleGetSiteArea');
    // Filter request
    const filteredRequest = SiteAreaValidator.getInstance().validateSiteAreaGetReq(req.query);
    // Check and Get Site Area
    const siteArea = await UtilsService.checkAndGetSiteAreaAuthorization(
      req.tenant, req.user, filteredRequest.ID, Action.READ, action, null, {
        withSite: filteredRequest.WithSite,
        withParentSiteArea: filteredRequest.WithParentSiteArea,
        withChargingStations: filteredRequest.WithChargingStations,
        withImage: true,
      }, true);
    res.json(siteArea);
    next();
  }

  public static async handleGetSiteAreaImage(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = SiteAreaValidator.getInstance().validateSiteAreaGetImageReq(req.query);
    // Get it
    const siteAreaImage = await SiteAreaStorage.getSiteAreaImage(
      await TenantStorage.getTenant(filteredRequest.TenantID), filteredRequest.ID);
    if (siteAreaImage?.image) {
      let header = 'image';
      let encoding: BufferEncoding = 'base64';
      // Remove encoding header
      if (siteAreaImage.image.startsWith('data:image/')) {
        header = siteAreaImage.image.substring(5, siteAreaImage.image.indexOf(';'));
        encoding = siteAreaImage.image.substring(siteAreaImage.image.indexOf(';') + 1, siteAreaImage.image.indexOf(',')) as BufferEncoding;
        siteAreaImage.image = siteAreaImage.image.substring(siteAreaImage.image.indexOf(',') + 1);
      }
      res.setHeader('content-type', header);
      res.send(siteAreaImage.image ? Buffer.from(siteAreaImage.image, encoding) : null);
    } else {
      res.send(null);
    }
    next();
  }

  public static async handleGetSiteAreas(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ORGANIZATION,
      Action.LIST, Entity.SITE_AREA, MODULE_NAME, 'handleGetSiteAreas');
    // Filter
    const filteredRequest = SiteAreaValidator.getInstance().validateSiteAreasGetReq(req.query);
    // Create GPS Coordinates
    if (filteredRequest.LocLongitude && filteredRequest.LocLatitude) {
      filteredRequest.LocCoordinates = [
        Utils.convertToFloat(filteredRequest.LocLongitude),
        Utils.convertToFloat(filteredRequest.LocLatitude)
      ];
    }
    // Check dynamic auth
    const authorizationSiteAreasFilter = await AuthorizationService.checkAndGetSiteAreasAuthorizations(
      req.tenant, req.user, filteredRequest);
    if (!authorizationSiteAreasFilter.authorized) {
      UtilsService.sendEmptyDataResult(res, next);
      return;
    }
    // Get the SiteAreas
    const siteAreas = await SiteAreaStorage.getSiteAreas(req.tenant,
      {
        issuer: filteredRequest.Issuer,
        search: filteredRequest.Search,
        withSite: filteredRequest.WithSite,
        withParentSiteArea: filteredRequest.WithParentSiteArea,
        withChargingStations: filteredRequest.WithChargeBoxes,
        withAvailableChargingStations: filteredRequest.WithAvailableChargers,
        locCoordinates: filteredRequest.LocCoordinates,
        locMaxDistanceMeters: filteredRequest.LocMaxDistanceMeters,
        siteIDs: (filteredRequest.SiteID ? filteredRequest.SiteID.split('|') : null),
        companyIDs: (filteredRequest.CompanyID ? filteredRequest.CompanyID.split('|') : null),
        ...authorizationSiteAreasFilter.filters
      },
      {
        limit: filteredRequest.Limit,
        skip: filteredRequest.Skip,
        sort: UtilsService.httpSortFieldsToMongoDB(filteredRequest.SortFields),
        onlyRecordCount: filteredRequest.OnlyRecordCount
      },
      authorizationSiteAreasFilter.projectFields
    );
    // Assign projected fields
    if (authorizationSiteAreasFilter.projectFields) {
      siteAreas.projectFields = authorizationSiteAreasFilter.projectFields;
    }
    // Add Auth flags
    await AuthorizationService.addSiteAreasAuthorizations(req.tenant, req.user, siteAreas as SiteAreaDataResult,
      authorizationSiteAreasFilter);
    res.json(siteAreas);
    next();
  }

  public static async handleGetSiteAreaConsumption(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ORGANIZATION,
      Action.LIST, Entity.SITE_AREA, MODULE_NAME, 'handleGetSiteAreaConsumption');
    // Filter request
    const filteredRequest = SiteAreaValidator.getInstance().validateSiteAreaGetConsumptionReq(req.query);
    // Check dates
    if (filteredRequest.StartDate && filteredRequest.EndDate &&
      moment(filteredRequest.StartDate).isAfter(moment(filteredRequest.EndDate))) {
      throw new AppError({
        errorCode: HTTPError.GENERAL_ERROR,
        message: `The requested start date '${filteredRequest.StartDate.toISOString()}' is after the end date '${filteredRequest.EndDate.toISOString()}' `,
        module: MODULE_NAME, method: 'handleGetSiteAreaConsumption',
        user: req.user,
        action: action
      });
    }
    // Check and Get Site Area
    const siteArea = await UtilsService.checkAndGetSiteAreaAuthorization(
      req.tenant, req.user, filteredRequest.SiteAreaID, Action.READ, action);
    // Get the ConsumptionValues
    const consumptions = await ConsumptionStorage.getSiteAreaConsumptions(req.tenant, {
      siteAreaID: filteredRequest.SiteAreaID,
      startDate: filteredRequest.StartDate,
      endDate: filteredRequest.EndDate
    });
    // Assign
    siteArea.values = consumptions;
    res.json(siteArea);
    next();
  }

  public static async handleCreateSiteArea(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ORGANIZATION,
      Action.CREATE, Entity.SITE_AREA, MODULE_NAME, 'handleCreateSiteArea');
    // Filter request
    const filteredRequest = SiteAreaValidator.getInstance().validateSiteAreaCreateReq(req.body);
    // Check request data is valid
    UtilsService.checkIfSiteAreaValid(filteredRequest, req);
    // Check auth
    const authorizationFilters = await AuthorizationService.checkAndGetSiteAreaAuthorizations(req.tenant, req.user,
      {}, Action.CREATE, filteredRequest);
    if (!authorizationFilters.authorized) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.CREATE, entity: Entity.SITE_AREA,
        module: MODULE_NAME, method: 'handleCreateSiteArea'
      });
    }
    // Check Site auth
    await UtilsService.checkAndGetSiteAuthorization(
      req.tenant, req.user, filteredRequest.siteID, Action.UPDATE, action);
    // Create Site Area
    const newSiteArea: SiteArea = {
      ...filteredRequest,
      issuer: true,
      createdBy: { id: req.user.id },
      createdOn: new Date()
    } as SiteArea;
    // Check site area chain validity
    await UtilsService.checkIfSiteAreaTreeValid(newSiteArea, req);
    // Save
    newSiteArea.id = await SiteAreaStorage.saveSiteArea(req.tenant, newSiteArea, true);
    await Logging.logInfo({
      tenantID: req.user.tenantID,
      user: req.user, module: MODULE_NAME, method: 'handleCreateSiteArea',
      message: `Site Area '${newSiteArea.name}' has been created successfully`,
      action: action,
      detailedMessages: { siteArea: newSiteArea }
    });
    res.json(Object.assign({ id: newSiteArea.id }, Constants.REST_RESPONSE_SUCCESS));
    next();
  }

  public static async handleUpdateSiteArea(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ORGANIZATION,
      Action.UPDATE, Entity.SITE_AREA, MODULE_NAME, 'handleUpdateSiteArea');
    // Filter request
    const filteredRequest = SiteAreaValidator.getInstance().validateSiteAreaUpdateReq(req.body);
    // Check Mandatory fields
    UtilsService.checkIfSiteAreaValid(filteredRequest, req);
    // Check and Get SiteArea
    const siteArea = await UtilsService.checkAndGetSiteAreaAuthorization(
      req.tenant, req.user, filteredRequest.id, Action.UPDATE, action, filteredRequest, {
        withChargingStations: true,
      }, false);
    // Check Site auth
    await UtilsService.checkAndGetSiteAuthorization(
      req.tenant, req.user, filteredRequest.siteID, Action.READ, action);
    // Update
    siteArea.name = filteredRequest.name;
    siteArea.address = filteredRequest.address;
    siteArea.maximumPower = filteredRequest.maximumPower;
    siteArea.voltage = filteredRequest.voltage;
    if (Utils.objectHasProperty(filteredRequest, 'image')) {
      siteArea.image = filteredRequest.image;
    }
    if (filteredRequest.smartCharging && filteredRequest.numberOfPhases === 1) {
      for (const chargingStation of siteArea.chargingStations) {
        for (const connector of chargingStation.connectors) {
          const numberOfPhases = Utils.getNumberOfConnectedPhases(chargingStation, null, connector.connectorId);
          if (numberOfPhases !== 1) {
            throw new AppError({
              action: action,
              errorCode: HTTPError.THREE_PHASE_CHARGER_ON_SINGLE_PHASE_SITE_AREA,
              message: `Error occurred while updating SiteArea.'${chargingStation.id}' is not single phased`,
              module: MODULE_NAME, method: 'handleUpdateSiteArea',
              user: req.user
            });
          }
        }
      }
    }
    siteArea.numberOfPhases = filteredRequest.numberOfPhases;
    let actionsResponse: ActionsResponse;
    if (siteArea.smartCharging && !filteredRequest.smartCharging) {
      actionsResponse = await OCPPUtils.clearAndDeleteChargingProfilesForSiteArea(
        req.tenant, siteArea,
        { profilePurposeType: ChargingProfilePurposeType.TX_PROFILE });
    }
    siteArea.smartCharging = filteredRequest.smartCharging;
    siteArea.accessControl = filteredRequest.accessControl;
    siteArea.parentSiteAreaID = filteredRequest.parentSiteAreaID;
    const formerSiteID = siteArea.siteID;
    siteArea.siteID = filteredRequest.siteID;
    await UtilsService.checkIfSiteAreaTreeValid(siteArea, req, formerSiteID);
    siteArea.lastChangedBy = { 'id': req.user.id };
    siteArea.lastChangedOn = new Date();
    // Save
    await SiteAreaStorage.saveSiteArea(req.tenant, siteArea, Utils.objectHasProperty(filteredRequest, 'image'));
    // Retrigger Smart Charging
    if (filteredRequest.smartCharging) {
      // FIXME: the lock acquisition can wait for 30s before timeout and the whole code execution timeout at 3s
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      setTimeout(async () => {
        const siteAreaLock = await LockingHelper.acquireSiteAreaSmartChargingLock(req.user.tenantID, siteArea);
        if (siteAreaLock) {
          try {
            const smartCharging = await SmartChargingFactory.getSmartChargingImpl(req.tenant);
            if (smartCharging) {
              await smartCharging.computeAndApplyChargingProfiles(siteArea);
            }
          } catch (error) {
            await Logging.logError({
              tenantID: req.user.tenantID,
              module: MODULE_NAME, method: 'handleUpdateSiteArea',
              action: action,
              message: 'An error occurred while trying to call smart charging',
              detailedMessages: { error: error.stack }
            });
          } finally {
            // Release lock
            await LockingManager.release(siteAreaLock);
          }
        }
      }, Constants.DELAY_SMART_CHARGING_EXECUTION_MILLIS);
    }
    await Logging.logInfo({
      tenantID: req.user.tenantID,
      user: req.user, module: MODULE_NAME, method: 'handleUpdateSiteArea',
      message: `Site Area '${siteArea.name}' has been updated successfully`,
      action: action,
      detailedMessages: { siteArea }
    });
    if (actionsResponse && actionsResponse.inError > 0) {
      throw new AppError({
        action: action,
        errorCode: HTTPError.CLEAR_CHARGING_PROFILE_NOT_SUCCESSFUL,
        message: 'Error occurred while clearing Charging Profiles for Site Area',
        module: MODULE_NAME, method: 'handleUpdateSiteArea',
        user: req.user, actionOnUser: req.user
      });
    }
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }
}
