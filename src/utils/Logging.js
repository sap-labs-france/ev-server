const Utils = require('./Utils');
const fs = require('fs');
const Constants = require('./Constants');
const AppError = require('../exception/AppError');
const AppAuthError = require('../exception/AppAuthError');
const CFLog = require('cf-nodejs-logging-support');
const Configuration = require('../utils/Configuration');
const LoggingStorage = require('../storage/mongodb/LoggingStorage'); 
require('source-map-support').install();

const loggingConfigPath = require.resolve('../logging.json');
let _loggingConfig;

let LogLevel = {
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
		if (typeof log !== 'object') {
			log = { simpleMessage: log }
		}
		// Log
		log.level = LogLevel.DEBUG;
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
		log.level = LogLevel.INFO;
		// Log it
		Logging._log(log);
	}

	// Log Warning
	static logWarning(log) {
		// Log
		log.level = LogLevel.WARNING;
		// Log it
		Logging._log(log);
	}

	// Log Warning
	static logSecurityWarning(log) {
		// Set
		log.type = LoggingType.SECURITY;
		// Log it
		Logging.logWarning(log);
	}

	// Log Error
	static logSecurityError(log) {
		// Set
		log.type = LoggingType.SECURITY;
		// Log it
		Logging.logError(log);
	}

	// Log Error
	static logError(log) {
		// Log
		log.level = LogLevel.ERROR;
		// Log it
		Logging._log(log);
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
	static logReturnedAction(module, chargeBoxID, action, detailedMessages) {
		// Log
		Logging.logDebug({
			source: chargeBoxID, module: module, method: action,
			message: `<< OCPP Request Returned`,
			action: action,
			detailedMessages: detailedMessages
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
		if (action === "login" && req.body.password) {
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
			source: exception.source,
			module: exception.module, method: exception.method,
			action: action, message: exception.message,
			detailedMessages: [{
				"stack": exception.stack
			}]
		});
	}

	static _logActionAppExceptionMessage(action, exception) {
		Logging.logSecurityError({
			source: exception.source,
			user: exception.user,
			actionOnUser: exception.actionOnUser,
			module: exception.module, method: exception.method,
			action: action, message: exception.message,
			detailedMessages: [{
				"stack": exception.stack
			}]
		});
	}

	// Used to check URL params (not in catch)
	static _logActionAppAuthExceptionMessage(action, exception) {
		Logging.logSecurityError({
			user: exception.user,
			actionOnUser: exception.actionOnUser,
			module: exception.module, method: exception.method,
			action: action, message: exception.message,
			detailedMessages: [{
				"stack": exception.stack
			}]
		});
	}

	// Used to check URL params (not in catch)
	static _format(detailedMessage) {
		// JSON?
		if (typeof detailedMessage === "object") {
			try {
				// Check that every detailedMessages is parsed
				return JSON.stringify(detailedMessage, null, " ");
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
		// Load conifguration
		Logging.loadConfiguration();
		let moduleConfig = null;
		let logLevel = (_loggingConfig.hasOwnProperty('logLevel') ? _loggingConfig.logLevel : "INFO");
		let consoleLog = (_loggingConfig.hasOwnProperty('consoleLog') ? _loggingConfig.consoleLog : "NONE");

		if (log.hasOwnProperty('module') && _loggingConfig.hasOwnProperty('moduleDetails')) {
			if (_loggingConfig.moduleDetails.hasOwnProperty(log.module)) {
				moduleConfig = _loggingConfig.moduleDetails[log.module];
				if (moduleConfig.hasOwnProperty('logLevel')) {
					if (moduleConfig.logLevel !== 'DEFAULT')
						logLevel = moduleConfig.logLevel;
				}
				if (moduleConfig.hasOwnProperty('consoleLog')) {
					if (moduleConfig.consoleLog !== 'DEFAULT')
						consoleLog = moduleConfig.consoleLog;
				}
			}
		}

		switch (consoleLog) {
			case 'NONE':
				break;
			case 'ERROR': // Keep up to error filter out debug
				if (log.level === 'I' || log.level === 'W' || log.level === 'D') {
					break;
				}
			case 'WARNING': // Keep up to warning filter out debug
				if (log.level === 'I' || log.level === 'D') {
					break;
				}
			case 'INFO': // Keep all log messages just filter out DEBUG
				if (log.level === 'D') {
					break;
				}
			case 'DEBUG': //Keep all messages
			default: // If we did not break then it means we have to console log it
				Logging._consoleLog(log);
				break;
		}
		if (log.hasOwnProperty('simpleMessage')) { // Do not log to DB simple string messages
			return;
		}

		switch (logLevel) {
			case 'NONE': // No logging at all
				return;
			case 'INFO': // Keep all log messages just filter out DEBUG
				if (log.level === 'D') {
					return;
				}
				break;
			case 'WARNING': // Keep up to warning filter out debug
				if (log.level === 'I' || log.level === 'D') {
					return;
				}
				break;
			case 'ERROR': // Keep up to error filter out debug
				if (log.level === 'I' || log.level === 'W' || log.level === 'D') {
					return;
				}
				break;
			case 'DEBUG': //Keep ALL
			default:
				break;
		}
		// Log
		log.timestamp = new Date();

		// Source
		if (!log.source) {
			log.source = Constants.CENTRAL_SERVER;
		}

		// Check
		if (log.detailedMessages) {
			// Array?
			if (!Array.isArray(log.detailedMessages)) {
				// Set array
				log.detailedMessages = [log.detailedMessages];
			}
			// Format
			log.detailedMessages = Logging._format(log.detailedMessages);
		}

		// Check Type
		if (!log.type) {
			log.type = LoggingType.REGULAR;
		}
		// Log
		LoggingStorage.saveLog(log);

		// Log in Cloud Foundry
		if (Configuration.isCloudFoundry()) {
			// Bind to express app
			CFLog.logMessage(Logging.getCFLogLevel(log.level), log.message);
		}
	}

	//console Log
	static _consoleLog(log) {
		let logFn;
		switch (log.level) {
			case 'D':
				logFn = console.debug;
				break;
			case 'E':
				logFn = console.error;
				break;
			case 'W':
				logFn = console.warn;
				break;
			case 'I':
				logFn = console.info;
				break;
			default:
				logFn = console.log;
				break;
		}
		// Log
		log.timestamp = new Date();
		if (log.hasOwnProperty('simpleMessage')) {
			logFn(log.timestamp.toISOString() + " " + log.simpleMessage);
		} else {			
			if (typeof log === 'object' && log.hasOwnProperty('message')) {
				logFn(log.message);
			}
			logFn(log);
		}
	}

	// Log
	static getCFLogLevel(logLevel) {
		// Log level
		switch (logLevel) {
			case LogLevel.DEBUG:
				return "debug";		
			case LogLevel.INFO:
				return "info";		
			case LogLevel.WARNING:
				return "warning";		
			case LogLevel.ERROR:
				return "error";		
		}
	}

	static getLog(id) {
		return LoggingStorage.getLog(id);
	}

	static getLogs(params, limit, skip, sort) {
		return LoggingStorage.getLogs(params, limit, skip, sort)
	}

	static loadConfiguration(forceLoad = false) {
		if (!_loggingConfig || forceLoad) {
			if (fs.existsSync(loggingConfigPath)) {
				try {
					_loggingConfig = JSON.parse(fs.readFileSync(loggingConfigPath));
				} catch (err) {
					Logging.logError(err);
					_loggingConfig = {};	
				}
				if (!forceLoad) { // register the watch on file change
					fs.watch(loggingConfigPath, (eventType) =>{
						if (eventType === 'change') {
							try {
								_loggingConfig = JSON.parse(fs.readFileSync(loggingConfigPath));
							} catch (err) {
								Logging.logError(err);
							}
						}
					})
				}
				
			} else {
				_loggingConfig = {};
			}
		}
	}


}

module.exports=Logging;
