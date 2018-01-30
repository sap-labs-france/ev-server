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
	},

	checkIfSiteAreaValid(action, filteredRequest, req, res, next) {
		// Update mode?
		if(req.method === "PUT" && !filteredRequest.id) {
			Logging.logActionExceptionMessageAndSendResponse(action, new Error(`The site area's ID is mandatory`), req, res, next);
			return false;
		}
		if(!filteredRequest.name) {
			Logging.logActionExceptionMessageAndSendResponse(action, new Error(`The site area's name is mandatory`), req, res, next);
			return false;
		}
		if(!filteredRequest.siteID) {
			Logging.logActionExceptionMessageAndSendResponse(action, new Error(`The site ID is mandatory for the site area`), req, res, next);
			return false;
		}
		// Ok
		return true;
	}
};
