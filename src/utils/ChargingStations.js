const Logging = require('./Logging');
require('source-map-support').install();

module.exports = {
	WITH_CONNECTORS: true,
	WITHOUT_CONNECTORS: false,

	checkIfChargingStationValid(action, filteredRequest, req, res, next) {
		// Update mode?
		if(req.method !== "POST" && !filteredRequest.id) {
			Logging.logActionExceptionMessageAndSendResponse(action, new Error(`The Charging Station ID is mandatory`), req, res, next);
			return false;
		}
		// Ok
		return true;
	}
};
