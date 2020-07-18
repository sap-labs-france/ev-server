import { Car, CarCatalog, CarMaker } from '../../../../types/Car';
import { HttpCarByIDRequest, HttpCarCatalogByIDRequest, HttpCarCatalogImagesRequest, HttpCarCatalogsRequest, HttpCarCreateRequest, HttpCarMakersRequest, HttpCarUpdateRequest, HttpCarsRequest, HttpUsersCarsRequest } from '../../../../types/requests/HttpCarRequest';

import Authorizations from '../../../../authorization/Authorizations';
import { DataResult } from '../../../../types/DataResult';
import { UserCar } from '../../../../types/User';
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
      ID: sanitize(request.ID),
    } as HttpCarCatalogImagesRequest;
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    return filteredRequest;
  }

  public static filterCarCatalogRequest(request: any): HttpCarCatalogByIDRequest {
    const filteredRequest: HttpCarCatalogByIDRequest = {
      ID: sanitize(request.ID),
    } as HttpCarCatalogByIDRequest;
    return filteredRequest;
  }

  public static filterCarCatalogResponse(carCatalog: CarCatalog, loggedUser: UserToken): CarCatalog {
    let filteredCarCatalog: CarCatalog;
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
        image: carCatalog.image,
        chargeAlternativePower: carCatalog.chargeAlternativePower,
        chargeAlternativePhase: carCatalog.chargeAlternativePhase,
        chargeOptionPower: carCatalog.chargeOptionPower,
        chargeOptionPhase: carCatalog.chargeOptionPhase,
        chargeOptionPhaseAmp: carCatalog.chargeOptionPhaseAmp,
        chargeAlternativePhaseAmp: carCatalog.chargeAlternativePhaseAmp,
        chargeStandardPhaseAmp: carCatalog.chargeStandardPhaseAmp
      } as CarCatalog;
    }
    // Created By / Last Changed By
    UtilsSecurity.filterCreatedAndLastChanged(filteredCarCatalog, carCatalog, loggedUser);
    return filteredCarCatalog;
  }

  public static filterMinimalCarCatalogResponse(carCatalog: CarCatalog, loggedUser: UserToken): CarCatalog {
    let filteredCarCatalog: CarCatalog;
    if (!carCatalog) {
      return null;
    }
    // Check auth
    if (Authorizations.canReadCarCatalog(loggedUser)) {
      filteredCarCatalog = {
        id: carCatalog.id,
        vehicleModel: carCatalog.vehicleModel,
        vehicleMake: carCatalog.vehicleMake,
        vehicleModelVersion: carCatalog.vehicleModelVersion,
        image: `${Utils.buildRestServerURL()}/client/util/CarCatalogImage?ID=${carCatalog.id}`,
      } as CarCatalog;
    }
    return filteredCarCatalog;
  }

  public static filterCarMakersResponse(carMakers: DataResult<CarMaker>, loggedUser: UserToken): void {
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

  public static filterCarCatalogsResponse(carCatalogs: DataResult<CarCatalog>, loggedUser: UserToken): void {
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
          image: `${Utils.buildRestServerURL()}/client/util/CarCatalogImage?ID=${carCatalog.id}`,
          chargeStandardChargeSpeed: carCatalog.chargeStandardChargeSpeed,
          chargeOptionPower: carCatalog.chargeOptionPower,
          chargeAlternativePower: carCatalog.chargeAlternativePower,
          chargeStandardPhaseAmp: carCatalog.chargeStandardPhaseAmp,
          chargeOptionPhaseAmp: carCatalog.chargeOptionPhaseAmp,
          chargeAlternativePhaseAmp: carCatalog.chargeAlternativePhaseAmp,
          chargeAlternativePhase: carCatalog.chargeAlternativePhase,
          chargeOptionPhase: carCatalog.chargeOptionPhase
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
      forced: UtilsSecurity.filterBoolean(request.forced),
      type: sanitize(request.type),
      converter: {
        amperagePerPhase: sanitize(request.converter.amperagePerPhase),
        numberOfPhases: sanitize(request.converter.numberOfPhases),
        type: sanitize(request.converter.type),
        powerWatts: sanitize(request.converter.powerWatts)
      },
      usersAdded: request.usersUpserted ? request.usersUpserted.map((userUpserted: UserCar) => ({
        user: userUpserted.user,
        default: userUpserted.default,
        owner: userUpserted.owner,
      })) : [],
    };
  }

  public static filterCarUpdateRequest(request: any): HttpCarUpdateRequest {
    const filteredRequest: HttpCarUpdateRequest = {
      vin: sanitize(request.vin),
      licensePlate: sanitize(request.licensePlate),
      carCatalogID: Utils.convertToInt(sanitize(request.carCatalogID)),
      type: sanitize(request.type),
      id: sanitize(request.id),
      converter: {
        amperagePerPhase: sanitize(request.converter.amperagePerPhase),
        numberOfPhases: sanitize(request.converter.numberOfPhases),
        type: sanitize(request.converter.type),
        powerWatts: sanitize(request.converter.powerWatts)
      },
      usersRemoved: request.usersRemoved ? request.usersRemoved.map((userRemoved: UserCar) => ({
        id: userRemoved.id,
        user: userRemoved.user,
        default: userRemoved.default,
        owner: userRemoved.owner,
      })) : [],
      usersUpserted: request.usersUpserted ? request.usersUpserted.map((userUpserted: UserCar) => ({
        id: userUpserted.id,
        user: userUpserted.user,
        default: userUpserted.default,
        owner: userUpserted.owner,
      })) : [],
    };
    return filteredRequest;
  }

  public static filterCarsResponse(cars: DataResult<Car>, loggedUser: UserToken): void {
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
          this.filterCarResponse(car, loggedUser, true));
      }
    }
    cars.result = filteredCars;
  }

  public static filterCarResponse(car: Car, loggedUser: UserToken, forList = false): Car {
    let filteredCar: Car;
    if (!car) {
      return null;
    }
    // Admin?
    if (Authorizations.canUpdateCar(loggedUser)) {
      // Yes: set all params
      filteredCar = car;
    } else {
      // Set only necessary info
      filteredCar = {
        id: car.id,
        vin: car.vin,
        licensePlate: car.licensePlate,
        carCatalogID: car.carCatalogID,
        type: car.type,
        converter: car.converter,
        carCatalog: car.carCatalog,
      };
    }
    if (filteredCar.carUsers) {
      filteredCar.carUsers = car.carUsers.map((carUser) => ({
        ...carUser, user: UserSecurity.filterMinimalUserResponse(carUser.user, loggedUser)
      }));
    }
    if (filteredCar.carCatalog) {
      filteredCar.carCatalog = forList ? this.filterMinimalCarCatalogResponse(car.carCatalog, loggedUser) :
        this.filterCarCatalogResponse(car.carCatalog, loggedUser);
    }
    UtilsSecurity.filterCreatedAndLastChanged(filteredCar, car, loggedUser);
    return filteredCar;
  }

  public static filterUsersCarsResponse(usersCars: DataResult<UserCar>, loggedUser: UserToken): void {
    const filteredUsersCars: UserCar[] = [];
    if (!usersCars.result) {
      return null;
    }
    if (!Authorizations.canListUsersCars(loggedUser)) {
      return null;
    }
    for (const userCar of usersCars.result) {
      // Add
      if (userCar) {
        filteredUsersCars.push(
          this.filterUserCarResponse(userCar, loggedUser)
        );
      }
    }
    usersCars.result = filteredUsersCars;
  }

  public static filterUserCarResponse(userCar: UserCar, loggedUser: UserToken): UserCar {
    if (!userCar) {
      return null;
    }
    const filteredUserCar: UserCar = {
      id: userCar.id,
      user: UserSecurity.filterMinimalUserResponse(userCar.user, loggedUser),
      carID: userCar.carID,
      default: userCar.default,
      owner: userCar.owner
    };
    return filteredUserCar;
  }

  public static filterCarsRequest(request: any): HttpCarsRequest {
    const filteredRequest: HttpCarsRequest = {
      Search: sanitize(request.Search),
      CarMaker: sanitize(request.CarMaker),
      WithUsers: UtilsSecurity.filterBoolean(request.WithUsers),
      UserID: sanitize(request.UserID)
    } as HttpCarsRequest;
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    return filteredRequest;
  }

  public static filterCarRequest(request: any): HttpCarByIDRequest {
    const filteredRequest: HttpCarByIDRequest = {
      ID: sanitize(request.ID),
    } as HttpCarByIDRequest;
    return filteredRequest;
  }

  public static filterCarUsersRequest(request: any): HttpUsersCarsRequest {
    const filteredRequest: HttpUsersCarsRequest = {
      Search: sanitize(request.Search),
      CarID: sanitize(request.CarID),
    } as HttpUsersCarsRequest;
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    return filteredRequest;
  }
}
