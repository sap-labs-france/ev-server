import sanitize from 'mongo-sanitize';
import Authorizations from '../../../../authorization/Authorizations';
import UtilsSecurity from './UtilsSecurity';

export default class VehicleSecurity {
  // eslint-disable-next-line no-unused-vars
  static filterVehicleDeleteRequest(request, loggedUser) {
    const filteredRequest: any = {};
    // Set
    filteredRequest.ID = sanitize(request.ID);
    return filteredRequest;
  }

  // eslint-disable-next-line no-unused-vars
  static filterVehicleRequest(request, loggedUser) {
    const filteredRequest: any = {};
    filteredRequest.ID = sanitize(request.ID);
    return filteredRequest;
  }

  // eslint-disable-next-line no-unused-vars
  static filterVehiclesRequest(request, loggedUser) {
    const filteredRequest: any = {};
    filteredRequest.Search = sanitize(request.Search);
    filteredRequest.Type = sanitize(request.Type);
    filteredRequest.VehicleManufacturerID = sanitize(request.VehicleManufacturerID);
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    return filteredRequest;
  }

  static filterVehicleUpdateRequest(request, loggedUser) {
    // Set
    const filteredRequest = VehicleSecurity._filterVehicleRequest(request, loggedUser);
    filteredRequest.id = sanitize(request.id);
    filteredRequest.withVehicleImages = UtilsSecurity.filterBoolean(request.withVehicleImages);
    return filteredRequest;
  }

  static filterVehicleCreateRequest(request, loggedUser) {
    const filteredRequest = VehicleSecurity._filterVehicleRequest(request, loggedUser);
    return filteredRequest;
  }

  // eslint-disable-next-line no-unused-vars
  static _filterVehicleRequest(request, loggedUser) {
    const filteredRequest: any = {};
    filteredRequest.type = sanitize(request.type);
    filteredRequest.model = sanitize(request.model);
    filteredRequest.batteryKW = sanitize(request.batteryKW);
    filteredRequest.autonomyKmWLTP = sanitize(request.autonomyKmWLTP);
    filteredRequest.autonomyKmReal = sanitize(request.autonomyKmReal);
    filteredRequest.horsePower = sanitize(request.horsePower);
    filteredRequest.torqueNm = sanitize(request.torqueNm);
    filteredRequest.performance0To100kmh = sanitize(request.performance0To100kmh);
    filteredRequest.weightKg = sanitize(request.weightKg);
    filteredRequest.lengthMeter = sanitize(request.lengthMeter);
    filteredRequest.widthMeter = sanitize(request.widthMeter);
    filteredRequest.heightMeter = sanitize(request.heightMeter);
    filteredRequest.releasedOn = sanitize(request.releasedOn);
    filteredRequest.images = sanitize(request.images);
    filteredRequest.logo = sanitize(request.logo);
    filteredRequest.vehicleManufacturerID = sanitize(request.vehicleManufacturerID);
    return filteredRequest;
  }

  static filterVehicleResponse(vehicle, loggedUser) {
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

  static filterVehiclesResponse(vehicles, loggedUser) {
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
    vehicles.result = filteredVehicles;
  }
}

