import sanitize from 'mongo-sanitize';
import Authorizations from '../../../../authorization/Authorizations';
import HttpByIDRequest from '../../../../types/requests/HttpByIDRequest';
import { HttpVehiclesRequest } from '../../../../types/requests/HttpVehicleRequest';
import UserToken from '../../../../types/UserToken';
import UtilsSecurity from './UtilsSecurity';
import Vehicle from '../../../../types/Vehicle';

export default class VehicleSecurity {

  public static filterVehicleRequestByID(request: any): string {
    return sanitize(request.ID);
  }

  public static filterVehicleRequest(request: any): HttpByIDRequest {
    return {
      ID: sanitize(request.ID)
    };
  }

  public static filterVehiclesRequest(request: any): HttpVehiclesRequest {
    const filteredRequest: HttpVehiclesRequest = {} as HttpVehiclesRequest;
    filteredRequest.Search = sanitize(request.Search);
    filteredRequest.Type = sanitize(request.Type);
    filteredRequest.VehicleManufacturerID = sanitize(request.VehicleManufacturerID);
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    return filteredRequest;
  }

  public static filterVehicleUpdateRequest(request: any): Partial<Vehicle> {
    // Set
    const filteredRequest = VehicleSecurity._filterVehicleRequest(request);
    filteredRequest.id = sanitize(request.id);
    return filteredRequest;
  }

  public static filterVehicleCreateRequest(request: any): Partial<Vehicle> {
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

  public static filterVehiclesResponse(vehicles: {count: number; result: Vehicle[]}, loggedUser: UserToken) {
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
      if (filteredVehicle) {
        filteredVehicles.push(filteredVehicle);
      }
    }
    return filteredVehicles;
  }

  private static _filterVehicleRequest(request: any): Partial<Vehicle> {
    const filteredVehicle: Partial<Vehicle> = {};
    filteredVehicle.type = sanitize(request.type);
    filteredVehicle.model = sanitize(request.model);
    filteredVehicle.batteryKW = sanitize(request.batteryKW);
    filteredVehicle.autonomyKmWLTP = sanitize(request.autonomyKmWLTP);
    filteredVehicle.autonomyKmReal = sanitize(request.autonomyKmReal);
    filteredVehicle.horsePower = sanitize(request.horsePower);
    filteredVehicle.torqueNm = sanitize(request.torqueNm);
    filteredVehicle.performance0To100kmh = sanitize(request.performance0To100kmh);
    filteredVehicle.weightKg = sanitize(request.weightKg);
    filteredVehicle.lengthMeter = sanitize(request.lengthMeter);
    filteredVehicle.widthMeter = sanitize(request.widthMeter);
    filteredVehicle.heightMeter = sanitize(request.heightMeter);
    filteredVehicle.releasedOn = sanitize(request.releasedOn);
    filteredVehicle.images = sanitize(request.images);
    filteredVehicle.logo = sanitize(request.logo);
    filteredVehicle.vehicleManufacturerID = sanitize(request.vehicleManufacturerID);
    return filteredVehicle;
  }
}
