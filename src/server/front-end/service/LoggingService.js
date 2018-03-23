const sanitize = require('mongo-sanitize');
const CentralRestServerAuthorization = require('../CentralRestServerAuthorization');
const Logging = require('../../../utils/Logging');
const Utils = require('../../../utils/Utils');
const UtilsSecurity = require('./UtilsService').UtilsSecurity;

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

class LoggingSecurity {
	static filterLoggingsRequest(request, loggedUser) {
		let filteredRequest = {};
		// Get logs
		filteredRequest.DateFrom = sanitize(request.DateFrom);
		filteredRequest.Level = sanitize(request.Level);
		filteredRequest.ChargingStation = sanitize(request.ChargingStation);
		filteredRequest.Search = sanitize(request.Search);
		filteredRequest.SortDate = sanitize(request.SortDate);
		filteredRequest.Type = sanitize(request.Type);
		UtilsSecurity.filterLimit(request, filteredRequest);
		return filteredRequest;
	}

	static filterLoggingResponse(logging, loggedUser) {
		let filteredLogging = {};

		if (!logging) {
			return null;
		}
		if (!CentralRestServerAuthorization.isAdmin(loggedUser)) {
			return null;
		}
		filteredLogging.level = logging.level;
		filteredLogging.timestamp = logging.timestamp;
		filteredLogging.type = logging.type;
		filteredLogging.source = logging.source;
		filteredLogging.userFullName = logging.userFullName;
		filteredLogging.action = logging.action;
		filteredLogging.message = logging.message;
		filteredLogging.module = logging.module;
		filteredLogging.method = logging.method;
		filteredLogging.detailedMessages = logging.detailedMessages;
		if (logging.user && typeof logging.user == "object") {
			// Build user
			filteredLogging.user = Utils.buildUserFullName(logging.user, false);
		}
		if (logging.actionOnUser && typeof logging.actionOnUser == "object") {
			// Build user
			filteredLogging.actionOnUser = Utils.buildUserFullName(logging.actionOnUser, false);
		}
		return filteredLogging;
	}

	static filterLoggingsResponse(loggings, loggedUser) {
		let filteredLoggings = [];

		if (!loggings) {
			return null;
		}
		loggings.forEach(logging => {
			// Filter
			let filteredLogging = LoggingSecurity.filterLoggingResponse(logging, loggedUser);
			// Ok?
			if (filteredLogging) {
				// Add
				filteredLoggings.push(filteredLogging);
			}
		});
		return filteredLoggings;
	}
}

module.exports = {
	"LoggingService": LoggingService,
	"LoggingSecurity": LoggingSecurity
};
