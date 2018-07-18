const Authorizations = require('../../../authorization/Authorizations');
const Logging = require('../../../utils/Logging');
const LoggingSecurity = require('./security/LoggingSecurity');
const AppAuthError = require('../../../exception/AppAuthError');

class LoggingService {
	static handleGetLoggings(action, req, res, next) {
		// Check auth
		if (!Authorizations.canListLogging(req.user)) {
			// Not Authorized!
			throw new AppAuthError(
				Authorizations.ACTION_LIST,
				Authorizations.ENTITY_LOGGING,
				null,
				560, "LoggingService", "handleGetLoggings",
				req.user);
		}
		// Filter
		let filteredRequest = LoggingSecurity.filterLoggingsRequest(req.query, req.user);
		// Get logs
		Logging.getLogs(filteredRequest.DateFrom, filteredRequest.Level, filteredRequest.Type, filteredRequest.ChargingStation,
				filteredRequest.Search, filteredRequest.Limit, filteredRequest.SortDate).then((loggings) => {
			// Return
			res.json(
				LoggingSecurity.filterLoggingsResponse(
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
