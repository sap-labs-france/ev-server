import { Action, Entity } from '../../../types/Authorization';
import { NextFunction, Request, Response } from 'express';

import AppAuthError from '../../../exception/AppAuthError';
import Authorizations from '../../../authorization/Authorizations';
import ChargingStationStorage from '../../../storage/mongodb/ChargingStationStorage';
import Constants from '../../../utils/Constants';
import { HTTPAuthError } from '../../../types/HTTPError';
import I18nManager from '../../../utils/I18nManager';
import Logging from '../../../utils/Logging';
import LoggingSecurity from './security/LoggingSecurity';
import { ServerAction } from '../../../types/Server';
import TenantComponents from '../../../types/TenantComponents';
import UserToken from '../../../types/UserToken';
import Utils from '../../../utils/Utils';
import fs from 'fs';

const MODULE_NAME = 'LoggingService';

export default class LoggingService {
  static async handleGetLoggings(action: ServerAction, req: Request, res: Response, next: NextFunction) {
    try {
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
          filteredRequest.Source = [''];
        } else if (filteredRequest.Source && filteredRequest.Source.length > 0) {
          // Filter only Site Admin Chargers
          const sources = [];
          for (const chargingStation of chargingStations.result) {
            if (filteredRequest.Source.includes(chargingStation.id)) {
              sources.push(chargingStation.id);
            }
          }
          filteredRequest.Source = sources;
        } else {
          // Add all Site Admin Chargers in filter
          filteredRequest.Source = chargingStations.result.map((chargingStation) => chargingStation.id);
        }
      }

      // Get logs
      const loggings = await Logging.getLogs(req.user.tenantID, {
        'search': filteredRequest.Search,
        'dateFrom': filteredRequest.DateFrom,
        'dateUntil': filteredRequest.DateUntil,
        'userIDs': filteredRequest.UserID,
        'level': filteredRequest.Level,
        'type': filteredRequest.Type,
        'sources': filteredRequest.Source,
        'host': filteredRequest.Host,
        'process': filteredRequest.Process,
        'actions': filteredRequest.Action
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
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }

  static async handleGetLoggingsExport(action: ServerAction, req: Request, res: Response, next: NextFunction) {
    try {
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
      const loggings = await Logging.getLogs(req.user.tenantID, {
        'search': filteredRequest.Search,
        'dateFrom': filteredRequest.DateFrom,
        'dateUntil': filteredRequest.DateUntil,
        'userIDs': filteredRequest.UserID,
        'level': filteredRequest.Level,
        'type': filteredRequest.Type,
        'sources': filteredRequest.Source,
        'host': filteredRequest.Host,
        'process': filteredRequest.Process,
        'actions': filteredRequest.Action
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
        res.download(filename, (err) => {
          if (err) {
            throw err;
          }
          fs.unlink(filename, (err) => {
            if (err) {
              throw err;
            }
          });
        });
      });
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }

  static async handleGetLogging(action: ServerAction, req: Request, res: Response, next: NextFunction) {
    try {
      // Filter
      const filteredRequest = LoggingSecurity.filterLoggingRequest(req.query);
      // Get logs
      const logging = await Logging.getLog(req.user.tenantID, filteredRequest.ID);
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
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
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

