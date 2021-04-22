import { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';
import { Log, LogLevel, LogType } from '../types/Log';
import { NextFunction, Request, Response } from 'express';

import { ActionsResponse } from '../types/GlobalType';
import AppAuthError from '../exception/AppAuthError';
import AppError from '../exception/AppError';
import BackendError from '../exception/BackendError';
import CFLog from 'cf-nodejs-logging-support';
import Configuration from '../utils/Configuration';
import Constants from './Constants';
import { HTTPError } from '../types/HTTPError';
import LoggingConfiguration from '../types/configuration/LoggingConfiguration';
import LoggingStorage from '../storage/mongodb/LoggingStorage';
import { OCPIResult } from '../types/ocpi/OCPIResult';
import { OCPPStatus } from '../types/ocpp/OCPPClient';
import { OICPResult } from '../types/oicp/OICPResult';
import PerformanceStorage from '../storage/mongodb/PerformanceStorage';
import { ServerAction } from '../types/Server';
import User from '../types/User';
import UserToken from '../types/UserToken';
import Utils from './Utils';
import chalk from 'chalk';
import cluster from 'cluster';
import sizeof from 'object-sizeof';

const MODULE_NAME = 'Logging';

export default class Logging {
  private static traceCalls: { [key: string]: number } = {};
  private static loggingConfig: LoggingConfiguration;

  public static getConfiguration(): LoggingConfiguration {
    if (!this.loggingConfig) {
      this.loggingConfig = Configuration.getLoggingConfig();
    }
    return this.loggingConfig;
  }

  // Debug DB
  public static traceStart(tenantID: string, module: string, method: string): string {
    if (Utils.isDevelopmentEnv()) {
      const key = `${tenantID}~${module}~${method}~${Utils.generateUUID()}`;
      Logging.traceCalls[key] = new Date().getTime();
      return key;
    }
  }

  // Debug DB
  public static async traceEnd(tenantID: string, module: string, method: string, key: string, data: any = {}): Promise<void> {
    if (Utils.isDevelopmentEnv()) {
      // Compute duration if provided
      let executionDurationMillis: number;
      let found = false;
      if (Logging.traceCalls[key]) {
        executionDurationMillis = (new Date().getTime() - Logging.traceCalls[key]);
        delete Logging.traceCalls[key];
        found = true;
      }
      const sizeOfDataKB = Utils.truncTo(sizeof(data) / 1024, 2);
      const numberOfRecords = Array.isArray(data) ? data.length : 0;
      const message = `${module}.${method} ${found ? '- ' + executionDurationMillis.toString() + 'ms' : ''} ${!Utils.isEmptyJSon(data) ? '- ' + sizeOfDataKB.toString() + 'kB' : ''} ${Array.isArray(data) ? '- ' + numberOfRecords.toString() + 'rec' : ''}`;
      console.debug(chalk.green(message));
      if (sizeOfDataKB > Constants.PERF_MAX_DATA_VOLUME_KB) {
        const error = new Error(`Data must be < ${Constants.PERF_MAX_DATA_VOLUME_KB}kB, got ${sizeOfDataKB}kB`);
        await Logging.logError({
          tenantID,
          source: Constants.CENTRAL_SERVER,
          action: ServerAction.PERFORMANCES,
          module, method,
          message: `${message}: ${error.message}`,
          detailedMessages: { error: error.message, stack: error.stack }
        });
        if (Utils.isDevelopmentEnv()) {
          console.error(chalk.red('===================================='));
          console.error(chalk.red(`Tenant ID '${tenantID}'`));
          console.error(chalk.red(error));
          console.error(chalk.red(message));
          console.error(chalk.red('===================================='));
        }
      }
      if (executionDurationMillis > Constants.PERF_MAX_RESPONSE_TIME_MILLIS) {
        const error = new Error(`Execution must be < ${Constants.PERF_MAX_RESPONSE_TIME_MILLIS}ms, got ${executionDurationMillis}ms`);
        await Logging.logError({
          tenantID,
          source: Constants.CENTRAL_SERVER,
          action: ServerAction.PERFORMANCES,
          module, method,
          message: `${message}: ${error.message}`,
          detailedMessages: { error: error.message, stack: error.stack }
        });
        if (Utils.isDevelopmentEnv()) {
          console.error(chalk.red('===================================='));
          console.error(chalk.red(`Tenant ID '${tenantID}'`));
          console.error(chalk.red(error));
          console.error(chalk.red(message));
          console.error(chalk.red('===================================='));
        }
      }
      await PerformanceStorage.savePerformanceRecord(
        Utils.buildPerformanceRecord({
          tenantID,
          durationMs: executionDurationMillis,
          sizeKb: sizeOfDataKB,
          source: Constants.DATABASE_SERVER,
          module, method,
          action: key,
        })
      );
    }
  }

  // Log Debug
  public static async logDebug(log: Log): Promise<string> {
    log.level = LogLevel.DEBUG;
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    return Logging._log(log);
  }

  // Log Security Debug
  public static async logSecurityDebug(log: Log): Promise<string> {
    log.type = LogType.SECURITY;
    return Logging.logDebug(log);
  }

  // Log Info
  public static async logInfo(log: Log): Promise<string> {
    log.level = LogLevel.INFO;
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    return Logging._log(log);
  }

  // Log Security Info
  public static async logSecurityInfo(log: Log): Promise<string> {
    log.type = LogType.SECURITY;
    return Logging.logInfo(log);
  }

  // Log Warning
  public static async logWarning(log: Log): Promise<string> {
    log.level = LogLevel.WARNING;
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    return Logging._log(log);
  }

  // Log Security Warning
  public static async logSecurityWarning(log: Log): Promise<string> {
    log.type = LogType.SECURITY;
    return Logging.logWarning(log);
  }

  // Log Error
  public static async logError(log: Log): Promise<string> {
    log.level = LogLevel.ERROR;
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    return Logging._log(log);
  }

  // Log Security Error
  public static async logSecurityError(log: Log): Promise<string> {
    log.type = LogType.SECURITY;
    return Logging.logError(log);
  }

  public static async logExpressRequest(tenantID: string, decodedToken, req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Check perfs
      req['timestamp'] = new Date();
      // Log
      await Logging.logSecurityDebug({
        tenantID,
        action: ServerAction.HTTP_REQUEST,
        user: (Utils.objectHasProperty(decodedToken, 'id') ? decodedToken as UserToken : null),
        message: `Express HTTP Request << ${req.method} '${req.url}'`,
        module: MODULE_NAME, method: 'logExpressRequest',
        detailedMessages: {
          url: req.url,
          method: req.method,
          query: Utils.cloneObject(req.query),
          body: Utils.cloneObject(req.body),
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

  public static async logActionsResponse(
      tenantID: string, action: ServerAction, module: string, method: string, actionsResponse: ActionsResponse,
      messageSuccess: string, messageError: string, messageSuccessAndError: string,
      messageNoSuccessNoError: string, user?: UserToken): Promise<void> {
    // Replace
    messageSuccess = messageSuccess.replace('{{inSuccess}}', actionsResponse.inSuccess.toString());
    messageError = messageError.replace('{{inError}}', actionsResponse.inError.toString());
    messageSuccessAndError = messageSuccessAndError.replace('{{inSuccess}}', actionsResponse.inSuccess.toString());
    messageSuccessAndError = messageSuccessAndError.replace('{{inError}}', actionsResponse.inError.toString());
    // Success and Error
    if (actionsResponse.inSuccess > 0 && actionsResponse.inError > 0) {
      await Logging.logError({
        tenantID: tenantID,
        user,
        source: Constants.CENTRAL_SERVER,
        action, module, method,
        message: messageSuccessAndError
      });
      Utils.isDevelopmentEnv() && console.error(chalk.red(messageSuccessAndError));
    } else if (actionsResponse.inSuccess > 0) {
      await Logging.logInfo({
        tenantID: tenantID,
        user,
        source: Constants.CENTRAL_SERVER,
        action, module, method,
        message: messageSuccess
      });
      Utils.isDevelopmentEnv() && console.info(chalk.green(messageSuccess));
    } else if (actionsResponse.inError > 0) {
      await Logging.logError({
        tenantID: tenantID,
        user,
        source: Constants.CENTRAL_SERVER,
        action, module, method,
        message: messageError
      });
      Utils.isDevelopmentEnv() && console.error(chalk.red(messageError));
    } else {
      await Logging.logInfo({
        tenantID: tenantID,
        user,
        source: Constants.CENTRAL_SERVER,
        action, module, method,
        message: messageNoSuccessNoError
      });
      Utils.isDevelopmentEnv() && console.info(chalk.green(messageNoSuccessNoError));
    }
  }

  public static async logOcpiResult(
      tenantID: string, action: ServerAction, module: string, method: string, ocpiResult: OCPIResult,
      messageSuccess: string, messageError: string, messageSuccessAndError: string,
      messageNoSuccessNoError: string): Promise<void> {
    // Replace
    messageSuccess = messageSuccess.replace('{{inSuccess}}', ocpiResult.success.toString());
    messageError = messageError.replace('{{inError}}', ocpiResult.failure.toString());
    messageSuccessAndError = messageSuccessAndError.replace('{{inSuccess}}', ocpiResult.success.toString());
    messageSuccessAndError = messageSuccessAndError.replace('{{inError}}', ocpiResult.failure.toString());
    if (Utils.isEmptyArray(ocpiResult.logs)) {
      ocpiResult.logs = null;
    }
    // Success and Error
    if (ocpiResult.success > 0 && ocpiResult.failure > 0) {
      await Logging.logError({
        tenantID: tenantID,
        source: Constants.CENTRAL_SERVER,
        action, module, method,
        message: messageSuccessAndError,
        detailedMessages: ocpiResult.logs
      });
      Utils.isDevelopmentEnv() && console.error(chalk.red(messageSuccessAndError));
    } else if (ocpiResult.success > 0) {
      await Logging.logInfo({
        tenantID: tenantID,
        source: Constants.CENTRAL_SERVER,
        action, module, method,
        message: messageSuccess,
        detailedMessages: ocpiResult.logs
      });
      Utils.isDevelopmentEnv() && console.info(chalk.green(messageSuccess));
    } else if (ocpiResult.failure > 0) {
      await Logging.logError({
        tenantID: tenantID,
        source: Constants.CENTRAL_SERVER,
        action, module, method,
        message: messageError,
        detailedMessages: ocpiResult.logs
      });
      Utils.isDevelopmentEnv() && console.error(chalk.red(messageError));
    } else {
      await Logging.logInfo({
        tenantID: tenantID,
        source: Constants.CENTRAL_SERVER,
        action, module, method,
        message: messageNoSuccessNoError,
        detailedMessages: ocpiResult.logs
      });
      Utils.isDevelopmentEnv() && console.info(chalk.green(messageNoSuccessNoError));
    }
  }

  public static async logOicpResult(tenantID: string, action: ServerAction, module: string, method: string, oicpResult: OICPResult,
      messageSuccess: string, messageError: string, messageSuccessAndError: string, messageNoSuccessNoError: string): Promise<void> {
    await Logging.logOcpiResult(tenantID, action, module, method, oicpResult,
      messageSuccess, messageError, messageSuccessAndError, messageNoSuccessNoError);
  }

  public static logExpressResponse(req: Request, res: Response, next: NextFunction): void {
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    res.on('finish', async () => {
      try {
        // Retrieve Tenant ID if available
        let tenantID: string;
        if (req['tenantID']) {
          tenantID = req['tenantID'];
        }
        // Compute duration
        let executionDurationMillis = 0;
        if (req['timestamp']) {
          executionDurationMillis = (new Date().getTime() - req['timestamp'].getTime());
        }
        // Compute Length
        let sizeOfDataKB = 0;
        if (res.getHeader('content-length')) {
          sizeOfDataKB = Utils.truncTo(res.getHeader('content-length') as number / 1024, 2);
        }
        const message = `Express HTTP Response - ${(executionDurationMillis > 0) ? executionDurationMillis : '?'}ms - ${(sizeOfDataKB > 0) ? sizeOfDataKB : '?'}kB >> ${req.method}/${res.statusCode} '${req.url}'`;
        Utils.isDevelopmentEnv() && console.debug(chalk.green(message));
        if (sizeOfDataKB > Constants.PERF_MAX_DATA_VOLUME_KB) {
          const error = new Error(`Data must be < ${Constants.PERF_MAX_DATA_VOLUME_KB}kB, got ${(sizeOfDataKB > 0) ? sizeOfDataKB : '?'}kB`);
          await Logging.logError({
            tenantID,
            source: Constants.CENTRAL_SERVER,
            action: ServerAction.PERFORMANCES,
            module: MODULE_NAME, method: 'logExpressResponse',
            message: `${message}: ${error.message}`,
            detailedMessages: { error: error.message, stack: error.stack }
          });
          if (Utils.isDevelopmentEnv()) {
            console.error(chalk.red('===================================='));
            console.error(chalk.red(`Tenant ID '${tenantID}'`));
            console.error(chalk.red(error));
            console.error(chalk.red(message));
            console.error(chalk.red('===================================='));
          }
        }
        if (executionDurationMillis > Constants.PERF_MAX_RESPONSE_TIME_MILLIS) {
          const error = new Error(`Execution must be < ${Constants.PERF_MAX_RESPONSE_TIME_MILLIS}ms, got ${(executionDurationMillis > 0) ? executionDurationMillis : '?'}ms`);
          await Logging.logError({
            tenantID,
            source: Constants.CENTRAL_SERVER,
            action: ServerAction.PERFORMANCES,
            module: MODULE_NAME, method: 'logExpressResponse',
            message: `${message}: ${error.message}`,
            detailedMessages: { error: error.message, stack: error.stack }
          });
          if (Utils.isDevelopmentEnv()) {
            console.error(chalk.red('===================================='));
            console.error(chalk.red(`Tenant ID '${tenantID}'`));
            console.error(chalk.red(error));
            console.error(chalk.red(message));
            console.error(chalk.red('===================================='));
          }
        }
        void Logging.logSecurityDebug({
          tenantID: tenantID,
          user: req.user,
          action: ServerAction.HTTP_RESPONSE,
          message,
          module: MODULE_NAME, method: 'logExpressResponse',
          detailedMessages: {
            request: req.url,
            status: res.statusCode,
            statusMessage: res.statusMessage,
            headers: res.getHeaders(),
          }
        });
        void PerformanceStorage.savePerformanceRecord(
          Utils.buildPerformanceRecord({
            tenantID,
            httpUrl: req.url,
            httpCode: res.statusCode,
            httpMethod: req.method,
            durationMs: executionDurationMillis,
            sizeKb: sizeOfDataKB,
            source: Constants.REST_SERVER,
            module: MODULE_NAME, method: 'logExpressResponse',
            action: ServerAction.HTTP_RESPONSE,
          })
        );
      } finally {
        next();
      }
    });
  }

  public static async logExpressError(error: Error, req: Request, res: Response, next: NextFunction): Promise<void> {
    await Logging.logActionExceptionMessageAndSendResponse(
      error['params'] && error['params']['action'] ? error['params']['action'] : ServerAction.HTTP_ERROR, error, req, res, next);
  }

  public static async logAxiosRequest(tenantID: string, request: AxiosRequestConfig): Promise<void> {
    request['timestamp'] = new Date();
    await Logging.logSecurityDebug({
      tenantID: tenantID,
      action: ServerAction.HTTP_REQUEST,
      message: `Axios HTTP Request >> ${request.method.toLocaleUpperCase()} '${request.url}'`,
      module: MODULE_NAME, method: 'interceptor',
      detailedMessages: {
        request: Utils.cloneObject(request),
      }
    });
  }

  public static async logAxiosResponse(tenantID: string, response: AxiosResponse): Promise<void> {
    // Compute duration
    let executionDurationMillis: number;
    if (response.config['timestamp']) {
      executionDurationMillis = (new Date().getTime() - response.config['timestamp'].getTime());
    }
    // Compute Length
    let sizeOfDataKB = 0;
    if (response.config.headers['Content-Length']) {
      sizeOfDataKB = Utils.truncTo(response.config.headers['Content-Length'] / 1024, 2);
    }
    const message = `Axios HTTP Response - ${(executionDurationMillis > 0) ? executionDurationMillis : '?'}ms - ${(sizeOfDataKB > 0) ? sizeOfDataKB : '?'}kB << ${response.config.method.toLocaleUpperCase()}/${response.status} '${response.config.url}'`;
    Utils.isDevelopmentEnv() && console.log(chalk.green(message));
    if (sizeOfDataKB > Constants.PERF_MAX_DATA_VOLUME_KB) {
      const error = new Error(`Data must be < ${Constants.PERF_MAX_DATA_VOLUME_KB}`);
      await Logging.logError({
        tenantID,
        source: Constants.CENTRAL_SERVER,
        action: ServerAction.PERFORMANCES,
        module: MODULE_NAME, method: 'logAxiosResponse',
        message: `${message}: ${error.message}`,
        detailedMessages: { error: error.message, stack: error.stack }
      });
      if (Utils.isDevelopmentEnv()) {
        console.error(chalk.red('===================================='));
        console.error(chalk.red(`Tenant ID '${tenantID}'`));
        console.error(chalk.red(error));
        console.error(chalk.red(message));
        console.error(chalk.red('===================================='));
      }
    }
    if (executionDurationMillis > Constants.PERF_MAX_RESPONSE_TIME_MILLIS) {
      const error = new Error(`Execution must be < ${Constants.PERF_MAX_RESPONSE_TIME_MILLIS}ms, got ${(executionDurationMillis > 0) ? executionDurationMillis : '?'}ms`);
      await Logging.logError({
        tenantID,
        source: Constants.CENTRAL_SERVER,
        action: ServerAction.PERFORMANCES,
        module: MODULE_NAME, method: 'logAxiosResponse',
        message: `${message}: ${error.message}`,
        detailedMessages: { error: error.message, stack: error.stack }
      });
      if (Utils.isDevelopmentEnv()) {
        console.error(chalk.red('===================================='));
        console.error(chalk.red(`Tenant ID '${tenantID}'`));
        console.error(chalk.red(error));
        console.error(chalk.red(message));
        console.error(chalk.red('===================================='));
      }
    }
    try {
      await Logging.logSecurityDebug({
        tenantID: tenantID,
        action: ServerAction.HTTP_RESPONSE,
        message,
        module: MODULE_NAME, method: 'logAxiosResponse',
        detailedMessages: {
          status: response.status,
          statusText: response.statusText,
          request: Utils.cloneObject(response.config),
          headers: Utils.cloneObject(response.headers),
          response: Utils.cloneObject(response.data)
        }
      });
      await PerformanceStorage.savePerformanceRecord(
        Utils.buildPerformanceRecord({
          tenantID,
          httpUrl: response.config.url,
          httpCode: response.status,
          httpMethod: response.config.method.toLocaleUpperCase(),
          durationMs: executionDurationMillis,
          sizeKb: sizeOfDataKB,
          source: Constants.AXIOS_CLIENT,
          module: MODULE_NAME, method: 'logAxiosResponse',
          action: ServerAction.HTTP_RESPONSE,
        })
      );
    } catch (error) {
      // FIXME: Error Message: Converting circular structure to JSON
      // Temporary FIX: Utils.cloneObject() removed
      await Logging.logSecurityDebug({
        tenantID: tenantID,
        action: ServerAction.HTTP_RESPONSE,
        message: `Axios HTTP Response - ${(executionDurationMillis > 0) ? executionDurationMillis : '?'}ms - ${(sizeOfDataKB > 0) ? sizeOfDataKB : '?'}kB << ${response.config.method.toLocaleUpperCase()}/${response.status} '${response.config.url}'`,
        module: MODULE_NAME, method: 'interceptor',
        detailedMessages: {
          status: response.status,
          statusText: response.statusText
        }
      });
    }
  }

  public static async logAxiosError(tenantID: string, error: AxiosError): Promise<void> {
    // Error handling is done outside to get the proper module information
    await Logging.logSecurityError({
      tenantID: tenantID,
      action: ServerAction.HTTP_ERROR,
      message: `Axios HTTP Error >> ${error.config?.method?.toLocaleUpperCase()}/${error.response?.status} '${error.config?.url}' - ${error.message}`,
      module: MODULE_NAME, method: 'interceptor',
      detailedMessages: {
        url: error.config?.url,
        status: error.response?.status,
        statusText: error.response?.statusText,
        message: error.message,
        response: error.response?.data,
        axiosError: Utils.objectHasProperty(error, 'toJSON') ? error.toJSON() : null,
      }
    });
  }

  public static async logChargingStationClientSendAction(module: string, tenantID: string, chargeBoxID: string,
      action: ServerAction, args: any): Promise<void> {
    await this.traceChargingStationActionStart(module, tenantID,chargeBoxID, action, args, '<<');
  }

  public static async logChargingStationClientReceiveAction(module: string, tenantID: string, chargeBoxID: string,
      action: ServerAction, detailedMessages: any): Promise<void> {
    await this.traceChargingStationActionEnd(module, tenantID, chargeBoxID, action, detailedMessages, '>>');
  }

  public static async logChargingStationServerReceiveAction(module: string, tenantID: string, chargeBoxID: string,
      action: ServerAction, payload: any): Promise<void> {
    await this.traceChargingStationActionStart(module, tenantID,chargeBoxID, action, payload, '>>');
  }

  public static async logChargingStationServerRespondAction(module: string, tenantID: string, chargeBoxID: string,
      action: ServerAction, detailedMessages: any): Promise<void> {
    await this.traceChargingStationActionEnd(module, tenantID, chargeBoxID, action, detailedMessages, '<<');
  }

  // Used to log exception in catch(...) only
  public static async logException(error: Error, action: ServerAction, source: string,
      module: string, method: string, tenantID: string, user?: UserToken|User|string): Promise<void> {
    const log: Log = Logging._buildLog(error, action, source, module, method, tenantID, user);
    if (error instanceof AppAuthError) {
      await Logging.logSecurityError(log);
    } else if (error instanceof AppError) {
      await Logging.logError(log);
    } else if (error instanceof BackendError) {
      await Logging.logError(log);
    } else {
      await Logging.logError(log);
    }
  }

  // Used to log exception in catch(...) only
  public static async logActionExceptionMessage(tenantID: string, action: ServerAction, exception: Error): Promise<void> {
    // Log App Error
    if (exception instanceof AppError) {
      await Logging._logActionAppExceptionMessage(tenantID, action, exception);
    // Log Backend Error
    } else if (exception instanceof BackendError) {
      await Logging._logActionBackendExceptionMessage(tenantID, action, exception);
    // Log Auth Error
    } else if (exception instanceof AppAuthError) {
      await Logging._logActionAppAuthExceptionMessage(tenantID, action, exception);
    } else {
      await Logging._logActionExceptionMessage(tenantID, action, exception);
    }
  }

  // Used to log exception in catch(...) only
  public static async logActionExceptionMessageAndSendResponse(action: ServerAction, exception: Error,
      req: Request, res: Response, next: NextFunction, tenantID = Constants.DEFAULT_TENANT): Promise<void> {
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
      await Logging._logActionAppExceptionMessage(tenantID, action, exception);
      statusCode = exception.params.errorCode;
    // Log Backend Error
    } else if (exception instanceof BackendError) {
      await Logging._logActionBackendExceptionMessage(tenantID, action, exception);
      statusCode = HTTPError.GENERAL_ERROR;
    // Log Auth Error
    } else if (exception instanceof AppAuthError) {
      await Logging._logActionAppAuthExceptionMessage(tenantID, action, exception);
      statusCode = exception.params.errorCode;
    } else {
      await Logging._logActionExceptionMessage(tenantID, action, exception);
    }
    // Send error
    res.status(statusCode ? statusCode : HTTPError.GENERAL_ERROR).send({
      'message': Utils.hideShowMessage(exception.message)
    });
    next();
  }

  private static async _logActionExceptionMessage(tenantID: string, action: ServerAction, exception: any): Promise<void> {
    // Log
    await Logging.logError({
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

  private static async _logActionAppExceptionMessage(tenantID: string, action: ServerAction, exception: AppError): Promise<void> {
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
    await Logging.logError({
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

  private static async _logActionBackendExceptionMessage(tenantID: string, action: ServerAction, exception: BackendError): Promise<void> {
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
    await Logging.logError({
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
  private static async _logActionAppAuthExceptionMessage(tenantID: string, action: ServerAction, exception: AppAuthError): Promise<void> {
    // Log
    await Logging.logSecurityError({
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
  private static async _log(log: Log): Promise<string> {
    let moduleConfig = null;
    // Check Log Level
    const loggingConfig = Logging.getConfiguration();
    // Default Log Level
    let logLevel = loggingConfig.logLevel ? loggingConfig.logLevel : LogLevel.DEBUG;
    // Module Provided?
    if (log.module && loggingConfig.moduleDetails) {
      // Yes: Check the Module
      if (loggingConfig.moduleDetails[log.module]) {
        // Get Modules Config
        moduleConfig = loggingConfig.moduleDetails[log.module];
        // Check Module Log Level
        if (moduleConfig.logLevel) {
          if (moduleConfig.logLevel !== LogLevel.DEFAULT) {
            logLevel = moduleConfig.logLevel;
          }
        }
      }
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
    log.source = log.source ?? `${Constants.CENTRAL_SERVER}`;
    // Host
    log.host = Utils.getHostname();
    // Process
    log.process = log.process ? log.process : (cluster.isWorker ? 'worker ' + cluster.worker.id.toString() : 'master');
    // Check
    if (log.detailedMessages) {
      // Anonymize message
      if (!Utils.isDevelopmentEnv()) {
        log.detailedMessages = Utils.cloneObject(log.detailedMessages);
        log.detailedMessages = await Logging.anonymizeSensitiveData(log.detailedMessages);
      }
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
    // Log in Cloud Foundry
    if (Configuration.isCloudFoundry()) {
      // Bind to express app
      CFLog.logMessage(Logging.getCFLogLevel(log.level), log.message);
    }
    // Log
    return LoggingStorage.saveLog(log.tenantID, log);
  }

  private static async anonymizeSensitiveData(message: any): Promise<any> {
    if (!message || typeof message === 'number' || Utils.isBoolean(message) || typeof message === 'function') {
      return message;
    } else if (typeof message === 'string') { // If the message is a string
      // Check if it is a query string
      const dataParts: string[] = message.split('&');
      if (dataParts.length > 1) {
        for (let i = 0; i < dataParts.length; i++) {
          const dataPart = dataParts[i];
          for (const sensitiveData of Constants.SENSITIVE_DATA) {
            if (dataPart.toLowerCase().startsWith(sensitiveData.toLocaleLowerCase())) {
              // Anonymize each query string part
              dataParts[i] = dataPart.substring(0, sensitiveData.length + 1) + Constants.ANONYMIZED_VALUE;
            }
          }
        }
        message = dataParts.join('&');
        return message;
      }
      // Check if the message is a string which contains sensitive data
      for (const sensitiveData of Constants.SENSITIVE_DATA) {
        if (message.toLowerCase().indexOf(sensitiveData.toLowerCase()) !== -1) {
          // Anonymize the whole message
          return Constants.ANONYMIZED_VALUE;
        }
      }
      return message;
    } else if (Array.isArray(message)) { // If the message is an array, apply the anonymizeSensitiveData function for each item
      const anonymizedMessage = [];
      for (const item of message) {
        anonymizedMessage.push(await Logging.anonymizeSensitiveData(item));
      }
      return anonymizedMessage;
    } else if (typeof message === 'object') { // If the message is an object
      for (const key of Object.keys(message)) {
        if (typeof message[key] === 'string' && Constants.SENSITIVE_DATA.filter((sensitiveData) => key.toLocaleLowerCase() === sensitiveData.toLocaleLowerCase()).length > 0) {
          // If the key indicates sensitive data and the value is a string, Anonymize the value
          message[key] = Constants.ANONYMIZED_VALUE;
        } else { // Otherwise, apply the anonymizeSensitiveData function
          message[key] = await Logging.anonymizeSensitiveData(message[key]);
        }
      }
      return message;
    }
    // Log
    await Logging.logError({
      tenantID: Constants.DEFAULT_TENANT,
      type: LogType.SECURITY,
      module: MODULE_NAME,
      method: 'anonymizeSensitiveData',
      action: ServerAction.LOGGING,
      message: 'No matching object type for log message anonymisation',
      detailedMessages: { message: message }
    });
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

  private static async traceChargingStationActionStart(module: string, tenantID: string, chargeBoxID: string,
      action: ServerAction, args: any, direction: '<<'|'>>'): Promise<void> {
    // Keep duration
    Logging.traceCalls[`${chargeBoxID}~action`] = new Date().getTime();
    // Log
    await Logging.logDebug({
      tenantID: tenantID,
      source: chargeBoxID,
      module: module, method: action, action,
      message: `${direction} OCPP Request '${action}' ${direction === '>>' ? 'received' : 'sent'}`,
      detailedMessages: { args }
    });
  }

  private static async traceChargingStationActionEnd(module: string, tenantID: string, chargeBoxID: string,
      action: ServerAction, detailedMessages: any, direction: '<<'|'>>'): Promise<void> {
    // Compute duration if provided
    let executionDurationMillis: number;
    let found = false;
    if (Logging.traceCalls[`${chargeBoxID}~action`]) {
      executionDurationMillis = (new Date().getTime() - Logging.traceCalls[`${chargeBoxID}~action`]);
      delete Logging.traceCalls[`${chargeBoxID}~action`];
      found = true;
    }
    const message = `${direction} OCPP Request '${action}' on '${chargeBoxID}' has been processed ${found ? 'in ' + executionDurationMillis.toString() + 'ms' : ''}`;
    Utils.isDevelopmentEnv() && console.debug(chalk.green(message));
    if (executionDurationMillis > Constants.PERF_MAX_RESPONSE_TIME_MILLIS) {
      const error = new Error(`Execution must be < ${Constants.PERF_MAX_RESPONSE_TIME_MILLIS}ms, got ${executionDurationMillis}ms`);
      await Logging.logError({
        tenantID,
        source: Constants.CENTRAL_SERVER,
        action: ServerAction.PERFORMANCES,
        module, method: 'traceChargingStationActionEnd',
        message: `${message}: ${error.message}`,
        detailedMessages: { error: error.message, stack: error.stack }
      });
      if (Utils.isDevelopmentEnv()) {
        console.error(chalk.red('===================================='));
        console.error(chalk.red(`Tenant ID '${tenantID}'`));
        console.error(chalk.red(error));
        console.error(chalk.red(message));
        console.error(chalk.red('===================================='));
      }
    }
    if (detailedMessages && detailedMessages['status'] && detailedMessages['status'] === OCPPStatus.REJECTED) {
      await Logging.logError({
        tenantID,
        source: chargeBoxID,
        module, method: action, action,
        message, detailedMessages
      });
    } else {
      await Logging.logDebug({
        tenantID,
        source: chargeBoxID,
        module, method: action, action,
        message, detailedMessages
      });
    }
    await PerformanceStorage.savePerformanceRecord(
      Utils.buildPerformanceRecord({
        tenantID,
        durationMs: executionDurationMillis,
        source: Constants.OCPP_SERVER,
        module: module, method: 'traceChargingStationActionEnd',
        action,
      })
    );
  }
}
