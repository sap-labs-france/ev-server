const Utils = require('../../../utils/Utils');
const Logging = require('../../../utils/Logging');
const CentralRestServerAuthorization = require('../CentralRestServerAuthorization');
const UtilsSecurity = require('./security/UtilsSecurity');

class UtilsService {
	static handleUnknownAction(action, req, res, next) {
		// Action provided
		if (!action) {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(
				"N/A", new Error(`No Action has been provided`), req, res, next);
		} else {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(
				"N/A", new Error(`The Action '${action}' does not exist`), req, res, next);
		}
	}
}

module.exports = UtilsService;
