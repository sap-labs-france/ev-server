import sanitize from 'mongo-sanitize';
import Authorizations from '../../../../authorization/Authorizations';
import UtilsSecurity from './UtilsSecurity';

export default class VehicleManufacturerSecurity {
  // eslint-disable-next-line no-unused-vars
  static filterVehicleManufacturerDeleteRequest(request, loggedUser) {
    const filteredRequest:any = {};
    // Set
    filteredRequest.ID = sanitize(request.ID);
    return filteredRequest;
  }

  // eslint-disable-next-line no-unused-vars
  static filterVehicleManufacturerRequest(request, loggedUser) {
    const filteredRequest:any = {};
    filteredRequest.ID = sanitize(request.ID);
    return filteredRequest;
  }

  // eslint-disable-next-line no-unused-vars
  static filterVehicleManufacturersRequest(request, loggedUser) {
    const filteredRequest:any = {};
    filteredRequest.Search = sanitize(request.Search);
    filteredRequest.WithVehicles = UtilsSecurity.filterBoolean(request.WithVehicles);
    filteredRequest.VehicleType = sanitize(request.VehicleType);
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    return filteredRequest;
  }

  static filterVehicleManufacturerUpdateRequest(request, loggedUser) {
    // Set
    const filteredRequest = VehicleManufacturerSecurity._filterVehicleManufacturerRequest(request, loggedUser);
    filteredRequest.id = sanitize(request.id);
    return filteredRequest;
  }

  static filterVehicleManufacturerCreateRequest(request, loggedUser) {
    const filteredRequest = VehicleManufacturerSecurity._filterVehicleManufacturerRequest(request, loggedUser);
    return filteredRequest;
  }

  // eslint-disable-next-line no-unused-vars
  static _filterVehicleManufacturerRequest(request, loggedUser) {
    const filteredRequest:any = {};
    filteredRequest.name = sanitize(request.name);
    filteredRequest.logo = sanitize(request.logo);
    return filteredRequest;
  }

  static filterVehicleManufacturerResponse(vehicleManufacturer, loggedUser) {
    let filteredVehicleManufacturer;

    if (!vehicleManufacturer) {
      return null;
    }
    // Check auth
    if (Authorizations.canReadVehicleManufacturer(loggedUser, vehicleManufacturer)) {
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

  static filterVehicleManufacturersResponse(vehicleManufacturers, loggedUser) {
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
      // Ok?
      if (filteredVehicleManufacturer) {
        // Add
        filteredVehicleManufacturers.push(filteredVehicleManufacturer);
      }
    }
    vehicleManufacturers.result = filteredVehicleManufacturers;
  }
}


