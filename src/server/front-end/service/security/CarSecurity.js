const sanitize = require('mongo-sanitize');
const CentralRestServerAuthorization = require('../../CentralRestServerAuthorization');
const Utils = require('../../../../utils/Utils');
const UtilsSecurity = require('./UtilsSecurity');

class CarSecurity {
	static filterCarDeleteRequest(request, loggedUser) {
		let filteredRequest = {};
		// Set
		filteredRequest.ID = sanitize(request.ID);
		return filteredRequest;
	}

	static filterCarRequest(request, loggedUser) {
		let filteredRequest = {};
		filteredRequest.ID = sanitize(request.ID);
		return filteredRequest;
	}

	static filterCarsRequest(request, loggedUser) {
		let filteredRequest = {};
		filteredRequest.Search = sanitize(request.Search);
		return filteredRequest;
	}

	static filterCarUpdateRequest(request, loggedUser) {
		// Set
		let filteredRequest = CarSecurity._filterCarRequest(request, loggedUser);
		filteredRequest.id = sanitize(request.id);
		filteredRequest.withCarImages = UtilsSecurity.filterBoolean(request.withCarImages);
		return filteredRequest;
	}

	static filterCarCreateRequest(request, loggedUser) {
		let filteredRequest = CarSecurity._filterCarRequest(request, loggedUser);
		return filteredRequest;
	}

	static _filterCarRequest(request, loggedUser) {
		let filteredRequest = {};
		filteredRequest.manufacturer = sanitize(request.manufacturer);
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
		filteredRequest.vehiculeManufacturerID = sanitize(request.vehiculeManufacturerID);
		return filteredRequest;
	}

	static filterCarResponse(car, loggedUser) {
		let filteredCar;

		if (!car) {
			return null;
		}
		// Check auth
		if (CentralRestServerAuthorization.canReadCar(loggedUser, car)) {
			// Admin?
			if (CentralRestServerAuthorization.isAdmin(loggedUser)) {
				// Yes: set all params
				filteredCar = car;
			} else {
				// Set only necessary info
				filteredCar = car;
			}
			// Created By / Last Changed By
			UtilsSecurity.filterCreatedAndLastChanged(
				filteredCar, car, loggedUser);
		}
		return filteredCar;
	}

	static filterCarsResponse(cars, loggedUser) {
		let filteredCars = [];

		if (!cars) {
			return null;
		}
		if (!CentralRestServerAuthorization.canListCars(loggedUser)) {
			return null;
		}
		cars.forEach(car => {
			// Filter
			let filteredCar = CarSecurity.filterCarResponse(car, loggedUser);
			// Ok?
			if (filteredCar) {
				// Add
				filteredCars.push(filteredCar);
			}
		});
		return filteredCars;
	}
}

module.exports = CarSecurity;
