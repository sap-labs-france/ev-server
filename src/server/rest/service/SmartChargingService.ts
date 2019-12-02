import { NextFunction, Request, Response } from 'express';
import AppAuthError from '../../../exception/AppAuthError';
import AppError from '../../../exception/AppError';
import Authorizations from '../../../authorization/Authorizations';
import Constants from '../../../utils/Constants';
import Database from '../../../utils/Database';
import Logging from '../../../utils/Logging';
import SmartChargingSecurity from './security/SmartChargingSecurity';
import SmartChargingStorage from '../../../storage/mongodb/SmartChargingStorage';


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

    // Get the Config
    const parameters = await SmartChargingStorage.getChargerManufacturerParameters(req.user.tenantID, filteredRequest.Manufacturer, filteredRequest.Model);
    // Return the result
    res.json(parameters.parameters);
    next();
  }


  public static async handleGetChargerSchedule(action: string, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = SmartChargingSecurity.filterChargerScheduleRequest(req.query);
    // Check auth - needs to be implemented
    // if (!Authorizations.canReadSmartCharing(req.user)) {
    //   throw new AppAuthError({
    //     errorCode: Constants.HTTP_AUTH_ERROR,
    //     user: req.user,
    //     action: Constants.ACTION_READ,
    //     entity: Constants.ENTITY_SMART_CHARGING,
    //     module: 'SmartChargingService',
    //     method: 'handleGetChargerSchedule',
    //     value
    //   });
    // }

    // Get the Config
    const schedule = await SmartChargingStorage.getChargerSchedule(req.user.tenantID, filteredRequest.ChargerID);
    // Return the result
    res.json(schedule.schedule);
    next();
  }

}
