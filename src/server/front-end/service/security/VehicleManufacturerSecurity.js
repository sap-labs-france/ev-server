const sanitize = require('mongo-sanitize');
const CentralRestServerAuthorization = require('../../CentralRestServerAuthorization');
const Utils = require('../../../../utils/Utils');
const UtilsSecurity = require('./UtilsSecurity');

class VehicleManufacturerSecurity {
	static filterVehicleManufacturerDeleteRequest(request, loggedUser) {
		let filteredRequest = {};
		// Set
		filteredRequest.ID = sanitize(request.ID);
		return filteredRequest;
	}

	static filterVehicleManufacturerRequest(request, loggedUser) {
		let filteredRequest = {};
		filteredRequest.ID = sanitize(request.ID);
		return filteredRequest;
	}

	static filterVehicleManufacturersRequest(request, loggedUser) {
		let filteredRequest = {};
		filteredRequest.Search = sanitize(request.Search);
		return filteredRequest;
	}

	static filterVehicleManufacturerUpdateRequest(request, loggedUser) {
		// Set
		let filteredRequest = VehicleManufacturerSecurity._filterVehicleManufacturerRequest(request, loggedUser);
		filteredRequest.id = sanitize(request.id);
		return filteredRequest;
	}

	static filterVehicleManufacturerCreateRequest(request, loggedUser) {
		let filteredRequest = VehicleManufacturerSecurity._filterVehicleManufacturerRequest(request, loggedUser);
		return filteredRequest;
	}

	static _filterVehicleManufacturerRequest(request, loggedUser) {
		let filteredRequest = {};
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
		if (CentralRestServerAuthorization.canReadVehicleManufacturer(loggedUser, vehicleManufacturer)) {
			// Admin?
			if (CentralRestServerAuthorization.isAdmin(loggedUser)) {
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
		let filteredVehicleManufacturers = [];

		if (!vehicleManufacturers) {
			return null;
		}
		if (!CentralRestServerAuthorization.canListVehicleManufacturers(loggedUser)) {
			return null;
		}
		vehicleManufacturers.forEach(vehicleManufacturer => {
			// Filter
			let filteredVehicleManufacturer = VehicleManufacturerSecurity.filterVehicleManufacturerResponse(vehicleManufacturer, loggedUser);
			// Ok?
			if (filteredVehicleManufacturer) {
				// Add
				filteredVehicleManufacturers.push(filteredVehicleManufacturer);
			}
		});
		return filteredVehicleManufacturers;
	}
}

module.exports = VehicleManufacturerSecurity;
