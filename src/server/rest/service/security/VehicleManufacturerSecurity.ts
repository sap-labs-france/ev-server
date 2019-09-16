import sanitize from 'mongo-sanitize';
import Authorizations from '../../../../authorization/Authorizations';
import HttpByIDRequest from '../../../../types/requests/HttpByIDRequest';
import { HttpVehicleManufacturersRequest } from '../../../../types/requests/HttpVehicleManufacturerRequest';
import UserToken from '../../../../types/UserToken';
import UtilsSecurity from './UtilsSecurity';
import VehicleManufacturer from '../../../../types/VehicleManufacturer';
import { DataResult } from '../../../../types/DataResult';

export default class VehicleManufacturerSecurity {

  public static filterVehicleManufacturerRequestByID(request: any): string {
    return sanitize(request.ID);
  }

  public static filterVehicleManufacturerRequest(request: any): HttpByIDRequest {
    return {
      ID: sanitize(request.ID)
    };
  }

  public static filterVehicleManufacturersRequest(request: any): HttpVehicleManufacturersRequest {
    const filteredRequest: HttpVehicleManufacturersRequest = {} as HttpVehicleManufacturersRequest;
    filteredRequest.Search = sanitize(request.Search);
    filteredRequest.WithVehicles = UtilsSecurity.filterBoolean(request.WithVehicles);
    filteredRequest.VehicleType = sanitize(request.VehicleType);
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    return filteredRequest;
  }

  public static filterVehicleManufacturerUpdateRequest(request: any): Partial<VehicleManufacturer> {
    // Set
    const filteredRequest = VehicleManufacturerSecurity._filterVehicleManufacturerRequest(request);
    filteredRequest.id = sanitize(request.id);
    return filteredRequest;
  }

  public static filterVehicleManufacturerCreateRequest(request: any): Partial<VehicleManufacturer> {
    return VehicleManufacturerSecurity._filterVehicleManufacturerRequest(request);
  }

  public static filterVehicleManufacturerResponse(vehicleManufacturer: VehicleManufacturer, loggedUser: UserToken): VehicleManufacturer {
    let filteredVehicleManufacturer;

    if (!vehicleManufacturer) {
      return null;
    }
    // Check auth
    if (Authorizations.canReadVehicleManufacturer(loggedUser)) {
      // Admin?
      if (Authorizations.isAdmin(loggedUser)) {
        // Yes: set all params
        filteredVehicleManufacturer = vehicleManufacturer;
      } else {
        // Set only necessary info
        filteredVehicleManufacturer = vehicleManufacturer;
      }
      // Created By / Last Changed By
      UtilsSecurity.filterCreatedAndLastChanged(
        filteredVehicleManufacturer, vehicleManufacturer, loggedUser);
    }
    return filteredVehicleManufacturer;
  }

  public static filterVehicleManufacturersResponse(vehicleManufacturers: DataResult<VehicleManufacturer>, loggedUser: UserToken) {
    const filteredVehicleManufacturers = [];

    if (!vehicleManufacturers.result) {
      return null;
    }
    if (!Authorizations.canListVehicleManufacturers(loggedUser)) {
      return null;
    }
    for (const vehicleManufacturer of vehicleManufacturers.result) {
      // Filter
      const filteredVehicleManufacturer = VehicleManufacturerSecurity.filterVehicleManufacturerResponse(vehicleManufacturer, loggedUser);
      if (filteredVehicleManufacturer) {
        filteredVehicleManufacturers.push(filteredVehicleManufacturer);
      }
    }
    vehicleManufacturers.result = filteredVehicleManufacturers;
  }

  private static _filterVehicleManufacturerRequest(request: any): Partial<VehicleManufacturer> {
    return {
      name: request.name,
      logo: request.logo
    };
  }
}

