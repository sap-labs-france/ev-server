import { NextFunction, Request, Response } from 'express';
import fs from 'fs';
import Authorizations from '../../../authorization/Authorizations';
import AppAuthError from '../../../exception/AppAuthError';
import ChargingStationStorage from '../../../storage/mongodb/ChargingStationStorage';
import LoggingStorage from '../../../storage/mongodb/LoggingStorage';
import { Action, Entity } from '../../../types/Authorization';
import { HTTPAuthError } from '../../../types/HTTPError';
import { ServerAction } from '../../../types/Server';
import TenantComponents from '../../../types/TenantComponents';
import UserToken from '../../../types/UserToken';
import Constants from '../../../utils/Constants';
import I18nManager from '../../../utils/I18nManager';
import Utils from '../../../utils/Utils';
import LoggingSecurity from './security/LoggingSecurity';


const MODULE_NAME = 'LoggingService';

export default class LoggingService {
  static async handleGetLoggings(action: ServerAction, req: Request, res: Response, next: NextFunction) {
    // Check auth
    if (!Authorizations.canListLogging(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.LIST,
        entity: Entity.LOGGINGS,
        module: MODULE_NAME,
        method: 'handleGetLoggings'
      });
    }
    // Filter
    const filteredRequest = LoggingSecurity.filterLoggingsRequest(req.query);
    // Check if organization component is active
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
    });
    // Filter
    LoggingSecurity.filterLoggingsResponse(loggings, req.user);
    // Return
    res.json(loggings);
    next();
  }

  static async handleGetLoggingsExport(action: ServerAction, req: Request, res: Response, next: NextFunction) {
    // Check auth
    if (!Authorizations.canListLogging(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.LIST,
        entity: Entity.LOGGINGS,
        module: MODULE_NAME,
        method: 'handleGetLoggingsExport'
      });
    }
    // Filter
    const filteredRequest = LoggingSecurity.filterLoggingsRequest(req.query);
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
    });
    // Filter
    LoggingSecurity.filterLoggingsResponse(loggings, req.user);
    const filename = 'exported-logs.csv';
    fs.writeFile(filename, LoggingService.convertToCSV(req.user, loggings.result), (err) => {
      if (err) {
        throw err;
      }
      res.download(filename, (err2) => {
        if (err2) {
          throw err2;
        }
        fs.unlink(filename, (err3) => {
          if (err3) {
            throw err3;
          }
        });
      });
    });
  }

  static async handleGetLogging(action: ServerAction, req: Request, res: Response, next: NextFunction) {
    // Filter
    const filteredRequest = LoggingSecurity.filterLoggingRequest(req.query);
    // Get logs
    const logging = await LoggingStorage.getLog(req.user.tenantID, filteredRequest.ID);
    // Check auth
    if (!Authorizations.canReadLogging(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.READ,
        entity: Entity.LOGGING,
        module: MODULE_NAME,
        method: 'handleGetLogging'
      });
    }
    // Return
    res.json(
      LoggingSecurity.filterLoggingResponse(
        logging, req.user, true
      )
    );
    next();
  }

  private static convertToCSV(loggedUser: UserToken, loggings) {
    const i18nManager = new I18nManager(loggedUser.locale);
    let csv = `Date${Constants.CSV_SEPARATOR}Level${Constants.CSV_SEPARATOR}Type${Constants.CSV_SEPARATOR}Action${Constants.CSV_SEPARATOR}Message${Constants.CSV_SEPARATOR}Method${Constants.CSV_SEPARATOR}Module${Constants.CSV_SEPARATOR}Source${Constants.CSV_SEPARATOR}Host${Constants.CSV_SEPARATOR}Process\r\n`;
    for (const log of loggings) {
      csv += `${i18nManager.formatDateTime(log.timestamp, 'L')} ${i18nManager.formatDateTime(log.timestamp, 'LT')}` + Constants.CSV_SEPARATOR;
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
}

