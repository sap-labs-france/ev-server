import { Action, Entity } from '../../../types/Authorization';
import { Car, UserCar } from '../../../types/Car';
import { HTTPAuthError, HTTPError } from '../../../types/HTTPError';
import { NextFunction, Request, Response } from 'express';

import AppAuthError from '../../../exception/AppAuthError';
import AppError from '../../../exception/AppError';
import Authorizations from '../../../authorization/Authorizations';
import BackendError from '../../../exception/BackendError';
import CarFactory from '../../../integration/car/CarFactory';
import CarSecurity from './security/CarSecurity';
import CarStorage from '../../../storage/mongodb/CarStorage';
import Constants from '../../../utils/Constants';
import Logging from '../../../utils/Logging';
import { ServerAction } from '../../../types/Server';
import TenantComponents from '../../../types/TenantComponents';
import User from '../../../types/User';
import Utils from '../../../utils/Utils';
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
          'miscSegment', 'miscIsofixSeats', 'chargeStandardTables', 'chargeStandardPower', 'chargeStandardPhase', 'image']);
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
    if (!Authorizations.isSuperAdmin(req.user)) {
      // Check if component is active
      UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.CAR,
        Action.SYNCHRONIZE_CAR_CATALOGS, Entity.CAR_CATALOGS, MODULE_NAME, 'handleSynchronizeCarCatalogs');
    }
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
      UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.CAR,
        Action.READ, Entity.CAR_CATALOG, MODULE_NAME, 'handleGetCarMakers');
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

  public static async handleCarCreate(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    let newCar: Car;
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.CAR,
      Action.CREATE, Entity.CAR, MODULE_NAME, 'handleCarCreate');
    // Filter
    const filteredRequest = CarSecurity.filterCarCreateRequest(req.body);
    // Check
    Utils.checkIfCarValid(filteredRequest, req);
    // Check auth
    if (!Authorizations.canCreateCar(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.CREATE, entity: Entity.CAR,
        module: MODULE_NAME, method: 'handleCarCreate'
      });
    }
    // Check Car Catalog
    const carCatalog = await CarStorage.getCarCatalog(filteredRequest.carCatalogID);
    UtilsService.assertObjectExists(action, carCatalog, `Car Catalog ID '${filteredRequest.carCatalogID}' does not exist`,
      MODULE_NAME, 'handleCarCreate', req.user);
    // Check Car
    const car = await CarStorage.getCarByVinLicensePlate(req.user.tenantID, filteredRequest.licensePlate, filteredRequest.vin, true);
    if (car) {
      // If Admin, car already exits!
      if (Authorizations.isAdmin(req.user)) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          errorCode: HTTPError.CAR_ALREADY_EXIST_ERROR,
          message: `The Car with VIN: '${filteredRequest.vin}' and License plate: '${filteredRequest.licensePlate}' already exist`,
          user: req.user,
          module: MODULE_NAME, method: 'handleCarCreate'
        });
      }
      // Basic users: Check if the car is already assigned to user
      if (car.users) {
        const foundUser = car.users.find((user: User) => user.id === req.user.id);
        if (foundUser) {
          // User already assigned to this car!
          throw new AppError({
            source: Constants.CENTRAL_SERVER,
            errorCode: HTTPError.CAR_ALREADY_EXIST_ERROR,
            message: `The Car with VIN: '${filteredRequest.vin}' and License plate: '${filteredRequest.licensePlate}' already exist for this user`,
            user: req.user,
            actionOnUser: foundUser,
            module: MODULE_NAME, method: 'handleCarCreate'
          });
        }
      }
      // Force to reuse the car
      if (filteredRequest.forced) {
        newCar = car;
      // Send error to the UI
      } else {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          errorCode: HTTPError.CAR_ALREADY_EXIST_ERROR_DIFFERENT_USER,
          message: `The Car with VIN: '${filteredRequest.vin}' and License plate: '${filteredRequest.licensePlate}' already exist with different user`,
          user: req.user,
          module: MODULE_NAME, method: 'handleCarCreate'
        });
      }
    } else {
      // Create car
      newCar = {
        carCatalogID: filteredRequest.carCatalogID,
        licensePlate: filteredRequest.licensePlate,
        vin: filteredRequest.vin,
        createdBy: { id: req.user.id },
        createdOn: new Date()
      } as Car;
      newCar.id = await CarStorage.saveCar(req.user.tenantID, newCar);
    }
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user, module: MODULE_NAME, method: 'handleCreateCar',
      message: `Car with plate ID '${newCar.licensePlate}' has been created successfully`,
      action: action,
      detailedMessages: { car: newCar }
    });
    // If Basic user, auto assign the car to him
    if (Authorizations.isBasic(req.user)) {
      let newUserCar: UserCar = {
        carID: newCar.id,
        userID: req.user.id,
        type: filteredRequest.isPrivate ? 'private' : 'company',
        createdBy: { id: req.user.id },
        createdOn: new Date()
      } as UserCar;
      const defaultCar = await CarStorage.getDefaultCar(req.user.tenantID, req.user.id);
      if (!defaultCar) {
        newUserCar = Object.assign(newUserCar, { default: true });
      }
      newUserCar.id = await CarStorage.saveUserCar(req.user.tenantID, newUserCar);
      if (defaultCar && filteredRequest.isDefault) {
        await CarStorage.updateDefaultCar(req.user.tenantID, newCar.id, req.user.id);
      }
    }
    // Ok
    res.json(Object.assign({ id: newCar.id }, Constants.REST_RESPONSE_SUCCESS));
    next();
  }

  public static async handleGetCars(action: Action, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.CAR, Action.LIST, Entity.CARS,
      MODULE_NAME, 'handleGetCars');
    // Check auth
    if (!Authorizations.canListCars(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.LIST, entity: Entity.CARS,
        module: MODULE_NAME, method: 'handleGetCars'
      });
    }
    const filteredRequest = CarSecurity.filterCarsRequest(req.query);
    // Get cars
    const cars = await CarStorage.getCars(req.user.tenantID,
      {
        search: filteredRequest.Search,
        userIDs: Authorizations.isBasic(req.user) ? [req.user.id] : null
      },
      { limit: filteredRequest.Limit, skip: filteredRequest.Skip, sort: filteredRequest.Sort, onlyRecordCount: filteredRequest.OnlyRecordCount });
    // Filter
    CarSecurity.filterCarsResponse(cars, req.user);
    // Return
    res.json(cars);
    next();
  }
}
