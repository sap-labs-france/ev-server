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
				Constants.ENTITY_LOGGINGS,
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

	static handleGetLogging(action, req, res, next) {
		// Filter
		let filteredRequest = LoggingSecurity.filterLoggingRequest(req.query, req.user);
		// Get logs
		Logging.getLog(filteredRequest.ID).then((logging) => {
			console.log(logging);
			
			// Check auth
			if (!Authorizations.canReadLogging(req.user, logging)) {
				// Not Authorized!
				throw new AppAuthError(
					Authorizations.ACTION_READ,
					Constants.ENTITY_LOGGING,
					null,
					560, "LoggingService", "handleGetLogging",
					req.user);
			}
			// Return
			res.json(
				LoggingSecurity.filterLoggingResponse(
					logging, req.user, true
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
