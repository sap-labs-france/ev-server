import { HttpCarsRequest, HttpCarRequest } from '../../../../types/requests/HttpCarRequest';
import UtilsSecurity from './UtilsSecurity';
import sanitize = require('mongo-sanitize');
import UserToken from '../../../../types/UserToken';
import Authorizations from '../../../../authorization/Authorizations';
import { Car } from '../../../../types/Car';
import { DataResult } from '../../../../types/DataResult';

export default class CarSecurity {
  public static filterCarsRequest(request: any): HttpCarsRequest {
    const filteredRequest: HttpCarsRequest = {
      Search: sanitize(request.Search),
    } as HttpCarsRequest;
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    return filteredRequest;
  }

  public static filterCarRequest(request: any): HttpCarRequest {
    const filteredRequest: HttpCarRequest = {
      ID: sanitize(request.carID),
    } as HttpCarRequest;
    return filteredRequest;
  }

  public static filterCarResponse(car: Car, loggedUser: UserToken): Car {
    let filteredCar;

    if (!car) {
      return null;
    }
    // Check auth
    if (Authorizations.canReadCar(loggedUser)) {
      filteredCar = car;
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
      const filteredCar = CarSecurity.filterCarResponse(car, loggedUser);
      if (filteredCar) {
        filteredCars.push(filteredCar);
      }
    }
    cars.result = filteredCars;
  }
}
