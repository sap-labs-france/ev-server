import { Action, Entity } from '../../../../types/Authorization';
import { Car, CarType } from '../../../../types/Car';
import { HTTPAuthError, HTTPError } from '../../../../types/HTTPError';
import { NextFunction, Request, Response } from 'express';

import AppAuthError from '../../../../exception/AppAuthError';
import AppError from '../../../../exception/AppError';
import Authorizations from '../../../../authorization/Authorizations';
import BackendError from '../../../../exception/BackendError';
import CarFactory from '../../../../integration/car/CarFactory';
import CarSecurity from './security/CarSecurity';
import CarStorage from '../../../../storage/mongodb/CarStorage';
import Constants from '../../../../utils/Constants';
import Logging from '../../../../utils/Logging';
import { ServerAction } from '../../../../types/Server';
import TenantComponents from '../../../../types/TenantComponents';
import { UserCar } from '../../../../types/User';
import UserStorage from '../../../../storage/mongodb/UserStorage';
import UserToken from '../../../../types/UserToken';
import Utils from '../../../../utils/Utils';
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
        action: Action.LIST, entity: Entity.CAR_CATALOGS,
        module: MODULE_NAME, method: 'handleGetCarCatalogs'
      });
    }
    // Filter
    const filteredRequest = CarSecurity.filterCarCatalogsRequest(req.query);
    // Get the Cars
    const carCatalogs = await CarStorage.getCarCatalogs(
      {
        search: filteredRequest.Search,
        carMaker: filteredRequest.CarMaker ? filteredRequest.CarMaker.split('|') : null
      },
      { limit: filteredRequest.Limit, skip: filteredRequest.Skip, sort: filteredRequest.Sort, onlyRecordCount: filteredRequest.OnlyRecordCount },
      [
        'id', 'vehicleModel', 'vehicleMake', 'vehicleModelVersion', 'batteryCapacityFull', 'fastchargeChargeSpeed', 'performanceTopspeed',
        'performanceAcceleration', 'rangeWLTP', 'rangeReal', 'efficiencyReal', 'image',
        'chargeStandardPower', 'chargeStandardPhase', 'chargeStandardPhaseAmp', 'chargeAlternativePower', 'chargeOptionPower',
        'chargeOptionPhaseAmp', 'chargeOptionPhase', 'chargeAlternativePhaseAmp', 'chargeAlternativePhase', 'chargePlug', 'fastChargePlug', 'fastChargePowerMax', 'drivetrainPowerHP'
      ]
    );
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
        action: Action.LIST, entity: Entity.CAR_CATALOG,
        module: MODULE_NAME, method: 'handleGetCarCatalog'
      });
    }
    // Filter
    const filteredRequest = CarSecurity.filterCarCatalogRequest(req.query);
    UtilsService.assertIdIsProvided(action, filteredRequest.ID, MODULE_NAME, 'handleGetCarCatalog', req.user);
    // Get the car
    const carCatalog = await CarStorage.getCarCatalog(filteredRequest.ID,
      [
        'id', 'vehicleModel', 'vehicleMake', 'vehicleModelVersion', 'batteryCapacityFull', 'fastchargeChargeSpeed',
        'performanceTopspeed', 'performanceAcceleration', 'rangeWLTP', 'rangeReal', 'efficiencyReal', 'drivetrainPropulsion',
        'drivetrainTorque', 'batteryCapacityUseable', 'chargePlug', 'fastChargePlug', 'fastChargePowerMax', 'chargePlugLocation',
        'drivetrainPowerHP', 'chargeStandardChargeSpeed', 'chargeStandardChargeTime', 'miscSeats', 'miscBody', 'miscIsofix', 'miscTurningCircle',
        'miscSegment', 'miscIsofixSeats', 'chargeStandardPower', 'chargeStandardPhase', 'chargeAlternativePower', 'hash',
        'chargeAlternativePhase', 'chargeOptionPower', 'chargeOptionPhase', 'image', 'chargeOptionPhaseAmp', 'chargeAlternativePhaseAmp'
      ]);
    // Return
    res.json(carCatalog);
    next();
  }

  public static async handleGetCarCatalogImage(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = CarSecurity.filterCarCatalogRequest(req.query);
    UtilsService.assertIdIsProvided(action, filteredRequest.ID, MODULE_NAME, 'handleGetCarCatalogImage', req.user);
    // Get the car Image
    const carCatalog = await CarStorage.getCarCatalogImage(filteredRequest.ID);
    // Return
    if (carCatalog?.image) {
      // Remove encoding header
      let header = 'image';
      let encoding: BufferEncoding = 'base64';
      if (carCatalog?.image.startsWith('data:image/')) {
        header = carCatalog.image.substring(5, carCatalog.image.indexOf(';'));
        encoding = carCatalog.image.substring(carCatalog.image.indexOf(';') + 1, carCatalog.image.indexOf(',')) as BufferEncoding;
        carCatalog.image = carCatalog.image.substring(carCatalog.image.indexOf(',') + 1);
      }
      // Revert to binary
      res.setHeader('content-type', header);
      res.send(Buffer.from(carCatalog.image, encoding));
    } else {
      res.send(null);
    }
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
        action: Action.READ, entity: Entity.CAR_CATALOG,
        module: MODULE_NAME, method: 'handleGetCarCatalogImages'
      });
    }
    // Filter
    const filteredRequest = CarSecurity.filterCarCatalogImagesRequest(req.query);
    UtilsService.assertIdIsProvided(action, filteredRequest.ID, MODULE_NAME, 'handleGetCarCatalogImages', req.user);
    // Get the car
    const carCatalogImages = await CarStorage.getCarCatalogImages(
      filteredRequest.ID,
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
        Action.SYNCHRONIZE, Entity.CAR_CATALOGS, MODULE_NAME, 'handleSynchronizeCarCatalogs');
    }
    // Check auth
    if (!Authorizations.canSynchronizeCarCatalogs(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.SYNCHRONIZE, entity: Entity.CAR_CATALOGS,
        module: MODULE_NAME, method: 'handleSynchronizeCarCatalogs'
      });
    }
    const carDatabaseImpl = await CarFactory.getCarImpl();
    if (!carDatabaseImpl) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        message: 'Car service is not configured',
        module: MODULE_NAME, method: 'handleSynchronizeCarCatalogs'
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
        action: Action.READ, entity: Entity.CAR_CATALOG,
        module: MODULE_NAME, method: 'handleGetCarMakers'
      });
    }
    // Filter
    const filteredRequest = CarSecurity.filterCarMakersRequest(req.query);
    // Get car makers
    const carMakers = await CarStorage.getCarMakers({ search: filteredRequest.Search }, [ 'carMaker' ]);
    res.json(carMakers);
    next();
  }

  public static async handleCreateCar(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    let newCar: Car;
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
        action: Action.CREATE, entity: Entity.CAR,
        module: MODULE_NAME, method: 'handleCreateCar'
      });
    }
    // Check Car Catalog
    const carCatalog = await CarStorage.getCarCatalog(filteredRequest.carCatalogID);
    UtilsService.assertObjectExists(action, carCatalog, `Car Catalog ID '${filteredRequest.carCatalogID}' does not exist`,
      MODULE_NAME, 'handleCreateCar', req.user);
    // Keep the current user to add for Basic role
    const carUserToAdd = filteredRequest.usersAdded.find((carUser) => carUser.user.id === req.user.id);
    // Check Car
    const car = await CarStorage.getCarByVinLicensePlate(req.user.tenantID,
      filteredRequest.licensePlate, filteredRequest.vin, {
        withUsers: Authorizations.isBasic(req.user) ? true : false,
      });
    if (car) {
      // If Admin, car already exits!
      if (Authorizations.isAdmin(req.user)) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          errorCode: HTTPError.CAR_ALREADY_EXIST_ERROR,
          message: `The Car with VIN: '${filteredRequest.vin}' and License plate: '${filteredRequest.licensePlate}' already exist`,
          user: req.user,
          module: MODULE_NAME, method: 'handleCreateCar'
        });
      }
      // Basic part
      // Basic users: Check if the car is already assigned to user
      if (car.carUsers) {
        const foundCarUser = car.carUsers.find((carUser) => carUser.user.id === req.user.id);
        if (foundCarUser) {
          // User already assigned to this car!
          throw new AppError({
            source: Constants.CENTRAL_SERVER,
            errorCode: HTTPError.CAR_ALREADY_EXIST_ERROR,
            message: `The Car with VIN '${filteredRequest.vin}' and License Plate '${filteredRequest.licensePlate}' already exist for this user`,
            user: req.user,
            actionOnUser: foundCarUser.user,
            module: MODULE_NAME, method: 'handleCreateCar'
          });
        }
      }
      // Force to reuse the car
      if (filteredRequest.forced) {
        newCar = car;
        // Uncheck owner
        carUserToAdd.owner = false;
        // Send error to the UI
      } else {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          errorCode: HTTPError.CAR_ALREADY_EXIST_ERROR_DIFFERENT_USER,
          message: `The Car with VIN '${filteredRequest.vin}' and License Plate '${filteredRequest.licensePlate}' already exist with different user`,
          user: req.user,
          module: MODULE_NAME, method: 'handleCreateCar'
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
        converter: filteredRequest.converter,
        createdOn: new Date()
      } as Car;
      newCar.id = await CarStorage.saveCar(req.user.tenantID, newCar);
      // If Basic, this is the car owner
      if (Authorizations.isBasic(req.user)) {
        carUserToAdd.owner = true;
      }
    }
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user, module: MODULE_NAME, method: 'handleCreateCar',
      message: `Car with VIN '${newCar.vin}' and plate ID '${newCar.licensePlate}' has been created successfully`,
      action: action,
      detailedMessages: { car: newCar }
    });
    // Assign Users
    if (filteredRequest.usersAdded.length > 0) {
      await CarService.handleAssignCarUsers(action, req.user.tenantID, req.user, newCar, filteredRequest.usersAdded);
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
    const car = await CarStorage.getCar(req.user.tenantID, filteredRequest.id, {
      withUsers: Authorizations.isBasic(req.user) ? true : false,
      userIDs: Authorizations.isBasic(req.user) ? [req.user.id] : null
    });
    UtilsService.assertObjectExists(action, car, `Car ID '${filteredRequest.id}' does not exist`,
      MODULE_NAME, 'handleUpdateCar', req.user);
    // Check Owner if Basic
    let carUser: UserCar;
    if (Authorizations.isBasic(req.user)) {
      carUser = car.carUsers.find((carUserToFind) => carUserToFind.user.id.toString() === req.user.id);
      // Assigned to this user?
      if (!carUser) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          errorCode: HTTPError.NO_CAR_FOR_USER,
          user: req.user,
          module: MODULE_NAME, method: 'handleUpdateCar',
          message: `User is not assigned to the car ID '${car.id}' (${Utils.buildCarName(car, true)})`,
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
    // Owner?
    if (Authorizations.isAdmin(req.user) || (Authorizations.isBasic(req.user) && carUser.owner)) {
      // Ok: Update & Save
      car.carCatalogID = filteredRequest.carCatalogID;
      car.vin = filteredRequest.vin;
      car.licensePlate = filteredRequest.licensePlate;
      car.type = filteredRequest.type;
      car.converter = filteredRequest.converter;
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
    }
    // Assign Users
    if (car.type !== CarType.POOL_CAR) {
      if (filteredRequest.usersUpserted.length > 0 || filteredRequest.usersRemoved.length > 0) {
        await CarService.handleAssignCarUsers(action, req.user.tenantID, req.user, car,
          filteredRequest.usersUpserted, filteredRequest.usersRemoved);
      }
    } else {
      // Remove all users for Pool car
      await CarStorage.deleteCarUsersByCarID(req.user.tenantID, car.id);
    }
    // Handle Users to Update/Remove/Add
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
    // Check User
    let userProject: string[] = [];
    if (Authorizations.canListUsers(req.user)) {
      userProject = [ 'createdBy.name', 'createdBy.firstName', 'lastChangedBy.name', 'lastChangedBy.firstName',
        'carUsers.user.name', 'carUsers.user.firstName', ];
    }
    // Get cars
    const cars = await CarStorage.getCars(req.user.tenantID,
      {
        search: filteredRequest.Search,
        userIDs: Authorizations.isBasic(req.user) ? [req.user.id] : filteredRequest.UserID ? filteredRequest.UserID.split('|') : null,
        carMakers: filteredRequest.CarMaker ? filteredRequest.CarMaker.split('|') : null,
        withUsers: filteredRequest.WithUsers
      },
      { limit: filteredRequest.Limit, skip: filteredRequest.Skip, sort: filteredRequest.Sort, onlyRecordCount: filteredRequest.OnlyRecordCount },
      [
        'id', 'type', 'vin', 'licensePlate', 'converter', 'default', 'owner', 'createdOn', 'lastChangedOn',
        'carCatalog.vehicleMake', 'carCatalog.vehicleModel', 'carCatalog.vehicleModelVersion', 'carCatalog.image',
        ...userProject
      ]);
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
    // Check User
    let userProject: string[] = [];
    if (Authorizations.canListUsers(req.user)) {
      userProject = [ 'createdBy.name', 'createdBy.firstName', 'lastChangedBy.name', 'lastChangedBy.firstName',
        'carUsers.user.id', 'carUsers.user.name', 'carUsers.user.firstName', 'carUsers.user.email', 'carUsers.default', 'carUsers.owner'
      ];
    }
    // Get the car
    const car = await CarStorage.getCar(req.user.tenantID, filteredRequest.ID, {
      withUsers: true,
      userIDs: Authorizations.isBasic(req.user) ? [req.user.id] : null
    },
    [
      'id', 'type', 'vin', 'licensePlate', 'converter', 'default', 'owner', 'createdOn', 'lastChangedOn',
      'carCatalogID', 'carCatalog.vehicleMake', 'carCatalog.vehicleModel', 'carCatalog.vehicleModelVersion', 'carCatalog.image',
      'carCatalog.chargeStandardPower', 'carCatalog.chargeStandardPhaseAmp', 'carCatalog.chargeStandardPhase',
      'carCatalog.chargeAlternativePower', 'carCatalog.chargeAlternativePhaseAmp', 'carCatalog.chargeAlternativePhase',
      'carCatalog.chargeOptionPower', 'carCatalog.chargeOptionPhaseAmp', 'carCatalog.chargeOptionPhase',
      ...userProject
    ]);
    // Return
    res.json(car);
    next();
  }

  public static async handleGetCarUsers(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.CAR, Action.LIST, Entity.USERS_CARS,
      MODULE_NAME, 'handleGetCarUsers');
    // Check auth
    if (!Authorizations.canListUsersCars(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.LIST, entity: Entity.USERS_CARS,
        module: MODULE_NAME, method: 'handleGetCarUsers'
      });
    }
    const filteredRequest = CarSecurity.filterCarUsersRequest(req.query);
    // CarID is mandatory
    UtilsService.assertIdIsProvided(action, filteredRequest.CarID, 'CarSecurity', 'filterCarUsersRequest', req.user);
    // Get cars
    const usersCars = await CarStorage.getCarUsers(req.user.tenantID,
      {
        search: filteredRequest.Search,
        carIDs: [filteredRequest.CarID]
      },
      { limit: filteredRequest.Limit, skip: filteredRequest.Skip, sort: filteredRequest.Sort, onlyRecordCount: filteredRequest.OnlyRecordCount },
      [ 'id', 'carID', 'default', 'owner', 'user.id', 'user.name', 'user.firstName', 'user.email' ]);
    // Return
    res.json(usersCars);
    next();
  }

  public static async handleDeleteCar(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const carId = CarSecurity.filterCarRequest(req.query).ID;
    // Check auth
    if (!Authorizations.canDeleteCar(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.DELETE, entity: Entity.CAR,
        module: MODULE_NAME, method: 'handleDeleteCar',
        value: carId
      });
    }
    // Get
    const car = await CarStorage.getCar(req.user.tenantID, carId, {
      withUsers: Authorizations.isBasic(req.user) ? true : false,
      userIDs: Authorizations.isBasic(req.user) ? [req.user.id] : null
    });
    UtilsService.assertObjectExists(action, car, `Car ID '${carId}' does not exist`,
      MODULE_NAME, 'handleDeleteCar', req.user);
    // Check Owner if Basic
    let carUser: UserCar;
    if (Authorizations.isBasic(req.user)) {
      carUser = car.carUsers.find((carUserToFind) => carUserToFind.user.id.toString() === req.user.id);
      // Assigned to this user?
      if (!carUser) {
        throw new AppAuthError({
          errorCode: HTTPAuthError.ERROR,
          user: req.user,
          action: Action.DELETE, entity: Entity.CAR,
          module: MODULE_NAME, method: 'handleDeleteCar',
          value: carId
        });
      }
    }
    // Basic User
    if (Authorizations.isBasic(req.user) && !carUser.owner) {
      // Delete the association
      await CarStorage.deleteCarUser(req.user.tenantID, carUser.id);
      Logging.logSecurityInfo({
        tenantID: req.user.tenantID,
        user: req.user, module: MODULE_NAME, method: 'handleDeleteCar',
        message: `User has been unassigned successfully from the car '${Utils.buildCarName(car, true)}'`,
        action: action,
        detailedMessages: { car }
      });
    }
    // Owner?
    if (Authorizations.isAdmin(req.user) || (Authorizations.isBasic(req.user) && carUser.owner)) {
      // Check if Transaction exist (to Be implemented later)
      // Delete all the associations
      await CarStorage.deleteCarUsersByCarID(req.user.tenantID, carId);
      // Delete the car
      await CarStorage.deleteCar(req.user.tenantID, carId);
      Logging.logSecurityInfo({
        tenantID: req.user.tenantID,
        user: req.user, module: MODULE_NAME, method: 'handleDeleteCar',
        message: `Car '${Utils.buildCarName(car)}' has been deleted successfully`,
        action: action,
        detailedMessages: { car }
      });
    }
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  private static async handleAssignCarUsers(action: ServerAction, tenantID: string, loggedUser: UserToken,
    car: Car, usersToUpsert: UserCar[] = [], usersToDelete: UserCar[] = []): Promise<void> {
    // Filter only allowed assignments
    if (Authorizations.isBasic(loggedUser)) {
      usersToDelete = [];
      usersToUpsert = usersToUpsert.filter((userToUpsert) => userToUpsert.user.id === loggedUser.id);
    }
    // Remove dups
    const usersToUpsertMap = new Map<string, UserCar>();
    for (const userToUpsert of usersToUpsert) {
      usersToUpsertMap.set(`${userToUpsert.user.id}`, userToUpsert);
    }
    usersToUpsert = Array.from(usersToUpsertMap.values());
    const usersToDeleteMap = new Map<string, UserCar>();
    for (const userToDelete of usersToDelete) {
      usersToDeleteMap.set(`${userToDelete.user.id}`, userToDelete);
    }
    usersToDelete = Array.from(usersToDeleteMap.values());
    // Users to Upsert
    if (usersToUpsert.length > 0) {
      // Get and check users
      const users = await UserStorage.getUsers(tenantID,
        { userIDs: usersToUpsert.map((userToUpsert) => userToUpsert.user.id) },
        Constants.DB_PARAMS_MAX_LIMIT);
      for (const userToUpsert of usersToUpsert) {
        // Check the user
        const foundUser = users.result.find((user) => user.id === userToUpsert.user.id);
        UtilsService.assertObjectExists(action, foundUser, `User '${userToUpsert.user.id}' does not exist`,
          MODULE_NAME, 'handleAssignCarUsers', loggedUser);
        // Auth
        if (!Authorizations.canReadUser(loggedUser, foundUser.id)) {
          throw new AppAuthError({
            errorCode: HTTPAuthError.ERROR,
            user: loggedUser,
            actionOnUser: foundUser.id,
            action: Action.READ, entity: Entity.USER,
            module: MODULE_NAME, method: 'handleAssignCarUsers',
            value: foundUser.id
          });
        }
      }
    }
    // Users to Delete
    if (usersToDelete.length > 0) {
      // Get and check users
      const users = await UserStorage.getUsers(tenantID,
        { userIDs: usersToDelete.map((userToDelete) => userToDelete.user.id) },
        Constants.DB_PARAMS_MAX_LIMIT);
      for (const userToDelete of usersToDelete) {
        // Check the user
        const foundUser = users.result.find((user) => user.id === userToDelete.user.id);
        UtilsService.assertObjectExists(action, foundUser, `User '${userToDelete.user.id}' does not exist`,
          MODULE_NAME, 'handleAssignCarUsers', loggedUser);
        // Auth
        if (!Authorizations.canReadUser(loggedUser, foundUser.id)) {
          throw new AppAuthError({
            errorCode: HTTPAuthError.ERROR,
            user: loggedUser,
            actionOnUser: foundUser,
            action: Action.READ, entity: Entity.USER,
            module: MODULE_NAME, method: 'handleAssignCarUsers',
            value: foundUser.id
          });
        }
      }
    }
    // Users to Upsert
    if (usersToUpsert.length > 0) {
      // Read all car users
      const carUsersDB = await CarStorage.getCarUsers(tenantID,
        { carUsersIDs: usersToUpsert.map((userToUpsert) => userToUpsert.id) },
        Constants.DB_PARAMS_MAX_LIMIT);
      const userCarsToInsert: UserCar[] = [];
      // Upsert
      try {
        for (const userToUpsert of usersToUpsert) {
          // Get from DB
          const foundCarUserDB = carUsersDB.result.find((carUserDB) => carUserDB.id === userToUpsert.id);
          // Check Default
          if (userToUpsert.default && (!foundCarUserDB || (userToUpsert.default !== foundCarUserDB.default))) {
            await CarStorage.clearCarUserDefault(tenantID, userToUpsert.user.id);
          }
          // Check Owner
          if (Authorizations.isAdmin(loggedUser) && userToUpsert.owner && (!foundCarUserDB || (userToUpsert.owner !== foundCarUserDB.owner))) {
            await CarStorage.clearCarUserOwner(tenantID, userToUpsert.carID);
          }
          // Update
          if (foundCarUserDB) {
            foundCarUserDB.owner = userToUpsert.owner;
            foundCarUserDB.default = userToUpsert.default;
            userToUpsert.lastChangedBy = { 'id': loggedUser.id };
            userToUpsert.lastChangedOn = new Date();
            // Save (multi updates one shot does not exist in MongoDB)
            await CarStorage.saveCarUser(tenantID, foundCarUserDB);
            // Create
          } else {
            userToUpsert.carID = car.id;
            userToUpsert.createdBy = { 'id': loggedUser.id };
            userToUpsert.createdOn = new Date();
            // Create later
            userCarsToInsert.push(userToUpsert);
          }
        }
        // Insert one shot
        if (userCarsToInsert.length > 0) {
          await CarStorage.insertCarUsers(tenantID, userCarsToInsert);
        }
      } catch (error) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          action: ServerAction.CAR_UPDATE,
          errorCode: HTTPError.GENERAL_ERROR,
          module: MODULE_NAME, method: 'handleAssignCarUsers',
          user: loggedUser.id,
          message: `An error occurred while trying to assign the users to the car ${Utils.buildCarName(car, true)}`,
          detailedMessages: { error: error.message, stack: error.stack }
        });
      }
      // Log
      Logging.logDebug({
        tenantID: tenantID,
        user: loggedUser.id,
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME, method: 'handleAssignCarUsers',
        action: ServerAction.CAR_UPDATE,
        message: `${usersToUpsert.length} user(s) have been assigned to the car ${Utils.buildCarName(car, true)}`
      });
    }
    // Users to Delete
    if (usersToDelete.length > 0) {
      try {
        // Delete
        await CarStorage.deleteCarUsers(tenantID, usersToDelete.map((userToDelete) => userToDelete.id));
      } catch (error) {
        Logging.logError({
          tenantID: tenantID,
          user: loggedUser.id,
          source: Constants.CENTRAL_SERVER,
          module: MODULE_NAME, method: 'handleAssignCarUsers',
          action: ServerAction.CAR_UPDATE,
          message: `An error occurred while trying to remove all the users from the car ${Utils.buildCarName(car, true)}`,
          detailedMessages: { error: error.message, stack: error.stack }
        });
      }
      // Log
      Logging.logDebug({
        tenantID: tenantID,
        user: loggedUser.id,
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME, method: 'handleAssignCarUsers',
        action: ServerAction.CAR_UPDATE,
        message: `${usersToDelete.length} user(s) have been removed from the car ${Utils.buildCarName(car, true)}`
      });
    }
  }
}
