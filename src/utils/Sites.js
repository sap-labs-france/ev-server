const Logging = require('./Logging');

require('source-map-support').install();

module.exports = {
	checkIfSiteValid(action, filteredRequest, req, res, next) {
		// Update mode?
		if(req.method === "PUT" && !filteredRequest.id) {
			Logging.logActionExceptionMessageAndSendResponse(action, new Error(`The site's ID is mandatory`), req, res, next);
			return false;
		}
		if(!filteredRequest.name) {
			Logging.logActionExceptionMessageAndSendResponse(action, new Error(`The site's name is mandatory`), req, res, next);
			return false;
		}
		// Ok
		return true;
	}
};
