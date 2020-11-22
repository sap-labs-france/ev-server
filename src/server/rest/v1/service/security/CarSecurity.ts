import { HttpCarByIDRequest, HttpCarCatalogByIDRequest, HttpCarCatalogImagesRequest, HttpCarCatalogsRequest, HttpCarCreateRequest, HttpCarMakersRequest, HttpCarUpdateRequest, HttpCarsRequest, HttpUsersCarsRequest } from '../../../../../types/requests/HttpCarRequest';

import { UserCar } from '../../../../../types/User';
import Utils from '../../../../../utils/Utils';
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
      ID: Utils.convertToInt(sanitize(request.ID)),
    } as HttpCarCatalogByIDRequest;
    return filteredRequest;
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
