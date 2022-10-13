import { DataResult, LogDataResult } from '../../../../types/DataResult';
import { NextFunction, Request, Response } from 'express';

import { Action } from '../../../../types/Authorization';
import AuthorizationService from './AuthorizationService';
import Constants from '../../../../utils/Constants';
import { HttpLogsGetRequest } from '../../../../types/requests/HttpLogRequest';
import { Log } from '../../../../types/Log';
import LogStorage from '../../../../storage/mongodb/LogStorage';
import LogValidatorRest from '../validator/LogValidatorRest';
import { ServerAction } from '../../../../types/Server';
import Utils from '../../../../utils/Utils';
import UtilsService from './UtilsService';
import moment from 'moment';

const MODULE_NAME = 'LogService';

export default class LogService {
  public static async handleGetLogs(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = LogValidatorRest.getInstance().validateLogsGetReq(req.query);
    // Get Logs
    res.json(await LogService.getLogs(req, filteredRequest));
    next();
  }

  public static async handleExportLogs(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Force params
    req.query.Limit = Constants.EXPORT_PAGE_SIZE.toString();
    // Filter
    const filteredRequest = LogValidatorRest.getInstance().validateLogsGetReq(req.query);
    // Export
    await UtilsService.exportToCSV(req, res, 'exported-logs.csv', filteredRequest,
      LogService.getLogs.bind(this),
      LogService.convertToCSV.bind(this));
  }

  public static async handleGetLog(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = LogValidatorRest.getInstance().validateLogGetReq(req.query);
    // Check and Get Log
    const log = await UtilsService.checkAndGetLogAuthorization(
      req.tenant, req.user, filteredRequest.ID, Action.READ, action, null, null, true);
    res.json(log);
    next();
  }

  private static convertToCSV(req: Request, logs: Log[], writeHeader = true): string {
    let headers = null;
    // Header
    if (writeHeader) {
      headers = [
        'level',
        'date',
        'time',
        'host',
        'source',
        'action',
        'siteID',
        'chargingStationID',
        'module',
        'method',
        'message',
      ].join(Constants.CSV_SEPARATOR);
    }
    // Content
    const rows = logs.map((log) => {
      const row = [
        log.level,
        moment(log.timestamp).format('YYYY-MM-DD'),
        moment(log.timestamp).format('HH:mm:ss'),
        log.host,
        log.source,
        log.action,
        log.siteID,
        log.chargingStationID,
        log.module,
        log.method,
        log.message,
      ].map((value) => Utils.escapeCsvValue(value));
      return row;
    }).join(Constants.CR_LF);
    return Utils.isNullOrUndefined(headers) ? Constants.CR_LF + rows : [headers, rows].join(Constants.CR_LF);
  }

  private static async getLogs(req: Request, filteredRequest: HttpLogsGetRequest): Promise<DataResult<Log>> {
    // Check dynamic auth
    const authorizations = await AuthorizationService.checkAndGetLoggingsAuthorizations(
      req.tenant, req.user, filteredRequest, false);
    if (!authorizations.authorized) {
      return Constants.DB_EMPTY_DATA_RESULT;
    }
    // Get Logs
    const logs = await LogStorage.getLogs(req.tenant, {
      search: filteredRequest.Search,
      startDateTime: filteredRequest.StartDateTime,
      endDateTime: filteredRequest.EndDateTime,
      userIDs: filteredRequest.UserID ? filteredRequest.UserID.split('|') : null,
      siteIDs: filteredRequest.SiteID ? filteredRequest.SiteID.split('|') : null,
      chargingStationIDs: filteredRequest.ChargingStationID ? filteredRequest.ChargingStationID.split('|') : null,
      hosts: filteredRequest.Host ? filteredRequest.Host.split('|') : null,
      levels: filteredRequest.Level ? filteredRequest.Level.split('|') : null,
      sources: filteredRequest.Source ? filteredRequest.Source.split('|') : null,
      actions: filteredRequest.Action ? filteredRequest.Action.split('|') : null,
      ...authorizations.filters
    }, {
      limit: filteredRequest.Limit,
      skip: filteredRequest.Skip,
      sort: UtilsService.httpSortFieldsToMongoDB(filteredRequest.SortFields),
      onlyRecordCount: filteredRequest.OnlyRecordCount
    },
    authorizations.projectFields);
    // Assign projected fields
    if (authorizations.projectFields) {
      logs.projectFields = authorizations.projectFields;
    }
    // Add Auth flags
    if (filteredRequest.WithAuth) {
      await AuthorizationService.addLogsAuthorizations(req.tenant, req.user, logs as LogDataResult, authorizations);
    }
    return logs;
  }
}
