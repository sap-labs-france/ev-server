import sanitize from 'mongo-sanitize';
import Authorizations from '../../../../authorization/Authorizations';
import Utils from '../../../../utils/Utils';
import UtilsSecurity from './UtilsSecurity';

export default class LoggingSecurity {
  // eslint-disable-next-line no-unused-vars
  static filterLoggingsRequest(request, loggedUser) {
    const filteredRequest: any = {};
    // Get logs
    filteredRequest.DateFrom = sanitize(request.DateFrom);
    filteredRequest.DateUntil = sanitize(request.DateUntil);
    filteredRequest.Level = sanitize(request.Level);
    filteredRequest.Source = sanitize(request.Source);
    filteredRequest.Host = sanitize(request.Host);
    filteredRequest.Process = sanitize(request.Process);
    filteredRequest.Search = sanitize(request.Search);
    filteredRequest.SortDate = sanitize(request.SortDate);
    filteredRequest.Type = sanitize(request.Type);
    filteredRequest.Action = sanitize(request.Action);
    filteredRequest.UserID = sanitize(request.UserID);
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    return filteredRequest;
  }

  // eslint-disable-next-line no-unused-vars
  static filterLoggingRequest(request, loggedUser) {
    const filteredRequest: any = {};
    // Get logs
    filteredRequest.ID = sanitize(request.ID);
    return filteredRequest;
  }

  static filterLoggingResponse(logging, loggedUser, withDetailedMessage=false) {
    const filteredLogging: any = {};

    if (!logging) {
      return null;
    }
    if (!Authorizations.isAdmin(loggedUser) && !Authorizations.isSuperAdmin(loggedUser)) {
      return null;
    }
    filteredLogging.id = logging.id;
    filteredLogging.level = logging.level;
    filteredLogging.timestamp = logging.timestamp;
    filteredLogging.type = logging.type;
    filteredLogging.source = logging.source;
    filteredLogging.host = logging.host;
    filteredLogging.process = logging.process;
    filteredLogging.userFullName = logging.userFullName;
    filteredLogging.action = logging.action;
    filteredLogging.message = logging.message;
    filteredLogging.module = logging.module;
    filteredLogging.method = logging.method;
    filteredLogging.hasDetailedMessages = (logging.detailedMessages && logging.detailedMessages.length > 0 ? true : false);
    if (withDetailedMessage) {
      filteredLogging.detailedMessages = logging.detailedMessages;
    }
    if (logging.user && typeof logging.user === "object") {
      // Build user
      filteredLogging.user = Utils.buildUserFullName(logging.user, false);
    }
    if (logging.actionOnUser && typeof logging.actionOnUser === "object") {
      // Build user
      filteredLogging.actionOnUser = Utils.buildUserFullName(logging.actionOnUser, false);
    }
    return filteredLogging;
  }

  static filterLoggingsResponse(loggings, loggedUser) {
    const filteredLoggings = [];
		
    if (!loggings.result) {
      return null;
    }
    for (const logging of loggings.result) {
      // Filter
      const filteredLogging = LoggingSecurity.filterLoggingResponse(logging, loggedUser);
      // Ok?
      if (filteredLogging) {
        // Add
        filteredLoggings.push(filteredLogging);
      }
    }
    loggings.result = filteredLoggings;
  }
}


