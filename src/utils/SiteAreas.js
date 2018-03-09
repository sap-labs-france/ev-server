const Logging = require('./Logging');

require('source-map-support').install();

module.exports = {
	WITH_CHARGING_STATIONS: true,
	WITHOUT_CHARGING_STATIONS: false,
	WITH_SITE: true,
	WITHOUT_SITE: false,
	
	checkIfSiteAreaValid(action, filteredRequest, req, res, next) {
		// Update model?
		if(req.method !== "POST" && !filteredRequest.id) {
			Logging.logActionExceptionMessageAndSendResponse(action, new Error(`The Site Area ID is mandatory`), req, res, next);
			return false;
		}
		if(!filteredRequest.name) {
			Logging.logActionExceptionMessageAndSendResponse(action, new Error(`The Site Area Name is mandatory`), req, res, next);
			return false;
		}
		if(!filteredRequest.siteID) {
			Logging.logActionExceptionMessageAndSendResponse(action, new Error(`The Site ID is mandatory for the Site Area`), req, res, next);
			return false;
		}
		// Ok
		return true;
	}
};
