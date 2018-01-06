const Utils = require('./Utils');
const AppError = require('../exception/AppError');
const AppAuthError = require('../exception/AppAuthError');
require('source-map-support').install();

let LoggingLevel = {
	"INFO": 'I',
	"DEBUG": 'D',
	"WARNING": 'W',
	"ERROR": 'E'
}

let LoggingType = {
	"SECURITY": 'S',
	"REGULAR": 'R'
}

class Logging {
	// Log Debug
	static logDebug(log) {
		// Log
		log.level = LoggingLevel.DEBUG;
		// Log it
		Logging._log(log);
	}

	// Log Info
	static logSecurityInfo(log) {
		// Set
		log.type = LoggingType.SECURITY;
		// Log it
		Logging.logInfo(log);
	}

	// Log Info
	static logInfo(log) {
		// Log
		log.level = LoggingLevel.INFO;
		// Log it
		Logging._log(log);
	}

	// Log Warning
	static logWarning(log) {
		// Log
		log.level = LoggingLevel.WARNING;
		// Log it
		Logging._log(log);
	}

	// Log Info
	static logSecurityError(log) {
		// Set
		log.type = LoggingType.SECURITY;
		// Log it
		Logging.logError(log);
	}

	// Log Error
	static logError(log) {
		// Log
		log.level = LoggingLevel.ERROR;
		// Log it
		Logging._log(log);
	}

	// Get Logs
	static getLogs(dateFrom, level, chargingStation, searchValue, numberOfLogs, sortDate) {
		return global.storage.getLogs(dateFrom, level, chargingStation, searchValue, numberOfLogs, sortDate);
	}

	// Delete
	static deleteLogs(deleteUpToDate) {
		return global.storage.deleteLogs(deleteUpToDate);
	}

	// Delete
	static deleteSecurityLogs(deleteUpToDate) {
		return global.storage.deleteSecurityLogs(deleteUpToDate);
	}

	// Log
	static logReceivedAction(module, chargeBoxIdentity, action, args, headers) {
		// Log
		Logging.logDebug({
			source: chargeBoxIdentity, module: module, method: action,
			message: `>> OCPP Request Received`,
			action: action,
			detailedMessages: {
				"args": args,
				"headers": headers
			}
		});
	}

	// Log
	static logSendAction(module, chargeBoxIdentity, action, args) {
		// Log
		Logging.logDebug({
			source: chargeBoxIdentity, module: module, method: action,
			message: `>> OCPP Request Sent`,
			action: action,
			detailedMessages: args
		});
	}

	// Log
	static logReturnedAction(module, chargeBoxIdentity, action, result) {
		// Log
		Logging.logDebug({
			source: chargeBoxIdentity, module: module, method: action,
			message: `<< OCPP Request Returned`,
			action: action,
			detailedMessages: {
				"result": result
			}
		});
	}

	// Used to log exception in catch(...) only
	static logActionExceptionMessageAndSendResponse(action, exception, req, res, next) {
		if (exception instanceof AppError) {
			// Log Error
			Logging._logActionExceptionMessageAndSendResponse(
				action, exception, req, res, next, exception.errorCode);
		} else if (exception instanceof AppAuthError) {
			// Log Auth Error
			Logging.logActionUnauthorizedMessageAndSendResponse(
				action, exception.entity, exception.value, req, res, next, exception.errorCode);
		} else {
			// Log Unexpected
			Logging._logActionExceptionMessageAndSendResponse(
				action, exception, req, res, next);
		}
	}

	// Log issues
	static logUnexpectedErrorMessage(action, module, method, err, source, userFullName) {
		Logging.logSecurityError({
			"userFullName": userFullName,
			"source": source, "module": module, "method": method,
			"action": action, "message": `${err.message}`,
			"detailedMessages": err.stack });
	}

	// Log issues
	static logActionUnauthorizedMessageAndSendResponse(action, entity, value, req, res, next) {
		// Log
		Logging._logActionExceptionMessageAndSendResponse(action,
			new Error(`Not authorised to perform '${action}' on ${entity} ${(value?"'"+value+"'":"")} (Role='${req.user.role}')`), req, res, next);
	}

	// Used to check URL params (not in catch)
	static _logActionExceptionMessageAndSendResponse(action, exception, req, res, next, errorCode=500) {
		// Clear password
		if (action==="login" && req.body.password) {
			req.body.password = "####";
		}
		Logging.logSecurityError({
			userID: ((req && req.user)?req.user.id:null), userFullName: Utils.buildUserFullName(req.user, false),
			module: exception.module, method: exception.method,
			action: action, message: exception.message,
			detailedMessages: [{
				"stack": exception.stack,
				"request": req.body}] });
		// Send error
		res.status(errorCode).send({"message": Utils.hideShowMessage(exception.message)});
		next();
	}

	static _format(detailedMessage) {
		// JSON?
		if (typeof detailedMessage === "object") {
			try {
				// Check that every detailedMessages is parsed
				return JSON.stringify(detailedMessage);
			} catch(err) {
				// Log
				Logging.logWarning({
					module: "Logging", method: "_format",
					message: `Error when formatting a Log (stringify): '${err.message}'`,
					detailedMessages: detailedMessage });
			}
		}
	}

	// Log
	static _log(log) {
		// Log
		log.timestamp = new Date();

		// Source
		if (!log.source) {
			log.source = "Central Server";
		}

		// Set User
		if (log.user) {
			log.userID = log.user.id;
			log.userFullName = Utils.buildUserFullName(log.user, false);
		} else if (!log.userFullName) {
			log.userFullName = "System";
		}

		// Check Array
		if (log.detailedMessages && !Array.isArray(log.detailedMessages)){
			// Handle update of array
			log.detailedMessages = [log.detailedMessages];
			// Format
			log.detailedMessages = Logging._format(log.detailedMessages);
		}

		// Check Type
		if (!log.type) {
			log.type = LoggingType.REGULAR;
		}

		// Log
		global.storage.saveLog(log);
	}
}

module.exports=Logging;
