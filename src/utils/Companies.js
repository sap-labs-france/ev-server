const Logging = require('./Logging');

require('source-map-support').install();

module.exports = {
	checkIfCompanyValid(action, filteredRequest, req, res, next) {
		// Update model?
		if(req.method !== "POST" && !filteredRequest.id) {
			Logging.logActionExceptionMessageAndSendResponse(action, new Error(`The Company ID is mandatory`), req, res, next);
			return false;
		}
		if(!filteredRequest.name) {
			Logging.logActionExceptionMessageAndSendResponse(action, new Error(`The Company Name is mandatory`), req, res, next);
			return false;
		}
		// Ok
		return true;
	}
};
