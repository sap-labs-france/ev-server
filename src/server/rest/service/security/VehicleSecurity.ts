import sanitize from 'mongo-sanitize';
import Authorizations from '../../../../authorization/Authorizations';
import HttpByIDRequest from '../../../../types/requests/HttpByIDRequest';
import { HttpVehiclesRequest } from '../../../../types/requests/HttpVehicleRequest';
import UserToken from '../../../../types/UserToken';
import UtilsSecurity from './UtilsSecurity';
import Vehicle from '../../../../types/Vehicle';

export default class VehicleSecurity {

  public static filterVehicleRequest(request: HttpByIDRequest): string {
    return sanitize(request.ID);
  }

  public static filterVehiclesRequest(request: HttpVehiclesRequest): HttpVehiclesRequest {
    const filteredRequest: HttpVehiclesRequest = {} as HttpVehiclesRequest;
    filteredRequest.Search = sanitize(request.Search);
    filteredRequest.Type = sanitize(request.Type);
    filteredRequest.VehicleManufacturerID = sanitize(request.VehicleManufacturerID);
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    return filteredRequest;
  }

  public static filterVehicleUpdateRequest(request: Partial<Vehicle>&{withVehicleImages?: boolean}): Partial<Vehicle>&{withVehicleImages?: boolean} {
    // Set
    const filteredRequest = VehicleSecurity._filterVehicleRequest(request);
    filteredRequest.id = sanitize(request.id);
    return { ...filteredRequest, withVehicleImages: UtilsSecurity.filterBoolean(request.withVehicleImages) };
  }

  public static filterVehicleCreateRequest(request: Partial<Vehicle>): Partial<Vehicle> {
    return VehicleSecurity._filterVehicleRequest(request);
  }

  public static filterVehicleResponse(vehicle: Vehicle, loggedUser: UserToken) {
    let filteredVehicle;

    if (!vehicle) {
      return null;
    }
    // Check auth
    if (Authorizations.canReadVehicle(loggedUser)) {
      // Admin?
      if (Authorizations.isAdmin(loggedUser.role)) {
        // Yes: set all params
        filteredVehicle = vehicle;
      } else {
        // Set only necessary info
        filteredVehicle = vehicle;
      }
      // Created By / Last Changed By
      UtilsSecurity.filterCreatedAndLastChanged(
        filteredVehicle, vehicle, loggedUser);
    }
    return filteredVehicle;
  }

  public static filterVehiclesResponse(vehicles: {result: Vehicle[]}, loggedUser: UserToken) {
    const filteredVehicles = [];

    if (!vehicles.result) {
      return null;
    }
    if (!Authorizations.canListVehicles(loggedUser)) {
      return null;
    }
    for (const vehicle of vehicles.result) {
      // Filter
      const filteredVehicle = VehicleSecurity.filterVehicleResponse(vehicle, loggedUser);
      // Ok?
      if (filteredVehicle) {
        // Add
        filteredVehicles.push(filteredVehicle);
      }
    }
    return filteredVehicles;
  }

  private static _filterVehicleRequest(request: Partial<Vehicle>): Partial<Vehicle> {
    const rrequest: Partial<Vehicle> = {};
    rrequest.type = sanitize(request.type);
    rrequest.model = sanitize(request.model);
    rrequest.batteryKW = sanitize(request.batteryKW);
    rrequest.autonomyKmWLTP = sanitize(request.autonomyKmWLTP);
    rrequest.autonomyKmReal = sanitize(request.autonomyKmReal);
    rrequest.horsePower = sanitize(request.horsePower);
    rrequest.torqueNm = sanitize(request.torqueNm);
    rrequest.performance0To100kmh = sanitize(request.performance0To100kmh);
    rrequest.weightKg = sanitize(request.weightKg);
    rrequest.lengthMeter = sanitize(request.lengthMeter);
    rrequest.widthMeter = sanitize(request.widthMeter);
    rrequest.heightMeter = sanitize(request.heightMeter);
    rrequest.releasedOn = sanitize(request.releasedOn);
    rrequest.images = sanitize(request.images);
    rrequest.logo = sanitize(request.logo);
    rrequest.vehicleManufacturerID = sanitize(request.vehicleManufacturerID);
    return rrequest;
  }
}

