import { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';
import { Log, LogLevel } from '../types/Log';
import { NextFunction, Request, Response } from 'express';
import PerformanceRecord, { PerformanceRecordGroup, PerformanceTracingData } from '../types/Performance';

import { ActionsResponse } from '../types/GlobalType';
import AppAuthError from '../exception/AppAuthError';
import AppError from '../exception/AppError';
import BackendError from '../exception/BackendError';
import Configuration from '../utils/Configuration';
import Constants from './Constants';
import { HTTPError } from '../types/HTTPError';
import LogConfiguration from '../types/configuration/LogConfiguration';
import LogStorage from '../storage/mongodb/LogStorage';
import { OCPIResult } from '../types/ocpi/OCPIResult';
import OCPPError from '../exception/OcppError';
import { OCPPStatus } from '../types/ocpp/OCPPClient';
import { OICPResult } from '../types/oicp/OICPResult';
import PerformanceStorage from '../storage/mongodb/PerformanceStorage';
import { ServerAction } from '../types/Server';
import Tenant from '../types/Tenant';
import TraceConfiguration from '../types/configuration/TraceConfiguration';
import User from '../types/User';
import UserToken from '../types/UserToken';
import Utils from './Utils';
import chalk from 'chalk';
import sizeof from 'object-sizeof';

const MODULE_NAME = 'Logging';

export default class Logging {
  private static logConfig: LogConfiguration;
  private static traceConfig: TraceConfiguration;

  public static getConfiguration(): LogConfiguration {
    if (!this.logConfig) {
      this.logConfig = Configuration.getLogConfig();
    }
    return this.logConfig;
  }

  public static getTraceConfiguration(): TraceConfiguration {
    if (!this.traceConfig) {
      this.traceConfig = Configuration.getTraceConfig();
    }
    return this.traceConfig;
  }

  public static traceDatabaseRequestStart(): number {
    if (Logging.getTraceConfiguration().traceDatabase) {
      return Date.now();
    }
  }

  public static async traceDatabaseRequestEnd(tenant: Tenant, module: string, method: string, timeStartMillis: number, request: any, response: any = {}): Promise<void> {
    if (Logging.getTraceConfiguration().traceDatabase) {
      // Compute duration if provided
      const executionDurationMillis = new Date().getTime() - timeStartMillis;
      const sizeOfRequestDataKB = Utils.truncTo(Utils.createDecimal(
        sizeof(request)).div(1024).toNumber(), 2);
      const sizeOfResponseDataKB = Utils.truncTo(Utils.createDecimal(
        sizeof(response)).div(1024).toNumber(), 2);
      const numberOfRecords = Array.isArray(response) ? response.length : 0;
      const message = `${module}.${method} - ${executionDurationMillis.toString()} ms - Req ${sizeOfRequestDataKB} KB - Res ${(sizeOfResponseDataKB > 0) ? sizeOfResponseDataKB : '?'} KB - ${numberOfRecords.toString()} rec(s)`;
      Utils.isDevelopmentEnv() && Logging.logConsoleInfo(message);
      if (sizeOfResponseDataKB > Constants.PERF_MAX_DATA_VOLUME_KB) {
        const error = new Error(`Data must be < ${Constants.PERF_MAX_DATA_VOLUME_KB}KB, got ${sizeOfResponseDataKB}KB`);
        await Logging.logWarning({
          tenantID: tenant.id,
          action: ServerAction.PERFORMANCES,
          module, method,
          message: `${message}: ${error.message}`,
          detailedMessages: { error: error.stack }
        });
        if (Utils.isDevelopmentEnv()) {
          Logging.logConsoleWarning('====================================');
          Logging.logConsoleWarning(`Tenant ID '${tenant.id ? tenant.id : Constants.DEFAULT_TENANT_ID}'`);
          Logging.logConsoleWarning(error.stack);
          Logging.logConsoleWarning(message);
          Logging.logConsoleWarning('====================================');
        }
      }
      if (executionDurationMillis > Constants.PERF_MAX_RESPONSE_TIME_MILLIS) {
        const error = new Error(`Execution must be < ${Constants.PERF_MAX_RESPONSE_TIME_MILLIS} ms`);
        await Logging.logWarning({
          tenantID: tenant.id,
          action: ServerAction.PERFORMANCES,
          module, method,
          message: `${message}: ${error.message}`,
          detailedMessages: { error: error.stack }
        });
        if (Utils.isDevelopmentEnv()) {
          Logging.logConsoleWarning('====================================');
          Logging.logConsoleWarning(`Tenant ID '${tenant.id ? tenant.id : Constants.DEFAULT_TENANT_ID}'`);
          Logging.logConsoleWarning(error.stack);
          Logging.logConsoleWarning(message);
          Logging.logConsoleWarning('====================================');
        }
      }
      if ((global.monitoringServer) && (process.env.K8S)) {
        const labels = { tenant: tenant.subdomain, module: module, method: method };
        const values = Object.values(labels).toString();
        const hashCode = Utils.positiveHashcode(values);
        const durationMetric = global.monitoringServer.getComposedMetric('mongodb', 'Duration', hashCode, 'db duration', Object.keys(labels));
        durationMetric.setValue(labels, executionDurationMillis);
        const requestSizeMetric = global.monitoringServer.getComposedMetric('mongodb', 'RequestSize', hashCode, 'db duration', Object.keys(labels));
        requestSizeMetric.setValue(labels, sizeOfRequestDataKB);
        const responseSizeMetric = global.monitoringServer.getComposedMetric('mongodb', 'ResponseSize', hashCode, 'db duration', Object.keys(labels));
        responseSizeMetric.setValue(labels, sizeOfResponseDataKB);
      }
      await PerformanceStorage.savePerformanceRecord(
        Utils.buildPerformanceRecord({
          tenantSubdomain: tenant.subdomain,
          group: PerformanceRecordGroup.MONGO_DB,
          durationMs: executionDurationMillis,
          reqSizeKb: sizeOfRequestDataKB,
          resSizeKb: sizeOfResponseDataKB,
          egress: true,
          action: `${module}.${method}`
        })
      );
    }
  }

  public static traceNotificationStart(): number {
    if (Logging.getTraceConfiguration().traceNotification) {
      return Date.now();
    }
  }

  public static async traceNotificationEnd(tenant: Tenant, module: string, method: string, timeStartMillis: number,
      templateName: string, data: any, userID: string): Promise<void> {
    if (Logging.getTraceConfiguration().traceNotification) {
      // Compute duration if provided
      const executionDurationMillis = new Date().getTime() - timeStartMillis;
      const sizeOfRequestDataKB = Utils.truncTo(Utils.createDecimal(
        sizeof(data)).div(1024).toNumber(), 2);
      const message = `${module}.${method} - ${templateName} - ${executionDurationMillis.toString()} ms - Data ${sizeOfRequestDataKB} KB`;
      Utils.isDevelopmentEnv() && Logging.logConsoleInfo(message);
      if (executionDurationMillis > Constants.PERF_MAX_RESPONSE_TIME_MILLIS) {
        const error = new Error(`Execution must be < ${Constants.PERF_MAX_RESPONSE_TIME_MILLIS} ms`);
        await Logging.logWarning({
          tenantID: tenant.id,
          action: ServerAction.PERFORMANCES,
          module, method,
          message: `${message}: ${error.message}`,
          detailedMessages: { error: error.stack }
        });
        if (Utils.isDevelopmentEnv()) {
          Logging.logConsoleWarning('====================================');
          Logging.logConsoleWarning(`Tenant ID '${tenant.id ? tenant.id : Constants.DEFAULT_TENANT_ID}'`);
          Logging.logConsoleWarning(error.stack);
          Logging.logConsoleWarning(message);
          Logging.logConsoleWarning('====================================');
        }
      }
      await PerformanceStorage.savePerformanceRecord(
        Utils.buildPerformanceRecord({
          tenantSubdomain: tenant.subdomain,
          group: PerformanceRecordGroup.NOTIFICATION,
          durationMs: executionDurationMillis,
          reqSizeKb: sizeOfRequestDataKB,
          resSizeKb: 0,
          egress: true,
          action: `${module}.${method}.${templateName}`,
          userID
        })
      );
    }
  }

  public static async logDebug(log: Log): Promise<string> {
    log.level = LogLevel.DEBUG;
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    return Logging.log(log);
  }

  public static async logInfo(log: Log): Promise<string> {
    log.level = LogLevel.INFO;
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    return Logging.log(log);
  }

  public static async logWarning(log: Log): Promise<string> {
    log.level = LogLevel.WARNING;
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    return Logging.log(log);
  }

  public static async logError(log: Log): Promise<string> {
    log.level = LogLevel.ERROR;
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    return Logging.log(log);
  }

  public static logConsoleError(message: string): void {
    console.error(chalk.red(`${new Date().toLocaleString()} - ${message}`));
  }

  public static logConsoleWarning(message: string): void {
    console.warn(chalk.yellow(`${new Date().toLocaleString()} - ${message}`));
  }

  public static logConsoleInfo(message: string): void {
    console.info(chalk.green(`${new Date().toLocaleString()} - ${message}`));
  }

  public static logConsoleDebug(message: string): void {
    console.info(chalk.gray(`${new Date().toLocaleString()} - ${message}`));
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
        action, module, method,
        message: messageSuccessAndError
      });
      Utils.isDevelopmentEnv() && Logging.logConsoleError(messageSuccessAndError);
    } else if (actionsResponse.inSuccess > 0) {
      await Logging.logInfo({
        tenantID: tenantID,
        user,
        action, module, method,
        message: messageSuccess
      });
      Utils.isDevelopmentEnv() && Logging.logConsoleInfo(messageSuccess);
    } else if (actionsResponse.inError > 0) {
      await Logging.logError({
        tenantID: tenantID,
        user,
        action, module, method,
        message: messageError
      });
      Utils.isDevelopmentEnv() && Logging.logConsoleError(messageError);
    } else {
      await Logging.logInfo({
        tenantID: tenantID,
        user,
        action, module, method,
        message: messageNoSuccessNoError
      });
      Utils.isDevelopmentEnv() && Logging.logConsoleInfo(messageNoSuccessNoError);
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
        action, module, method,
        message: messageSuccessAndError,
        detailedMessages: ocpiResult.logs
      });
      Utils.isDevelopmentEnv() && Logging.logConsoleError(messageSuccessAndError);
    } else if (ocpiResult.success > 0) {
      await Logging.logInfo({
        tenantID: tenantID,
        action, module, method,
        message: messageSuccess,
        detailedMessages: ocpiResult.logs
      });
      Utils.isDevelopmentEnv() && Logging.logConsoleInfo(messageSuccess);
    } else if (ocpiResult.failure > 0) {
      await Logging.logError({
        tenantID: tenantID,
        action, module, method,
        message: messageError,
        detailedMessages: ocpiResult.logs
      });
      Utils.isDevelopmentEnv() && Logging.logConsoleError(messageError);
    } else {
      await Logging.logInfo({
        tenantID: tenantID,
        action, module, method,
        message: messageNoSuccessNoError,
        detailedMessages: ocpiResult.logs
      });
      Utils.isDevelopmentEnv() && Logging.logConsoleError(messageNoSuccessNoError);
    }
  }

  public static async logOicpResult(tenantID: string, action: ServerAction, module: string, method: string, oicpResult: OICPResult,
      messageSuccess: string, messageError: string, messageSuccessAndError: string, messageNoSuccessNoError: string): Promise<void> {
    await Logging.logOcpiResult(tenantID, action, module, method, oicpResult,
      messageSuccess, messageError, messageSuccessAndError, messageNoSuccessNoError);
  }

  public static async traceExpressRequest(req: Request, res: Response, next: NextFunction, action?: ServerAction): Promise<void> {
    if (Logging.getTraceConfiguration().traceIngressHttp) {
      try {
        // Get Tenant info
        let userID: string;
        let tenantID: string;
        let tenantSubdomain: string;
        // Keep date/time
        req['timestamp'] = new Date();
        // Check Tenant
        if (req.tenant) {
          const tenant = req.tenant;
          tenantID = tenant.id;
          tenantSubdomain = tenant.subdomain;
        }
        // Check User
        if (req.user) {
          const user = req.user;
          userID = user.id;
        }
        // Clear Default Tenant
        if (tenantID === Constants.DEFAULT_TENANT_ID) {
          tenantID = null;
        }
        // Keep Tenant in request
        req['tenantID'] = tenantID;
        req['tenantSubdomain'] = tenantSubdomain;
        // Compute Length
        const sizeOfRequestDataKB = Utils.truncTo(Utils.createDecimal(
          sizeof({ headers: req.headers, query: req.query, body: req.body })
        ).div(1024).toNumber(), 2);
        const performanceID = await PerformanceStorage.savePerformanceRecord(
          Utils.buildPerformanceRecord({
            tenantSubdomain,
            group: Utils.getPerformanceRecordGroupFromURL(req.originalUrl),
            httpUrl: req.url,
            httpMethod: req.method,
            egress: false,
            reqSizeKb: sizeOfRequestDataKB,
            action: ServerAction.HTTP_REQUEST,
          })
        );
        const message = `Express HTTP Request - '${Utils.last5Chars(performanceID)}' << Req ${(sizeOfRequestDataKB > 0) ? sizeOfRequestDataKB : '?'} KB << ${req.method} '${req.url}'`;
        Utils.isDevelopmentEnv() && Logging.logConsoleInfo(message);
        await Logging.logDebug({
          tenantID,
          action: action ?? ServerAction.HTTP_REQUEST,
          user: userID,
          message,
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
        req['performanceID'] = performanceID;
      } finally {
        // Express call does not provide action
        if (!action) {
          next();
        }
      }
      // Express call does not provide action
    } else if (!action) {
      next();
    }
  }

  public static traceExpressResponse(req: Request, res: Response, next: NextFunction, action?: ServerAction): void {
    if (Logging.getTraceConfiguration().traceIngressHttp) {
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      res.on('finish', async () => {
        // Get Tenant info
        const tenantID = req['tenantID'] as string;
        // Compute duration
        let executionDurationMillis = 0;
        if (req['timestamp']) {
          executionDurationMillis = (new Date().getTime() - req['timestamp'].getTime());
        }
        let sizeOfResponseDataKB = 0;
        if (res.getHeader('content-length')) {
          sizeOfResponseDataKB = Utils.truncTo(
            Utils.createDecimal(res.getHeader('content-length') as number).div(1024).toNumber(), 2);
        }
        const message = `Express HTTP Response ${req['performanceID'] ? '- \'' + Utils.last5Chars(req['performanceID']) + '\' ' : ''}>> ${(executionDurationMillis > 0) ? executionDurationMillis : '?'} ms - Res ${(sizeOfResponseDataKB > 0) ? sizeOfResponseDataKB : '?'} KB >> ${req.method}/${res.statusCode} '${req.url}'`;
        Utils.isDevelopmentEnv() && Logging.logConsoleInfo(message);
        if (sizeOfResponseDataKB > Constants.PERF_MAX_DATA_VOLUME_KB) {
          const error = new Error(`Data must be < ${Constants.PERF_MAX_DATA_VOLUME_KB} KB, got ${(sizeOfResponseDataKB > 0) ? sizeOfResponseDataKB : '?'} KB`);
          await Logging.logWarning({
            tenantID,
            action: ServerAction.PERFORMANCES,
            module: MODULE_NAME, method: 'logExpressResponse',
            message: `${message}: ${error.message}`,
            detailedMessages: { error: error.stack }
          });
          if (Utils.isDevelopmentEnv()) {
            Logging.logConsoleWarning('====================================');
            Logging.logConsoleWarning(`Tenant ID '${tenantID ? tenantID : Constants.DEFAULT_TENANT_ID}'`);
            Logging.logConsoleWarning(error.stack);
            Logging.logConsoleWarning(message);
            Logging.logConsoleWarning('====================================');
          }
        }
        if (executionDurationMillis > Constants.PERF_MAX_RESPONSE_TIME_MILLIS) {
          const error = new Error(`Execution must be < ${Constants.PERF_MAX_RESPONSE_TIME_MILLIS} ms, got ${(executionDurationMillis > 0) ? executionDurationMillis : '?'} ms`);
          await Logging.logWarning({
            tenantID,
            action: ServerAction.PERFORMANCES,
            module: MODULE_NAME, method: 'logExpressResponse',
            message: `${message}: ${error.message}`,
            detailedMessages: { error: error.stack }
          });
          if (Utils.isDevelopmentEnv()) {
            Logging.logConsoleWarning('====================================');
            Logging.logConsoleWarning(`Tenant ID '${tenantID ? tenantID : Constants.DEFAULT_TENANT_ID}'`);
            Logging.logConsoleWarning(error.stack);
            Logging.logConsoleWarning(message);
            Logging.logConsoleWarning('====================================');
          }
        }
        await Logging.logDebug({
          tenantID: tenantID,
          user: req.user,
          action: action ?? ServerAction.HTTP_RESPONSE,
          message,
          module: MODULE_NAME, method: 'logExpressResponse',
          detailedMessages: {
            request: req.url,
            status: res.statusCode,
            statusMessage: res.statusMessage,
            headers: res.getHeaders(),
          }
        });
        if (req['performanceID']) {
          const performanceRecord = {
            id: req['performanceID'],
            httpResponseCode: res.statusCode,
            durationMs: executionDurationMillis,
            resSizeKb: sizeOfResponseDataKB,
          } as PerformanceRecord;
          await PerformanceStorage.updatePerformanceRecord(performanceRecord);
        }
      });
    }
    // Express call does not provide action
    if (!action) {
      next();
    }
  }

  public static async traceExpressError(error: Error, req: Request, res: Response, next: NextFunction): Promise<void> {
    await Logging.logActionExceptionMessageAndSendResponse(
      error['params'] && error['params']['action'] ? error['params']['action'] : ServerAction.HTTP_ERROR, error, req, res, next);
    if (Logging.getTraceConfiguration().traceIngressHttp) {
      // Nothing done yet
    }
  }

  public static async traceAxiosRequest(tenant: Tenant, request: AxiosRequestConfig): Promise<void> {
    if (Logging.getTraceConfiguration().traceEgressHttp) {
      request['timestamp'] = new Date();
      // Compute Length
      const sizeOfRequestDataKB = Utils.truncTo(Utils.createDecimal(
        sizeof(request)).div(1024).toNumber(), 2);
      const performanceID = await PerformanceStorage.savePerformanceRecord(
        Utils.buildPerformanceRecord({
          tenantSubdomain: tenant.subdomain,
          group: Utils.getPerformanceRecordGroupFromURL(request.url),
          httpUrl: request.url,
          httpMethod: request.method.toLocaleUpperCase(),
          egress: true,
          reqSizeKb: sizeOfRequestDataKB,
          action: Utils.getAxiosActionFromURL(request.url),
        })
      );
      const message = `Axios HTTP Request - '${Utils.last5Chars(performanceID)}' >> Req ${(sizeOfRequestDataKB > 0) ? sizeOfRequestDataKB : '?'} KB - ${request.method.toLocaleUpperCase()} '${request.url}'`;
      Utils.isDevelopmentEnv() && Logging.logConsoleInfo(message);
      await Logging.logDebug({
        tenantID: tenant.id,
        action: Utils.getAxiosActionFromURL(request.url),
        module: Constants.MODULE_AXIOS, method: 'interceptor',
        message,
        detailedMessages: {
          request: Utils.cloneObject(request),
        }
      });
      request['performanceID'] = performanceID;
    }
  }

  public static async traceAxiosResponse(tenant: Tenant, response: AxiosResponse): Promise<void> {
    if (Logging.getTraceConfiguration().traceEgressHttp) {
      // Compute duration
      let executionDurationMillis: number;
      if (response.config['timestamp']) {
        executionDurationMillis = (new Date().getTime() - response.config['timestamp'].getTime());
      }
      // Compute Length
      let sizeOfResponseDataKB = 0;
      if (response.config.headers['Content-Length']) {
        sizeOfResponseDataKB = Utils.truncTo(
          Utils.createDecimal(Utils.convertToInt(response.config.headers['Content-Length'])).div(1024).toNumber(), 2);
      } else if (response.data) {
        sizeOfResponseDataKB = Utils.truncTo(
          Utils.createDecimal(sizeof(response.data)).div(1024).toNumber(), 2);
      }
      const message = `Axios HTTP Response ${response.config['performanceID'] ? '- \'' + Utils.last5Chars(response.config['performanceID']) + '\' ' : ''}<< ${(executionDurationMillis > 0) ? executionDurationMillis : '?'} ms - Res ${(sizeOfResponseDataKB > 0) ? sizeOfResponseDataKB : '?'} KB << ${response.config.method.toLocaleUpperCase()}/${response.status} '${response.config.url}'`;
      Utils.isDevelopmentEnv() && Logging.logConsoleInfo(message);
      if (sizeOfResponseDataKB > Constants.PERF_MAX_DATA_VOLUME_KB) {
        const error = new Error(`Data must be < ${Constants.PERF_MAX_DATA_VOLUME_KB}`);
        await Logging.logWarning({
          tenantID: tenant.id,
          action: ServerAction.PERFORMANCES,
          module: Constants.MODULE_AXIOS, method: 'logAxiosResponse',
          message: `${message}: ${error.message}`,
          detailedMessages: { error: error.stack }
        });
        if (Utils.isDevelopmentEnv()) {
          Logging.logConsoleWarning('====================================');
          Logging.logConsoleWarning(`Tenant ID '${tenant.id ? tenant.id : Constants.DEFAULT_TENANT_ID}'`);
          Logging.logConsoleWarning(error.stack);
          Logging.logConsoleWarning(message);
          Logging.logConsoleWarning('====================================');
        }
      }
      if (executionDurationMillis > Constants.PERF_MAX_RESPONSE_TIME_MILLIS) {
        const error = new Error(`Execution must be < ${Constants.PERF_MAX_RESPONSE_TIME_MILLIS} ms, got ${(executionDurationMillis > 0) ? executionDurationMillis : '?'} ms`);
        await Logging.logWarning({
          tenantID: tenant.id,
          action: ServerAction.PERFORMANCES,
          module: Constants.MODULE_AXIOS, method: 'logAxiosResponse',
          message: `${message}: ${error.message}`,
          detailedMessages: { error: error.stack }
        });
        if (Utils.isDevelopmentEnv()) {
          Logging.logConsoleWarning('====================================');
          Logging.logConsoleWarning(`Tenant ID '${tenant.id ? tenant.id : Constants.DEFAULT_TENANT_ID}'`);
          Logging.logConsoleWarning(error.stack);
          Logging.logConsoleWarning(message);
          Logging.logConsoleWarning('====================================');
        }
      }
      try {
        await Logging.logDebug({
          tenantID: tenant.id,
          action: Utils.getAxiosActionFromURL(response.config.url),
          message,
          module: Constants.MODULE_AXIOS, method: 'logAxiosResponse',
          detailedMessages: {
            status: response.status,
            statusText: response.statusText,
            request: Utils.cloneObject(response.config),
            headers: Utils.cloneObject(response.headers),
            response: Utils.cloneObject(response.data)
          }
        });
        if (response.config['performanceID']) {
          const performanceRecord = {
            id: response.config['performanceID'],
            httpResponseCode: response.status,
            durationMs: executionDurationMillis,
            resSizeKb: sizeOfResponseDataKB,
          } as PerformanceRecord;
          await PerformanceStorage.updatePerformanceRecord(performanceRecord);
        }
      } catch (error) {
        await Logging.logDebug({
          tenantID: tenant.id,
          action: Utils.getAxiosActionFromURL(response.config.url),
          message: `Axios HTTP Response - ${(executionDurationMillis > 0) ? executionDurationMillis : '?'} ms - Res ${(sizeOfResponseDataKB > 0) ? sizeOfResponseDataKB : '?'} KB << ${response.config.method.toLocaleUpperCase()}/${response.status} '${response.config.url}'`,
          module: Constants.MODULE_AXIOS, method: 'logAxiosResponse',
          detailedMessages: {
            status: response.status,
            statusText: response.statusText
          }
        });
      }
    }
  }

  public static async traceAxiosError(tenant: Tenant, error: AxiosError): Promise<void> {
    // Error handling is done outside to get the proper module information
    await Logging.logError({
      tenantID: tenant.id,
      action: Utils.getAxiosActionFromURL(error.config.url),
      message: `Axios HTTP Error >> ${error.config?.method?.toLocaleUpperCase()}/${error.response?.status} '${error.config?.url}' - ${error.message}`,
      module: Constants.MODULE_AXIOS, method: 'interceptor',
      detailedMessages: {
        url: error.config?.url,
        status: error.response?.status,
        statusText: error.response?.statusText,
        message: error.message,
        response: error.response?.data,
        axiosError: Utils.objectHasProperty(error, 'toJSON') ? error.toJSON() : null,
      }
    });
    if (Logging.getTraceConfiguration().traceEgressHttp) {
      if (error.response?.config['performanceID']) {
        let executionDurationMillis: number;
        let sizeOfResponseDataKB = 0;
        if (error.response?.config['timestamp']) {
          executionDurationMillis = (new Date().getTime() - error.response?.config['timestamp'].getTime());
        }
        if (error.response?.data) {
          sizeOfResponseDataKB = Utils.truncTo(
            Utils.createDecimal(sizeof(error.response?.data)).div(1024).toNumber(), 2);
        }
        const performanceRecord = {
          id: error.response?.config['performanceID'],
          httpResponseCode: error.response?.status,
          durationMs: executionDurationMillis,
          resSizeKb: sizeOfResponseDataKB,
        } as PerformanceRecord;
        await PerformanceStorage.updatePerformanceRecord(performanceRecord);
      }
    }
  }

  public static async logException(exception: Error, action: ServerAction,
      module: string, method: string, tenantID: string, user?: UserToken | User | string): Promise<void> {
    if (exception instanceof AppAuthError) {
      await Logging.logActionAppAuthException(tenantID, action, exception);
    } else if (exception instanceof AppError) {
      await Logging.logActionAppException(tenantID, action, exception);
    } else if (exception instanceof OCPPError) {
      await Logging.logActionOcppException(tenantID, action, exception);
    } else if (exception instanceof BackendError) {
      await Logging.logActionBackendException(tenantID, action, exception);
    } else {
      await Logging.logError(
        Logging.buildLogError(action, module, method, tenantID, user, exception));
    }
  }

  // Used to log exception in catch(...) only
  public static async logActionExceptionMessage(tenantID: string, action: ServerAction, exception: Error, detailedMessages = {}): Promise<void> {
    if (exception instanceof AppError) {
      await Logging.logActionAppException(tenantID, action, exception, detailedMessages);
    } else if (exception instanceof BackendError) {
      await Logging.logActionBackendException(tenantID, action, exception, detailedMessages);
    } else if (exception instanceof AppAuthError) {
      await Logging.logActionAppAuthException(tenantID, action, exception, detailedMessages);
    } else if (exception instanceof OCPPError) {
      await Logging.logActionOcppException(tenantID, action, exception);
    } else {
      await Logging.logActionException(tenantID, action, exception, detailedMessages);
    }
  }

  // Used to log exception in catch(...) only
  public static async logActionExceptionMessageAndSendResponse(action: ServerAction, exception: Error,
      req: Request, res: Response, next: NextFunction, tenantID = Constants.DEFAULT_TENANT_ID): Promise<void> {
    // Clear password
    if (action === ServerAction.LOGIN && req.body.password) {
      req.body.password = '####';
    }
    if (req.user?.tenantID) {
      tenantID = req.user.tenantID;
    } else if (req.tenant?.id) {
      // AuthRouter endpoints throw errors with no user token
      tenantID = req.tenant.id;
    }
    if (exception instanceof AppError) {
      await Logging.logActionAppException(tenantID, action, exception);
    } else if (exception instanceof BackendError) {
      await Logging.logActionBackendException(tenantID, action, exception);
    } else if (exception instanceof AppAuthError) {
      await Logging.logActionAppAuthException(tenantID, action, exception);
    } else if (exception instanceof OCPPError) {
      await Logging.logActionOcppException(tenantID, action, exception);
    } else {
      await Logging.logActionException(tenantID, action, exception);
    }
    // Send error
    if (!res.headersSent) {
      const errorCode = exception['params'] && exception['params']['errorCode'] ?
        exception['params']['errorCode'] : HTTPError.GENERAL_ERROR;
      res.status(errorCode)
        .send({
          errorCode,
          errorMessage: exception.message,
          errorDetailedMessage: exception['params'] ? exception['params']['detailedMessages'] : null,
        });
    }
    next();
  }

  public static async traceOcppMessageRequest(module: string, tenant: Tenant, chargingStationID: string,
      action: ServerAction, request: any, direction: '<<' | '>>',
      chargingStationDetails: { siteID: string; siteAreaID: string; companyID: string; }): Promise<PerformanceTracingData> {
    if (Logging.getTraceConfiguration().traceOcpp) {
      // Compute size
      const sizeOfRequestDataKB = Utils.truncTo(Utils.createDecimal(
        sizeof(request)).div(1024).toNumber(), 2);
      const performanceID = await PerformanceStorage.savePerformanceRecord(
        Utils.buildPerformanceRecord({
          tenantSubdomain: tenant.subdomain,
          chargingStationID,
          group: PerformanceRecordGroup.OCPP,
          reqSizeKb: sizeOfRequestDataKB,
          egress: direction === '<<' ? true : false,
          action
        })
      );
      const message = `${direction} OCPP Request '${action}~${Utils.last5Chars(performanceID)}' on '${chargingStationID}' has been ${direction === '>>' ? 'received' : 'sent'} - Req ${sizeOfRequestDataKB} KB`;
      if ((global.monitoringServer) && (process.env.K8S)) {
        const labels = { ocppComand : action, direction: ((direction === '<<') ? 'in' : 'out'), tenant: tenant.subdomain, siteId: chargingStationDetails.siteID, siteAreaID: chargingStationDetails.siteAreaID, companyID: chargingStationDetails.companyID };
        const values = Object.values(labels).toString();
        const hashCode = Utils.positiveHashcode(values);
        const durationMetric = global.monitoringServer.getComposedMetric('ocpp', 'requestSize', hashCode, 'ocpp response time ', Object.keys(labels));
        durationMetric.setValue(labels,sizeOfRequestDataKB);
      }
      Utils.isDevelopmentEnv() && Logging.logConsoleInfo(message);
      await Logging.logDebug({
        tenantID: tenant.id,
        chargingStationID: chargingStationID,
        siteAreaID: chargingStationDetails.siteAreaID,
        siteID: chargingStationDetails.siteID,
        companyID: chargingStationDetails.companyID,
        module: module, method: action, action,
        message, detailedMessages: { request }
      });
      return {
        startTimestamp: Date.now(),
        performanceID
      };
    }
  }

  public static async traceOcppMessageResponse(module: string, tenant: Tenant, chargingStationID: string,
      action: ServerAction, request: any, response: any, direction: '<<' | '>>',
      chargingStationDetails: { siteID: string, siteAreaID: string, companyID: string,}, performanceTracingData?: PerformanceTracingData): Promise<void> {
    if (Logging.getTraceConfiguration().traceOcpp && performanceTracingData) {
      // Compute duration if provided
      const executionDurationMillis = performanceTracingData?.startTimestamp ? Date.now() - performanceTracingData.startTimestamp : 0;
      const sizeOfResponseDataKB = Utils.truncTo(Utils.createDecimal(
        sizeof(response)).div(1024).toNumber(), 2);
      const message = `${direction} OCPP Request '${action}~${Utils.last5Chars(performanceTracingData.performanceID)}' on '${chargingStationID}' has been processed ${executionDurationMillis ? 'in ' + executionDurationMillis.toString() + ' ms' : ''} - Res ${(sizeOfResponseDataKB > 0) ? sizeOfResponseDataKB : '?'} KB`;
      Utils.isDevelopmentEnv() && Logging.logConsoleInfo(message);
      if (executionDurationMillis > Constants.PERF_MAX_RESPONSE_TIME_MILLIS) {
        const error = new Error(`Execution must be < ${Constants.PERF_MAX_RESPONSE_TIME_MILLIS} ms`);
        await Logging.logWarning({
          tenantID: tenant?.id,
          action: ServerAction.PERFORMANCES,
          module, method: 'traceChargingStationActionEnd',
          message: `${message}: ${error.message}`,
          detailedMessages: { error: error.stack }
        });
        if (Utils.isDevelopmentEnv()) {
          Logging.logConsoleWarning('====================================');
          Logging.logConsoleWarning(`Tenant ID '${tenant?.id ? tenant.id : Constants.DEFAULT_TENANT_ID}'`);
          Logging.logConsoleWarning(error.stack);
          Logging.logConsoleWarning(message);
          Logging.logConsoleWarning('====================================');
        }
      }
      if ((global.monitoringServer) && (process.env.K8S)) {
        const labels = { ocppComand : action, direction: ((direction === '<<') ? 'in' : 'out'), tenant: tenant.subdomain, siteId: chargingStationDetails.siteID, siteAreaID: chargingStationDetails.siteAreaID, companyID: chargingStationDetails.companyID };
        const values = Object.values(labels).toString();
        const hashCode = Utils.positiveHashcode(values);
        const durationMetric = global.monitoringServer.getComposedMetric('ocpp', 'responsetime', hashCode, 'ocpp response time ', Object.keys(labels));
        durationMetric.setValue(labels,executionDurationMillis);
      }
      if (response && response['status'] === OCPPStatus.REJECTED) {
        await Logging.logError({
          tenantID: tenant?.id,
          chargingStationID: chargingStationID,
          siteID: chargingStationDetails.siteID,
          siteAreaID: chargingStationDetails.siteAreaID,
          companyID: chargingStationDetails.companyID,
          module, method: action, action,
          message, detailedMessages: response
        });
      } else {
        await Logging.logDebug({
          tenantID: tenant?.id,
          chargingStationID: chargingStationID,
          siteID: chargingStationDetails.siteID,
          siteAreaID: chargingStationDetails.siteAreaID,
          companyID: chargingStationDetails.companyID,
          module, method: action, action,
          message, detailedMessages: response
        });
      }
      if (performanceTracingData?.performanceID) {
        const performanceRecord = {
          id: performanceTracingData.performanceID,
          durationMs: executionDurationMillis,
          resSizeKb: sizeOfResponseDataKB,
        } as PerformanceRecord;
        await PerformanceStorage.updatePerformanceRecord(performanceRecord);
      }
    }
  }

  private static async logActionException(tenantID: string, action: ServerAction, exception: any, detailedMessages = {}): Promise<void> {
    await Logging.logError({
      tenantID: tenantID,
      user: exception.user,
      module: exception.module,
      method: exception.method,
      action: action,
      message: exception.message,
      detailedMessages: { error: exception.stack, ...detailedMessages }
    });
  }

  private static async logActionAppException(tenantID: string, action: ServerAction, exception: AppError, detailedMessages = {}): Promise<void> {
    Utils.handleExceptionDetailedMessages(exception);
    await Logging.logError({
      tenantID: tenantID,
      chargingStationID: exception.params.chargingStationID,
      siteID: exception.params.siteID,
      siteAreaID: exception.params.siteAreaID,
      companyID: exception.params.companyID,
      user: exception.params.user,
      actionOnUser: exception.params.actionOnUser,
      module: exception.params.module,
      method: exception.params.method,
      action: action,
      message: exception.message,
      detailedMessages: {
        ...exception.params.detailedMessages,
        ...detailedMessages
      }
    });
  }

  private static async logActionBackendException(tenantID: string, action: ServerAction, exception: BackendError, detailedMessages = {}): Promise<void> {
    Utils.handleExceptionDetailedMessages(exception);
    await Logging.logError({
      tenantID: tenantID,
      chargingStationID: exception.params.chargingStationID,
      siteID: exception.params.siteID,
      siteAreaID: exception.params.siteAreaID,
      companyID: exception.params.companyID,
      module: exception.params.module,
      method: exception.params.method,
      action: action,
      message: exception.message,
      user: exception.params.user,
      actionOnUser: exception.params.actionOnUser,
      detailedMessages: {
        ...exception.params.detailedMessages,
        ...detailedMessages
      }
    });
  }

  // Used to check URL params (not in catch)
  private static async logActionAppAuthException(tenantID: string, action: ServerAction, exception: AppAuthError, detailedMessages = {}): Promise<void> {
    Utils.handleExceptionDetailedMessages(exception);
    await Logging.logError({
      tenantID: tenantID,
      user: exception.params.user,
      chargingStationID: exception.params.chargingStationID,
      siteID: exception.params.siteID,
      siteAreaID: exception.params.siteAreaID,
      companyID: exception.params.companyID,
      actionOnUser: exception.params.actionOnUser,
      module: exception.params.module,
      method: exception.params.method,
      action: action,
      message: exception.message,
      detailedMessages: {
        ...exception.params.detailedMessages,
        ...detailedMessages
      }
    });
  }

  private static async logActionOcppException(tenantID: string, action: ServerAction, exception: OCPPError, detailedMessages = {}): Promise<void> {
    Utils.handleExceptionDetailedMessages(exception);
    await Logging.logError({
      tenantID: tenantID,
      chargingStationID: exception.params.chargingStationID,
      siteID: exception.params.siteID,
      siteAreaID: exception.params.siteAreaID,
      companyID: exception.params.companyID,
      module: exception.params.module,
      method: exception.params.method,
      action: action,
      message: exception.message,
      detailedMessages: {
        ...exception.params.detailedMessages,
        ...detailedMessages
      }
    });
  }

  // Used to check URL params (not in catch)
  private static format(detailedMessage: any): string {
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

  private static async log(log: Log): Promise<string> {
    // Check Log Level
    const logConfig = Logging.getConfiguration();
    // Default Log Level
    const logLevelAsString = logConfig.logLevel ? logConfig.logLevel : 'D';
    const logLevel = logLevelAsString as LogLevel;
    // Log Level
    switch (logLevel) {
      // No log at all
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
    // Host
    log.host = Utils.getHostName();
    if (log.detailedMessages) {
      // Anonymize message
      if (!Utils.isDevelopmentEnv() && log.action !== ServerAction.UNKNOWN_ACTION) {
        log.detailedMessages = Utils.cloneObject(log.detailedMessages);
        log.detailedMessages = await Logging.anonymizeSensitiveData(log.detailedMessages);
      }
      // Array?
      if (!Array.isArray(log.detailedMessages)) {
        log.detailedMessages = [log.detailedMessages];
      }
      // Format
      log.detailedMessages = Logging.format(log.detailedMessages);
    }
    // First char always in Uppercase
    if (typeof log.message === 'string' && log.message && log.message.length > 0) {
      log.message = log.message[0].toUpperCase() + log.message.substring(1);
    }
    if (!log.tenantID || log.tenantID === '') {
      log.tenantID = Constants.DEFAULT_TENANT_ID;
    }
    // Save
    return LogStorage.saveLog(log.tenantID, log);
  }

  private static async anonymizeSensitiveData(message: any): Promise<any> {
    if (!message || typeof message === 'number' || typeof message === 'bigint' || typeof message === 'symbol' || Utils.isBoolean(message) || typeof message === 'function') {
      return message;
    }
    // If the message is a string
    if (typeof message === 'string') {
      // Check if message is matching a WS connection URL having a registration token
      const matchingURLParts = Constants.WS_CONNECTION_URL_RE.exec(message);
      if (!Utils.isEmptyArray(matchingURLParts)) {
        return message.replace(matchingURLParts[1], Constants.ANONYMIZED_VALUE);
      }
      // Check if it is a query string
      const dataParts: string[] = message.split('&');
      if (dataParts.length > 1) {
        for (let i = 0; i < dataParts.length; i++) {
          const dataPart = dataParts[i];
          let queryParamKey = dataPart.split('=')[0];
          const queryParamKeyParts = queryParamKey.split('?');
          queryParamKey = queryParamKeyParts.length > 1 ? queryParamKeyParts[1] : queryParamKeyParts[0];
          for (const sensitiveData of Constants.SENSITIVE_DATA) {
            if (queryParamKey.toLowerCase().startsWith(sensitiveData.toLocaleLowerCase())) {
              // Find position of sensitive data
              const posSensitiveData = dataPart.toLowerCase().search(sensitiveData.toLowerCase());
              // Anonymize each query string part
              dataParts[i] = dataPart.substring(0, posSensitiveData + sensitiveData.length + 1) + Constants.ANONYMIZED_VALUE;
            }
          }
        }
        message = dataParts.join('&');
        return message;
      }
      // Check if the message is a string which contains sensitive data
      for (const sensitiveData of Constants.SENSITIVE_DATA) {
        if (message.toLowerCase().indexOf(sensitiveData.toLowerCase()) !== -1) {
          // Anonymize the message
          return Constants.ANONYMIZED_VALUE;
        }
      }
      return message;
    }
    // If the message is an array, apply the anonymizeSensitiveData function for each item
    if (Array.isArray(message)) {
      const anonymizedMessage = [];
      for (const item of message) {
        anonymizedMessage.push(await Logging.anonymizeSensitiveData(item));
      }
      return anonymizedMessage;
    }
    // If the message is an object
    if (typeof message === 'object') {
      for (const key of Object.keys(message)) {
        // Ignore
        if (Constants.EXCEPTION_JSON_KEYS_IN_SENSITIVE_DATA.includes(key)) {
          continue;
        }
        if (Constants.SENSITIVE_DATA.filter((sensitiveData) => key.toLowerCase() === sensitiveData.toLowerCase()).length > 0) {
          // If the key indicates sensitive data, anonymize the value independently of the type to guarantee that the whole object is protected
          message[key] = Constants.ANONYMIZED_VALUE;
        } else { // Otherwise, apply the anonymizeSensitiveData function
          message[key] = await Logging.anonymizeSensitiveData(message[key]);
        }
      }
      return message;
    }
    await Logging.logError({
      tenantID: Constants.DEFAULT_TENANT_ID,
      module: MODULE_NAME,
      method: 'anonymizeSensitiveData',
      action: ServerAction.LOG,
      message: 'No matching object type for log message anonymisation',
      detailedMessages: { message }
    });
    return null;
  }

  private static buildLogError(action: ServerAction, module: string,
      method: string, tenantID: string, user: UserToken | User | string, error: any): Log {
    const tenant = tenantID ? tenantID : Constants.DEFAULT_TENANT_ID;
    if (error.params) {
      return {
        user: user,
        tenantID: tenant,
        actionOnUser: error.params.actionOnUser,
        module: module, method: method,
        action: action,
        message: error.message,
        detailedMessages: {
          details: error.params.detailedMessages,
          error: error.stack
        }
      };
    }
    return {
      user: user,
      tenantID: tenant,
      actionOnUser: error.actionOnUser,
      module: module, method: method,
      action: action,
      message: error.message,
      detailedMessages: {
        details: error.detailedMessages,
        stack: error.stack
      }
    };
  }
}
