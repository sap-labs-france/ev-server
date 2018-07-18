const Constants = require('./Constants');
const AppError = require('../exception/AppError');

require('source-map-support').install();

module.exports = {
	checkIfVehicleManufacturerValid(filteredRequest, request) {
		// Update model?
		if(request.method !== "POST" && !filteredRequest.id) {
			throw new AppError(
				Constants.CENTRAL_SERVER,
				`The Vehicle Manufacturer ID is mandatory`,
				500, "VehicleManufacturers", "checkIfVehicleManufacturerValid");
		}
		if(!filteredRequest.name) {
			throw new AppError(
				Constants.CENTRAL_SERVER,
				`The Vehicle Manufacturer Name is mandatory`,
				500, "VehicleManufacturers", "checkIfVehicleManufacturerValid");
		}
	}
};
