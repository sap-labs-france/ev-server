import Authorizations from '../../../../authorization/Authorizations';
import { Car, CarMaker } from '../../../../types/Car';
import { DataResult } from '../../../../types/DataResult';
import { HttpCarByIDRequest, HttpCarImagesRequest, HttpCarMakersRequest, HttpCarsRequest } from '../../../../types/requests/HttpCarRequest';
import UserToken from '../../../../types/UserToken';
import UtilsSecurity from './UtilsSecurity';
import sanitize = require('mongo-sanitize');

export default class CarSecurity {

  public static filterCarMakersRequest(request: any): HttpCarMakersRequest {
    const filteredRequest: HttpCarsRequest = {
      Search: sanitize(request.Search),
    } as HttpCarsRequest;
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    return filteredRequest;
  }

  public static filterCarsRequest(request: any): HttpCarsRequest {
    const filteredRequest: HttpCarsRequest = {
      Search: sanitize(request.Search),
      CarMaker: sanitize(request.CarMaker),
    } as HttpCarsRequest;
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    return filteredRequest;
  }

  public static filterCarImagesRequest(request: any): HttpCarImagesRequest {
    const filteredRequest: HttpCarImagesRequest = {
      CarID: sanitize(request.CarID),
    } as HttpCarImagesRequest;
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    return filteredRequest;
  }

  public static filterCarRequest(request: any): HttpCarByIDRequest {
    const filteredRequest: HttpCarByIDRequest = {
      ID: +sanitize(request.CarID),
    } as HttpCarByIDRequest;
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
        chargeStandardPower: car.chargeStandardPower,
        chargeStandardPhase: car.chargeStandardPhase,
        vehicleModelVersion: car.vehicleModelVersion,
        performanceAcceleration: car.performanceAcceleration,
        rangeReal: car.rangeReal,
        rangeWLTP: car.rangeWLTP,
        efficiencyReal: car.efficiencyReal,
        chargeStandardChargeSpeed: car.chargeStandardChargeSpeed,
        drivetrainPropulsion: car.drivetrainPropulsion,
        drivetrainTorque: car.drivetrainTorque,
        batteryCapacityUseable: car.batteryCapacityUseable,
        chargePlug: car.chargePlug,
        fastChargePlug: car.fastChargePlug,
        fastChargePowerMax: car.fastChargePowerMax,
        chargePlugLocation: car.chargePlugLocation,
        drivetrainPowerHP: car.drivetrainPowerHP,
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

  public static filterCarMakersResponse(carMakers: DataResult<CarMaker>, loggedUser: UserToken) {
    const filteredCarConstructors: CarMaker[] = [];
    if (!carMakers) {
      return null;
    }
    if (!Authorizations.canReadCar(loggedUser)) {
      return null;
    }
    for (const carMaker of carMakers.result) {
      filteredCarConstructors.push({
        carMaker: carMaker.carMaker
      });
    }
    carMakers.result = filteredCarConstructors;
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
          chargeStandardPower: car.chargeStandardPower,
          chargePlug: car.chargePlug,
          fastChargePlug: car.fastChargePlug,
          fastChargePowerMax: car.fastChargePowerMax,
          drivetrainPowerHP: car.drivetrainPowerHP,
          chargeStandardPhase: car.chargeStandardPhase,
          vehicleModelVersion: car.vehicleModelVersion,
          performanceAcceleration: car.performanceAcceleration,
          rangeReal: car.rangeReal,
          rangeWLTP: car.rangeWLTP,
          efficiencyReal: car.efficiencyReal,
          image: car.image,
          chargeStandardChargeSpeed: car.chargeStandardChargeSpeed
        });
      }
    }
    cars.result = filteredCars;
  }
}
