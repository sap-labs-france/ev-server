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
import UserStorage from '../../../storage/mongodb/UserStorage';
import { ActionsResponse } from '../../../types/GlobalType';

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
        'chargeStandardPower', 'chargeStandardPhase', 'chargePlug', 'fastChargePlug', 'chargeStandardTables', 'fastChargePowerMax', 'drivetrainPowerHP']
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
    let newCar: Car, isNewCar = false;
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
            message: `The Car with VIN '${filteredRequest.vin}' and License Plate '${filteredRequest.licensePlate}' already exist for this user`,
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
          message: `The Car with VIN '${filteredRequest.vin}' and License Plate '${filteredRequest.licensePlate}' already exist with different user`,
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
        type: filteredRequest.type,
        converterType: filteredRequest.converterType,
        createdOn: new Date()
      } as Car;
      newCar.id = await CarStorage.saveCar(req.user.tenantID, newCar);
      isNewCar = true;
    }
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user, module: MODULE_NAME, method: 'handleCreateCar',
      message: `Car with VIN '${newCar.vin}' and plate ID '${newCar.licensePlate}' has been created successfully`,
      action: action,
      detailedMessages: { car: newCar }
    });
    // If Basic user, auto assign the car to him
    if (Authorizations.isBasic(req.user)) {
      // Clear default car
      if (filteredRequest.isDefault) {
        await CarStorage.clearUserCarDefault(req.user.tenantID, req.user.id);
      }
      // Assign to User
      const newUserCar: UserCar = {
        carID: newCar.id,
        userID: req.user.id,
        default: filteredRequest.isDefault,
        createdBy: { id: req.user.id },
        createdOn: new Date(),
        owner: isNewCar
      } as UserCar;
      newUserCar.id = await CarStorage.saveUserCar(req.user.tenantID, newUserCar);
    }
    // Ok
    res.json(Object.assign({ id: newCar.id }, Constants.REST_RESPONSE_SUCCESS));
    next();
  }

  public static async handleUpdateCar(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.CAR,
      Action.UPDATE, Entity.CAR, MODULE_NAME, 'handleUpdateCar');
    // Filter
    const filteredRequest = CarSecurity.filterCarUpdateRequest(req.body);
    // ID is mandatory
    UtilsService.assertIdIsProvided(action, filteredRequest.id, 'CarSecurity', 'filterCarUpdateRequest', req.user);
    // Check
    Utils.checkIfCarValid(filteredRequest, req);
    // Check auth
    if (!Authorizations.canUpdateCar(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.UPDATE, entity: Entity.CAR,
        module: MODULE_NAME, method: 'handleUpdateCar',
        value: filteredRequest.id
      });
    }
    // Check Car
    const car = await CarStorage.getCar(req.user.tenantID, filteredRequest.id, { withUsers: true });
    UtilsService.assertObjectExists(action, car, `Car ID '${filteredRequest.id}' does not exist`,
      MODULE_NAME, 'handleUpdateCar', req.user);
    // Check Owner if Basic
    let userCar: UserCar;
    if (Authorizations.isBasic(req.user)) {
      userCar = car.usersCar.find((userCarToFind) => userCarToFind.userID.toString() === req.user.id);
      // Assigned to this user?
      if (!userCar) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          errorCode: HTTPError.NO_CAR_FOR_USER,
          user: req.user,
          module: MODULE_NAME, method: 'handleUpdateCar',
          message: `User is not assigned to the car ID '${car.id}' (${Utils.buildCarName(car.carCatalog)})`,
        });
      }
      // Owner?
      if (!userCar.owner) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          errorCode: HTTPError.USER_NOT_OWNER_OF_THE_CAR,
          user: req.user,
          module: MODULE_NAME, method: 'handleUpdateCar',
          message: `User is not the owner of the car ID '${car.id}' (${Utils.buildCarName(car.carCatalog)})`,
        });
      }
    }
    // Car already exists with same VIN and License Plate
    if (car.licensePlate !== filteredRequest.licensePlate || car.vin !== filteredRequest.vin) {
      const checkCar = await CarStorage.getCarByVinLicensePlate(req.user.tenantID, filteredRequest.licensePlate, filteredRequest.vin);
      if (checkCar) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          errorCode: HTTPError.CAR_ALREADY_EXIST_ERROR,
          message: `Car with VIN '${filteredRequest.vin}' and License Plate '${filteredRequest.licensePlate}' already exists`,
          user: req.user,
          module: MODULE_NAME, method: 'handleUpdateCar'
        });
      }
    }
    // Ok: Update & Save
    car.carCatalogID = filteredRequest.carCatalogID;
    car.vin = filteredRequest.vin;
    car.licensePlate = filteredRequest.licensePlate;
    car.type = filteredRequest.type;
    car.converterType = filteredRequest.converterType;
    car.lastChangedBy = { 'id': req.user.id };
    car.lastChangedOn = new Date();
    await CarStorage.saveCar(req.user.tenantID, car);
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user, module: MODULE_NAME, method: 'handleUpdateCar',
      message: `Car '${car.id}' has been updated successfully`,
      action: action,
      detailedMessages: { car }
    });
    // Handle Basic User specific props in userscars collection
    if (Authorizations.isBasic(req.user)) {
      // Only one property in userscars: Default
      if (userCar.default !== filteredRequest.isDefault) {
        if (filteredRequest.isDefault) {
          await CarStorage.clearUserCarDefault(req.user.tenantID, req.user.id);
        }
        userCar.default = filteredRequest.isDefault;
        userCar.lastChangedBy = { 'id': req.user.id };
        userCar.lastChangedOn = new Date();
        await CarStorage.saveUserCar(req.user.tenantID, userCar);
        // Log
        Logging.logSecurityInfo({
          tenantID: req.user.tenantID,
          user: req.user, module: MODULE_NAME, method: 'handleUpdateCar',
          message: `User Car '${userCar.id}' has been updated successfully`,
          action: action,
          detailedMessages: { userCar }
        });
      }
    }
    res.json(Constants.REST_RESPONSE_SUCCESS);
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
        userIDs: Authorizations.isBasic(req.user) ? [req.user.id] : null,
        withUsers: true
      },
      { limit: filteredRequest.Limit, skip: filteredRequest.Skip, sort: filteredRequest.Sort, onlyRecordCount: filteredRequest.OnlyRecordCount });
    // Filter
    CarSecurity.filterCarsResponse(cars, req.user);
    // Return
    res.json(cars);
    next();
  }

  public static async handleGetCar(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.CAR, Action.READ, Entity.CAR,
      MODULE_NAME, 'handleGetCar');
    // Check auth
    if (!Authorizations.canReadCar(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.READ, entity: Entity.CAR,
        module: MODULE_NAME, method: 'handleGetCar'
      });
    }
    const filteredRequest = CarSecurity.filterCarRequest(req.query);
    UtilsService.assertIdIsProvided(action, filteredRequest.ID, MODULE_NAME, 'handleGetCar', req.user);
    // Get the car
    const car = await CarStorage.getCar(req.user.tenantID, filteredRequest.ID, { withUsers: true });
    if (Authorizations.isBasic(req.user)) {
      const userCar = car.usersCar.find((userCarToFind) => userCarToFind.userID.toString() === req.user.id);
      if (userCar) {
        car.isDefault = userCar.default;
      }
    }
    // Return
    res.json(CarSecurity.filterCarResponse(car, req.user));
    next();
  }

  public static async handleGetUsersFromCar(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.CAR, Action.LIST, Entity.USERS_CARS,
      MODULE_NAME, 'handleGetUsersFromCar');
    // Check auth
    if (!Authorizations.canListUsersCars(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.LIST, entity: Entity.USERS_CARS,
        module: MODULE_NAME, method: 'handleGetUsersFromCar'
      });
    }
    const filteredRequest = CarSecurity.filterUsersCarsRequest(req.query);
    // CarID is mandatory
    UtilsService.assertIdIsProvided(action, filteredRequest.carID, 'CarSecurity', 'filterUsersCarsRequest', req.user);
    // Get cars
    const usersCars = await CarStorage.getUsersCars(req.user.tenantID,
      {
        search: filteredRequest.search,
        carIDs: [filteredRequest.carID],
        active: true
      },
      { limit: filteredRequest.Limit, skip: filteredRequest.Skip, sort: filteredRequest.Sort, onlyRecordCount: filteredRequest.OnlyRecordCount });
    // Filter
    CarSecurity.filterUsersCarsResponse(usersCars, req.user);
    // Return
    res.json(usersCars);
    next();
  }

  public static async handleUpdateUsersCar(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.CAR, Action.UPDATE, Entity.USERS_CARS,
      MODULE_NAME, 'handleUpdateUsersCar');
    // Update
    if (action === ServerAction.UPDATE_USERS_CAR) {
      if (!Authorizations.canAssignUsersCar(req.user)) {
        throw new AppAuthError({
          errorCode: HTTPAuthError.ERROR,
          user: req.user,
          action: Action.UPDATE, entity: Entity.USERS_CARS,
          module: MODULE_NAME, method: 'handleUpdateUsersCar'
        });
      }
    // Add
    } else if (action === ServerAction.ADD_USERS_TO_CAR) {
      if (!Authorizations.canAssignUsersCar(req.user)) {
        throw new AppAuthError({
          errorCode: HTTPAuthError.ERROR,
          user: req.user,
          action: Action.CREATE, entity: Entity.USERS_CARS,
          module: MODULE_NAME, method: 'handleUpdateUsersCar'
        });
      }
    }
    const filteredRequest = CarSecurity.filterUsersAssignRequest(req.body);
    // CarID is mandatory
    UtilsService.assertIdIsProvided(action, filteredRequest.carID, MODULE_NAME, 'handleUpdateUsersCar', req.user);
    // Check Users
    for (const userCar of filteredRequest.usersCar) {
      // Check the user
      const user = await UserStorage.getUser(req.user.tenantID, userCar.userID);
      UtilsService.assertObjectExists(action, user, `User '${userCar.userID}' does not exist`,
        MODULE_NAME, 'handleUpdateUsersCar', req.user);
      // Auth
      if (!Authorizations.canReadUser(req.user, userCar.userID)) {
        throw new AppAuthError({
          errorCode: HTTPAuthError.ERROR,
          user: req.user,
          action: Action.READ, entity: Entity.USER,
          module: MODULE_NAME, method: 'handleUpdateUsersCar',
          value: userCar.userID
        });
      }
    }
    // Save
    const actionsDone: ActionsResponse = {
      inSuccess: 0,
      inError: 0
    };
    for (const userCar of filteredRequest.usersCar) {
      try {
        // Check Default
        if (userCar.default) {
          await CarStorage.clearUserCarDefault(req.user.tenantID, userCar.userID);
        }
        // Check Owner
        if (userCar.owner) {
          await CarStorage.clearUserCarOwner(req.user.tenantID, filteredRequest.carID);
        }
        // Get from DB
        const userCarDB = await CarStorage.getUserCarByCarUser(req.user.tenantID, filteredRequest.carID, userCar.userID);
        // Update
        if (userCarDB) {
          userCarDB.owner = userCar.owner;
          userCarDB.default = userCar.default;
          // Save
          await CarStorage.saveUserCar(req.user.tenantID, userCarDB);
        // Create
        } else {
          userCar.carID = filteredRequest.carID;
          userCar.lastChangedOn = new Date();
          await CarStorage.saveUserCar(req.user.tenantID, userCar);
        }
        actionsDone.inSuccess++;
      } catch (error) {
        Logging.logError({
          tenantID: req.user.tenantID,
          user: userCar.userID,
          source: Constants.CENTRAL_SERVER,
          module: MODULE_NAME, method: 'handleUpdateUsersCar',
          action: ServerAction.UPDATE_USERS_CAR,
          message: 'An error occurred while trying to assign the user to the car',
          detailedMessages: { error: error.message, stack: error.stack, userCar }
        });
        actionsDone.inError++;
      }
    }
    // Log
    Utils.logActionsResponse(req.user.tenantID, ServerAction.UPDATE_USERS_CAR,
      MODULE_NAME, 'handleUpdateUsersCar', actionsDone,
      '{{inSuccess}} user(s) were successfully updated',
      '{{inError}} user(s) failed to be updated',
      '{{inSuccess}} user(s) were successfully updated and {{inError}} failed to be updated',
      'All the users are up to date'
    );
    res.json({ ...actionsDone, ...Constants.REST_RESPONSE_SUCCESS });
    next();
  }

  public static async handleRemoveUsersFromCar(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.CAR, Action.DELETE, Entity.USERS_CARS,
      MODULE_NAME, 'handleRemoveUsersFromCar');
    // Check auth
    if (!Authorizations.canAssignUsersCar(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.DELETE, entity: Entity.USERS_CARS,
        module: MODULE_NAME, method: 'handleRemoveUsersFromCar'
      });
    }
    const usersCarIDs = CarSecurity.filterUsersCarRequestByIDs(req.body);
    // Check Users
    for (const userCarID of usersCarIDs) {
      // Check the user
      const userCar = await CarStorage.getUserCar(req.user.tenantID, userCarID);
      UtilsService.assertObjectExists(action, userCar, `User Car ID '${userCarID}' does not exist`,
        MODULE_NAME, 'handleRemoveUsersFromCar', req.user);
      // Auth
      if (!Authorizations.canReadUser(req.user, userCar.userID)) {
        throw new AppAuthError({
          errorCode: HTTPAuthError.ERROR,
          user: req.user,
          action: Action.READ, entity: Entity.USER,
          module: MODULE_NAME, method: 'handleRemoveUsersFromCar',
          value: userCar.userID
        });
      }
    }
    // Delete
    const actionsDone: ActionsResponse = {
      inSuccess: 0,
      inError: 0
    };
    for (const userCarID of usersCarIDs) {
      try {
        await CarStorage.deleteUserCar(req.user.tenantID, userCarID);
        actionsDone.inSuccess++;
      } catch (error) {
        actionsDone.inError++;
      }
    }
    // Log
    Utils.logActionsResponse(req.user.tenantID, ServerAction.REMOVE_USERS_FROM_CAR,
      MODULE_NAME, 'handleRemoveUsersFromCar', actionsDone,
      '{{inSuccess}} user(s) were successfully deleted',
      '{{inError}} user(s) failed to be deleted',
      '{{inSuccess}} user(s) were successfully deleted and {{inError}} failed to be deleted',
      'All the users are up to date'
    );
    res.json({ ...actionsDone, ...Constants.REST_RESPONSE_SUCCESS });
    next();
  }

}
