import { Action, Entity } from '../../../../types/Authorization';
import { NextFunction, Request, Response } from 'express';

import AppAuthError from '../../../../exception/AppAuthError';
import Authorizations from '../../../../authorization/Authorizations';
import ChargingStationStorage from '../../../../storage/mongodb/ChargingStationStorage';
import Constants from '../../../../utils/Constants';
import { DataResult } from '../../../../types/DataResult';
import { HTTPAuthError } from '../../../../types/HTTPError';
import { Log } from '../../../../types/Log';
import LoggingSecurity from './security/LoggingSecurity';
import LoggingStorage from '../../../../storage/mongodb/LoggingStorage';
import { ServerAction } from '../../../../types/Server';
import TenantComponents from '../../../../types/TenantComponents';
import UserToken from '../../../../types/UserToken';
import Utils from '../../../../utils/Utils';
import UtilsService from './UtilsService';
import moment from 'moment';

const MODULE_NAME = 'LoggingService';

export default class LoggingService {
  public static async handleGetLogs(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Get logs
    res.json(await LoggingService.getLogs(req));
    next();
  }

  public static async handleExportLogs(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    await UtilsService.exportToCSV(req, res, 'exported-logs.csv',
      LoggingService.getLogs.bind(this), LoggingService.convertToCSV.bind(this));
  }

  public static async handleGetLog(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = LoggingSecurity.filterLogRequest(req.query);
    // Get logs
    const logging = await LoggingStorage.getLog(req.user.tenantID, filteredRequest.ID, [
      'id', 'level', 'timestamp', 'type', 'source', 'host', 'process', 'action', 'message',
      'user.name', 'user.firstName', 'actionOnUser.name', 'actionOnUser.firstName', 'hasDetailedMessages', 'detailedMessages'
    ]);
    // Check auth
    if (!Authorizations.canReadLog(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.READ, entity: Entity.LOGGING,
        module: MODULE_NAME, method: 'handleGetLog'
      });
    }
    // Return
    res.json(logging);
    next();
  }

  private static convertToCSV(loggedUser: UserToken, loggings: Log[], writeHeader = true): string {
    let csv = '';
    // Header
    if (writeHeader) {
      csv = `Date${Constants.CSV_SEPARATOR}Time${Constants.CSV_SEPARATOR}Level${Constants.CSV_SEPARATOR}Type${Constants.CSV_SEPARATOR}Action${Constants.CSV_SEPARATOR}Message${Constants.CSV_SEPARATOR}Method${Constants.CSV_SEPARATOR}Module${Constants.CSV_SEPARATOR}Source${Constants.CSV_SEPARATOR}Host${Constants.CSV_SEPARATOR}Process\r\n`;
    }
    // Content
    for (const log of loggings) {
      csv += `${moment(log.timestamp).format('YYYY-MM-DD')}` + Constants.CSV_SEPARATOR;
      csv += `${moment(log.timestamp).format('HH:mm:ss')}` + Constants.CSV_SEPARATOR;
      csv += `${log.level}` + Constants.CSV_SEPARATOR;
      csv += `${log.type}` + Constants.CSV_SEPARATOR;
      csv += `${log.action}` + Constants.CSV_SEPARATOR;
      csv += `${log.message}` + Constants.CSV_SEPARATOR;
      csv += `${log.method}` + Constants.CSV_SEPARATOR;
      csv += `${log.module}` + Constants.CSV_SEPARATOR;
      csv += `${log.source}` + Constants.CSV_SEPARATOR;
      csv += `${log.host}` + Constants.CSV_SEPARATOR;
      csv += `${log.process}\r\n`;
    }
    return csv;
  }

  private static async getLogs(req: Request): Promise<DataResult<Log>> {
    // Check auth
    if (!Authorizations.canListLoggings(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.LIST, entity: Entity.LOGGINGS,
        module: MODULE_NAME, method: 'getLogs'
      });
    }
    // Filter
    const filteredRequest = LoggingSecurity.filterLogsRequest(req.query);
    // Add filter for Site Admins
    if (Utils.isComponentActiveFromToken(req.user, TenantComponents.ORGANIZATION) && Authorizations.isSiteAdmin(req.user)) {
      // Optimization: Retrieve Charging Stations to get the logs only for the Site Admin user
      const chargingStations = await ChargingStationStorage.getChargingStations(req.user.tenantID,
        { siteIDs: req.user.sitesAdmin }, Constants.DB_PARAMS_MAX_LIMIT);
      // Check if Charging Station is already filtered
      if (chargingStations.count === 0) {
        filteredRequest.Source = '';
      } else if (filteredRequest.Source && filteredRequest.Source.length > 0) {
        // Filter only Site Admin Chargers
        const sources = [];
        for (const chargingStation of chargingStations.result) {
          if (filteredRequest.Source.includes(chargingStation.id)) {
            sources.push(chargingStation.id);
          }
        }
        filteredRequest.Source = sources.join('|');
      } else {
        // Add all Site Admin Chargers in filter
        filteredRequest.Source = chargingStations.result.join('|');
      }
    }
    // Get logs
    const loggings = await LoggingStorage.getLogs(req.user.tenantID, {
      search: filteredRequest.Search,
      startDateTime: filteredRequest.StartDateTime,
      endDateTime: filteredRequest.EndDateTime,
      userIDs: filteredRequest.UserID ? filteredRequest.UserID.split('|') : null,
      hosts: filteredRequest.Host ? filteredRequest.Host.split('|') : null,
      levels: filteredRequest.Level ? filteredRequest.Level.split('|') : null,
      type: filteredRequest.Type,
      sources: filteredRequest.Source ? filteredRequest.Source.split('|') : null,
      actions: filteredRequest.Action ? filteredRequest.Action.split('|') : null,
    }, {
      limit: filteredRequest.Limit,
      skip: filteredRequest.Skip,
      sort: filteredRequest.Sort,
      onlyRecordCount: filteredRequest.OnlyRecordCount
    }, [
      'id', 'level', 'timestamp', 'type', 'source', 'host', 'process', 'action', 'message',
      'user.name', 'user.firstName', 'actionOnUser.name', 'actionOnUser.firstName', 'hasDetailedMessages'
    ]);
    return loggings;
  }
}

