import { Action, Entity } from '../../../../types/Authorization';
import { HTTPAuthError, HTTPError } from '../../../../types/HTTPError';
import { NextFunction, Request, Response } from 'express';
import SiteArea, { SubSiteAreaAction } from '../../../../types/SiteArea';
import Tenant, { TenantComponents } from '../../../../types/Tenant';

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
import LoggingHelper from '../../../../utils/LoggingHelper';
import OCPPUtils from '../../../ocpp/utils/OCPPUtils';
import { ServerAction } from '../../../../types/Server';
import { SiteAreaDataResult } from '../../../../types/DataResult';
import SiteAreaStorage from '../../../../storage/mongodb/SiteAreaStorage';
import SiteAreaValidator from '../validator/SiteAreaValidator';
import SmartChargingFactory from '../../../../integration/smart-charging/SmartChargingFactory';
import { StatusCodes } from 'http-status-codes';
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
      ...LoggingHelper.getSiteAreaProperties(siteArea),
      tenantID: req.tenant.id,
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
              ...LoggingHelper.getSiteAreaProperties(siteArea),
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
      ...LoggingHelper.getSiteAreaProperties(siteArea),
      tenantID: req.tenant.id,
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
    // Delete
    await SiteAreaStorage.deleteSiteArea(req.tenant, siteArea.id);
    // Update children
    await SiteAreaStorage.attachSiteAreaChildrenToNewParent(req.tenant, siteArea.id, siteArea.parentSiteAreaID);
    // Log
    await Logging.logInfo({
      ...LoggingHelper.getSiteAreaProperties(siteArea),
      tenantID: req.tenant.id,
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
    let image = siteAreaImage?.image;
    if (image) {
      // Header
      let header = 'image';
      let encoding: BufferEncoding = 'base64';
      if (image.startsWith('data:image/')) {
        header = image.substring(5, image.indexOf(';'));
        encoding = image.substring(image.indexOf(';') + 1, image.indexOf(',')) as BufferEncoding;
        image = image.substring(image.indexOf(',') + 1);
      }
      res.setHeader('content-type', header);
      res.send(Buffer.from(image, encoding));
    } else {
      res.status(StatusCodes.NOT_FOUND);
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
    const authorizations = await AuthorizationService.checkAndGetSiteAreasAuthorizations(
      req.tenant, req.user, filteredRequest, false);
    if (!authorizations.authorized) {
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
        excludeSiteAreaIDs: (filteredRequest.ExcludeSiteAreaID ? filteredRequest.ExcludeSiteAreaID.split('|') : null),
        siteIDs: (filteredRequest.SiteID ? filteredRequest.SiteID.split('|') : null),
        companyIDs: (filteredRequest.CompanyID ? filteredRequest.CompanyID.split('|') : null),
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
      siteAreas.projectFields = authorizations.projectFields;
    }
    // Add Auth flags
    await AuthorizationService.addSiteAreasAuthorizations(req.tenant, req.user, siteAreas as SiteAreaDataResult,
      authorizations);
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
    const authorizations = await AuthorizationService.checkAndGetSiteAreaAuthorizations(req.tenant, req.user,
      {}, Action.CREATE, filteredRequest);
    if (!authorizations.authorized) {
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
    // Check parent Site Area auth
    let parentSiteArea: SiteArea;
    if (filteredRequest.parentSiteAreaID) {
      parentSiteArea = await UtilsService.checkAndGetSiteAreaAuthorization(
        req.tenant, req.user, filteredRequest.parentSiteAreaID, Action.UPDATE, action);
    }
    // Create Site Area
    const siteArea: SiteArea = {
      ...filteredRequest,
      parentSiteArea: parentSiteArea,
      issuer: true,
      createdBy: { id: req.user.id },
      createdOn: new Date(),
    } as SiteArea;
    // Check site area chain validity
    await SiteAreaService.checkAndGetSiteAreaTree(req.tenant, siteArea, parentSiteArea, [siteArea.siteID]);
    // Save
    siteArea.id = await SiteAreaStorage.saveSiteArea(req.tenant, siteArea, Utils.objectHasProperty(filteredRequest, 'image'));
    await Logging.logInfo({
      ...LoggingHelper.getSiteAreaProperties(siteArea),
      tenantID: req.tenant.id,
      user: req.user, module: MODULE_NAME, method: 'handleCreateSiteArea',
      message: `Site Area '${siteArea.name}' has been created successfully`,
      action: action,
      detailedMessages: { siteArea: siteArea }
    });
    res.json(Object.assign({ id: siteArea.id }, Constants.REST_RESPONSE_SUCCESS));
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
        withSite: true,
      }, false);
    // Check Site auth
    const site = await UtilsService.checkAndGetSiteAuthorization(
      req.tenant, req.user, filteredRequest.siteID, Action.READ, action);
    // Check parent Site Area auth
    let parentSiteArea: SiteArea;
    if (filteredRequest.parentSiteAreaID) {
      parentSiteArea = await UtilsService.checkAndGetSiteAreaAuthorization(
        req.tenant, req.user, filteredRequest.parentSiteAreaID, Action.UPDATE, action);
      // Same ID as Parent?
      if (siteArea.id === parentSiteArea.id) {
        throw new AppError({
          ...LoggingHelper.getSiteAreaProperties(siteArea),
          errorCode: HTTPError.SITE_AREA_TREE_ERROR_SMART_SAME_SITE_AREA,
          message: `Site Area ID '${siteArea.siteID}' with name '${siteArea.name}' cannot be the parent of itself`,
          module: MODULE_NAME, method: 'handleUpdateSiteArea',
          detailedMessages: { siteArea, parentSiteArea },
        });
      }
    }
    // Check that Charging Station's nbr of phases is aligned with Site Area
    if (filteredRequest.smartCharging && filteredRequest.numberOfPhases === 1) {
      for (const chargingStation of siteArea.chargingStations) {
        for (const connector of chargingStation.connectors) {
          const numberOfPhases = Utils.getNumberOfConnectedPhases(chargingStation, null, connector.connectorId);
          if (numberOfPhases !== 1) {
            throw new AppError({
              ...LoggingHelper.getSiteAreaProperties(siteArea),
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
    if (Utils.isComponentActiveFromToken(req.user, TenantComponents.OCPI) &&
        Utils.objectHasProperty(filteredRequest, 'tariffID')) {
      siteArea.tariffID = filteredRequest.tariffID;
    }
    // Update
    siteArea.name = filteredRequest.name;
    siteArea.address = filteredRequest.address;
    siteArea.maximumPower = filteredRequest.maximumPower;
    siteArea.voltage = filteredRequest.voltage;
    if (Utils.objectHasProperty(filteredRequest, 'image')) {
      siteArea.image = filteredRequest.image;
    }
    siteArea.numberOfPhases = filteredRequest.numberOfPhases;
    if (Utils.isComponentActiveFromToken(req.user, TenantComponents.OCPI) &&
        Utils.objectHasProperty(filteredRequest, 'tariffID')) {
      siteArea.tariffID = filteredRequest.tariffID;
    }
    siteArea.smartCharging = filteredRequest.smartCharging;
    siteArea.accessControl = filteredRequest.accessControl;
    const formerParentSiteAreaID = siteArea.parentSiteAreaID;
    siteArea.parentSiteAreaID = filteredRequest.parentSiteAreaID;
    // Keep the Site IDs to build the Site Area tree
    const treeSiteIDs: string[] = [siteArea.siteID];
    if (siteArea.siteID !== filteredRequest.siteID) {
      treeSiteIDs.push(filteredRequest.siteID);
    }
    siteArea.siteID = filteredRequest.siteID;
    siteArea.lastChangedBy = { 'id': req.user.id };
    siteArea.lastChangedOn = new Date();
    // Check Site Area tree
    const rootSiteArea = await SiteAreaService.checkAndGetSiteAreaTree(
      req.tenant, siteArea, parentSiteArea, treeSiteIDs, filteredRequest.subSiteAreasAction);
    // Handle Site Area has children which have not the same site
    if (rootSiteArea) {
      switch (filteredRequest.subSiteAreasAction) {
        // Update Site ID in children
        case SubSiteAreaAction.UPDATE:
          await SiteAreaService.updateSiteAreaChildrenWithSiteID(
            req.tenant, [rootSiteArea], siteArea.siteID, siteArea.id);
          break;
        // Clear parent Site Area in children
        case SubSiteAreaAction.ATTACH:
          await SiteAreaStorage.attachSiteAreaChildrenToNewParent(
            req.tenant, siteArea.id, formerParentSiteAreaID);
          // Parent Site Area not belonging to the new Site
          if (parentSiteArea?.siteID !== siteArea.siteID) {
            delete siteArea.parentSiteAreaID;
          }
          break;
        // Clear parent Site Area in children
        case SubSiteAreaAction.CLEAR:
          await SiteAreaStorage.attachSiteAreaChildrenToNewParent(
            req.tenant, siteArea.id, null);
          break;
        // Update Smart Charging in children
        case SubSiteAreaAction.FORCE_SMART_CHARGING:
          await SiteAreaService.updateSiteAreaChildrenWithSmartCharging(
            req.tenant, [rootSiteArea], siteArea.smartCharging, siteArea.id);
          break;
      }
    }
    // Save
    await SiteAreaStorage.saveSiteArea(req.tenant, siteArea, Utils.objectHasProperty(filteredRequest, 'image'));
    // Update all refs
    void SiteAreaStorage.updateEntitiesWithOrganizationIDs(
      req.tenant, site.companyID, filteredRequest.siteID, filteredRequest.id);
    // Retrigger Smart Charging
    if (filteredRequest.smartCharging) {
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      setTimeout(async () => {
        const siteAreaLock = await LockingHelper.acquireSiteAreaSmartChargingLock(req.tenant.id, siteArea);
        if (siteAreaLock) {
          try {
            const smartCharging = await SmartChargingFactory.getSmartChargingImpl(req.tenant);
            if (smartCharging) {
              await smartCharging.computeAndApplyChargingProfiles(siteArea);
            }
          } catch (error) {
            await Logging.logError({
              ...LoggingHelper.getSiteAreaProperties(siteArea),
              tenantID: req.tenant.id,
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
      ...LoggingHelper.getSiteAreaProperties(siteArea),
      tenantID: req.tenant.id,
      user: req.user, module: MODULE_NAME, method: 'handleUpdateSiteArea',
      message: `Site Area '${siteArea.name}' has been updated successfully`,
      action: action,
      detailedMessages: { siteArea }
    });
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  private static async updateSiteAreaChildrenWithSiteID(
      tenant: Tenant, siteAreas: SiteArea[], siteID: string, currentSiteAreaID: string): Promise<void> {
    for (const siteArea of siteAreas) {
      // Do not update the current Site Area (will be updated after)
      if (siteArea.id !== currentSiteAreaID) {
        // Update
        await SiteAreaStorage.updateSiteID(tenant, siteArea.id, siteID);
        // Update all refs
        void SiteAreaStorage.updateEntitiesWithOrganizationIDs(
          tenant, siteArea.site.companyID, siteID, siteArea.id);
      }
      // Update children
      await SiteAreaService.updateSiteAreaChildrenWithSiteID(
        tenant, siteArea.childSiteAreas, siteID, currentSiteAreaID);
    }
  }

  private static async updateSiteAreaChildrenWithSmartCharging(
      tenant: Tenant, siteAreas: SiteArea[], smartCharging: boolean, currentSiteAreaID: string): Promise<void> {
    for (const siteArea of siteAreas) {
      // Do not update the current Site Area (will be updated after)
      if (siteArea.id !== currentSiteAreaID) {
        // Update
        await SiteAreaStorage.updateSmartCharging(tenant, siteArea.id, smartCharging);
      }
      // Clear Charging Profiles (async)
      if (!smartCharging) {
        void OCPPUtils.clearAndDeleteChargingProfilesForSiteArea(
          tenant, siteArea, { profilePurposeType: ChargingProfilePurposeType.TX_PROFILE });
      }
      // Update children
      await SiteAreaService.updateSiteAreaChildrenWithSmartCharging(
        tenant, siteArea.childSiteAreas, smartCharging, currentSiteAreaID);
    }
  }

  private static async checkAndGetSiteAreaTree(tenant: Tenant, siteArea: SiteArea,
      parentSiteArea: SiteArea, siteIDs: string[], subSiteAreaAction?: SubSiteAreaAction): Promise<SiteArea> {
    // Build Site Area tree
    const rootSiteArea = await SiteAreaService.buildSiteAreaTree(tenant, siteArea, parentSiteArea, siteIDs);
    // Check Site Area children
    SiteAreaService.checkIfSiteAreaTreeISConsistent(rootSiteArea, subSiteAreaAction);
    return rootSiteArea;
  }

  private static checkIfSiteAreaTreeISConsistent(siteArea: SiteArea, subSiteAreaAction?: SubSiteAreaAction): void {
    // Count and check all children and children of children
    for (const childSiteArea of siteArea.childSiteAreas) {
      // Check Site Area with Parent
      if (![SubSiteAreaAction.ATTACH, SubSiteAreaAction.CLEAR, SubSiteAreaAction.UPDATE].includes(subSiteAreaAction) &&
          siteArea.siteID !== childSiteArea.siteID) {
        throw new AppError({
          ...LoggingHelper.getSiteAreaProperties(siteArea),
          errorCode: HTTPError.SITE_AREA_TREE_ERROR_SITE,
          message: `Site ID between Site Area ID ('${siteArea.id}') and its child ID ('${childSiteArea.id}') differs`,
          module: MODULE_NAME, method: 'checkIfSiteAreaTreeISConsistent',
          detailedMessages: { siteArea, childSiteArea },
        });
      }
      if (subSiteAreaAction !== SubSiteAreaAction.FORCE_SMART_CHARGING &&
          siteArea.smartCharging !== childSiteArea.smartCharging) {
        throw new AppError({
          ...LoggingHelper.getSiteAreaProperties(siteArea),
          errorCode: HTTPError.SITE_AREA_TREE_ERROR_SMART_CHARGING,
          message: `Smart Charging between Site Area ID ('${siteArea.id}') and its child ID ('${childSiteArea.id}') differs`,
          module: MODULE_NAME, method: 'checkIfSiteAreaTreeISConsistent',
          detailedMessages: { siteArea, childSiteArea },
        });
      }
      if (siteArea.numberOfPhases !== childSiteArea.numberOfPhases) {
        throw new AppError({
          ...LoggingHelper.getSiteAreaProperties(siteArea),
          errorCode: HTTPError.SITE_AREA_TREE_ERROR_SMART_NBR_PHASES,
          message: `Number Of Phases between Site Area ID ('${siteArea.id}') and its child ID ('${childSiteArea.id}') differs`,
          module: MODULE_NAME, method: 'checkIfSiteAreaTreeISConsistent',
          detailedMessages: { siteArea, childSiteArea },
        });
      }
      if (siteArea.voltage !== childSiteArea.voltage) {
        throw new AppError({
          ...LoggingHelper.getSiteAreaProperties(siteArea),
          errorCode: HTTPError.SITE_AREA_TREE_ERROR_VOLTAGE,
          message: `Voltage between Site Area ID ('${siteArea.id}') and its child ID ('${childSiteArea.id}') differs`,
          module: MODULE_NAME, method: 'checkIfSiteAreaTreeISConsistent',
          detailedMessages: { siteArea, childSiteArea },
        });
      }
      // Process children
      SiteAreaService.checkIfSiteAreaTreeISConsistent(childSiteArea, subSiteAreaAction);
    }
  }

  private static async buildSiteAreaTree(tenant: Tenant, siteArea: SiteArea, parentSiteArea: SiteArea, siteIDs: string[]): Promise<SiteArea> {
    // Get all Site Areas of the same Site
    const allSiteAreasOfSite = await SiteAreaStorage.getSiteAreas(tenant,
      { siteIDs, excludeSiteAreaIDs: siteArea.id ? [siteArea.id] : [], withSite: true }, Constants.DB_PARAMS_MAX_LIMIT,
      ['id', 'name', 'parentSiteAreaID', 'siteID', 'smartCharging', 'name', 'voltage', 'numberOfPhases', 'site.companyID']);
    // Add current Site Area
    allSiteAreasOfSite.result.push(siteArea);
    // Build tree
    let rootSiteAreas: SiteArea[];
    try {
      rootSiteAreas = Utils.buildSiteAreasTree(allSiteAreasOfSite.result);
    } catch (error) {
      throw new AppError({
        ...LoggingHelper.getSiteAreaProperties(siteArea),
        errorCode: HTTPError.SITE_AREA_TREE_ERROR,
        message: `Error while building the Site Area tree: '${error.message as string}'`,
        module: MODULE_NAME, method: 'checkIfSiteAreaParentAndChildrenValid',
        detailedMessages: { error: error.stack, siteArea, parentSiteArea },
      });
    }
    // Get Site Area from Tree
    return Utils.getRootSiteAreaFromSiteAreasTree(siteArea.id, rootSiteAreas);
  }
}
