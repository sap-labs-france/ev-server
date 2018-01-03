const SecurityRestObjectFiltering = require('../SecurityRestObjectFiltering');
const CentralRestServerAuthorization = require('../CentralRestServerAuthorization');
const Logging = require('../../../utils/Logging');
const AppError = require('../../../exception/AppError');
const AppAuthError = require('../../../exception/AppAuthError');
const Utils = require('../../../utils/Utils');

class LoggingService {
	static handleGetLoggings(action, req, res, next) {
		// Check auth
		if (!CentralRestServerAuthorization.canListLogging(req.user)) {
			// Not Authorized!
			Logging.logActionUnauthorizedMessageAndSendResponse(
				CentralRestServerAuthorization.ACTION_LIST, CentralRestServerAuthorization.ENTITY_LOGGING, null, req, res, next);
			return;
		}
		// Filter
		let filteredRequest = SecurityRestObjectFiltering.filterLoggingsRequest(req.query, req.user);
		// Get logs
		Logging.getLogs(filteredRequest.DateFrom, filteredRequest.Level, filteredRequest.ChargingStation,
				filteredRequest.Search, filteredRequest.NumberOfLogs, filteredRequest.SortDate).then((loggings) => {
			// Return
			res.json(loggings);
			next();
		}).catch((err) => {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		});
	}
}

module.exports = LoggingService;
