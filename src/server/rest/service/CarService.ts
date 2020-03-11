import { NextFunction, Request, Response } from 'express';
import { Action, Entity } from '../../../types/Authorization';
import TenantComponents from '../../../types/TenantComponents';
import UtilsService from './UtilsService';
import Authorizations from '../../../authorization/Authorizations';
import AppAuthError from '../../../exception/AppAuthError';
import { HTTPAuthError } from '../../../types/HTTPError';
import CarSecurity from './security/CarSecurity';
import CarStorage from '../../../storage/mongodb/CarStorage';

export default class CarService {
  public static async handleGetCars(action: Action, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    // UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.CAR,
    // Action.LIST, Entity.CARS, 'CarService', 'handleGetCars');
    // Check auth
    if (!Authorizations.canListCars(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.LIST,
        entity: Entity.CARS,
        module: 'CarService',
        method: 'handleGetCars'
      });
    }
    // Filter
    const filteredRequest = CarSecurity.filterCarsRequest(req.query);
    // Get the cars
    const cars = await CarStorage.getCars(
      {
        search: filteredRequest.Search
      },
      { limit: filteredRequest.Limit, skip: filteredRequest.Skip, sort: filteredRequest.Sort, onlyRecordCount: filteredRequest.OnlyRecordCount },
      ['id', 'VehicleModel', 'vehicleMake', 'batteryCapacityFull', 'fastchargeChargeSpeed', 'performanceTopspeed', 'performanceAcceleration', 'rangeReal', 'efficiencyReal', 'images','chargeStandardChargeSpeed']
    );
    // Filter
    CarSecurity.filterCarsResponse(cars, req.user);
    // Return
    res.json(cars);
    next();
  }

  public static async handleGetCar(action: Action, req: Request, res: Response, next: NextFunction): Promise<void> {
    if (!Authorizations.canReadCar(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.LIST,
        entity: Entity.CAR,
        module: 'CarService',
        method: 'handleGetCar'
      });
    }
    // Filter
    const filteredRequest = CarSecurity.filterCarRequest(req.query);
    // Get the cars
    const car = await CarStorage.getCar(filteredRequest.ID);
    // Filter
    CarSecurity.filterCarResponse(car, req.user);
    // Return
    res.json(car);
    next();
  }

  public static async handleGetCarObject(action: Action, req: Request, res: Response, next: NextFunction): Promise<void> {
    if (!Authorizations.canReadCarObject(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.LIST,
        entity: Entity.CARS,
        module: 'CarService',
        method: 'handleGetCars'
      });
    }
    // Filter
    const filteredRequest = CarSecurity.filterCarRequest(req.query);
    // Get the cars
    const car = await CarStorage.getCar(filteredRequest.ID,true);
    // Filter
    CarSecurity.filterCarResponse(car, req.user);
    // Return
    res.json(car);
    next();
  }
}
