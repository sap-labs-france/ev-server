import { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';
import { Log, LogLevel, LogType } from '../types/Log';
import { NextFunction, Request, Response } from 'express';
import { PerformanceObserver, performance } from 'perf_hooks';

import AppAuthError from '../exception/AppAuthError';
import AppError from '../exception/AppError';
import BackendError from '../exception/BackendError';
import CFLog from 'cf-nodejs-logging-support';
import Configuration from '../utils/Configuration';
import Constants from './Constants';
import { HTTPError } from '../types/HTTPError';
import LoggingStorage from '../storage/mongodb/LoggingStorage';
import { ServerAction } from '../types/Server';
import TenantStorage from '../storage/mongodb/TenantStorage';
import User from '../types/User';
import UserToken from '../types/UserToken';
import Utils from './Utils';
import cfenv from 'cfenv';
import cluster from 'cluster';
import jwtDecode from 'jwt-decode';
import os from 'os';
import { v4 as uuid } from 'uuid';

const _loggingConfig = Configuration.getLoggingConfig();
let _traceStatistics = null;

const MODULE_NAME = 'Logging';

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
  private static traceOCPPCalls: { [key: string]: number } = {};

  // Debug DB
  public static traceStart(module: string, method: string): string {
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

  // Log Debug
  public static logDebug(log: Log): void {
    log.level = LogLevel.DEBUG;
    Logging._log(log);
  }

  // Log Security Debug
  public static logSecurityDebug(log: Log): void {
    log.type = LogType.SECURITY;
    Logging.logDebug(log);
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

  public static logReceivedAction(module: string, tenantID: string, chargeBoxID: string, action: ServerAction, payload: any): void {
    // Keep duration
    Logging.traceOCPPCalls[`${chargeBoxID}~action`] = new Date().getTime();
    // Log
    Logging.logDebug({
      tenantID: tenantID,
      source: chargeBoxID,
      module: module, method: action,
      message: `>> OCPP Request '${action}' Received`,
      action: action,
      detailedMessages: { payload }
    });
  }

  public static async logExpressRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantID = await Logging.retrieveTenantFromHttpRequest(req);
      // Check perfs
      req['timestamp'] = new Date();
      // Log
      Logging.logSecurityDebug({
        tenantID,
        action: ServerAction.HTTP_REQUEST,
        user: Logging.getUserTokenFromHttpRequest(req),
        message: `Express HTTP Request << ${req.method} '${req.url}'`,
        module: MODULE_NAME, method: 'logExpressRequest',
        detailedMessages: {
          url: req.url,
          method: req.method,
          query: Utils.cloneJSonDocument(req.query),
          body: Utils.cloneJSonDocument(req.body),
          locale: req.locale,
          xhr: req.xhr,
          ip: req.ip,
          ips: req.ips,
          httpVersion: req.httpVersion,
          headers: req.headers,
        }
      });
    } finally {
      next();
    }
  }

  public static logExpressResponse(req: Request, res: Response, next: NextFunction): void {
    res.on('finish', () => {
      try {
        // Retrieve Tenant ID if available
        let tenantID: string;
        if (req.user) {
          tenantID = req.user.tenantID;
        }
        // Compute duration
        let durationSecs = 0;
        if (req['timestamp']) {
          durationSecs = (new Date().getTime() - req['timestamp'].getTime()) / 1000;
        }
        // Compute Length
        let contentLengthKB = 0;
        if (res.getHeader('content-length')) {
          contentLengthKB = Utils.roundTo(res.getHeader('content-length') as number / 1024, 2);
        }
        Logging.logSecurityDebug({
          tenantID: tenantID,
          user: req.user,
          action: ServerAction.HTTP_RESPONSE,
          message: `Express HTTP Response - ${(durationSecs > 0) ? durationSecs : '?'}s - ${(contentLengthKB > 0) ? contentLengthKB : '?'}kB >> ${req.method}/${res.statusCode} '${req.url}'`,
          module: MODULE_NAME, method: 'logExpressResponse',
          detailedMessages: {
            request: req.url,
            status: res.statusCode,
            statusMessage: res.statusMessage,
            headers: res.getHeaders(),
          }
        });
      } finally {
        next();
      }
    });
  }

  public static logExpressError(error: Error, req: Request, res: Response, next: NextFunction): void {
    // Log
    Logging.logActionExceptionMessageAndSendResponse(ServerAction.HTTP_ERROR, error, req, res, next);
  }

  public static logAxiosRequest(tenantID: string, request: AxiosRequestConfig): void {
    request['timestamp'] = new Date();
    Logging.logSecurityDebug({
      tenantID: tenantID,
      action: ServerAction.HTTP_REQUEST,
      message: `Axios HTTP Request >> ${request.method.toLocaleUpperCase()} '${request.url}'`,
      module: MODULE_NAME, method: 'interceptor',
      detailedMessages: {
        request: Utils.cloneJSonDocument(request),
      }
    });
  }

  public static logAxiosResponse(tenantID: string, response: AxiosResponse): void {
    // Compute duration
    let durationSecs = 0;
    if (response.config['timestamp']) {
      durationSecs = (new Date().getTime() - response.config['timestamp'].getTime()) / 1000;
    }
    // Compute Length
    let contentLengthKB = 0;
    if (response.config.headers['Content-Length']) {
      contentLengthKB = response.config.headers['Content-Length'] / 1024;
    }
    Logging.logSecurityDebug({
      tenantID: tenantID,
      action: ServerAction.HTTP_RESPONSE,
      message: `Axios HTTP Response - ${(durationSecs > 0) ? durationSecs : '?'}s - ${(contentLengthKB > 0) ? contentLengthKB : '?'}kB << ${response.config.method.toLocaleUpperCase()}/${response.status} '${response.config.url}'`,
      module: MODULE_NAME, method: 'interceptor',
      detailedMessages: {
        status: response.status,
        statusText: response.statusText,
        request: Utils.cloneJSonDocument(response.config),
        response: Utils.cloneJSonDocument(response.data)
      }
    });
  }

  public static logAxiosError(tenantID: string, error: AxiosError): void {
    // Error handling is done outside to get the proper module information
    Logging.logSecurityError({
      tenantID: tenantID,
      action: ServerAction.HTTP_ERROR,
      message: `Axios HTTP Error >> ${error.config.method.toLocaleUpperCase()}/${error.response?.status} '${error.config.url}' - ${error.message}`,
      module: MODULE_NAME, method: 'interceptor',
      detailedMessages: {
        url: error.config.url,
        status: error.response?.status,
        statusText: error.response?.statusText,
        message: error.message,
        response: error.response?.data,
        axiosError: error.toJSON(),
      }
    });
  }

  public static logSendAction(module: string, tenantID: string, chargeBoxID: string, action: ServerAction, args: any): void {
    // Log
    Logging.logDebug({
      tenantID: tenantID,
      source: chargeBoxID,
      module: module, method: action,
      message: `<< OCPP Request '${action}' Sent`,
      action: action,
      detailedMessages: { args }
    });
  }

  public static logReturnedAction(module: string, tenantID: string, chargeBoxID: string, action: ServerAction, detailedMessages: any): void {
    // Compute duration if provided
    let executionDurationSecs: number;
    if (Logging.traceOCPPCalls[`${chargeBoxID}~action`]) {
      executionDurationSecs = (new Date().getTime() - Logging.traceOCPPCalls[`${chargeBoxID}~action`]) / 1000;
      delete Logging.traceOCPPCalls[`${chargeBoxID}~action`];
    }
    if (detailedMessages && detailedMessages['status'] && detailedMessages['status'] === 'Rejected') {
      Logging.logError({
        tenantID: tenantID,
        source: chargeBoxID,
        module: module, method: action,
        message: `<< OCPP Request processed ${executionDurationSecs ? 'in ' + executionDurationSecs.toString() + ' secs' : ''}`,
        action: action,
        detailedMessages
      });
    } else {
      Logging.logDebug({
        tenantID: tenantID,
        source: chargeBoxID,
        module: module, method: action,
        message: `<< OCPP Request processed ${executionDurationSecs ? 'in ' + executionDurationSecs.toString() + ' secs' : ''}`,
        action: action,
        detailedMessages
      });
    }
  }

  // Used to log exception in catch(...) only
  public static logException(error: Error, action: ServerAction, source: string, module: string, method: string, tenantID: string, user?: UserToken|User|string): void {
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
  public static logActionExceptionMessage(tenantID: string, action: ServerAction, exception: Error): void {
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
  public static logActionExceptionMessageAndSendResponse(action: ServerAction, exception: Error, req: Request, res: Response, next: NextFunction, tenantID = Constants.DEFAULT_TENANT): void {
    // Clear password
    if (action === ServerAction.LOGIN && req.body.password) {
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

  private static _logActionExceptionMessage(tenantID: string, action: ServerAction, exception: any): void {
    // Log
    Logging.logError({
      tenantID: tenantID,
      type: LogType.SECURITY,
      user: exception.user,
      source: exception.source,
      module: exception.module,
      method: exception.method,
      action: action,
      message: exception.message,
      detailedMessages: { stack: exception.stack }
    });
  }

  private static _logActionAppExceptionMessage(tenantID: string, action: ServerAction, exception: AppError): void {
    // Add Exception stack
    if (exception.params.detailedMessages) {
      exception.params.detailedMessages = {
        'stack': exception.stack,
        'previous' : exception.params.detailedMessages
      };
    } else {
      exception.params.detailedMessages = {
        'stack': exception.stack,
      };
    }
    // Log
    Logging.logError({
      tenantID: tenantID,
      type: LogType.SECURITY,
      source: exception.params.source,
      user: exception.params.user,
      actionOnUser: exception.params.actionOnUser,
      module: exception.params.module,
      method: exception.params.method,
      action: action,
      message: exception.message,
      detailedMessages: exception.params.detailedMessages
    });
  }

  private static _logActionBackendExceptionMessage(tenantID: string, action: ServerAction, exception: BackendError): void {
    // Add Exception stack
    if (exception.params.detailedMessages) {
      exception.params.detailedMessages = {
        'stack': exception.stack,
        'previous' : exception.params.detailedMessages
      };
    } else {
      exception.params.detailedMessages = {
        'stack': exception.stack,
      };
    }
    // Log
    Logging.logError({
      tenantID: tenantID,
      type: LogType.SECURITY,
      source: exception.params.source,
      module: exception.params.module,
      method: exception.params.method,
      action: action,
      message: exception.message,
      user: exception.params.user,
      actionOnUser: exception.params.actionOnUser,
      detailedMessages: exception.params.detailedMessages
    });
  }

  // Used to check URL params (not in catch)
  private static _logActionAppAuthExceptionMessage(tenantID: string, action: ServerAction, exception: AppAuthError): void {
    // Log
    Logging.logSecurityError({
      tenantID: tenantID,
      type: LogType.SECURITY,
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

  private static _buildLog(error, action: ServerAction, source: string, module: string,
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
        return detailedMessage;
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
    Logging.anonymizeSensitiveData(log.detailedMessages);
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
    if (!log.tenantID || log.tenantID === '') {
      log.tenantID = Constants.DEFAULT_TENANT;
    }
    // Log
    await LoggingStorage.saveLog(log.tenantID, log);
    // Log in Cloud Foundry
    if (Configuration.isCloudFoundry()) {
      // Bind to express app
      CFLog.logMessage(Logging.getCFLogLevel(log.level), log.message);
    }
  }

  private static anonymizeSensitiveData(message: any) {
    if (!message || typeof message === 'number' || typeof message === 'boolean' || typeof message === 'function') {
      // eslint-disable-next-line no-useless-return
      return;
    } else if (Array.isArray(message)) {
      for (const item of message) {
        Logging.anonymizeSensitiveData(item);
      }
    } else if (typeof message === 'object') {
      for (const key of Object.keys(message)) {
        // String?
        if (typeof message[key] === 'string') {
          for (const sensitiveData of Constants.SENSITIVE_DATA) {
            if (key.toLocaleLowerCase() === sensitiveData.toLocaleLowerCase()) {
              // Anonymize
              message[key] = Constants.ANONYMIZED_VALUE;
            }
          }
          // Check query string
          const dataParts: string[] = message[key].split('&');
          if (dataParts.length > 1) {
            for (let i = 0; i < dataParts.length; i++) {
              const dataPart = dataParts[i];
              for (const sensitiveData of Constants.SENSITIVE_DATA) {
                if (dataPart.toLowerCase().startsWith(sensitiveData.toLocaleLowerCase())) {
                  // Anonymize
                  dataParts[i] = dataPart.substring(0, sensitiveData.length + 1) + Constants.ANONYMIZED_VALUE;
                }
              }
            }
            message[key] = dataParts.join('&');
          }
        } else {
          Logging.anonymizeSensitiveData(message[key]);
        }
      }
    } else {
      // Log
      Logging.logError({
        tenantID: Constants.DEFAULT_TENANT,
        type: LogType.SECURITY,
        module: MODULE_NAME,
        method: 'anonymizeSensitiveData',
        action: ServerAction.LOGGING,
        message: 'No matching object type for log message anonymisation',
        detailedMessages: { message: message }
      });
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

  private static getUserTokenFromHttpRequest(req: Request): UserToken {
    // Retrieve Tenant ID from JWT token if available
    try {
      // Decode the token
      if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        return jwtDecode(req.headers.authorization.slice(7));
      }
    } catch (error) {
      // Do nothing
    }
  }

  private static async retrieveTenantFromHttpRequest(req: Request): Promise<string> {
    // Try from Token
    const userToken = Logging.getUserTokenFromHttpRequest(req);
    if (userToken) {
      return userToken.tenantID;
    }
    // Try from body
    if (req.body?.tenant && req.body.tenant !== '') {
      const tenant = await TenantStorage.getTenantBySubdomain(req.body.tenant);
      if (tenant) {
        return tenant.id;
      }
    }
    // Try from host header
    if (req.headers?.host) {
      const hostParts = req.headers.host.split('.');
      if (hostParts.length > 1) {
        // Try with the first param
        const tenant = await TenantStorage.getTenantBySubdomain(hostParts[0]);
        if (tenant) {
          return tenant.id;
        }
      }
    }
    return Constants.DEFAULT_TENANT;
  }
}
