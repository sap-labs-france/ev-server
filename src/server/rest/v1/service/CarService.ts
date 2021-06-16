import { Action, Entity } from '../../../../types/Authorization';
import { AsyncTaskType, AsyncTasks } from '../../../../types/AsyncTask';
import { Car, CarType } from '../../../../types/Car';
import { CarCatalogDataResult, CarDataResult } from '../../../../types/DataResult';
import { HTTPAuthError, HTTPError } from '../../../../types/HTTPError';
import { NextFunction, Request, Response } from 'express';

import AppAuthError from '../../../../exception/AppAuthError';
import AppError from '../../../../exception/AppError';
import AsyncTaskManager from '../../../../async-task/AsyncTaskManager';
import AuthorizationService from './AuthorizationService';
import Authorizations from '../../../../authorization/Authorizations';
import CarSecurity from './security/CarSecurity';
import CarStorage from '../../../../storage/mongodb/CarStorage';
import Constants from '../../../../utils/Constants';
import LockingHelper from '../../../../locking/LockingHelper';
import LockingManager from '../../../../locking/LockingManager';
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
      UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.CAR,
        Action.LIST, Entity.CAR_CATALOGS, MODULE_NAME, 'handleGetCarCatalogs');
    }
    // Filter
    const filteredRequest = CarSecurity.filterCarCatalogsRequest(req.query);
    // Check auth
    const authorizationCarCatalogsFilter = await AuthorizationService.checkAndGetCarCatalogsAuthorizationFilters(req.tenant, req.user, filteredRequest);
    if (!authorizationCarCatalogsFilter.authorized) {
      UtilsService.sendEmptyDataResult(res, next);
      return;
    }
    // Get the Cars
    const carCatalogs = await CarStorage.getCarCatalogs(
      {
        search: filteredRequest.Search,
        carMaker: filteredRequest.CarMaker ? filteredRequest.CarMaker.split('|') : null,
        withImage: true,
      },
      {
        limit: filteredRequest.Limit,
        skip: filteredRequest.Skip,
        sort: filteredRequest.SortFields,
        onlyRecordCount: filteredRequest.OnlyRecordCount
      },
      authorizationCarCatalogsFilter.projectFields
    );
    // Add Auth flags
    await AuthorizationService.addCarCatalogsAuthorizationActions(req.tenant, req.user, carCatalogs as CarCatalogDataResult,
      authorizationCarCatalogsFilter);
    // Return
    res.json(carCatalogs);
    next();
  }

  public static async handleGetCarCatalog(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    if (!Authorizations.isSuperAdmin(req.user)) {
    // Check if component is active
      UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.CAR,
        Action.READ, Entity.CAR_CATALOG, MODULE_NAME, 'handleGetCarCatalog');
    }
    // Filter
    const filteredRequest = CarSecurity.filterCarCatalogRequest(req.query);
    // Check and get Car cATALOG
    const carCatalog = await UtilsService.checkAndGetCarCatalogAuthorization(req.tenant, req.user, filteredRequest.ID, Action.READ, action,
      { withImage: true }, true);
    // Return
    res.json(carCatalog);
    next();
  }

  public static async handleGetCarCatalogImage(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Unprotected Endpoint: No JWT token is provided
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
      UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.CAR,
        Action.READ, Entity.CAR_CATALOG, MODULE_NAME, 'handleGetCarCatalogImages');
    }
    // Filter
    const filteredRequest = CarSecurity.filterCarCatalogImagesRequest(req.query);
    // Check mandatory fields
    UtilsService.assertIdIsProvided(action, filteredRequest.ID, MODULE_NAME, 'handleGetCarCatalogImages', req.user);
    // Check dynamic auth
    const authorizationFilter = await AuthorizationService.checkAndGetCarCatalogAuthorizationFilters(
      req.tenant, req.user, { ID: filteredRequest.ID }, Action.READ);
    if (!authorizationFilter.authorized) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.READ, entity: Entity.CAR_CATALOG,
        module: MODULE_NAME, method: 'handleGetCarCatalogImages',
        value: filteredRequest.ID.toString()
      });
    }
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
    if (!await Authorizations.canSynchronizeCarCatalogs(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.SYNCHRONIZE, entity: Entity.CAR_CATALOGS,
        module: MODULE_NAME, method: 'handleSynchronizeCarCatalogs'
      });
    }
    // Get the lock
    const syncCarCatalogsLock = await LockingHelper.createSyncCarCatalogsLock(Constants.DEFAULT_TENANT);
    if (!syncCarCatalogsLock) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        action: action,
        errorCode: HTTPError.CANNOT_ACQUIRE_LOCK,
        module: MODULE_NAME, method: 'handleSynchronizeCarCatalogs',
        message: 'Error in synchronizing the Car Catalogs: cannot acquire the lock',
        user: req.user
      });
    }
    try {
      // Create and Save async task
      await AsyncTaskManager.createAndSaveAsyncTasks({
        name: AsyncTasks.SYNCHRONIZE_CAR_CATALOGS,
        action,
        type: AsyncTaskType.TASK,
        module: MODULE_NAME,
        method: 'handleSynchronizeCarCatalogs',
      });
    } finally {
      // Release the lock
      await LockingManager.release(syncCarCatalogsLock);
    }
    // Return result
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleGetCarMakers(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    if (!Authorizations.isSuperAdmin(req.user)) {
    // Check if component is active
      UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.CAR,
        Action.READ, Entity.CAR_CATALOG, MODULE_NAME, 'handleGetCarMakers');
    }
    // Filter
    const filteredRequest = CarSecurity.filterCarMakersRequest(req.query);
    // Check auth
    if (!await Authorizations.canReadCarCatalog(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.READ, entity: Entity.CAR_CATALOG,
        module: MODULE_NAME, method: 'handleGetCarMakers'
      });
    }
    // Get car makers
    const carMakers = await CarStorage.getCarMakers({ search: filteredRequest.Search }, [ 'carMaker' ]);
    res.json(carMakers);
    next();
  }

  public static async handleCreateCar(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.CAR,
      Action.CREATE, Entity.CAR, MODULE_NAME, 'handleCreateCar');
    // Filter
    const filteredRequest = CarSecurity.filterCarCreateRequest(req.body);
    // Check
    UtilsService.checkIfCarValid(filteredRequest, req);
    // Check auth
    const authorizationFilters = await AuthorizationService.checkAndGetCarAuthorizationFilters(
      req.tenant,req.user, filteredRequest, Action.CREATE);
    if (!authorizationFilters.authorized) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.CREATE, entity: Entity.CAR,
        module: MODULE_NAME, method: 'handleCreateCar'
      });
    }
    // Check and get CarCatalog
    const carCatalog = await UtilsService.checkAndGetCarCatalogAuthorization(req.tenant, req.user, filteredRequest.carCatalogID, Action.READ, action,
      { withImage: true }, true);
    UtilsService.assertObjectExists(action, carCatalog, `Car Catalog ID '${filteredRequest.carCatalogID}' does not exist`,
      MODULE_NAME, 'handleCreateCar', req.user);
    // Keep the current user to add for Basic role
    const carUserToAdd = filteredRequest.usersAdded.find((carUser) => carUser.user.id === req.user.id);
    // Check Car
    const car = await CarStorage.getCarByVinLicensePlate(req.user.tenantID,
      filteredRequest.licensePlate, filteredRequest.vin, {
        withUsers: Authorizations.isBasic(req.user) ? true : false,
      });

    let newCar: Car;
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
    await Logging.logSecurityInfo({
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
    // Return
    res.json(Object.assign({ id: newCar.id }, Constants.REST_RESPONSE_SUCCESS));
    next();
  }

  public static async handleUpdateCar(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.CAR,
      Action.UPDATE, Entity.CAR, MODULE_NAME, 'handleUpdateCar');
    // Filter
    const filteredRequest = CarSecurity.filterCarUpdateRequest(req.body);
    // Check
    UtilsService.checkIfCarValid(filteredRequest, req);
    // Check and Get Car
    const car = await UtilsService.checkAndGetCarAuthorization(req.tenant, req.user, filteredRequest.id, Action.UPDATE, action,
      {
        withUsers: Authorizations.isBasic(req.user) ? true : false
      }, true);
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
      await Logging.logSecurityInfo({
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
    // Filter
    const filteredRequest = CarSecurity.filterCarsRequest(req.query);
    // Check auth
    const authorizationCarsFilter = await AuthorizationService.checkAndGetCarsAuthorizationFilters(req.tenant, req.user, filteredRequest);
    if (!authorizationCarsFilter.authorized) {
      UtilsService.sendEmptyDataResult(res, next);
      return;
    }
    // Get cars
    const cars = await CarStorage.getCars(req.user.tenantID,
      {
        search: filteredRequest.Search,
        carMakers: filteredRequest.CarMaker ? filteredRequest.CarMaker.split('|') : null,
        withUsers: filteredRequest.WithUsers,
        userIDs: filteredRequest.UserID ? filteredRequest.UserID.split('|') : null,
        ...authorizationCarsFilter.filters
      },
      {
        limit: filteredRequest.Limit,
        skip: filteredRequest.Skip,
        sort: filteredRequest.SortFields,
        onlyRecordCount: filteredRequest.OnlyRecordCount
      },
      authorizationCarsFilter.projectFields
    );
    // Add Auth flags
    await AuthorizationService.addCarsAuthorizations(
      req.tenant, req.user, cars as CarDataResult, authorizationCarsFilter, filteredRequest);
    // Return
    res.json(cars);
    next();
  }

  public static async handleGetCar(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.CAR, Action.READ, Entity.CAR,
      MODULE_NAME, 'handleGetCar');
    // Filter
    const filteredRequest = CarSecurity.filterCarRequest(req.query);
    // Check and get Car
    const car = await UtilsService.checkAndGetCarAuthorization(req.tenant, req.user, filteredRequest.ID, Action.READ, action, {
      withUsers: true ,
    }, true);
    // Return
    res.json(car);
    next();
  }

  public static async handleGetCarUsers(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.CAR, Action.LIST, Entity.USERS_CARS,
      MODULE_NAME, 'handleGetCarUsers');
    // Filter request
    const filteredRequest = CarSecurity.filterCarUsersRequest(req.query);
    // Check Car
    try {
      await UtilsService.checkAndGetCarAuthorization(
        req.tenant, req.user, filteredRequest.CarID, Action.READ, action, {}, true);
    } catch (error) {
      UtilsService.sendEmptyDataResult(res, next);
      return;
    }
    // Check dynamic auth for reading Users
    const authorizationCarUsersFilter = await AuthorizationService.checkAndGetCarUsersAuthorizationFilters(req.tenant,
      req.user, filteredRequest);
    if (!authorizationCarUsersFilter.authorized) {
      UtilsService.sendEmptyDataResult(res, next);
      return;
    }
    // Get cars
    const usersCars = await CarStorage.getCarUsers(req.user.tenantID,
      {
        search: filteredRequest.Search,
        carIDs: [filteredRequest.CarID],
        ...authorizationCarUsersFilter.filters
      },
      {
        limit: filteredRequest.Limit,
        skip: filteredRequest.Skip,
        sort: filteredRequest.SortFields,
        onlyRecordCount: filteredRequest.OnlyRecordCount
      },
      authorizationCarUsersFilter.projectFields
    );
    // Return
    res.json(usersCars);
    next();
  }

  public static async handleDeleteCar(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.CAR, Action.DELETE, Entity.USERS_CARS,
      MODULE_NAME, 'handleDeleteCar');
    // Filter
    const carId = CarSecurity.filterCarRequest(req.query).ID;
    // Check and Get Car
    const car = await UtilsService.checkAndGetCarAuthorization(req.tenant, req.user, carId, Action.DELETE, action,
      {
        withUsers: Authorizations.isBasic(req.user) ? true : false
      }, true);
    // Check Owner if Basic
    let carUser: UserCar;
    if (Authorizations.isBasic(req.user)) {
      carUser = car.carUsers.find((carUserToFind) => carUserToFind.user.id.toString() === req.user.id);
      // Assigned to this user?
      if (!carUser) {
        throw new AppAuthError({
          errorCode: HTTPAuthError.FORBIDDEN,
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
      await Logging.logSecurityInfo({
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
      await Logging.logSecurityInfo({
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
    if (!Authorizations.isAdmin(loggedUser)) {
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
    // Check Users
    const usersToCheck = [...usersToUpsert, ...usersToDelete];
    if (!Utils.isEmptyArray(usersToCheck)) {
      // Get and check users
      const users = await UserStorage.getUsers(tenantID,
        { userIDs: usersToCheck.map((userToCheck) => userToCheck.user.id) },
        Constants.DB_PARAMS_MAX_LIMIT);
      for (const userToCheck of usersToCheck) {
        // Check the user
        const foundUser = users.result.find((user) => user.id === userToCheck.user.id);
        UtilsService.assertObjectExists(action, foundUser, `User ID '${userToCheck.user.id}' does not exist`,
          MODULE_NAME, 'handleAssignCarUsers', loggedUser);
        // Auth
        if (!(await Authorizations.canReadUser(loggedUser, { UserID: foundUser.id })).authorized) {
          throw new AppAuthError({
            errorCode: HTTPAuthError.FORBIDDEN,
            user: loggedUser,
            actionOnUser: foundUser.id,
            action: Action.READ, entity: Entity.USER,
            module: MODULE_NAME, method: 'handleAssignCarUsers',
            value: foundUser.id
          });
        }
      }
    }
    // Users to Upsert
    if (!Utils.isEmptyArray(usersToUpsert)) {
      // Read all car users
      const carUsersDB = await CarStorage.getCarUsers(tenantID,
        { carUsersIDs: usersToUpsert.map((userToUpsert) => userToUpsert.id) },
        Constants.DB_PARAMS_MAX_LIMIT);
      const userCarsToInsert: UserCar[] = [];
      // Upsert
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
      if (!Utils.isEmptyArray(userCarsToInsert)) {
        await CarStorage.insertCarUsers(tenantID, userCarsToInsert);
      }
      // Log
      await Logging.logDebug({
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
      // Delete
      await CarStorage.deleteCarUsers(tenantID, usersToDelete.map((userToDelete) => userToDelete.id));
      // Log
      await Logging.logDebug({
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
