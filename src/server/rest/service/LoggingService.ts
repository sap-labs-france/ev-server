import fs from 'fs';
import AppAuthError from '../../../exception/AppAuthError';
import Authorizations from '../../../authorization/Authorizations';
import ChargingStationStorage from '../../../storage/mongodb/ChargingStationStorage';
import Constants from '../../../utils/Constants';
import Logging from '../../../utils/Logging';
import LoggingSecurity from './security/LoggingSecurity';
import Tenant from '../../../entity/Tenant';
import Utils from '../../../utils/Utils';

export default class LoggingService {
  static async handleGetLoggings(action, req, res, next) {
    try {
      // Check auth
      if (!Authorizations.canListLogging(req.user)) {
        // Not Authorized!
        throw new AppAuthError(
          Constants.ACTION_LIST,
          Constants.ENTITY_LOGGINGS,
          null,
          Constants.HTTP_AUTH_ERROR, 'LoggingService', 'handleGetLoggings',
          req.user);
      }
      // Filter
      const filteredRequest = LoggingSecurity.filterLoggingsRequest(req.query, req.user);
      // Check if organization component is active
      if (Utils.isComponentActiveFromToken(req.user, Constants.COMPONENTS.ORGANIZATION) && Authorizations.isSiteAdmin(req.user)) {
        // Optimization: Retrieve Charging Stations to get the logs only for the Site Admin user
        const chargingStations = await ChargingStationStorage.getChargingStations(req.user.tenantID,
          { siteIDs: req.user.sitesAdmin }, Constants.DB_PARAMS_MAX_LIMIT);
        // Check if Charging Station is already filtered
        if (filteredRequest.Source && filteredRequest.Source.length > 0) {
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
          filteredRequest.Source = chargingStations.result.map((chargingStation) => {
            return chargingStation.id;
          });
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

  static async handleGetLoggingsExport(action, req, res, next) {
    try {
      // Check auth
      if (!Authorizations.canListLogging(req.user)) {
        // Not Authorized!
        throw new AppAuthError(
          Constants.ACTION_LIST,
          Constants.ENTITY_LOGGINGS,
          null,
          Constants.HTTP_AUTH_ERROR, 'LoggingService', 'handleGetLoggingsExport',
          req.user);
      }
      // Filter
      const filteredRequest = LoggingSecurity.filterLoggingsRequest(req.query, req.user);
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
      const filename = 'loggings_export.csv';
      fs.writeFile(filename, LoggingService.convertToCSV(loggings.result), (err) => {
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

  static async handleGetLogging(action, req, res, next) {
    try {
      // Filter
      const filteredRequest = LoggingSecurity.filterLoggingRequest(req.query, req.user);
      // Get logs
      const logging = await Logging.getLog(req.user.tenantID, filteredRequest.ID);
      // Check auth
      if (!Authorizations.canReadLogging(req.user)) {
        // Not Authorized!
        throw new AppAuthError(
          Constants.ACTION_READ,
          Constants.ENTITY_LOGGING,
          null,
          Constants.HTTP_AUTH_ERROR, 'LoggingService', 'handleGetLogging',
          req.user);
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

  static convertToCSV(loggings) {
    let csv = 'id,timestamp,level,type,action,message,method,module,source,host,process\r\n';
    for (const log of loggings) {
      csv += `${log.id},`;
      csv += `${log.timestamp},`;
      csv += `${log.level},`;
      csv += `${log.type},`;
      csv += `${log.action},`;
      csv += `${log.message},`;
      csv += `${log.method},`;
      csv += `${log.module},`;
      csv += `${log.source}`;
      csv += `${log.host}`;
      csv += `${log.process}\r\n`;
    }
    return csv;
  }
}

