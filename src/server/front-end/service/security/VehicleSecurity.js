const sanitize = require('mongo-sanitize');
const Authorizations = require('../../../../authorization/Authorizations');
const UtilsSecurity = require('./UtilsSecurity');

class VehicleSecurity {
  static filterVehicleDeleteRequest(request, loggedUser) {
    const filteredRequest = {};
    // Set
    filteredRequest.ID = sanitize(request.ID);
    return filteredRequest;
  }

  static filterVehicleRequest(request, loggedUser) {
    const filteredRequest = {};
    filteredRequest.ID = sanitize(request.ID);
    return filteredRequest;
  }

  static filterVehiclesRequest(request, loggedUser) {
    const filteredRequest = {};
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

  static _filterVehicleRequest(request, loggedUser) {
    const filteredRequest = {};
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
    if (Authorizations.canReadVehicle(loggedUser, vehicle)) {
      // Admin?
      if (Authorizations.isAdmin(loggedUser)) {
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

    if (!vehicles) {
      return null;
    }
    if (!Authorizations.canListVehicles(loggedUser)) {
      return null;
    }
    for (const vehicle of vehicles) {
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
}

module.exports = VehicleSecurity;
