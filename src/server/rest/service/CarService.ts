import { NextFunction, Request, Response } from 'express';
import Authorizations from '../../../authorization/Authorizations';
import AppAuthError from '../../../exception/AppAuthError';
import BackendError from '../../../exception/AppError';
import CarFactory from '../../../integration/car/CarFactory';
import CarStorage from '../../../storage/mongodb/CarStorage';
import { Action, Entity } from '../../../types/Authorization';
import { HTTPAuthError, HTTPError } from '../../../types/HTTPError';
import { ServerAction } from '../../../types/Server';
import TenantComponents from '../../../types/TenantComponents';
import Constants from '../../../utils/Constants';
import CarSecurity from './security/CarSecurity';
import UtilsService from './UtilsService';

const MODULE_NAME = 'CarService';

export default class CarService {
  public static async handleGetCarCatalogs(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    if (!Authorizations.isSuperAdmin(req.user)) {
      // Check if component is active
      UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.CAR, Action.LIST, Entity.CAR_CATALOGS, MODULE_NAME, 'handleGetCarCatalogs');
    }
    // Check auth
    if (!Authorizations.canListCarCatalogs(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.LIST,
        entity: Entity.CAR_CATALOGS,
        module: MODULE_NAME,
        method: 'handleGetCarCatalogs'
      });
    }
    // Filter
    const filteredRequest = CarSecurity.filterCarCatalogsRequest(req.query);
    // Get the cars
    const carCatalogs = await CarStorage.getCarCatalogs(
      {
        search: filteredRequest.Search,
        carMaker: filteredRequest.CarMaker ? filteredRequest.CarMaker.split('|') : null
      },
      { limit: filteredRequest.Limit, skip: filteredRequest.Skip, sort: filteredRequest.Sort, onlyRecordCount: filteredRequest.OnlyRecordCount },
      ['id', 'vehicleModel', 'vehicleMake', 'vehicleModelVersion', 'batteryCapacityFull', 'fastchargeChargeSpeed', 'performanceTopspeed',
        'performanceAcceleration', 'rangeWLTP', 'rangeReal', 'efficiencyReal', 'image', 'chargeStandardChargeSpeed',
        'chargeStandardPower', 'chargeStandardPhase', 'chargePlug', 'fastChargePlug', 'fastChargePowerMax', 'drivetrainPowerHP']
    );
    // Filter
    CarSecurity.filterCarCatalogsResponse(carCatalogs, req.user);
    // Return
    res.json(carCatalogs);
    next();
  }

  public static async handleGetCarCatalog(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    if (!Authorizations.isSuperAdmin(req.user)) {
      // Check if component is active
      UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.CAR, Action.READ, Entity.CAR_CATALOG, MODULE_NAME, 'handleGetCarCatalog');
    }
    // Check auth
    if (!Authorizations.canReadCarCatalog(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.LIST,
        entity: Entity.CAR_CATALOG,
        module: MODULE_NAME,
        method: 'handleGetCarCatalog'
      });
    }
    // Filter
    const filteredRequest = CarSecurity.filterCarCatalogRequest(req.query);
    UtilsService.assertIdIsProvided(action, filteredRequest.ID, MODULE_NAME, 'handleGetCarCatalog', req.user);

    let carCatalog;
    if (!Authorizations.isSuperAdmin(req.user)) {
      // Get the car
      carCatalog = await CarStorage.getCarCatalog(filteredRequest.ID,
        ['id', 'vehicleModel', 'vehicleMake', 'vehicleModelVersion', 'batteryCapacityFull', 'fastchargeChargeSpeed',
          'performanceTopspeed', 'performanceAcceleration', 'rangeWLTP', 'rangeReal', 'efficiencyReal', 'drivetrainPropulsion',
          'drivetrainTorque', 'batteryCapacityUseable', 'chargePlug', 'fastChargePlug', 'fastChargePowerMax', 'chargePlugLocation', 'drivetrainPowerHP',
          'chargeStandardChargeSpeed', 'chargeStandardChargeTime', 'miscSeats', 'miscBody', 'miscIsofix', 'miscTurningCircle',
          'miscSegment', 'miscIsofixSeats', 'chargeStandardTables', 'chargeStandardPower', 'chargeStandardPhase','image']);
    } else {
      // Get the car
      carCatalog = await CarStorage.getCarCatalog(filteredRequest.ID);
    }
    // Return
    res.json(CarSecurity.filterCarCatalogResponse(carCatalog, req.user));
    next();
  }

  public static async handleGetCarCatalogImages(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    if (!Authorizations.isSuperAdmin(req.user)) {
      // Check if component is active
      UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.CAR, Action.READ, Entity.CAR_CATALOG, MODULE_NAME, 'handleGetCarCatalogImages');
    }
    // Check auth
    if (!Authorizations.canReadCarCatalog(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.READ,
        entity: Entity.CAR_CATALOG,
        module: MODULE_NAME,
        method: 'handleGetCarCatalogImages'
      });
    }
    // Filter
    const filteredRequest = CarSecurity.filterCarCatalogImagesRequest(req.query);
    UtilsService.assertIdIsProvided(action, filteredRequest.CarID, MODULE_NAME, 'handleGetCarCatalogImages', req.user);
    // Get the car
    const carCatalogImages = await CarStorage.getCarCatalogImages(
      filteredRequest.CarID,
      { limit: filteredRequest.Limit, skip: filteredRequest.Skip }
    );
    // Return
    res.json(carCatalogImages);
    next();
  }

  public static async handleSynchronizeCarCatalogs(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check auth
    if (!Authorizations.canSynchronizeCarCatalogs(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.SYNCHRONIZE_CAR_CATALOGS,
        entity: Entity.CAR_CATALOGS,
        module: MODULE_NAME,
        method: 'handleSynchronizeCarCatalogs'
      });
    }
    const carDatabaseImpl = await CarFactory.getCarImpl();
    if (!carDatabaseImpl) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Car service is not configured',
        module: MODULE_NAME,
        method: 'handleSynchronizeCarCatalogs'
      });
    }
    const result = await carDatabaseImpl.synchronizeCarCatalogs();
    res.json({ ...result, ...Constants.REST_RESPONSE_SUCCESS });
    next();
  }

  public static async handleGetCarMakers(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    if (!Authorizations.isSuperAdmin(req.user)) {
      // Check if component is active
      UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.CAR, Action.READ, Entity.CAR_CATALOG, MODULE_NAME, 'handleGetCarMakers');
    }
    // Check auth
    if (!Authorizations.canReadCarCatalog(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.READ,
        entity: Entity.CAR_CATALOG,
        module: MODULE_NAME,
        method: 'handleGetCarMakers'
      });
    }
    // Filter
    const filteredRequest = CarSecurity.filterCarMakersRequest(req.query);
    // Get car makers
    const carMakers = await CarStorage.getCarMakers({ search: filteredRequest.Search });
    // Filter
    CarSecurity.filterCarMakersResponse(carMakers, req.user);
    res.json(carMakers);
    next();
  }
}
