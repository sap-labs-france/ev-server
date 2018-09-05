const Authorizations = require('../../../authorization/Authorizations');
const Logging = require('../../../utils/Logging');
const LoggingSecurity = require('./security/LoggingSecurity');
const AppAuthError = require('../../../exception/AppAuthError');
const LoggingStorage = require('../../../storage/mongodb/LoggingStorage');

class LoggingService {
	static async handleGetLoggings(action, req, res, next) {
		try {
			// Check auth
			if (!Authorizations.canListLogging(req.user)) {
				// Not Authorized!
				throw new AppAuthError(
					Authorizations.ACTION_LIST,
					Constants.ENTITY_LOGGINGS,
					null,
					560, 'LoggingService', 'handleGetLoggings',
					req.user);
			}
			// Filter
			let filteredRequest = LoggingSecurity.filterLoggingsRequest(req.query, req.user);
			// Get logs
			let loggings = await LoggingStorage.getLogs({'search': filteredRequest.Search, 'dateFrom': filteredRequest.DateFrom, 
				'level': filteredRequest.Level, 'type': filteredRequest.Type, 'source': filteredRequest.Source, 
				'action': filteredRequest.Action}, filteredRequest.Limit, filteredRequest.Skip, filteredRequest.Sort);
			// Filter
			loggings.result = LoggingSecurity.filterLoggingsResponse(
				loggings.result, req.user);
			// Return
			res.json(loggings);
			next();
		} catch (error) {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
		}
	}

	static async handleGetLogging(action, req, res, next) {
		try {
			// Filter
			let filteredRequest = LoggingSecurity.filterLoggingRequest(req.query, req.user);
			// Get logs
			let logging = await LoggingStorage.getLog(filteredRequest.ID);
			// Check auth
			if (!Authorizations.canReadLogging(req.user, logging)) {
				// Not Authorized!
				throw new AppAuthError(
					Authorizations.ACTION_READ,
					Constants.ENTITY_LOGGING,
					null,
					560, 'LoggingService', 'handleGetLogging',
					req.user);
			}
			// Return
			res.json(
				LoggingSecurity.filterLoggingResponse(
					logging, req.user, true
				)
			);
			next();
		} catch (error) {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
		}
	}
}

module.exports = LoggingService;
