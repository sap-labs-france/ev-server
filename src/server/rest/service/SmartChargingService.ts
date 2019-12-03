import { NextFunction, Request, Response } from 'express';
import AppAuthError from '../../../exception/AppAuthError';
import AppError from '../../../exception/AppError';
import Authorizations from '../../../authorization/Authorizations';
import ChargingStationStorage from '../../../storage/mongodb/ChargingStationStorage';
import Constants from '../../../utils/Constants';
import Logging from '../../../utils/Logging';
import SiteAreaStorage from '../../../storage/mongodb/SiteAreaStorage';
import SmartChargingSecurity from './security/SmartChargingSecurity';
import SmartChargingStorage from '../../../storage/mongodb/SmartChargingStorage';
import Utils from '../../../utils/Utils';
import UtilsService from './UtilsService';
export default class SmartChargingService {

  public static async handleGetChargerManufacturerParameters(action: string, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = SmartChargingSecurity.filterChargerManufacturerParametersRequest(req.query);

    // Check auth
    if (!Authorizations.canReadChargingStation(req.user)) {
      throw new AppAuthError({
        errorCode: Constants.HTTP_AUTH_ERROR,
        user: req.user,
        action: Constants.ACTION_READ,
        entity: Constants.ENTITY_CHARGING_STATION,
        module: 'SmartChargingService',
        method: 'handleGetChargerManufacturerParameters',
      });
    }

    if (!filteredRequest.manufacturer || !filteredRequest.model) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: Constants.HTTP_GENERAL_ERROR,
        message: 'Manufacturer and Model must be provided',
        module: 'SmartChargingService',
        method: 'handleGetChargerManufacturerParameters',
        user: req.user
      });
    }
    // Get the Config
    const parameters = await SmartChargingStorage.getChargerManufacturerParameters(req.user.tenantID, filteredRequest.manufacturer, filteredRequest.model);
    // Return the result
    res.json(parameters.parameters);
    next();
  }


  public static async handleGetChargerSchedule(action: string, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = SmartChargingSecurity.filterChargerScheduleRequest(req.query);
    // Check
    UtilsService.assertIdIsProvided(filteredRequest.chargerID, 'SmartChargingService', 'handleGetChargerSchedule', req.user);
    // Get the Charging Station`
    const chargingStation = await ChargingStationStorage.getChargingStation(req.user.tenantID, filteredRequest.chargerID);
    // Found?
    UtilsService.assertObjectExists(chargingStation, `ChargingStation '${filteredRequest.chargerID}' doesn't exist anymore.`,
      'SmartChargingService', 'handleGetChargerSchedule', req.user);
    // Check auth - Own method required?
    if (!Authorizations.canReadChargingStation(req.user)) {
      throw new AppAuthError({
        errorCode: Constants.HTTP_AUTH_ERROR,
        user: req.user,
        action: Constants.ACTION_READ,
        entity: Constants.ENTITY_CHARGING_STATION,
        module: 'SmartChargingService',
        method: 'handleGetChargerSchedule',
        value: filteredRequest.chargerID
      });
    }

    // Get the Config
    const schedule = await SmartChargingStorage.getChargerSchedule(req.user.tenantID, filteredRequest.chargerID);
    // Return the result
    res.json(schedule.schedule);
    next();
  }

  public static async handleChargerScheduleUpdate(action: string, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = SmartChargingSecurity.filterChargerScheduleUpdateRequest(req.body);
    // Check existence
    const chargingStation = await ChargingStationStorage.getChargingStation(req.user.tenantID, filteredRequest.chargerID);
    // Check
    UtilsService.assertObjectExists(chargingStation, `ChargingStation '${filteredRequest.chargerID}' doesn't exist.`,
      'ChargingStationService', 'handleAssignChargingStationsToSiteArea', req.user);

    let siteID = null;
    if (Utils.isComponentActiveFromToken(req.user, Constants.COMPONENTS.ORGANIZATION)) {
      // Get the Site Area
      const siteArea = await SiteAreaStorage.getSiteArea(req.user.tenantID, chargingStation.siteAreaID);
      siteID = siteArea ? siteArea.siteID : null;
    }

    // Check Auth
    if (!Authorizations.canUpdateChargingStation(req.user, siteID)) {
      throw new AppAuthError({
        errorCode: Constants.HTTP_AUTH_ERROR,
        user: req.user,
        action: Constants.ACTION_UPDATE,
        entity: Constants.ENTITY_CHARGING_STATION,
        module: 'SmartChargingService',
        method: 'handleChargerScheduleUpdate',
        value: chargingStation.id
      });
    }

    if (!filteredRequest.chargerID) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: Constants.HTTP_GENERAL_ERROR,
        message: 'The Charger ID must be provided',
        module: 'SmartChargingService',
        method: 'handleChargerScheduleUpdate',
        user: req.user
      });
    }
    if (!filteredRequest.schedule) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: Constants.HTTP_GENERAL_ERROR,
        message: 'The charger schedule must be provided',
        module: 'SmartChargingService',
        method: 'handleChargerScheduleUpdate',
        user: req.user
      });
    }

    // Update
    await SmartChargingStorage.saveChargerSchedule(req.user.tenantID, filteredRequest);

    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      source: chargingStation.id,
      user: req.user, module: 'SmartChargingService',
      method: 'handleChargerScheduleUpdate',
      message: `${chargingStation.id} Schedule has been updated successfully`
    });

    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

}
