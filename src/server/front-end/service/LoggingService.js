const Authorizations = require('../../../authorization/Authorizations');
const Logging = require('../../../utils/Logging');
const Constants = require('../../../utils/Constants');
const LoggingSecurity = require('./security/LoggingSecurity');
const AppAuthError = require('../../../exception/AppAuthError');

class LoggingService {
  static async handleGetLoggings(action, req, res, next) {
    try {
      // Check auth
      if (!Authorizations.canListLogging(req.user)) {
        // Not Authorized!
        throw new AppAuthError(
          Constants.ACTION_LIST,
          Constants.ENTITY_LOGGINGS,
          null,
          560, 'LoggingService', 'handleGetLoggings',
          req.user);
      }
      // Filter
      const filteredRequest = LoggingSecurity.filterLoggingsRequest(req.query, req.user);
      // Get logs
      const loggings = await Logging.getLogs(req.user.tenantID, {
        'search': filteredRequest.Search, 'dateFrom': filteredRequest.DateFrom, 'userID': filteredRequest.UserID, 
        'level': filteredRequest.Level, 'type': filteredRequest.Type, 'source': filteredRequest.Source, 
        'action': filteredRequest.Action}, filteredRequest.Limit, filteredRequest.Skip, filteredRequest.Sort);
      // Filter
      loggings.result = LoggingSecurity.filterLoggingsResponse(
        loggings.result, req.user);
      // Return
      res.json(loggings);
      next();
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
      if (!Authorizations.canReadLogging(req.user, logging)) {
        // Not Authorized!
        throw new AppAuthError(
          Constants.ACTION_READ,
          Constants.ENTITY_LOGGING,
          null,
          560, 'LoggingService', 'handleGetLogging',
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
}

module.exports = LoggingService;
