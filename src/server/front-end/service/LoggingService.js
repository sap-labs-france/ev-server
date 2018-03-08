const SecurityRestObjectFiltering = require('../SecurityRestObjectFiltering');
const CentralRestServerAuthorization = require('../CentralRestServerAuthorization');
const Logging = require('../../../utils/Logging');
const Utils = require('../../../utils/Utils');

class LoggingService {
	static handleGetLoggings(action, req, res, next) {
		// Check auth
		if (!CentralRestServerAuthorization.canListLogging(req.user)) {
			// Not Authorized!
			throw new AppAuthError(
				CentralRestServerAuthorization.ACTION_LIST,
				CentralRestServerAuthorization.ENTITY_LOGGING,
				null,
				560, "LoggingService", "handleGetLoggings",
				req.user);
		}
		// Filter
		let filteredRequest = SecurityRestObjectFiltering.filterLoggingsRequest(req.query, req.user);
		// Get logs
		Logging.getLogs(filteredRequest.DateFrom, filteredRequest.Level, filteredRequest.Type, filteredRequest.ChargingStation,
				filteredRequest.Search, filteredRequest.Limit, filteredRequest.SortDate).then((loggings) => {
			// Return
			res.json(
				SecurityRestObjectFiltering.filterLoggingsResponse(
					loggings, req.user
				)
			);
			next();
		}).catch((err) => {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		});
	}
}

module.exports = LoggingService;
