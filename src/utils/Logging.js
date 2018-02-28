const Utils = require('./Utils');
const Constants = require('./Constants');
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
	static getLogs(dateFrom, level, type, chargingStation, searchValue, numberOfLogs, sortDate) {
		return global.storage.getLogs(dateFrom, level, type, chargingStation, searchValue, numberOfLogs, sortDate);
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
	static logReceivedAction(module, chargeBoxID, action, args, headers) {
		// Log
		Logging.logDebug({
			source: chargeBoxID, module: module, method: action,
			message: `>> OCPP Request Received`,
			action: action,
			detailedMessages: {
				"args": args,
				"headers": headers
			}
		});
	}

	// Log
	static logSendAction(module, chargeBoxID, action, args) {
		// Log
		Logging.logDebug({
			source: chargeBoxID, module: module, method: action,
			message: `>> OCPP Request Sent`,
			action: action,
			detailedMessages: args
		});
	}

	// Log
	static logReturnedAction(module, chargeBoxID, action, result) {
		// Log
		Logging.logDebug({
			source: chargeBoxID, module: module, method: action,
			message: `<< OCPP Request Returned`,
			action: action,
			detailedMessages: {
				"result": result
			}
		});
	}

	// Used to log exception in catch(...) only
	static logActionExceptionMessage(action, exception) {
		if (exception instanceof AppError) {
			// Log Error
			Logging._logActionAppExceptionMessage(action, exception);
		} else if (exception instanceof AppAuthError) {
			// Log Auth Error
			Logging._logActionAppAuthExceptionMessage(action, exception);
		} else {
			// Log Unexpected
			Logging._logActionExceptionMessage(action, exception);
		}
	}

	// Used to log exception in catch(...) only
	static logActionExceptionMessageAndSendResponse(action, exception, req, res, next) {
		// Clear password
		if (action==="login" && req.body.password) {
			req.body.password = "####";
		}
		if (exception instanceof AppError) {
			// Log App Error
			Logging._logActionAppExceptionMessage(action, exception);
		} else if (exception instanceof AppAuthError) {
			// Log Auth Error
			Logging._logActionAppAuthExceptionMessage(action, exception);
		} else {
			// Log Generic Error
			Logging._logActionExceptionMessage(action, exception);
		}
		// Send error
		res.status((exception.errorCode ? exception.errorCode : 500)).send({"message": Utils.hideShowMessage(exception.message)});
		next();
	}

	static _logActionExceptionMessage(action, exception) {
		Logging.logSecurityError({
			module: exception.module, method: exception.method,
			action: action, message: exception.message,
			detailedMessages: [{
				"stack": exception.stack,
				"request": req.body}]
		});
	}

	static _logActionAppExceptionMessage(action, exception) {
		Logging.logSecurityError({
			user: exception.user,
			actionOnUser: exception.actionOnUser,
			module: exception.module, method: exception.method,
			action: action, message: exception.message,
			detailedMessages: [{
				"stack": exception.stack,
				"request": req.body}] });
	}

	// Used to check URL params (not in catch)
	static _logActionAppAuthExceptionMessage(action, exception) {
		Logging.logSecurityError({
			user: exception.user,
			actionOnUser: exception.actionOnUser,
			module: exception.module, method: exception.method,
			action: action, message: exception.message,
			detailedMessages: [{
				"stack": exception.stack,
				"request": req.body}] });
	}

	// Used to check URL params (not in catch)
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
			log.source = Constants.CENTRAL_SERVER;
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
