import fs from 'fs';
import AppAuthError from '../../../exception/AppAuthError';
import Authorizations from '../../../authorization/Authorizations';
import Constants from '../../../utils/Constants';
import Logging from '../../../utils/Logging';
import LoggingSecurity from './security/LoggingSecurity';

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
      console.log(`>>> filter:${JSON.stringify(filteredRequest)}`);
      console.log(`>>> action:${JSON.stringify(filteredRequest.Action.split('|'))}`);
      // Get logs
      const loggings = await Logging.getLogs(req.user.tenantID, {
        'search': filteredRequest.Search, 'dateFrom': filteredRequest.DateFrom, 'dateUntil': filteredRequest.DateUntil, 'users': filteredRequest.UserID.split('|'),
        'level': filteredRequest.Level, 'type': filteredRequest.Type, 'sources': filteredRequest.Source.split('|'), 'host': filteredRequest.Host,
        'process': filteredRequest.Process, 'actions': filteredRequest.Action.split('|'), 'onlyRecordCount': filteredRequest.OnlyRecordCount
      }, filteredRequest.Limit, filteredRequest.Skip, filteredRequest.Sort);
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
        'search': filteredRequest.Search, 'dateFrom': filteredRequest.DateFrom, 'dateUntil': filteredRequest.DateUntil, 'users': filteredRequest.UserID.split('|'),
        'level': filteredRequest.Level, 'type': filteredRequest.Type, 'sources': filteredRequest.Source.split('|'), 'host': filteredRequest.Host,
        'process': filteredRequest.Process, 'actions': filteredRequest.Action.split('|'), 'onlyRecordCount': filteredRequest.OnlyRecordCount
      }, filteredRequest.Limit, filteredRequest.Skip, filteredRequest.Sort);
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

