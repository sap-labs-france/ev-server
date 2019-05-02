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
const uuid = require('uuid/v4');
require('source-map-support').install();

const {
  performance,
  PerformanceObserver
} = require('perf_hooks');

const _loggingConfig = Configuration.getLoggingConfig();

let _traceStatistics = null;

const obs = new PerformanceObserver((items) => {
  if (!_loggingConfig.traceLogOnlyStatistics) {
    // eslint-disable-next-line no-console
    console.log(`Performance ${items.getEntries()[0].name}) ${items.getEntries()[0].duration} ms`);
  }

  // Add statistics
  if (_traceStatistics === null) {
    _traceStatistics = {};
    //start interval to display statistics
    if (_loggingConfig.traceStatisticInterval) {
      setInterval(() => {
        const date = new Date();
        // eslint-disable-next-line no-console
        console.log(date.toISOString().substr(0, 19) + " STATISTICS START");
        // eslint-disable-next-line no-console
        console.log(JSON.stringify(_traceStatistics, null, " "));
        // eslint-disable-next-line no-console
        console.log(date.toISOString().substr(0, 19) + " STATISTICS END");
      }, _loggingConfig.traceStatisticInterval * 1000);
    }
  }
  Logging.addStatistic(items.getEntries()[0].name, items.getEntries()[0].duration);
  if (performance.hasOwnProperty('clearMeasures')) {
    performance.clearMeasures(); // does not seem to exist in node 10. It's stragen because then we have no way to remove measures and we will reach the maximum quickly
  }
  performance.clearMarks();
});
obs.observe({ entryTypes: ['measure'] });

const LogLevel = {
  "INFO": 'I',
  "DEBUG": 'D',
  "WARNING": 'W',
  "ERROR": 'E',
  "NONE": 'NONE',
  "DEFAULT": 'DEFAULT'
};

const LoggingType = {
  "SECURITY": 'S',
  "REGULAR": 'R'
};

class Logging {

  // Log Debug
  static logDebug(log) {
    if (typeof log !== 'object') {
      log = {
        simpleMessage: log
      };
    }
    // Log
    log.level = LogLevel.DEBUG;
    // Log it
    Logging._log(log);
  }

  // Debug DB
  static traceStart(module, method) {
    let uniqueID = 0;
    // Check
    if (_loggingConfig.trace) {
      uniqueID = uuid();
      // Log
      console.time(`${module}.${method}(${uniqueID})`); // eslint-disable-line
      performance.mark(`Start ${module}.${method}(${uniqueID})`);
    }
    return uniqueID;
  }

  static addStatistic(name, duration) {
    let currentStatistics;
    if (_traceStatistics[name]) {
      currentStatistics = _traceStatistics[name];
    } else {
      _traceStatistics[name] = {};
      currentStatistics = _traceStatistics[name];
    }

    if (currentStatistics) {
      // update current statistics timers
      currentStatistics.countTime = (currentStatistics.countTime ? currentStatistics.countTime + 1 : 1);
      currentStatistics.minTime = (currentStatistics.minTime ? (currentStatistics.minTime > duration ? duration : currentStatistics.minTime) : duration);
      currentStatistics.maxTime = (currentStatistics.maxTime ? (currentStatistics.maxTime < duration ? duration : currentStatistics.maxTime) : duration);
      currentStatistics.totalTime = (currentStatistics.totalTime ? currentStatistics.totalTime + duration : duration);
      currentStatistics.avgTime = currentStatistics.totalTime / currentStatistics.countTime;
    }
  }

  // Debug DB
  static traceEnd(module, method, uniqueID, params = {}) {
    // Check
    if (_loggingConfig.trace) {
      performance.mark(`End ${module}.${method}(${uniqueID})`);
      performance.measure(`${module}.${method}(${JSON.stringify(params)})`, `Start ${module}.${method}(${uniqueID})`, `End ${module}.${method}(${uniqueID})`);
    }
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
  static logReceivedAction(module, tenantID, chargeBoxID, action, payload) {
    // Log
    Logging.logDebug({
      tenantID: tenantID,
      source: chargeBoxID,
      module: module,
      method: action,
      message: `>> OCPP Request Received`,
      action: action,
      detailedMessages: payload
    });
  }

  // Log
  static logSendAction(module, tenantID, chargeBoxID, action, args) {
    // Log
    Logging.logDebug({
      tenantID: tenantID,
      source: chargeBoxID,
      module: module,
      method: action,
      message: `>> OCPP Request Sent`,
      action: action,
      detailedMessages: args
    });
  }

  // Log
  static logReturnedAction(module, tenantID, chargeBoxID, action, detailedMessages) {
    // Log
    Logging.logDebug({
      tenantID: tenantID,
      source: chargeBoxID,
      module: module,
      method: action,
      message: `<< OCPP Request Returned`,
      action: action,
      detailedMessages: detailedMessages
    });
  }

  // Used to log exception in catch(...) only
  static logException(error, action, source, module, method, tenantID, user) {
    const log = Logging._buildLog(error, action, source, module, method, tenantID, user);
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
  static logActionExceptionMessage(tenantID, action, exception) {
    // Log App Error
    if (exception instanceof AppError) {
      Logging._logActionAppExceptionMessage(tenantID, action, exception);
    // Log Backend Error
    } else if (exception instanceof BackendError) {
      Logging._logActionBackendExceptionMessage(tenantID, action, exception);
    // Log Auth Error
    } else if (exception instanceof AppAuthError) {
      Logging._logActionAppAuthExceptionMessage(tenantID, action, exception);
    } else if (exception instanceof BadRequestError) {
      Logging._logActionBadRequestExceptionMessage(tenantID, action, exception);
      // Log Unexpected
    } else {
      Logging._logActionExceptionMessage(tenantID, action, exception);
    }
  }

  // Used to log exception in catch(...) only
  static logActionExceptionMessageAndSendResponse(action, exception, req, res, next, tenantID = Constants.DEFAULT_TENANT) {
    // Clear password
    if (action === "login" && req.body.password) {
      req.body.password = "####";
    }
    if (req.user && req.user.tenantID) {
      tenantID = req.user.tenantID;
    }
    // Log App Error
    if (exception instanceof AppError) {
      Logging._logActionAppExceptionMessage(tenantID, action, exception);
    // Log Backend Error
    } else if (exception instanceof BackendError) {
      Logging._logActionBackendExceptionMessage(tenantID, action, exception);
    // Log Auth Error
    } else if (exception instanceof AppAuthError) {
      Logging._logActionAppAuthExceptionMessage(tenantID, action, exception);
    } else if (exception instanceof BadRequestError) {
      Logging._logActionBadRequestExceptionMessage(tenantID, action, exception);
    // Log Generic Error
    } else {
      Logging._logActionExceptionMessage(tenantID, action, exception);
    }
    // Send error
    res.status((exception.errorCode ? exception.errorCode : 500)).send({
      "message": Utils.hideShowMessage(exception.message)
    });
    next();
  }

  static _logActionExceptionMessage(tenantID, action, exception) {
    Logging.logError({
      tenantID: tenantID,
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

  static _logActionAppExceptionMessage(tenantID, action, exception) {
    Logging.logError({
      tenantID: tenantID,
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

  static _logActionBackendExceptionMessage(tenantID, action, exception) {
    Logging.logError({
      tenantID: tenantID,
      source: exception.source,
      module: exception.module,
      method: exception.method,
      action: action,
      message: exception.message,
      user: exception.user,
      actionOnUser: exception.actionOnUser,
      detailedMessages: [{
        "stack": exception.stack
      }]
    });
  }

  // Used to check URL params (not in catch)
  static _logActionBadRequestExceptionMessage(tenantID, action, exception) {
    Logging.logSecurityError({
      tenantID: tenantID,
      user: exception.user,
      actionOnUser: exception.actionOnUser,
      module: exception.module,
      method: exception.method,
      action: action,
      message: exception.message,
      detailedMessages: [{
        "details": exception.details,
        "stack": exception.stack
      }]
    });
  }

  // Used to check URL params (not in catch)
  static _logActionAppAuthExceptionMessage(tenantID, action, exception) {
    Logging.logSecurityError({
      tenantID: tenantID,
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

  static _buildLog(error, action, source, module, method, tenantID, user) {
    let tenant = tenantID ? tenantID : Constants.DEFAULT_TENANT;
    if (!tenantID && user) {
      // Check if the log can be attached to a tenant
      if (user.hasOwnProperty("tenantID")) {
        tenant = user.tenantID;
      } else if (user.hasOwnProperty("_tenantID")) {
        tenant = user._tenantID;
      }
    }
    return {
      source: source,
      user: user,
      tenantID: tenant,
      actionOnUser: error.actionOnUser,
      module: module,
      method: method,
      action: action,
      message: error.message,
      detailedMessages: [{
        "details": error.detailedMessages,
        "stack": error.stack
      }]
    };
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
  static async _log(log) {
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
    switch (LogLevel[consoleLogLevel]) {
      case LogLevel.NONE:
        break;
      // Keep up to error filter out debug
      case LogLevel.ERROR:
        if (log.level === LogLevel.INFO || log.level === LogLevel.WARNING || log.level === LogLevel.DEBUG) {
          break;
        }
      // Keep up to warning filter out debug
      case LogLevel.WARNING: // eslint-disable-line
        if (log.level === LogLevel.INFO || log.level === LogLevel.DEBUG) {
          break;
        }
      // Keep all log messages just filter out DEBUG
      case LogLevel.INFO: // eslint-disable-line
        if (log.level === LogLevel.DEBUG) {
          break;
        }
      // Keep all messages
      case LogLevel.DEBUG: // eslint-disable-line
      default: // If we did not break then it means we have to console log it
        Logging._consoleLog(log);
        break;
    }

    // Do not log to DB simple string messages
    if (log.hasOwnProperty('simpleMessage')) {
      return;
    }

    // Log Level
    switch (LogLevel[logLevel]) {
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
    await LoggingStorage.saveLog(log.tenantID, log);

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
        logFn = console.debug; // eslint-disable-line
        break;
      case LogLevel.ERROR:
        logFn = console.error; // eslint-disable-line
        break;
      case LogLevel.WARNING:
        logFn = console.warn; // eslint-disable-line
        break;
      case LogLevel.INFO:
        logFn = console.info; // eslint-disable-line
        break;
      default:
        logFn = console.log; // eslint-disable-line
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

  static getLog(tenantID, id) {
    return LoggingStorage.getLog(tenantID, id);
  }

  static getLogs(tenantID, params, limit, skip, sort) {
    return LoggingStorage.getLogs(tenantID, params, limit, skip, sort);
  }
}

module.exports = Logging;
