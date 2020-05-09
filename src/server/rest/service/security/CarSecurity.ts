import { Car, CarCatalog, CarMaker } from '../../../../types/Car';
import { HttpCarCatalogByIDRequest, HttpCarCatalogImagesRequest, HttpCarCatalogsRequest, HttpCarCreateRequest, HttpCarMakersRequest, HttpCarsRequest } from '../../../../types/requests/HttpCarRequest';

import Authorizations from '../../../../authorization/Authorizations';
import { DataResult } from '../../../../types/DataResult';
import UserSecurity from './UserSecurity';
import UserToken from '../../../../types/UserToken';
import Utils from '../../../../utils/Utils';
import UtilsSecurity from './UtilsSecurity';
import sanitize from 'mongo-sanitize';

export default class CarSecurity {

  public static filterCarMakersRequest(request: any): HttpCarMakersRequest {
    const filteredRequest: HttpCarMakersRequest = {
      Search: sanitize(request.Search),
    } as HttpCarMakersRequest;
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    return filteredRequest;
  }

  public static filterCarCatalogsRequest(request: any): HttpCarCatalogsRequest {
    const filteredRequest: HttpCarCatalogsRequest = {
      Search: sanitize(request.Search),
      CarMaker: sanitize(request.CarMaker),
    } as HttpCarCatalogsRequest;
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    return filteredRequest;
  }

  public static filterCarCatalogImagesRequest(request: any): HttpCarCatalogImagesRequest {
    const filteredRequest: HttpCarCatalogImagesRequest = {
      CarID: sanitize(request.CarCatalogID),
    } as HttpCarCatalogImagesRequest;
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    return filteredRequest;
  }

  public static filterCarCatalogRequest(request: any): HttpCarCatalogByIDRequest {
    const filteredRequest: HttpCarCatalogByIDRequest = {
      ID: +sanitize(request.CarCatalogID),
    } as HttpCarCatalogByIDRequest;
    return filteredRequest;
  }

  public static filterCarCatalogResponse(carCatalog: CarCatalog, loggedUser: UserToken): CarCatalog {
    let filteredCarCatalog;

    if (!carCatalog) {
      return null;
    }
    // Check auth
    if (Authorizations.isSuperAdmin(loggedUser)) {
      filteredCarCatalog = carCatalog;
    } else if (Authorizations.canReadCarCatalog(loggedUser)) {
      filteredCarCatalog = {
        id: carCatalog.id,
        vehicleModel: carCatalog.vehicleModel,
        vehicleMake: carCatalog.vehicleMake,
        batteryCapacityFull: carCatalog.batteryCapacityFull,
        fastChargeSpeed: carCatalog.fastChargeSpeed,
        performanceTopspeed: carCatalog.performanceTopspeed,
        chargeStandardPower: carCatalog.chargeStandardPower,
        chargeStandardPhase: carCatalog.chargeStandardPhase,
        vehicleModelVersion: carCatalog.vehicleModelVersion,
        performanceAcceleration: carCatalog.performanceAcceleration,
        rangeReal: carCatalog.rangeReal,
        rangeWLTP: carCatalog.rangeWLTP,
        efficiencyReal: carCatalog.efficiencyReal,
        chargeStandardChargeSpeed: carCatalog.chargeStandardChargeSpeed,
        drivetrainPropulsion: carCatalog.drivetrainPropulsion,
        drivetrainTorque: carCatalog.drivetrainTorque,
        batteryCapacityUseable: carCatalog.batteryCapacityUseable,
        chargePlug: carCatalog.chargePlug,
        fastChargePlug: carCatalog.fastChargePlug,
        fastChargePowerMax: carCatalog.fastChargePowerMax,
        chargePlugLocation: carCatalog.chargePlugLocation,
        drivetrainPowerHP: carCatalog.drivetrainPowerHP,
        chargeStandardChargeTime: carCatalog.chargeStandardChargeTime,
        miscSeats: carCatalog.miscSeats,
        miscBody: carCatalog.miscBody,
        miscIsofix: carCatalog.miscIsofix,
        miscTurningCircle: carCatalog.miscTurningCircle,
        miscSegment: carCatalog.miscSegment,
        miscIsofixSeats: carCatalog.miscIsofixSeats,
        chargeStandardTables: carCatalog.chargeStandardTables,
        image: carCatalog.image,
      } as CarCatalog;
    }
    // Created By / Last Changed By
    UtilsSecurity.filterCreatedAndLastChanged(filteredCarCatalog, carCatalog, loggedUser);
    return filteredCarCatalog;
  }

  public static filterCarMakersResponse(carMakers: DataResult<CarMaker>, loggedUser: UserToken) {
    const filteredCarConstructors: CarMaker[] = [];
    if (!carMakers) {
      return null;
    }
    if (!Authorizations.canReadCarCatalog(loggedUser)) {
      return null;
    }
    for (const carMaker of carMakers.result) {
      filteredCarConstructors.push({
        carMaker: carMaker.carMaker
      });
    }
    carMakers.result = filteredCarConstructors;
  }

  public static filterCarCatalogsResponse(carCatalogs: DataResult<CarCatalog>, loggedUser: UserToken) {
    const filteredCarCatalogs = [];

    if (!carCatalogs.result) {
      return null;
    }
    if (!Authorizations.canListCarCatalogs(loggedUser)) {
      return null;
    }
    for (const carCatalog of carCatalogs.result) {
      // Add
      if (carCatalog) {
        filteredCarCatalogs.push({
          id: carCatalog.id,
          vehicleModel: carCatalog.vehicleModel,
          vehicleMake: carCatalog.vehicleMake,
          batteryCapacityFull: carCatalog.batteryCapacityFull,
          fastChargeSpeed: carCatalog.fastChargeSpeed,
          performanceTopspeed: carCatalog.performanceTopspeed,
          chargeStandardPower: carCatalog.chargeStandardPower,
          chargePlug: carCatalog.chargePlug,
          fastChargePlug: carCatalog.fastChargePlug,
          fastChargePowerMax: carCatalog.fastChargePowerMax,
          drivetrainPowerHP: carCatalog.drivetrainPowerHP,
          chargeStandardPhase: carCatalog.chargeStandardPhase,
          vehicleModelVersion: carCatalog.vehicleModelVersion,
          performanceAcceleration: carCatalog.performanceAcceleration,
          rangeReal: carCatalog.rangeReal,
          rangeWLTP: carCatalog.rangeWLTP,
          efficiencyReal: carCatalog.efficiencyReal,
          image: carCatalog.image,
          chargeStandardChargeSpeed: carCatalog.chargeStandardChargeSpeed
        });
      }
    }
    carCatalogs.result = filteredCarCatalogs;
  }

  public static filterCarCreateRequest(request: any): HttpCarCreateRequest {
    return {
      vin: sanitize(request.vin),
      licensePlate: sanitize(request.licensePlate),
      carCatalogID: Utils.convertToInt(sanitize(request.carCatalogID)),
      forced: UtilsSecurity.filterBoolean(request.forced)
    };
  }

  public static filterCarsResponse(cars: DataResult<Car>, loggedUser: UserToken) {
    const filteredCars: Car[] = [];
    if (!cars.result) {
      return null;
    }
    if (!Authorizations.canListCars(loggedUser)) {
      return null;
    }
    for (const car of cars.result) {
      // Add
      if (car) {
        filteredCars.push(
          this.filterCarResponse(car, loggedUser)
        );
      }
    }
    cars.result = filteredCars;
  }

  public static filterCarResponse(car: Car, loggedUser: UserToken): Car {
    let filteredCar: Car;
    if (!car) {
      return null;
    }
    // Admin?
    if (Authorizations.isAdmin(loggedUser)) {
      // Yes: set all params
      filteredCar = car;
    } else {
      // Set only necessary info
      filteredCar = {
        id: car.id,
        vin: car.vin,
        licensePlate: car.licensePlate,
        carCatalogID: car.carCatalogID,
      };
    }
    if (car.users) {
      filteredCar.users = car.users.map(
        (user) => UserSecurity.filterUserResponse(user, loggedUser));
    }
    if (car.carCatalog) {
      filteredCar.carCatalog = CarSecurity.filterCarCatalogResponse(car.carCatalog, loggedUser);
    }
    return filteredCar;
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
}
