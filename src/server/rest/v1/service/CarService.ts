import { Action, Entity } from '../../../../types/Authorization';
import { AsyncTaskType, AsyncTasks } from '../../../../types/AsyncTask';
import { CarCatalogDataResult, CarDataResult } from '../../../../types/DataResult';
import { HTTPAuthError, HTTPError } from '../../../../types/HTTPError';
import { NextFunction, Request, Response } from 'express';
import Tenant, { TenantComponents } from '../../../../types/Tenant';

import AppAuthError from '../../../../exception/AppAuthError';
import AppError from '../../../../exception/AppError';
import AsyncTaskBuilder from '../../../../async-task/AsyncTaskBuilder';
import AuthorizationService from './AuthorizationService';
import Authorizations from '../../../../authorization/Authorizations';
import { Car } from '../../../../types/Car';
import CarStorage from '../../../../storage/mongodb/CarStorage';
import CarValidator from '../validator/CarValidator';
import Constants from '../../../../utils/Constants';
import LockingHelper from '../../../../locking/LockingHelper';
import LockingManager from '../../../../locking/LockingManager';
import Logging from '../../../../utils/Logging';
import LoggingHelper from '../../../../utils/LoggingHelper';
import { ServerAction } from '../../../../types/Server';
import Utils from '../../../../utils/Utils';
import UtilsService from './UtilsService';

const MODULE_NAME = 'CarService';

export default class CarService {
  public static async handleGetCarCatalogs(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    if (!Authorizations.isSuperAdmin(req.user)) {
      UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.CAR,
        Action.LIST, Entity.CAR_CATALOG, MODULE_NAME, 'handleGetCarCatalogs');
    }
    // Filter
    const filteredRequest = CarValidator.getInstance().validateCarCatalogsGetReq(req.query);
    // Check auth
    const authorizationCarCatalogsFilter = await AuthorizationService.checkAndGetCarCatalogsAuthorizations(req.tenant, req.user, Action.LIST, filteredRequest);
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
        ...authorizationCarCatalogsFilter.filters
      },
      {
        limit: filteredRequest.Limit,
        skip: filteredRequest.Skip,
        sort: UtilsService.httpSortFieldsToMongoDB(filteredRequest.SortFields),
        onlyRecordCount: filteredRequest.OnlyRecordCount
      },
      authorizationCarCatalogsFilter.projectFields
    );
    // Assign projected fields
    if (authorizationCarCatalogsFilter.projectFields) {
      carCatalogs.projectFields = authorizationCarCatalogsFilter.projectFields;
    }
    // Add Auth flags
    await AuthorizationService.addCarCatalogsAuthorizationActions(req.tenant, req.user, carCatalogs as CarCatalogDataResult,
      authorizationCarCatalogsFilter);
    res.json(carCatalogs);
    next();
  }

  public static async handleGetCarCatalog(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    if (!Authorizations.isSuperAdmin(req.user)) {
      UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.CAR,
        Action.READ, Entity.CAR_CATALOG, MODULE_NAME, 'handleGetCarCatalog');
    }
    // Filter
    const filteredRequest = CarValidator.getInstance().validateCarCatalogGetReq(req.query);
    // Check and get Car Catalog
    const carCatalog = await UtilsService.checkAndGetCarCatalogAuthorization(
      req.tenant, req.user, filteredRequest.ID, Action.READ, action, null, { withImage: true }, true);
    res.json(carCatalog);
    next();
  }

  public static async handleGetCarCatalogImage(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // This endpoint is not protected, so no need to check user's access
    const filteredRequest = CarValidator.getInstance().validateCarCatalogGetReq(req.query);
    // Get the car Image
    const carCatalog = await CarStorage.getCarCatalogImage(filteredRequest.ID);
    let logo = carCatalog && !Utils.isNullOrEmptyString(carCatalog.image) ? carCatalog.image : Constants.NO_CAR_IMAGE;
    let header = 'image';
    let encoding: BufferEncoding = 'base64';
    // Remove encoding header
    if (logo.startsWith('data:image/')) {
      header = logo.substring(5, logo.indexOf(';'));
      encoding = logo.substring(logo.indexOf(';') + 1, logo.indexOf(',')) as BufferEncoding;
      logo = logo.substring(logo.indexOf(',') + 1);
    }
    res.setHeader('content-type', header);
    res.send(Buffer.from(logo, encoding));
    next();
  }

  public static async handleGetCarCatalogImages(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    if (!Authorizations.isSuperAdmin(req.user)) {
      UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.CAR,
        Action.READ, Entity.CAR_CATALOG, MODULE_NAME, 'handleGetCarCatalogImages');
    }
    // Filter
    const filteredRequest = CarValidator.getInstance().validateCarCatalogImagesGetReq(req.query);
    // Check dynamic auth
    const authorizationFilter = await AuthorizationService.checkAndGetCarCatalogAuthorizations(
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
    res.json(carCatalogImages);
    next();
  }

  public static async handleSynchronizeCarCatalogs(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    if (!Authorizations.isSuperAdmin(req.user)) {
      UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.CAR,
        Action.SYNCHRONIZE, Entity.CAR_CATALOG, MODULE_NAME, 'handleSynchronizeCarCatalogs');
    }
    // Check auth
    const authorizationFilter = await AuthorizationService.checkAndGetCarCatalogsAuthorizations(req.tenant, req.user, Action.SYNCHRONIZE);
    if (!authorizationFilter.authorized) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.SYNCHRONIZE, entity: Entity.CAR_CATALOG,
        module: MODULE_NAME, method: 'handleSynchronizeCarCatalogs'
      });
    }
    // Get the lock
    const syncCarCatalogsLock = await LockingHelper.acquireSyncCarCatalogsLock(Constants.DEFAULT_TENANT);
    if (!syncCarCatalogsLock) {
      throw new AppError({
        action: action,
        errorCode: HTTPError.CANNOT_ACQUIRE_LOCK,
        module: MODULE_NAME, method: 'handleSynchronizeCarCatalogs',
        message: 'Error in synchronizing the Car Catalogs: cannot acquire the lock',
        user: req.user
      });
    }
    try {
      // Create and Save async task
      await AsyncTaskBuilder.createAndSaveAsyncTasks({
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
    // Check if component is active
    if (!Authorizations.isSuperAdmin(req.user)) {
      UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.CAR,
        Action.READ, Entity.CAR_CATALOG, MODULE_NAME, 'handleGetCarMakers');
    }
    // Filter
    const filteredRequest = CarValidator.getInstance().validateCarMakersGetReq(req.query);
    // Check auth
    const authorizationCarCatalogsFilter = await AuthorizationService.checkAndGetCarCatalogsAuthorizations(req.tenant, req.user, Action.LIST, filteredRequest);
    if (!authorizationCarCatalogsFilter.authorized) {
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
    const filteredRequest = CarValidator.getInstance().validateCarCreateReq(req.body);
    UtilsService.checkIfCarValid(filteredRequest, req);
    // Check auth
    await AuthorizationService.checkAndGetCarAuthorizations(
      req.tenant,req.user, {}, Action.CREATE, filteredRequest as Car);
    // Check and get Car Catalog
    await UtilsService.checkAndGetCarCatalogAuthorization(
      req.tenant, req.user, filteredRequest.carCatalogID, Action.READ, action, filteredRequest as Car);
    // Car already exits
    const car = await CarStorage.getCarByVinLicensePlate(req.tenant,
      filteredRequest.licensePlate, filteredRequest.vin);
    if (car) {
      throw new AppError({
        errorCode: HTTPError.CAR_ALREADY_EXIST_ERROR,
        message: `The Car with VIN: '${filteredRequest.vin}' and License plate: '${filteredRequest.licensePlate}' already exist`,
        user: req.user,
        module: MODULE_NAME, method: 'handleCreateCar'
      });
    }
    // Check and Get User
    if (filteredRequest.userID) {
      await UtilsService.checkAndGetUserAuthorization(
        req.tenant, req.user, filteredRequest.userID, Action.READ, action);
      // Clear Default
      if (filteredRequest.default) {
        await CarStorage.clearDefaultUserCar(req.tenant, filteredRequest.userID);
      // Force Default Car
      } else {
        const defaultCar = await CarStorage.getDefaultUserCar(req.tenant, filteredRequest.userID, {}, ['id']);
        // Force default
        if (!defaultCar) {
          filteredRequest.default = true;
        }
      }
    // Clear Default Car
    } else {
      filteredRequest.default = false;
    }
    // Create car
    const newCar: Car = {
      carCatalogID: filteredRequest.carCatalogID,
      licensePlate: filteredRequest.licensePlate,
      vin: filteredRequest.vin,
      createdBy: { id: req.user.id },
      type: filteredRequest.type,
      userID: filteredRequest.userID,
      default: filteredRequest.default,
      converter: filteredRequest.converter,
      carConnectorData: filteredRequest.carConnectorData,
      createdOn: new Date()
    };
    // Save
    newCar.id = await CarStorage.saveCar(req.tenant, newCar);
    await Logging.logInfo({
      tenantID: req.user.tenantID,
      ...LoggingHelper.getCarProperties(newCar),
      user: req.user, module: MODULE_NAME, method: 'handleCreateCar',
      message: `Car with VIN '${newCar.vin}' and plate ID '${newCar.licensePlate}' has been created successfully`,
      action: action,
      detailedMessages: { car: newCar }
    });
    res.json(Object.assign({ id: newCar.id }, Constants.REST_RESPONSE_SUCCESS));
    next();
  }

  public static async handleUpdateCar(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.CAR,
      Action.UPDATE, Entity.CAR, MODULE_NAME, 'handleUpdateCar');
    // Filter
    const filteredRequest = CarValidator.getInstance().validateCarUpdateReq(req.body);
    UtilsService.checkIfCarValid(filteredRequest, req);
    // Check and Get Car
    const car = await UtilsService.checkAndGetCarAuthorization(
      req.tenant, req.user, filteredRequest.id, Action.UPDATE, action, filteredRequest as Car);
    // Check and get Car Catalog
    await UtilsService.checkAndGetCarCatalogAuthorization(
      req.tenant, req.user, filteredRequest.carCatalogID, Action.READ, action);
    // Check Car with same VIN and License Plate
    if (car.licensePlate !== filteredRequest.licensePlate || car.vin !== filteredRequest.vin) {
      const sameCar = await CarStorage.getCarByVinLicensePlate(
        req.tenant, filteredRequest.licensePlate, filteredRequest.vin);
      if (sameCar) {
        throw new AppError({
          errorCode: HTTPError.CAR_ALREADY_EXIST_ERROR,
          message: `Car with VIN '${filteredRequest.vin}' and License Plate '${filteredRequest.licensePlate}' already exists`,
          user: req.user,
          module: MODULE_NAME, method: 'handleUpdateCar'
        });
      }
    }
    // Check and Get User
    if (filteredRequest.userID) {
      await UtilsService.checkAndGetUserAuthorization(
        req.tenant, req.user, filteredRequest.userID, Action.READ, action);
      // Clear Default
      if (filteredRequest.default) {
        await CarStorage.clearDefaultUserCar(req.tenant, filteredRequest.userID);
      // Force Default Car
      } else {
        const defaultCar = await CarStorage.getDefaultUserCar(req.tenant, filteredRequest.userID, {}, ['id']);
        // Force default
        if (!defaultCar || defaultCar.id === car.id) {
          filteredRequest.default = true;
        }
      }
    // Clear Default Car
    } else {
      filteredRequest.default = false;
    }
    // User has been changed?
    let setDefaultCarToOldUserID: string;
    if (car.userID && filteredRequest.userID && car.userID !== filteredRequest.userID) {
      // Check Default Car of old User
      if (car.default) {
        setDefaultCarToOldUserID = car.userID;
      }
    }
    // Update
    car.carCatalogID = filteredRequest.carCatalogID;
    car.vin = filteredRequest.vin;
    car.licensePlate = filteredRequest.licensePlate;
    car.type = filteredRequest.type;
    car.converter = filteredRequest.converter;
    car.userID = filteredRequest.userID;
    car.default = filteredRequest.default;
    car.carConnectorData = filteredRequest.carConnectorData;
    car.lastChangedBy = { 'id': req.user.id };
    car.lastChangedOn = new Date();
    // Save
    await CarStorage.saveCar(req.tenant, car);
    // Set Default Car to old User
    if (setDefaultCarToOldUserID) {
      await CarService.setDefaultCarForUser(req.tenant, setDefaultCarToOldUserID);
    }
    await Logging.logInfo({
      tenantID: req.user.tenantID,
      ...LoggingHelper.getCarProperties(car),
      user: req.user, module: MODULE_NAME, method: 'handleUpdateCar',
      message: `Car '${car.id}' has been updated successfully`,
      action: action,
      detailedMessages: { car }
    });
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleGetCars(action: Action, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.CAR,
      Action.LIST, Entity.CAR, MODULE_NAME, 'handleGetCars');
    // Filter
    const filteredRequest = CarValidator.getInstance().validateCarsGetReq(req.query);
    // Check auth
    const authorizationCarsFilter = await AuthorizationService.checkAndGetCarsAuthorizations(
      req.tenant, req.user, filteredRequest);
    if (!authorizationCarsFilter.authorized) {
      UtilsService.sendEmptyDataResult(res, next);
      return;
    }
    // Get cars
    const cars = await CarStorage.getCars(req.tenant,
      {
        search: filteredRequest.Search,
        carMakers: filteredRequest.CarMaker ? filteredRequest.CarMaker.split('|') : null,
        withUser: filteredRequest.WithUser,
        userIDs: filteredRequest.UserID ? filteredRequest.UserID.split('|') : null,
        ...authorizationCarsFilter.filters
      },
      {
        limit: filteredRequest.Limit,
        skip: filteredRequest.Skip,
        sort: UtilsService.httpSortFieldsToMongoDB(filteredRequest.SortFields),
        onlyRecordCount: filteredRequest.OnlyRecordCount
      },
      authorizationCarsFilter.projectFields
    );
    // Assign projected fields
    if (authorizationCarsFilter.projectFields) {
      cars.projectFields = authorizationCarsFilter.projectFields;
    }
    // Add Auth flags
    await AuthorizationService.addCarsAuthorizations(
      req.tenant, req.user, cars as CarDataResult, authorizationCarsFilter);
    res.json(cars);
    next();
  }

  public static async handleGetCar(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.CAR,
      Action.READ, Entity.CAR, MODULE_NAME, 'handleGetCar');
    // Filter
    const filteredRequest = CarValidator.getInstance().validateCarGetReq(req.query);
    // Check and get Car
    const car = await UtilsService.checkAndGetCarAuthorization(
      req.tenant, req.user, filteredRequest.ID, Action.READ, action, null, { withUser: true }, true);
    res.json(car);
    next();
  }

  public static async handleDeleteCar(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.CAR,
      Action.DELETE, Entity.CAR, MODULE_NAME, 'handleDeleteCar');
    // Filter
    const carID = CarValidator.getInstance().validateCarGetReq(req.query).ID;
    // Check and Get Car
    const car = await UtilsService.checkAndGetCarAuthorization(
      req.tenant, req.user, carID, Action.DELETE, action);
    // Delete the car
    await CarStorage.deleteCar(req.tenant, carID);
    // Set new Default Car
    if (car.default) {
      await CarService.setDefaultCarForUser(req.tenant, car.userID);
    }
    await Logging.logInfo({
      ...LoggingHelper.getCarProperties(car),
      tenantID: req.user.tenantID,
      user: req.user, module: MODULE_NAME, method: 'handleDeleteCar',
      message: `Car '${Utils.buildCarName(car)}' has been deleted successfully`,
      action: action,
      detailedMessages: { car }
    });
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  private static async setDefaultCarForUser(tenant: Tenant, userID: string) {
    // Get the first available car
    const defaultCars = await CarStorage.getCars(tenant, { userIDs: [userID] }, Constants.DB_PARAMS_SINGLE_RECORD);
    if (!Utils.isEmptyArray(defaultCars.result)) {
      // Set Default
      const newDefaultCar = defaultCars.result[0];
      newDefaultCar.default = true;
      await CarStorage.saveCar(tenant, newDefaultCar);
    }
  }
}
