import { NextFunction, Request, Response } from 'express';
import Authorizations from '../../../authorization/Authorizations';
import AppAuthError from '../../../exception/AppAuthError';
import AppError from '../../../exception/AppError';
import BuildingStorage from '../../../storage/mongodb/BuildingStorage';
import SiteAreaStorage from '../../../storage/mongodb/SiteAreaStorage';
import { Action, Entity } from '../../../types/Authorization';
import Building from '../../../types/Building';
import { HTTPAuthError, HTTPError } from '../../../types/HTTPError';
import TenantComponents from '../../../types/TenantComponents';
import Constants from '../../../utils/Constants';
import Logging from '../../../utils/Logging';
import Utils from '../../../utils/Utils';
import BuildingSecurity from './security/BuildingSecurity';
import UtilsService from './UtilsService';

const MODULE_NAME = 'BuildingService';

export default class BuildingService {

  public static async handleAssignBuildingsToSiteArea(action: Action, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.BUILDING,
      Action.UPDATE, Entity.BUILDING, 'BuildingService', 'handleAssignBuildingsToSiteArea');
    const filteredRequest = BuildingSecurity.filterAssignBuildingsToSiteAreaRequest(req.body);
    // Check Mandatory fields
    UtilsService.assertIdIsProvided(action, filteredRequest.siteAreaID, 'BuildingService', 'handleAssignBuildingsToSiteArea', req.user);
    if (!filteredRequest.buildingIDs || (filteredRequest.buildingIDs && filteredRequest.buildingIDs.length <= 0)) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'The Building\'s IDs must be provided',
        module: MODULE_NAME,
        method: 'handleAssignBuildingsToSiteArea',
        user: req.user
      });
    }
    // Get the Site Area
    const siteArea = await SiteAreaStorage.getSiteArea(req.user.tenantID, filteredRequest.siteAreaID);
    UtilsService.assertObjectExists(action, siteArea, `Site Area '${filteredRequest.siteAreaID}' doesn't exist anymore.`,
      'BuildingService', 'handleAssignBuildingsToSiteArea', req.user);
    // Check auth
    if (!Authorizations.canUpdateSiteArea(req.user, siteArea.siteID)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.UPDATE,
        entity: Entity.SITE_AREA,
        module: MODULE_NAME,
        method: 'handleAssignBuildingsToSiteArea',
        value: filteredRequest.siteAreaID
      });
    }
    // Get Buildings
    for (const buildingID of filteredRequest.buildingIDs) {
      // Check the building
      const building = await BuildingStorage.getBuilding(req.user.tenantID, buildingID);
      UtilsService.assertObjectExists(action, building, `Building '${buildingID}' doesn't exist anymore.`,
        'BuildingService', 'handleAssignBuildingsToSiteArea', req.user);
      // Check auth
      if (!Authorizations.canUpdateBuilding(req.user)) {
        throw new AppAuthError({
          errorCode: HTTPAuthError.ERROR,
          user: req.user,
          action: Action.UPDATE,
          entity: Entity.BUILDING,
          module: MODULE_NAME,
          method: 'handleAssignBuildingsToSiteArea',
          value: buildingID
        });
      }
    }
    // Save
    if (action === Action.ADD_BUILDING_TO_SITE_AREA) {
      await BuildingStorage.addBuildingsToSiteArea(req.user.tenantID, filteredRequest.siteAreaID, filteredRequest.buildingIDs);
    } else {
      await BuildingStorage.removeBuildingsFromSiteArea(req.user.tenantID, filteredRequest.siteAreaID, filteredRequest.buildingIDs);
    }
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user,
      module: MODULE_NAME,
      method: 'handleAssignBuildingsToSiteArea',
      message: 'Site Area\'s Buildings have been assigned successfully',
      action: action
    });
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleDeleteBuilding(action: Action, req: Request, res: Response, next: NextFunction) {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.BUILDING,
      Action.DELETE, Entity.BUILDING, 'BuildingService', 'handleDeleteBuilding');
    // Filter
    const filteredRequest = BuildingSecurity.filterBuildingRequest(req.query);
    // Check Mandatory fields
    UtilsService.assertIdIsProvided(action, filteredRequest.ID, 'BuildingService', 'handleDeleteBuilding', req.user);
    // Check auth
    if (!Authorizations.canDeleteBuilding(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.DELETE,
        entity: Entity.BUILDING,
        module: MODULE_NAME,
        method: 'handleDeleteBuilding',
        value: filteredRequest.ID
      });
    }
    // Get
    const building = await BuildingStorage.getBuilding(req.user.tenantID, filteredRequest.ID,
      { withSiteArea: filteredRequest.WithSiteArea });
    // Found?
    UtilsService.assertObjectExists(action, building, `Building with ID '${building}' does not exist`,
      'BuildingService', 'handleDeleteBuilding', req.user);
    // Delete
    await BuildingStorage.deleteBuilding(req.user.tenantID, building.id);
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user, module: MODULE_NAME, method: 'handleDeleteBuilding',
      message: `Building '${building.name}' has been deleted successfully`,
      action: action,
      detailedMessages: { building }
    });
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleGetBuilding(action: Action, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.BUILDING,
      Action.READ, Entity.BUILDING, 'BuildingService', 'handleGetBuilding');
    // Filter
    const filteredRequest = BuildingSecurity.filterBuildingRequest(req.query);
    // ID is mandatory
    UtilsService.assertIdIsProvided(action, filteredRequest.ID, 'BuildingService', 'handleGetBuilding', req.user);
    // Check auth
    if (!Authorizations.canReadBuilding(req.user, filteredRequest.ID)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.READ,
        entity: Entity.BUILDING,
        module: MODULE_NAME,
        method: 'handleGetBuilding',
        value: filteredRequest.ID
      });
    }
    // Get it
    const building = await BuildingStorage.getBuilding(req.user.tenantID, filteredRequest.ID,
      { withSiteArea: filteredRequest.WithSiteArea });
    UtilsService.assertObjectExists(action, building, `Building with ID '${filteredRequest.ID}' does not exist`,
      'BuildingService', 'handleGetBuilding', req.user);
    // Return
    res.json(
      // Filter
      BuildingSecurity.filterBuildingResponse(building, req.user)
    );
    next();
  }

  public static async handleGetBuildingImage(action: Action, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.BUILDING,
      Action.READ, Entity.BUILDING, 'BuildingService', 'handleGetBuildingImage');
    // Filter
    const buildingID = BuildingSecurity.filterBuildingRequestByID(req.query);
    // Charge Box is mandatory
    UtilsService.assertIdIsProvided(action, buildingID, 'BuildingService', 'handleGetBuildingImage', req.user);
    // Check auth
    if (!Authorizations.canReadBuilding(req.user, buildingID)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.READ,
        entity: Entity.BUILDING,
        module: MODULE_NAME,
        method: 'handleGetBuildingImage',
        value: buildingID
      });
    }
    // Get it
    const buildingImage = await BuildingStorage.getBuildingImage(req.user.tenantID, buildingID);
    // Check
    UtilsService.assertObjectExists(action, buildingImage, `Building with ID '${buildingID}' does not exist`,
      'BuildingService', 'handleGetBuildingImage', req.user);
    // Return
    res.json({ id: buildingImage.id, image: buildingImage.image });
    next();
  }

  public static async handleGetBuildings(action: Action, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.BUILDING,
      Action.LIST, Entity.BUILDINGS, 'BuildingService', 'handleGetBuildings');
    // Check auth
    if (!Authorizations.canListBuildings(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.LIST,
        entity: Entity.BUILDINGS,
        module: MODULE_NAME,
        method: 'handleGetBuildings'
      });
    }
    // Filter
    const filteredRequest = BuildingSecurity.filterBuildingsRequest(req.query);
    // Get the buildings
    const buildings = await BuildingStorage.getBuildings(req.user.tenantID,
      {
        search: filteredRequest.Search,
        siteAreaIDs: (filteredRequest.SiteAreaID ? filteredRequest.SiteAreaID.split('|') : null),
        withSiteArea: filteredRequest.WithSiteArea,
        withNoSiteArea: filteredRequest.WithNoSiteArea
      },
      { limit: filteredRequest.Limit, skip: filteredRequest.Skip, sort: filteredRequest.Sort, onlyRecordCount: filteredRequest.OnlyRecordCount },
      [ 'id', 'name', 'siteAreaID', 'address.coordinates', 'address.city', 'address.country', 'siteArea.id', 'siteArea.name']
    );
    // Filter
    BuildingSecurity.filterBuildingsResponse(buildings, req.user);
    // Return
    res.json(buildings);
    next();
  }

  public static async handleCreateBuilding(action: Action, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.BUILDING,
      Action.CREATE, Entity.BUILDING, 'BuildingService', 'handleCreateBuilding');
    // Check auth
    if (!Authorizations.canCreateBuilding(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.CREATE,
        entity: Entity.BUILDING,
        module: MODULE_NAME,
        method: 'handleCreateBuilding'
      });
    }
    // Filter
    const filteredRequest = BuildingSecurity.filterBuildingCreateRequest(req.body);
    // Check Building
    Utils.checkIfBuildingValid(filteredRequest, req);
    // Check Site Area
    if (filteredRequest.siteAreaID) {
      const siteArea = await SiteAreaStorage.getSiteArea(req.user.tenantID, filteredRequest.siteAreaID);
      UtilsService.assertObjectExists(action, siteArea, `Site Area ID '${filteredRequest.siteAreaID}' does not exist`,
        'BuildingService', 'handleCreateBuilding', req.user);
    }
    // Create building
    const newBuilding: Building = {
      ...filteredRequest,
      createdBy: { id: req.user.id },
      createdOn: new Date()
    } as Building;
    // Save
    newBuilding.id = await BuildingStorage.saveBuilding(req.user.tenantID, newBuilding);
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user, module: MODULE_NAME, method: 'handleCreateBuilding',
      message: `Building '${newBuilding.id}' has been created successfully`,
      action: action,
      detailedMessages: { building: newBuilding }
    });
    // Ok
    res.json(Object.assign({ id: newBuilding.id }, Constants.REST_RESPONSE_SUCCESS));
    next();
  }

  public static async handleUpdateBuilding(action: Action, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.BUILDING,
      Action.UPDATE, Entity.BUILDING, 'BuildingService', 'handleUpdateBuilding');
    // Filter
    const filteredRequest = BuildingSecurity.filterBuildingUpdateRequest(req.body);
    // Check auth
    if (!Authorizations.canUpdateBuilding(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.UPDATE,
        entity: Entity.BUILDING,
        module: MODULE_NAME,
        method: 'handleUpdateBuilding',
        value: filteredRequest.id
      });
    }
    // Check Site Area
    if (filteredRequest.siteAreaID) {
      const siteArea = await SiteAreaStorage.getSiteArea(req.user.tenantID, filteredRequest.siteAreaID);
      UtilsService.assertObjectExists(action, siteArea, `Site Area ID '${filteredRequest.siteAreaID}' does not exist`,
        'BuildingService', 'handleUpdateBuilding', req.user);
    }
    // Check email
    const building = await BuildingStorage.getBuilding(req.user.tenantID, filteredRequest.id);
    // Check
    UtilsService.assertObjectExists(action, building, `Site Area with ID '${filteredRequest.id}' does not exist`,
      'BuildingService', 'handleUpdateBuilding', req.user);
    // Check Mandatory fields
    Utils.checkIfBuildingValid(filteredRequest, req);
    // Update
    building.name = filteredRequest.name;
    building.siteAreaID = filteredRequest.siteAreaID;
    building.address = filteredRequest.address;
    building.image = filteredRequest.image;
    building.lastChangedBy = { 'id': req.user.id };
    building.lastChangedOn = new Date();
    // Update Building
    await BuildingStorage.saveBuilding(req.user.tenantID, building);
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user, module: MODULE_NAME, method: 'handleUpdateBuilding',
      message: `Building '${building.name}' has been updated successfully`,
      action: action,
      detailedMessages: { building }
    });
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }
}
