import { HttpCarsRequest, HttpCarRequest } from '../../../../types/requests/HttpCarRequest';
import UtilsSecurity from './UtilsSecurity';
import sanitize = require('mongo-sanitize');
import UserToken from '../../../../types/UserToken';
import Authorizations from '../../../../authorization/Authorizations';
import { Car } from '../../../../types/Car';
import { DataResult } from '../../../../types/DataResult';
import HttpByIDRequest from '../../../../types/requests/HttpByIDRequest';

export default class CarSecurity {
  public static filterCarsRequest(request: any): HttpCarsRequest {
    const filteredRequest: HttpCarsRequest = {
      Search: sanitize(request.Search),
    } as HttpCarsRequest;
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    return filteredRequest;
  }

  public static filterCarRequest(request: any): HttpByIDRequest {
    const filteredRequest: HttpByIDRequest = {
      ID: sanitize(request.CarID),
    } as HttpByIDRequest;
    return filteredRequest;
  }

  public static filterCarResponse(car: Car, loggedUser: UserToken): Car {
    let filteredCar;

    if (!car) {
      return null;
    }
    // Check auth
    if (Authorizations.canReadCar(loggedUser)) {
      filteredCar = {
        id: car.id,
        vehicleModel: car.vehicleModel,
        vehicleMake: car.vehicleMake,
        batteryCapacityFull: car.batteryCapacityFull,
        fastChargeSpeed: car.fastChargeSpeed,
        performanceTopspeed: car.performanceTopspeed,
        performanceAcceleration: car.performanceAcceleration,
        rangeReal: car.rangeReal,
        efficiencyReal: car.efficiencyReal,
        images: car.images,
        chargeStandardChargeSpeed: car.chargeStandardChargeSpeed,
        drivetrainPropulsion: car.drivetrainPropulsion,
        drivetrainTorque: car.drivetrainTorque,
        batteryCapacityUseable: car.batteryCapacityUseable,
        chargePlug: car.chargePlug,
        fastChargePlug: car.fastChargePlug,
        chargePlugLocation: car.chargePlugLocation,
        chargeStandardPower: car.chargeStandardPower,
        chargeStandardChargeTime: car.chargeStandardChargeTime,
        miscSeats: car.miscSeats,
        miscBody: car.miscBody,
        miscIsofix: car.miscIsofix,
        miscTurningCircle: car.miscTurningCircle,
        miscSegment: car.miscSegment,
        miscIsofixSeats: car.miscIsofixSeats,
        chargeStandardTables: car.chargeStandardTables
      };
      if (Authorizations.isSuperAdmin(loggedUser)) {
        filteredCar.carObject = car;
      }
      // Created By / Last Changed By
      UtilsSecurity.filterCreatedAndLastChanged(
        filteredCar, car, loggedUser);
    }
    return filteredCar;
  }

  public static filterCarsResponse(cars: DataResult<Car>, loggedUser: UserToken) {
    const filteredCars = [];

    if (!cars.result) {
      return null;
    }
    if (!Authorizations.canListCars(loggedUser)) {
      return null;
    }
    for (const car of cars.result) {
      // Add
      if (car) {
        filteredCars.push({
          id: car.id,
          vehicleModel: car.vehicleModel,
          vehicleMake: car.vehicleMake,
          batteryCapacityFull: car.batteryCapacityFull,
          fastChargeSpeed: car.fastChargeSpeed,
          performanceTopspeed: car.performanceTopspeed,
          performanceAcceleration: car.performanceAcceleration,
          rangeReal: car.rangeReal,
          efficiencyReal: car.efficiencyReal,
          images: car.images,
          chargeStandardChargeSpeed: car.chargeStandardChargeSpeed
        });
      }
    }
    cars.result = filteredCars;
  }
}
