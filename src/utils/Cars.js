const Logging = require('./Logging');

require('source-map-support').install();

module.exports = {
	checkIfCarValid(action, filteredRequest, req, res, next) {
		// Update model?
		if(req.method !== "POST" && !filteredRequest.id) {
			Logging.logActionExceptionMessageAndSendResponse(action,
				new Error(`The Car ID is mandatory`), req, res, next);
			return false;
		}
		if(!filteredRequest.model) {
			Logging.logActionExceptionMessageAndSendResponse(action,
				new Error(`The Car Model is mandatory`), req, res, next);
			return false;
		}
		if(!filteredRequest.manufacturer) {
			Logging.logActionExceptionMessageAndSendResponse(action,
				new Error(`The Car Manufacturer is mandatory`), req, res, next);
			return false;
		}
		// Ok
		return true;
	}
};
