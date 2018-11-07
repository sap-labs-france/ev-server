const Utils = require('./Utils');
const Constants = require('./Constants');
const AppError = require('../exception/AppError');
const BackendError = require('../exception/BackendError');
const AppAuthError = require('../exception/AppAuthError');
const BadRequestError = require('../exception/BadRequestError');
const ConflictError = require('../exception/ConflictError');
const NotFoundError = require('../exception/NotFoundError');
const CFLog = require('cf-nodejs-logging-support');
const Configuration = require('../utils/Configuration');
const LoggingStorage = require('../storage/mongodb/LoggingStorage');
require('source-map-support').install();

let _loggingConfig = Configuration.getLoggingConfig();

const LogLevel = {
  "INFO": 'I',
  "DEBUG": 'D',
  "WARNING": 'W',
  "ERROR": 'E',
  "NONE": 'NONE',
  "DEFAULT": 'DEFAULT'
}

const LoggingType = {
  "SECURITY": 'S',
  "REGULAR": 'R'
}

class Logging {

  // Log Debug
  static logDebug(log) {
    if (typeof log !== 'object') {
      log = {
        simpleMessage: log
      }
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
  static logReceivedAction(module, chargeBoxID, action, payload) {
    // Log
    Logging.logDebug({
      source: chargeBoxID,
      module: module,
      method: action,
      message: `>> OCPP Request Received`,
      action: action,
      detailedMessages: payload
    });
  }

  // Log
  static logSendAction(module, chargeBoxID, action, args) {
    // Log
    Logging.logDebug({
      source: chargeBoxID,
      module: module,
      method: action,
      message: `>> OCPP Request Sent`,
      action: action,
      detailedMessages: args
    });
  }

  // Log
  static logReturnedAction(module, chargeBoxID, action, detailedMessages) {
    // Log
    Logging.logDebug({
      source: chargeBoxID,
      module: module,
      method: action,
      message: `<< OCPP Request Returned`,
      action: action,
      detailedMessages: detailedMessages
    });
  }

  // Used to log exception in catch(...) only
  static logException(error, action, source, module, method, user) {
    const log = Logging._buildLog(error, action, source, module, method, user);
    if (error instanceof AppAuthError) {
      Logging.logSecurityError(log);
    } else if (error instanceof BadRequestError) {
      Logging.logDebug(log);
    } else if (error instanceof ConflictError) {
      Logging.logWarning(log);
    } else if (error instanceof NotFoundError) {
      Logging.logWarning(log);
    } else if (error instanceof AppError) {
      Logging.logError(log);
    } else if (error instanceof BackendError) {
      Logging.logError(log);
    } else {
      Logging.logError(log);
    }
  }

  // Used to log exception in catch(...) only
  static logActionExceptionMessage(action, exception) {
    // Log App Error
    if (exception instanceof AppError) {
      Logging._logActionAppExceptionMessage(action, exception);
    // Log Backend Error
    } else if (exception instanceof BackendError) {
      Logging._logActionBackendExceptionMessage(action, exception);
    // Log Auth Error
    } else if (exception instanceof AppAuthError) {
      Logging._logActionAppAuthExceptionMessage(action, exception);
    // Log Unexpected
    } else {
      Logging._logActionExceptionMessage(action, exception);
    }
  }

  // Used to log exception in catch(...) only
  static logActionExceptionMessageAndSendResponse(action, exception, req, res, next) {
    // Clear password
    if (action === "login" && req.body.password) {
      req.body.password = "####";
    }
    // Log App Error
    if (exception instanceof AppError) {
      Logging._logActionAppExceptionMessage(action, exception);
    // Log Backend Error
    } else if (exception instanceof BackendError) {
      Logging._logActionBackendExceptionMessage(action, exception);
    // Log Auth Error
    } else if (exception instanceof AppAuthError) {
      Logging._logActionAppAuthExceptionMessage(action, exception);
    // Log Generic Error
    } else {
      Logging._logActionExceptionMessage(action, exception);
    }
    // Send error
    res.status((exception.errorCode ? exception.errorCode : 500)).send({
      "message": Utils.hideShowMessage(exception.message)
    });
    next();
  }

  static _logActionExceptionMessage(action, exception) {
    Logging.logError({
      source: exception.source,
      module: exception.module,
      method: exception.method,
      action: action,
      message: exception.message,
      detailedMessages: [{
        "stack": exception.stack
      }]
    });
  }

  static _logActionAppExceptionMessage(action, exception) {
    Logging.logError({
      source: exception.source,
      user: exception.user,
      actionOnUser: exception.actionOnUser,
      module: exception.module,
      method: exception.method,
      action: action,
      message: exception.message,
      detailedMessages: [{
        "stack": exception.stack
      }]
    });
  }

  static _logActionBackendExceptionMessage(action, exception) {
    Logging.logError({
      source: exception.source,
      module: exception.module,
      method: exception.method,
      action: action,
      message: exception.message,
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
      module: exception.module,
      method: exception.method,
      action: action,
      message: exception.message,
      detailedMessages: [{
        "stack": exception.stack
      }]
    });
  }

  static _buildLog(error, action, source, module, method, user) {
    return {
      source: source,
      user: user,
      actionOnUser: error.actionOnUser,
      module: module,
      method: method,
      action: action,
      message: error.message,
      detailedMessages: [{
        "stack": error.stack
      }]
    }
  }

  // Used to check URL params (not in catch)
  static _format(detailedMessage) {
    // JSON?
    if (typeof detailedMessage === "object") {
      try {
        // Check that every detailedMessages is parsed
        return JSON.stringify(detailedMessage, null, " ");
      } catch (err) {
        // Log
        Logging.logWarning({
          module: "Logging",
          method: "_format",
          message: `Error when formatting a Log (stringify): '${err.message}'`,
          detailedMessages: detailedMessage
        });
      }
    }
  }

  // Log
  static _log(log) {
    let moduleConfig = null;

    // Default Log Level
    let logLevel = (_loggingConfig.hasOwnProperty('logLevel') ? _loggingConfig.logLevel : LogLevel.DEBUG);
    // Default Console Level
    let consoleLogLevel = (_loggingConfig.hasOwnProperty('consoleLogLevel') ? _loggingConfig.consoleLogLevel : LogLevel.NONE);

    // Module Provided?
    if (log.hasOwnProperty('module') && _loggingConfig.hasOwnProperty('moduleDetails')) {
      // Yes: Check the Module
      if (_loggingConfig.moduleDetails.hasOwnProperty(log.module)) {
        // Get Modules Config
        moduleConfig = _loggingConfig.moduleDetails[log.module];
        // Check Module Log Level
        if (moduleConfig.hasOwnProperty('logLevel')) {
          if (moduleConfig.logLevel !== LogLevel.DEFAULT) {
            logLevel = moduleConfig.logLevel;
          }
        }
        // Check Console Log Level
        if (moduleConfig.hasOwnProperty('consoleLogLevel')) {
          // Default?
          if (moduleConfig.consoleLogLevel !== LogLevel.DEFAULT) {
            // No
            consoleLogLevel = moduleConfig.consoleLogLevel;
          }
        }
      }
    }

    // Log Level takes precedence over console log
    switch (consoleLogLevel) {
      case LogLevel.NONE:
        break;
      // Keep up to error filter out debug
      case LogLevel.ERROR:
        if (log.level === LogLevel.INFO || log.level === LogLevel.WARNING || log.level === LogLevel.DEBUG) {
          break;
        }
      // Keep up to warning filter out debug
      case LogLevel.WARNING:
        if (log.level === LogLevel.INFO || log.level === LogLevel.DEBUG) {
          break;
        }
      // Keep all log messages just filter out DEBUG
      case LogLevel.INFO: 
        if (log.level === LogLevel.DEBUG) {
          break;
        }
      // Keep all messages
      case LogLevel.DEBUG:
      default: // If we did not break then it means we have to console log it
        Logging._consoleLog(log);
        break;
    }

    // Do not log to DB simple string messages
    if (log.hasOwnProperty('simpleMessage')) {
      return;
    }

    // Log Level
    switch (logLevel) {
      // No logging at all
      case LogLevel.NONE:
        return;
      // Keep all log messages just filter out DEBUG
      case LogLevel.INFO:
        if (log.level === LogLevel.DEBUG) {
          return;
        }
        break;
      // Keep up to warning filter out debug
      case LogLevel.WARNING:
        if (log.level === LogLevel.INFO || log.level === LogLevel.DEBUG) {
          return;
        }
        break;
      // Keep up to error filter out debug
      case LogLevel.ERROR:
        if (log.level === LogLevel.INFO || log.level === LogLevel.WARNING || log.level === LogLevel.DEBUG) {
          return;
        }
        break;
      //Keep ALL
      case LogLevel.DEBUG:
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
    // Set the function to log
    switch (log.level) {
      case LogLevel.DEBUG:
        logFn = console.debug;
        break;
      case LogLevel.ERROR:
        logFn = console.error;
        break;
      case LogLevel.WARNING:
        logFn = console.warn;
        break;
      case LogLevel.INFO:
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
}

module.exports = Logging;