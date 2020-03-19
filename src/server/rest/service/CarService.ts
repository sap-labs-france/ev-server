import { NextFunction, Request, Response } from 'express';
import { Action, Entity } from '../../../types/Authorization';
import TenantComponents from '../../../types/TenantComponents';
import UtilsService from './UtilsService';
import Authorizations from '../../../authorization/Authorizations';
import AppAuthError from '../../../exception/AppAuthError';
import { HTTPAuthError } from '../../../types/HTTPError';
import CarSecurity from './security/CarSecurity';
import CarStorage from '../../../storage/mongodb/CarStorage';
import Constants from '../../../utils/Constants';
import CarDatabaseFactory from '../../../integration/car/CarDatabaseFactory';

export default class CarService {
  public static async handleGetCars(action: Action, req: Request, res: Response, next: NextFunction): Promise<void> {
    if (!Authorizations.isSuperAdmin(req.user)) {
      // Check if component is active
      UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.CAR, Action.LIST, Entity.CARS, 'CarService', 'handleGetCars');
    }
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
      ['id', 'vehicleModel', 'vehicleMake', 'vehicleModelVersion', 'batteryCapacityFull', 'fastchargeChargeSpeed', 'performanceTopspeed',
        'performanceAcceleration', 'rangeWLTP', 'rangeReal', 'efficiencyReal', 'images', 'chargeStandardChargeSpeed',
        'chargeStandardPower', 'chargeStandardPhase', 'chargePlug', 'fastChargePlug', 'fastChargePowerMax', 'drivetrainPowerHP']
    );
    // Filter
    CarSecurity.filterCarsResponse(cars, req.user);
    // Return
    res.json(cars);
    next();
  }

  public static async handleGetCar(action: Action, req: Request, res: Response, next: NextFunction): Promise<void> {
    if (!Authorizations.isSuperAdmin(req.user)) {
      // Check if component is active
      UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.CAR, Action.READ, Entity.CAR, 'CarService', 'handleGetCars');
    }
    // Check auth
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
    let car;
    if (!Authorizations.isSuperAdmin(req.user)) {
      // Get the car
      car = await CarStorage.getCar(filteredRequest.ID,
        ['id', 'vehicleModel', 'vehicleMake', 'vehicleModelVersion', 'batteryCapacityFull', 'fastchargeChargeSpeed',
          'performanceTopspeed', 'performanceAcceleration', 'rangeWLTP', 'rangeReal', 'efficiencyReal', 'images', 'drivetrainPropulsion',
          'drivetrainTorque', 'batteryCapacityUseable', 'chargePlug', 'fastChargePlug', 'fastChargePowerMax', 'chargePlugLocation', 'drivetrainPowerHP',
          'chargeStandardChargeSpeed', 'chargeStandardChargeTime', 'miscSeats', 'miscBody', 'miscIsofix', 'miscTurningCircle',
          'miscSegment', 'miscIsofixSeats', 'chargeStandardTables', 'chargeStandardPower', 'chargeStandardPhase']);
    } else {
      // Get the car
      car = await CarStorage.getCar(filteredRequest.ID);
    }
    // Return
    res.json(CarSecurity.filterCarResponse(car, req.user));
    next();
  }
}
