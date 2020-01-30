import CFLog from 'cf-nodejs-logging-support';
import cfenv from 'cfenv';
import cluster from 'cluster';
import os from 'os';
import { PerformanceObserver, performance } from 'perf_hooks';
import uuid from 'uuid/v4';
import AppAuthError from '../exception/AppAuthError';
import AppError from '../exception/AppError';
import BackendError from '../exception/BackendError';
import Configuration from '../utils/Configuration';
import Constants from './Constants';
import { HTTPError } from '../types/HTTPError';
import LoggingStorage from '../storage/mongodb/LoggingStorage';
import User from '../types/User';
import UserToken from '../types/UserToken';
import Utils from './Utils';
import { NextFunction, Request, Response } from 'express';
import { Log, LogLevel, LogType } from '../types/Log';

const _loggingConfig = Configuration.getLoggingConfig();
let _traceStatistics = null;

const obs = new PerformanceObserver((items): void => {
  if (!_loggingConfig.traceLogOnlyStatistics) {
    // eslint-disable-next-line no-console
    console.log(`Performance ${items.getEntries()[0].name}) ${items.getEntries()[0].duration} ms`);
  }

  // Add statistics
  if (!_traceStatistics) {
    _traceStatistics = {};
    // Start interval to display statistics
    if (_loggingConfig.traceStatisticInterval) {
      setInterval((): void => {
        const date = new Date();
        // eslint-disable-next-line no-console
        console.log(date.toISOString().substr(0, 19) + ' STATISTICS START');
        // eslint-disable-next-line no-console
        console.log(JSON.stringify(_traceStatistics, null, ' '));
        // eslint-disable-next-line no-console
        console.log(date.toISOString().substr(0, 19) + ' STATISTICS END');
      }, _loggingConfig.traceStatisticInterval * 1000);
    }
  }
  Logging.addStatistic(items.getEntries()[0].name, items.getEntries()[0].duration);
  if (performance.clearMeasures) {
    performance.clearMeasures(); // Does not seem to exist in node 10. It's strange because then we have no way to remove measures and we will reach the maximum quickly
  }
  performance.clearMarks();
});
obs.observe({ entryTypes: ['measure'] });

export default class Logging {
  // Log Debug
  public static logDebug(log): void {
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
  public static traceStart(module, method): string {
    let uniqueID = '0';
    // Check
    if (_loggingConfig.trace) {
      uniqueID = uuid();
      // Log
      // eslint-disable-next-line no-console
      console.time(`${module}.${method}(${uniqueID})`);
      performance.mark(`Start ${module}.${method}(${uniqueID})`);
    }
    return uniqueID;
  }

  public static addStatistic(name: string, duration: number): void {
    let currentStatistics;
    if (_traceStatistics[name]) {
      currentStatistics = _traceStatistics[name];
    } else {
      _traceStatistics[name] = {};
      currentStatistics = _traceStatistics[name];
    }

    // Update current statistics timers
    if (currentStatistics) {
      currentStatistics.countTime = (currentStatistics.countTime ? currentStatistics.countTime + 1 : 1);
      currentStatistics.minTime = (currentStatistics.minTime ? (currentStatistics.minTime > duration ? duration : currentStatistics.minTime) : duration);
      currentStatistics.maxTime = (currentStatistics.maxTime ? (currentStatistics.maxTime < duration ? duration : currentStatistics.maxTime) : duration);
      currentStatistics.totalTime = (currentStatistics.totalTime ? currentStatistics.totalTime + duration : duration);
      currentStatistics.avgTime = currentStatistics.totalTime / currentStatistics.countTime;
    }
  }

  // Debug DB
  public static traceEnd(module: string, method: string, uniqueID: string, params = {}): void {
    if (_loggingConfig.trace) {
      performance.mark(`End ${module}.${method}(${uniqueID})`);
      performance.measure(`${module}.${method}(${JSON.stringify(params)})`, `Start ${module}.${method}(${uniqueID})`, `End ${module}.${method}(${uniqueID})`);
    }
  }

  // Log Info
  public static logInfo(log: Log): void {
    log.level = LogLevel.INFO;
    Logging._log(log);
  }

  // Log Security Info
  public static logSecurityInfo(log: Log): void {
    log.type = LogType.SECURITY;
    Logging.logInfo(log);
  }

  // Log Warning
  public static logWarning(log: Log): void {
    log.level = LogLevel.WARNING;
    Logging._log(log);
  }

  // Log Security Warning
  public static logSecurityWarning(log: Log): void {
    log.type = LogType.SECURITY;
    Logging.logWarning(log);
  }

  // Log Error
  public static logError(log: Log): void {
    log.level = LogLevel.ERROR;
    Logging._log(log);
  }

  // Log Security Error
  public static logSecurityError(log: Log): void {
    log.type = LogType.SECURITY;
    Logging.logError(log);
  }

  // Log
  public static logReceivedAction(module: string, tenantID: string, chargeBoxID: string, action: string, payload: any): void {
    Logging.logDebug({
      tenantID: tenantID,
      source: chargeBoxID,
      module: module,
      method: action,
      message: '>> OCPP Request Received',
      action: action,
      detailedMessages: payload
    });
  }

  // Log
  public static logSendAction(module: string, tenantID: string, chargeBoxID: string, action: string, args: any): void {
    Logging.logDebug({
      tenantID: tenantID,
      source: chargeBoxID,
      module: module,
      method: action,
      message: '>> OCPP Request Sent',
      action: action,
      detailedMessages: args
    });
  }

  // Log
  public static logReturnedAction(module: string, tenantID: string, chargeBoxID: string, action: string, detailedMessages: any): void {
    Logging.logDebug({
      tenantID: tenantID,
      source: chargeBoxID,
      module: module,
      method: action,
      message: '<< OCPP Request Returned',
      action: action,
      detailedMessages: detailedMessages
    });
  }

  // Used to log exception in catch(...) only
  public static logException(error: Error, action: string, source: string, module: string, method: string, tenantID: string, user?: UserToken|User|string): void {
    const log: Log = Logging._buildLog(error, action, source, module, method, tenantID, user);
    if (error instanceof AppAuthError) {
      Logging.logSecurityError(log);
    } else if (error instanceof AppError) {
      Logging.logError(log);
    } else if (error instanceof BackendError) {
      Logging.logError(log);
    } else {
      Logging.logError(log);
    }
  }

  // Used to log exception in catch(...) only
  public static logActionExceptionMessage(tenantID: string, action: string, exception: Error): void {
    // Log App Error
    if (exception instanceof AppError) {
      Logging._logActionAppExceptionMessage(tenantID, action, exception);
    // Log Backend Error
    } else if (exception instanceof BackendError) {
      Logging._logActionBackendExceptionMessage(tenantID, action, exception);
    // Log Auth Error
    } else if (exception instanceof AppAuthError) {
      Logging._logActionAppAuthExceptionMessage(tenantID, action, exception);
    } else {
      Logging._logActionExceptionMessage(tenantID, action, exception);
    }
  }

  // Used to log exception in catch(...) only
  public static logActionExceptionMessageAndSendResponse(action: string, exception: Error, req: Request, res: Response, next: NextFunction, tenantID = Constants.DEFAULT_TENANT): void {
    // Clear password
    if (action === 'login' && req.body.password) {
      req.body.password = '####';
    }
    if (req.user && req.user.tenantID) {
      tenantID = req.user.tenantID;
    }
    let statusCode;
    // Log App Error
    if (exception instanceof AppError) {
      Logging._logActionAppExceptionMessage(tenantID, action, exception);
      statusCode = exception.params.errorCode;
    // Log Backend Error
    } else if (exception instanceof BackendError) {
      Logging._logActionBackendExceptionMessage(tenantID, action, exception);
      statusCode = HTTPError.GENERAL_ERROR;
    // Log Auth Error
    } else if (exception instanceof AppAuthError) {
      Logging._logActionAppAuthExceptionMessage(tenantID, action, exception);
      statusCode = exception.params.errorCode;
    } else {
      Logging._logActionExceptionMessage(tenantID, action, exception);
    }
    // Send error
    res.status(statusCode ? statusCode : HTTPError.GENERAL_ERROR).send({
      'message': Utils.hideShowMessage(exception.message)
    });
    next();
  }

  public static getLog(tenantID, id): any {
    return LoggingStorage.getLog(tenantID, id);
  }

  public static getLogs(tenantID, params, dbParams): any {
    return LoggingStorage.getLogs(tenantID, params, dbParams);
  }

  private static _logActionExceptionMessage(tenantID: string, action: string, exception: any): void {
    Logging.logError({
      tenantID: tenantID,
      user: exception.user,
      source: exception.source,
      module: exception.module,
      method: exception.method,
      action: action,
      message: exception.message,
      detailedMessages: [{
        'details': exception.detailedMessages,
        'stack': exception.stack
      }]
    });
  }

  private static _logActionAppExceptionMessage(tenantID: string, action: string, exception: AppError): void {
    const detailedMessages = [];
    detailedMessages.push({
      'stack': exception.stack
    });
    if (exception.params.detailedMessages) {
      detailedMessages.push({
        'details': (exception.params.detailedMessages instanceof Error ? exception.params.detailedMessages.stack : exception.params.detailedMessages)
      });
    }
    Logging.logError({
      tenantID: tenantID,
      source: exception.params.source,
      user: exception.params.user,
      actionOnUser: exception.params.actionOnUser,
      module: exception.params.module,
      method: exception.params.method,
      action: action,
      message: exception.message,
      detailedMessages
    });
  }

  private static _logActionBackendExceptionMessage(tenantID: string, action: string, exception: BackendError): void {
    Logging.logError({
      tenantID: tenantID,
      source: exception.params.source,
      module: exception.params.module,
      method: exception.params.method,
      action: action,
      message: exception.message,
      user: exception.params.user,
      actionOnUser: exception.params.actionOnUser,
      detailedMessages: [{
        'stack': exception.stack
      }]
    });
  }

  // Used to check URL params (not in catch)
  private static _logActionBadRequestExceptionMessage(tenantID: string, action: string, exception: any): void {
    Logging.logSecurityError({
      tenantID: tenantID,
      user: exception.user,
      actionOnUser: exception.actionOnUser,
      module: exception.module,
      method: exception.method,
      action: action,
      message: exception.message,
      detailedMessages: [{
        'details': exception.details,
        'stack': exception.stack
      }]
    });
  }

  // Used to check URL params (not in catch)
  private static _logActionAppAuthExceptionMessage(tenantID: string, action: string, exception: AppAuthError): void {
    Logging.logSecurityError({
      tenantID: tenantID,
      user: exception.params.user,
      actionOnUser: exception.params.actionOnUser,
      module: exception.params.module,
      method: exception.params.method,
      action: action,
      message: exception.message,
      detailedMessages: [{
        'stack': exception.stack
      }]
    });
  }

  private static _buildLog(error, action: string, source: string, module: string,
    method: string, tenantID: string, user: UserToken|User|string): Log {
    const tenant = tenantID ? tenantID : Constants.DEFAULT_TENANT;
    if (error.params) {
      return {
        source: source,
        user: user,
        tenantID: tenant,
        actionOnUser: error.params.actionOnUser,
        module: module,
        method: method,
        action: action,
        message: error.message,
        detailedMessages: [{
          'details': error.params.detailedMessages,
          'stack': error.stack
        }]
      };
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
        'details': error.detailedMessages,
        'stack': error.stack
      }]
    };
  }

  // Used to check URL params (not in catch)
  private static _format(detailedMessage: any): string {
    // JSON?
    if (typeof detailedMessage === 'object') {
      try {
        // Check that every detailedMessages is parsed
        return JSON.stringify(detailedMessage, null, ' ');
      } catch (err) {
        // Do nothing
      }
    }
  }

  // Log
  private static async _log(log: Log): Promise<void> {
    let moduleConfig = null;
    // Default Log Level
    let logLevel = _loggingConfig.logLevel ? _loggingConfig.logLevel : LogLevel.DEBUG;
    // Default Console Level
    let consoleLogLevel = _loggingConfig.consoleLogLevel ? _loggingConfig.consoleLogLevel : LogLevel.NONE;
    // Module Provided?
    if (log.module && _loggingConfig.moduleDetails) {
      // Yes: Check the Module
      if (_loggingConfig.moduleDetails[log.module]) {
        // Get Modules Config
        moduleConfig = _loggingConfig.moduleDetails[log.module];
        // Check Module Log Level
        if (moduleConfig.logLevel) {
          if (moduleConfig.logLevel !== LogLevel.DEFAULT) {
            logLevel = moduleConfig.logLevel;
          }
        }
        // Check Console Log Level
        if (moduleConfig.consoleLogLevel) {
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
      case LogLevel.WARNING: // eslint-disable-line no-fallthrough
        if (log.level === LogLevel.INFO || log.level === LogLevel.DEBUG) {
          break;
        }
      // Keep all log messages just filter out DEBUG
      case LogLevel.INFO: // eslint-disable-line no-fallthrough
        if (log.level === LogLevel.DEBUG) {
          break;
        }
      // Keep all messages
      case LogLevel.DEBUG: // eslint-disable-line no-fallthrough
      default: // If we did not break then it means we have to console log it
        Logging._consoleLog(log);
        break;
    }
    // Do not log to DB simple string messages
    if (log['simpleMessage']) {
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
      // Keep ALL
      case LogLevel.DEBUG:
      default:
        break;
    }
    // Timestamp
    log.timestamp = new Date();
    // Source
    if (!log.source) {
      log.source = `${Constants.CENTRAL_SERVER}`;
    }
    // Host
    log.host = Configuration.isCloudFoundry() ? cfenv.getAppEnv().name : os.hostname();
    // Process
    log.process = cluster.isWorker ? 'worker ' + cluster.worker.id : 'master';
    // Anonymize message
    Logging._anonymizeSensitiveData(log.detailedMessages);
    // Check
    if (log.detailedMessages) {
      // Array?
      if (!Array.isArray(log.detailedMessages)) {
        log.detailedMessages = [log.detailedMessages];
      }
      // Format
      log.detailedMessages = Logging._format(log.detailedMessages);
    }
    // Check Type
    if (!log.type) {
      log.type = LogType.REGULAR;
    }
    // First char always in Uppercase
    if (typeof log.message === 'string' && log.message && log.message.length > 0) {
      log.message = log.message[0].toUpperCase() + log.message.substring(1);
    }
    // Log
    await LoggingStorage.saveLog(log.tenantID, log);
    // Log in Cloud Foundry
    if (Configuration.isCloudFoundry()) {
      // Bind to express app
      CFLog.logMessage(Logging.getCFLogLevel(log.level), log.message);
    }
  }

  private static _anonymizeSensitiveData(message: any) {
    if (!message) {
      return;
    }
    if (typeof message === 'object') {
      for (const key in message) {
        if (message.key) {
          const value = message[key];
          // Another JSon?
          if (typeof value === 'object') {
            Logging._anonymizeSensitiveData(message[key]);
          }
          // Array?
          if (Array.isArray(value)) {
            Logging._anonymizeSensitiveData(value);
          }
          // String?
          if (typeof value === 'string') {
            if (key === 'password' ||
                key === 'repeatPassword' ||
                key === 'captcha') {
              // Anonymize
              message[key] = Constants.ANONYMIZED_VALUE;
            }
          }
        }
      }
    } else if (Array.isArray(message)) {
      for (const item of message) {
        Logging._anonymizeSensitiveData(item);
      }
    }
  }

  // Console Log
  private static _consoleLog(log): void {
    let logFn;
    // Set the function to log
    switch (log.level) {
      case LogLevel.DEBUG:
        // eslint-disable-next-line no-console
        logFn = console.debug;
        break;
      case LogLevel.ERROR:
        // eslint-disable-next-line no-console
        logFn = console.error;
        break;
      case LogLevel.WARNING:
        // eslint-disable-next-line no-console
        logFn = console.warn;
        break;
      case LogLevel.INFO:
        // eslint-disable-next-line no-console
        logFn = console.info;
        break;
      default:
        // eslint-disable-next-line no-console
        logFn = console.log;
        break;
    }

    // Log
    log.timestamp = new Date();
    if (log.simpleMessage) {
      logFn(log.timestamp.toISOString() + ' ' + log.simpleMessage);
    } else {
      logFn(log);
    }
  }

  // Log
  private static getCFLogLevel(logLevel): string {
    // Log level
    switch (logLevel) {
      case LogLevel.DEBUG:
        return 'debug';
      case LogLevel.INFO:
        return 'info';
      case LogLevel.WARNING:
        return 'warning';
      case LogLevel.ERROR:
        return 'error';
    }
  }
}
