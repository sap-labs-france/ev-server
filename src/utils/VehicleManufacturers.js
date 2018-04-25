const Logging = require('./Logging');

require('source-map-support').install();

module.exports = {
	checkIfVehicleManufacturerValid(action, filteredRequest, req, res, next) {
		// Update model?
		if(req.method !== "POST" && !filteredRequest.id) {
			Logging.logActionExceptionMessageAndSendResponse(action,
				new Error(`The Vehicle Manufacturer ID is mandatory`), req, res, next);
			return false;
		}
		if(!filteredRequest.name) {
			Logging.logActionExceptionMessageAndSendResponse(action,
				new Error(`The Vehicle Manufacturer Name is mandatory`), req, res, next);
			return false;
		}
		// Ok
		return true;
	}
};
