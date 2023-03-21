import { Action, Entity } from '../../../../types/Authorization';
import { NextFunction, Request, Response } from 'express';
import SiteArea, { SubSiteAreaAction } from '../../../../types/SiteArea';
import Tenant, { TenantComponents } from '../../../../types/Tenant';

import AppError from '../../../../exception/AppError';
import AuthorizationService from './AuthorizationService';
import { ChargingProfilePurposeType } from '../../../../types/ChargingProfile';
import ChargingStation from '../../../../types/ChargingStation';
import Constants from '../../../../utils/Constants';
import ConsumptionStorage from '../../../../storage/mongodb/ConsumptionStorage';
import { HTTPError } from '../../../../types/HTTPError';
import LockingHelper from '../../../../locking/LockingHelper';
import LockingManager from '../../../../locking/LockingManager';
import Logging from '../../../../utils/Logging';
import LoggingHelper from '../../../../utils/LoggingHelper';
import OCPPUtils from '../../../ocpp/utils/OCPPUtils';
import { ServerAction } from '../../../../types/Server';
import SettingStorage from '../../../../storage/mongodb/SettingStorage';
import { SiteAreaDataResult } from '../../../../types/DataResult';
import SiteAreaStorage from '../../../../storage/mongodb/SiteAreaStorage';
import SiteAreaValidatorRest from '../validator/SiteAreaValidatorRest';
import SmartChargingFactory from '../../../../integration/smart-charging/SmartChargingFactory';
import { StatusCodes } from 'http-status-codes';
import UserToken from '../../../../types/UserToken';
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
    const filteredRequest = SiteAreaValidatorRest.getInstance().validateSiteAreaAssignAssetsReq(req.body);
    // Check and Get Site Area
    const authAction = action === ServerAction.ADD_ASSET_TO_SITE_AREA ? Action.ASSIGN_ASSETS_TO_SITE_AREA : Action.UNASSIGN_ASSETS_FROM_SITE_AREA;
    const siteArea = await UtilsService.checkAndGetSiteAreaAuthorization(
      req.tenant, req.user, filteredRequest.siteAreaID, authAction, action, null, { withSite: true });
    // Check and Get Assets
    const assets = await UtilsService.checkSiteAreaAssetsAuthorization(
      req.tenant, req.user, siteArea, filteredRequest.assetIDs, action);
    // Save
    if (action === ServerAction.ADD_ASSET_TO_SITE_AREA) {
      await SiteAreaStorage.addAssetsToSiteArea(
        req.tenant, siteArea.id, siteArea.siteID, siteArea.site.companyID, assets.map((asset) => asset.id));
    } else {
      await SiteAreaStorage.removeAssetsFromSiteArea(
        req.tenant, filteredRequest.siteAreaID, assets.map((asset) => asset.id));
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
    const filteredRequest = SiteAreaValidatorRest.getInstance().validateSiteAreaAssignChargingStationsReq(req.body);
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
        req.tenant, siteArea.id, siteArea.siteID, siteArea.site.companyID, chargingStations.map((chargingStation) => chargingStation.id));
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
    const siteAreaID = SiteAreaValidatorRest.getInstance().validateSiteAreaDeleteReq(req.query).ID;
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
    const filteredRequest = SiteAreaValidatorRest.getInstance().validateSiteAreaGetReq(req.query);
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
    // Check Tenant
    if (!req.tenant) {
      throw new AppError({
        errorCode: StatusCodes.BAD_REQUEST,
        message: 'Tenant must be provided',
        module: MODULE_NAME, method: 'handleGetSiteAreaImage', action: action,
      });
    }
    // Filter
    const filteredRequest = SiteAreaValidatorRest.getInstance().validateSiteAreaGetImageReq(req.query);
    // Get it
    const siteAreaImage = await SiteAreaStorage.getSiteAreaImage(
      req.tenant, filteredRequest.ID);
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
      res.setHeader('Content-Type', header);
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
    const filteredRequest = SiteAreaValidatorRest.getInstance().validateSiteAreasGetReq(req.query);
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
        withChargingStations: filteredRequest.WithChargingStations,
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
    if (filteredRequest.WithAuth) {
      await AuthorizationService.addSiteAreasAuthorizations(req.tenant, req.user, siteAreas as SiteAreaDataResult, authorizations);
    }
    // Handle smart charging session parameters
    await SiteAreaService.addSmartChargingSessionParametersActive(req.tenant, req.user, siteAreas as SiteAreaDataResult);
    res.json(siteAreas);
    next();
  }

  public static async handleGetSiteAreaConsumption(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ORGANIZATION,
      Action.LIST, Entity.SITE_AREA, MODULE_NAME, 'handleGetSiteAreaConsumption');
    // Filter request
    const filteredRequest = SiteAreaValidatorRest.getInstance().validateSiteAreaGetConsumptionReq(req.query);
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
    const parentSiteArea = await SiteAreaService.checkAndGetParentSiteArea(
      req.tenant, req.user, siteArea, siteArea.parentSiteAreaID, action);
    const rootSiteArea = await SiteAreaService.buildSiteAreaTree(req.tenant, siteArea, parentSiteArea, [siteArea.siteID]);
    const targetSiteArea = Utils.getSiteAreaFromSiteAreasTree(siteArea.id, [rootSiteArea]);
    // Get the ConsumptionValues
    const siteAreaIDs = Utils.getSiteAreaIDsFromSiteAreasTree(targetSiteArea);
    const consumptions = await ConsumptionStorage.getSiteAreaConsumptions(req.tenant, {
      siteAreaIDs: siteAreaIDs,
      startDate: filteredRequest.StartDate,
      endDate: filteredRequest.EndDate
    });
    if (siteAreaIDs.length > 1) {
      const limitAmps = Utils.createDecimal(siteArea.maximumPower).div(siteArea.voltage).toNumber();
      for (const consumption of consumptions) {
        consumption.limitWatts = siteArea.maximumPower;
        consumption.limitAmps = limitAmps;
      }
    }
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
    const filteredRequest = SiteAreaValidatorRest.getInstance().validateSiteAreaCreateReq(req.body);
    // Check Site Area auth
    await AuthorizationService.checkAndGetSiteAreaAuthorizations(req.tenant, req.user,
      {}, Action.CREATE, filteredRequest);
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
    // Build sub-Site Area actions
    const subSiteAreasActions = SiteAreaService.buildSubSiteAreaActions(
      action, req.user, siteArea, filteredRequest.subSiteAreasAction);
    // Check site area chain validity
    const rootSiteArea = await SiteAreaService.checkAndGetSiteAreaTree(
      req.tenant, siteArea, parentSiteArea, [siteArea.siteID], subSiteAreasActions);
    // Handle Site Area has children which have not the same site
    await SiteAreaService.processSubSiteAreaActions(
      req.tenant, rootSiteArea, siteArea, parentSiteArea, subSiteAreasActions);
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
    const filteredRequest = SiteAreaValidatorRest.getInstance().validateSiteAreaUpdateReq(req.body);
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
    const parentSiteArea = await SiteAreaService.checkAndGetParentSiteArea(
      req.tenant, req.user, siteArea, filteredRequest.parentSiteAreaID, action);
    // Check that Charging Station's nbr of phases is aligned with Site Area
    SiteAreaService.checkChargingStationNumberOfPhases(
      action, req.user, siteArea.chargingStations, filteredRequest.numberOfPhases);
    // Keep Parent ID
    const formerParentSiteAreaID = siteArea.parentSiteAreaID;
    // Keep the Site IDs to build the Site Area tree
    const treeSiteIDs: string[] = [siteArea.siteID];
    if (siteArea.siteID !== filteredRequest.siteID) {
      treeSiteIDs.push(filteredRequest.siteID);
    }
    // Update
    siteArea.name = filteredRequest.name;
    siteArea.address = filteredRequest.address;
    siteArea.numberOfPhases = filteredRequest.numberOfPhases;
    siteArea.maximumPower = filteredRequest.maximumPower;
    siteArea.voltage = filteredRequest.voltage;
    if (Utils.objectHasProperty(filteredRequest, 'image')) {
      siteArea.image = filteredRequest.image;
    }
    siteArea.numberOfPhases = filteredRequest.numberOfPhases;
    siteArea.smartCharging = filteredRequest.smartCharging;
    siteArea.smartChargingSessionParameters = filteredRequest.smartChargingSessionParameters;
    siteArea.accessControl = filteredRequest.accessControl;
    if (Utils.isComponentActiveFromToken(req.user, TenantComponents.OCPI) &&
        Utils.objectHasProperty(filteredRequest, 'tariffID')) {
      siteArea.tariffID = filteredRequest.tariffID;
    }
    siteArea.parentSiteAreaID = filteredRequest.parentSiteAreaID;
    siteArea.siteID = filteredRequest.siteID;
    siteArea.lastChangedBy = { 'id': req.user.id };
    siteArea.lastChangedOn = new Date();
    // Build sub-Site Area actions
    const subSiteAreasActions = SiteAreaService.buildSubSiteAreaActions(
      action, req.user, siteArea, filteredRequest.subSiteAreasAction);
    // Check Site Area tree
    const rootSiteArea = await SiteAreaService.checkAndGetSiteAreaTree(
      req.tenant, siteArea, parentSiteArea, treeSiteIDs, subSiteAreasActions);
    // Handle Site Area has children which have not the same site
    await SiteAreaService.processSubSiteAreaActions(
      req.tenant, rootSiteArea, siteArea, parentSiteArea, subSiteAreasActions, formerParentSiteAreaID);
    // Save
    await SiteAreaStorage.saveSiteArea(req.tenant, siteArea, Utils.objectHasProperty(filteredRequest, 'image'));
    // Update all refsx
    void SiteAreaStorage.updateEntitiesWithOrganizationIDs(
      req.tenant, site.companyID, filteredRequest.siteID, filteredRequest.id);
    // Clear Charging Profiles (async)
    if (!siteArea.smartCharging) {
      void OCPPUtils.clearAndDeleteChargingProfilesForSiteArea(
        req.tenant, siteArea, { profilePurposeType: ChargingProfilePurposeType.TX_PROFILE });
    }
    // Retrigger Smart Charging
    void SiteAreaService.triggerSmartCharging(req.tenant, action, siteArea);
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

  public static buildSubSiteAreaActions(action: ServerAction, user: UserToken, siteArea,
      subSiteAreasAction: string): SubSiteAreaAction[] {
    // Split
    const subSiteAreasActions = subSiteAreasAction ? subSiteAreasAction?.split('|') as SubSiteAreaAction[] : [];
    // Does not support yet multiple actions
    if (subSiteAreasActions?.length > 1) {
      throw new AppError({
        ...LoggingHelper.getSiteAreaProperties(siteArea),
        errorCode: HTTPError.SITE_AREA_TREE_ERROR_MULTIPLE_ACTIONS_NOT_SUPPORTED,
        message: `Multiple Actions on sub-Site Area is not supported: ${subSiteAreasActions.join(', ')}`,
        user, action, module: MODULE_NAME, method: 'buildSubSiteAreaActionsFromHttpRequest',
      });
    }
    return subSiteAreasActions;
  }

  private static async checkAndGetParentSiteArea(tenant: Tenant, user: UserToken, siteArea: SiteArea,
      parentSiteAreaID: string, action: ServerAction): Promise<SiteArea> {
    let parentSiteArea: SiteArea;
    if (parentSiteAreaID) {
      parentSiteArea = await UtilsService.checkAndGetSiteAreaAuthorization(
        tenant, user, parentSiteAreaID, Action.UPDATE, action);
      // Same ID as Parent?
      if (siteArea.id === parentSiteArea.id) {
        throw new AppError({
          ...LoggingHelper.getSiteAreaProperties(siteArea),
          errorCode: HTTPError.SITE_AREA_TREE_ERROR_SMART_SAME_SITE_AREA,
          message: `Site Area ID '${siteArea.siteID}' with name '${siteArea.name}' cannot be the parent of itself`,
          module: MODULE_NAME, method: 'checkAndGetParentSiteArea',
          detailedMessages: { siteArea, parentSiteArea },
        });
      }
    }
    return parentSiteArea;
  }

  private static checkChargingStationNumberOfPhases(action: ServerAction, user: UserToken,
      chargingStations: ChargingStation[], numberOfPhasesToUpdate: number) {
    if (numberOfPhasesToUpdate === 1) {
      for (const chargingStation of chargingStations) {
        for (const connector of chargingStation.connectors) {
          const numberOfPhases = Utils.getNumberOfConnectedPhases(chargingStation, null, connector.connectorId);
          if (numberOfPhases !== 1) {
            throw new AppError({
              ...LoggingHelper.getChargingStationProperties(chargingStation),
              errorCode: HTTPError.THREE_PHASE_CHARGER_ON_SINGLE_PHASE_SITE_AREA,
              message: `Error occurred while updating SiteArea.'${chargingStation.id}' is not single phased`,
              action, module: MODULE_NAME, method: 'checkChargingStationNumberOfPhases',
              user: user
            });
          }
        }
      }
    }
  }

  private static async triggerSmartCharging(tenant: Tenant, action: ServerAction, siteArea: SiteArea) {
    if (siteArea.smartCharging) {
      const siteAreaLock = await LockingHelper.acquireSiteAreaSmartChargingLock(tenant.id, siteArea);
      if (siteAreaLock) {
        try {
          const smartCharging = await SmartChargingFactory.getSmartChargingImpl(tenant);
          if (smartCharging) {
            await smartCharging.computeAndApplyChargingProfiles(siteArea);
          }
        } catch (error) {
          await Logging.logError({
            ...LoggingHelper.getSiteAreaProperties(siteArea),
            tenantID: tenant.id,
            action, module: MODULE_NAME, method: 'triggerSmartCharging',
            message: 'An error occurred while trying to call smart charging',
            detailedMessages: { error: error.stack }
          });
        } finally {
          await LockingManager.release(siteAreaLock);
        }
      }
    }
  }

  private static async addSmartChargingSessionParametersActive(tenant: Tenant, user: UserToken, siteAreas: SiteAreaDataResult) {
    siteAreas.smartChargingSessionParametersActive = false;
    if (Utils.isComponentActiveFromToken(user, TenantComponents.SMART_CHARGING)) {
      const smartChargingSettings = await SettingStorage.getSmartChargingSettings(tenant);
      if (smartChargingSettings.sapSmartCharging.prioritizationParametersActive) {
        siteAreas.smartChargingSessionParametersActive = true;
      }
    }
  }

  private static async processSubSiteAreaActions(tenant: Tenant, rootSiteArea: SiteArea,
      siteArea: SiteArea, parentSiteArea: SiteArea, subSiteAreasActions: SubSiteAreaAction[], formerParentSiteAreaID?: string) {
    if (rootSiteArea && !Utils.isEmptyArray(subSiteAreasActions)) {
      for (const subSiteAreasAction of subSiteAreasActions) {
        switch (subSiteAreasAction) {
          // Update Site ID in children
          case SubSiteAreaAction.UPDATE:
            await SiteAreaService.updateSiteAreaChildrenWithSiteID(
              tenant, [rootSiteArea], siteArea.siteID, siteArea.id);
            break;
          // Clear parent Site Area in children
          case SubSiteAreaAction.ATTACH:
            await SiteAreaStorage.attachSiteAreaChildrenToNewParent(
              tenant, siteArea.id, formerParentSiteAreaID);
            // Parent Site Area not belonging to the new Site
            if (parentSiteArea?.siteID !== siteArea.siteID) {
              delete siteArea.parentSiteAreaID;
            }
            break;
          // Clear parent Site Area in children
          case SubSiteAreaAction.CLEAR:
            await SiteAreaStorage.attachSiteAreaChildrenToNewParent(
              tenant, siteArea.id, null);
            break;
          // Update Smart Charging in children
          case SubSiteAreaAction.FORCE_SMART_CHARGING:
            await SiteAreaService.updateSiteAreaChildrenWithSmartCharging(
              tenant, [rootSiteArea], siteArea.smartCharging, siteArea.id);
            break;
        }
      }
    }
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
        // Clear Charging Profiles (async)
        if (!smartCharging) {
          void OCPPUtils.clearAndDeleteChargingProfilesForSiteArea(
            tenant, siteArea, { profilePurposeType: ChargingProfilePurposeType.TX_PROFILE });
        }
      }
      // Update children
      await SiteAreaService.updateSiteAreaChildrenWithSmartCharging(
        tenant, siteArea.childSiteAreas, smartCharging, currentSiteAreaID);
    }
  }

  private static async checkAndGetSiteAreaTree(tenant: Tenant, siteArea: SiteArea,
      parentSiteArea: SiteArea, siteIDs: string[], subSiteAreaActions?: SubSiteAreaAction[]): Promise<SiteArea> {
    // Build Site Area tree
    const rootSiteArea = await SiteAreaService.buildSiteAreaTree(tenant, siteArea, parentSiteArea, siteIDs);
    // Check Site Area children
    SiteAreaService.checkIfSiteAreaTreeIsConsistent(rootSiteArea, subSiteAreaActions);
    return rootSiteArea;
  }

  private static checkIfSiteAreaTreeIsConsistent(siteArea: SiteArea, subSiteAreaActions: SubSiteAreaAction[] = []): void {
    // Count and check all children and children of children
    for (const childSiteArea of siteArea.childSiteAreas) {
      // Check Site Area with Parent
      const actionOnSite = subSiteAreaActions.filter((subSiteAreaAction) =>
        [SubSiteAreaAction.ATTACH, SubSiteAreaAction.CLEAR, SubSiteAreaAction.UPDATE].includes(subSiteAreaAction));
      if (Utils.isEmptyArray(actionOnSite) &&
          siteArea.siteID !== childSiteArea.siteID) {
        throw new AppError({
          ...LoggingHelper.getSiteAreaProperties(siteArea),
          errorCode: HTTPError.SITE_AREA_TREE_ERROR_SITE,
          message: `Site ID between Site Area ('${siteArea.name}') and its child ('${childSiteArea.name}') differs`,
          module: MODULE_NAME, method: 'checkIfSiteAreaTreeIsConsistent',
          detailedMessages: { siteArea, childSiteArea },
        });
      }
      const actionOnSmartCharging = subSiteAreaActions.filter((subSiteAreaAction) =>
        SubSiteAreaAction.FORCE_SMART_CHARGING === subSiteAreaAction);
      if (Utils.isEmptyArray(actionOnSmartCharging) &&
          siteArea.smartCharging !== childSiteArea.smartCharging) {
        throw new AppError({
          ...LoggingHelper.getSiteAreaProperties(siteArea),
          errorCode: HTTPError.SITE_AREA_TREE_ERROR_SMART_CHARGING,
          message: `Smart Charging between Site Area ('${siteArea.name}') and its child ('${childSiteArea.name}') differs`,
          module: MODULE_NAME, method: 'checkIfSiteAreaTreeIsConsistent',
          detailedMessages: { siteArea, childSiteArea },
        });
      }
      if (siteArea.numberOfPhases !== childSiteArea.numberOfPhases) {
        throw new AppError({
          ...LoggingHelper.getSiteAreaProperties(siteArea),
          errorCode: HTTPError.SITE_AREA_TREE_ERROR_SMART_NBR_PHASES,
          message: `Number Of Phases between Site Area ('${siteArea.name}') and its child ('${childSiteArea.name}') differs`,
          module: MODULE_NAME, method: 'checkIfSiteAreaTreeIsConsistent',
          detailedMessages: { siteArea, childSiteArea },
        });
      }
      if (siteArea.voltage !== childSiteArea.voltage) {
        throw new AppError({
          ...LoggingHelper.getSiteAreaProperties(siteArea),
          errorCode: HTTPError.SITE_AREA_TREE_ERROR_VOLTAGE,
          message: `Voltage between Site Area ('${siteArea.name}') and its child ('${childSiteArea.name}') differs`,
          module: MODULE_NAME, method: 'checkIfSiteAreaTreeIsConsistent',
          detailedMessages: { siteArea, childSiteArea },
        });
      }
      // Process children
      SiteAreaService.checkIfSiteAreaTreeIsConsistent(childSiteArea, subSiteAreaActions);
    }
  }

  private static async buildSiteAreaTree(tenant: Tenant, siteArea: SiteArea, parentSiteArea: SiteArea, siteIDs: string[]): Promise<SiteArea> {
    // Get all Site Areas of the same Site
    const allSiteAreasOfSite = await SiteAreaStorage.getSiteAreas(tenant,
      { siteIDs, excludeSiteAreaIDs: siteArea.id ? [siteArea.id] : [], withSite: true }, Constants.DB_PARAMS_MAX_LIMIT,
      ['id', 'name', 'parentSiteAreaID', 'siteID', 'smartCharging', 'name', 'voltage', 'numberOfPhases', 'maximumPower', 'site.companyID']);
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
        module: MODULE_NAME, method: 'buildSiteAreaTree',
        detailedMessages: { error: error.stack, siteArea, parentSiteArea },
      });
    }
    // Get Site Area from Tree
    return Utils.getRootSiteAreaFromSiteAreasTree(siteArea.id, rootSiteAreas);
  }
}
