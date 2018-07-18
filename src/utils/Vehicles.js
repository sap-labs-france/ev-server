const Constants = require('./Constants');
const AppError = require('../exception/AppError');

require('source-map-support').install();

module.exports = {
	// Vehicle Types
	VEHICLE_TYPE_CAR: "C",

	checkIfVehicleValid(request, httpRequest) {
		// Update model?
		if(httpRequest.method !== "POST" && !request.id) {
			throw new AppError(
				Constants.CENTRAL_SERVER,
				`The Vehicle ID is mandatory`,
				500, "Vehicles", "checkIfVehicleValid");
		}
		if(!request.type) {
			throw new AppError(
				Constants.CENTRAL_SERVER,
				`The Vehicle Type is mandatory`,
				500, "Vehicles", "checkIfVehicleValid");
		}
		if(!request.model) {
			throw new AppError(
				Constants.CENTRAL_SERVER,
				`The Vehicle Model is mandatory`,
				500, "Vehicles", "checkIfVehicleValid");
		}
		if(!request.vehicleManufacturerID) {
			throw new AppError(
				Constants.CENTRAL_SERVER,
				`The Vehicle Manufacturer is mandatory`,
				500, "Vehicles", "checkIfVehicleValid");
		}
	}
};
