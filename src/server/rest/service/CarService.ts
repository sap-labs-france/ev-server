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
import Utils from '../../../utils/Utils';
import { Car, UserCar } from '../../../types/Car';
import Logging from '../../../utils/Logging';
import UserStorage from '../../../storage/mongodb/UserStorage';

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

  public static async handleCarCreate(action: Action, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.CAR,
      Action.CREATE, Entity.CAR, MODULE_NAME, 'handleCreateCar');
    // Filter
    const filteredRequest = CarSecurity.filterCarCreateRequest(req.body);
    // Check
    Utils.checkIfCarValid(filteredRequest, req);
    // Check auth
    if (!Authorizations.canCreateCar(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.CREATE,
        entity: Entity.CAR,
        module: MODULE_NAME,
        method: 'handleCreateCar'
      });
    }
    // Check Car Catalog
    const carCatalog = await CarStorage.getCarCatalog(filteredRequest.carCatalogID);
    UtilsService.assertObjectExists(action, carCatalog, `Car Catalog ID '${filteredRequest.carCatalogID}' does not exist`,
      MODULE_NAME, 'handleCreateCar', req.user);
    // Create car
    const newCar: Car = {
      ...filteredRequest,
      createdBy: { id: req.user.id },
      createdOn: new Date()
    } as Car;
    // Save
    newCar.id = await CarStorage.saveCar(req.user.tenantID, newCar);
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user, module: MODULE_NAME, method: 'handleCreateCar',
      message: `Car with plate: '${newCar.licensePlate}' has been created successfully`,
      action: action,
      detailedMessages: { car: newCar }
    });
    if (Authorizations.isBasic(req.user)) {
      const newUserCar: UserCar = {
        carID: newCar.id,
        userID: req.user.id,
        createdBy: { id: req.user.id },
        createdOn: new Date()
      } as UserCar;
      newUserCar.id = await CarStorage.saveUserCar(req.user.tenantID, newUserCar);
    } else if (Authorizations.isAdmin(req.user)) {
      if (filteredRequest.userIDs) {
        for (const userID of filteredRequest.userIDs.split('|')) {
          const newUserCar: UserCar = {
            carID: newCar.id,
            userID: userID,
            createdBy: { id: req.user.id },
            createdOn: new Date()
          } as UserCar;
          newUserCar.id = await CarStorage.saveUserCar(req.user.tenantID, newUserCar);
        }
      }
    }
    // Ok
    res.json(Object.assign({ id: newCar.id }, Constants.REST_RESPONSE_SUCCESS));
    next();
  }

  public static async handleAssignCar(action: Action, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.CAR,
      Action.CREATE, Entity.USER_CAR, MODULE_NAME, 'handleAssignCar');
    // Filter
    const filteredRequest = CarSecurity.filterUserCarCreateRequest(req.body);
    // Check
    Utils.checkIfUserCarValid(filteredRequest, req);
    // Check auth
    if (!Authorizations.canAssignCar(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.CREATE,
        entity: Entity.USER_CAR,
        module: MODULE_NAME,
        method: 'handleAssignCar'
      });
    }
    // Check Car
    const car = await CarStorage.getCar(req.user.tenantID, filteredRequest.carID);
    UtilsService.assertObjectExists(action, car, `Car ID '${filteredRequest.carID}' does not exist`,
      MODULE_NAME, 'handleAssignCar', req.user);
    // Check User
    const user = await UserStorage.getUser(req.user.tenantID, filteredRequest.userID);
    UtilsService.assertObjectExists(action, user, `User ID '${filteredRequest.carID}' does not exist`,
      MODULE_NAME, 'handleAssignCar', req.user);
    // Create user car
    const newUserCar: UserCar = {
      ...filteredRequest,
      createdBy: { id: req.user.id },
      createdOn: new Date()
    } as UserCar;
    // Save
    newUserCar.id = await CarStorage.saveUserCar(req.user.tenantID, newUserCar);
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user, module: MODULE_NAME, method: 'handleAssignCar',
      message: `Car with plate: '${car.licensePlate}' has been assigned successfully to the user '${user.firstName}'`,
      action: action,
      detailedMessages: { userCar: newUserCar }
    });
    // Ok
    res.json(Object.assign({ id: newUserCar.id }, Constants.REST_RESPONSE_SUCCESS));
    next();
  }

  public static async handleGetUserCars(action: Action, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.CAR, Action.READ, Entity.USER_CAR, MODULE_NAME, 'handleGetUserCars');

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
    const filteredRequest = CarSecurity.filterUserCarsRequest(req.query);
    let userCars;
    if (Authorizations.isBasic(req.user)) {
      userCars = await CarStorage.getUserCars(req.user.tenantID, { UserID: req.user.id }, { limit: filteredRequest.Limit, skip: filteredRequest.Skip, sort: filteredRequest.Sort, onlyRecordCount: filteredRequest.OnlyRecordCount });
    } else {
      userCars = await CarStorage.getUserCars(req.user.tenantID, {}, { limit: filteredRequest.Limit, skip: filteredRequest.Skip, sort: filteredRequest.Sort, onlyRecordCount: filteredRequest.OnlyRecordCount });
    }
    res.json(userCars);
    next();
  }
}
