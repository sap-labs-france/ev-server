const Utils = require('./Utils');
const AppError = require('./AppError');
const AppAuthError = require('./AppAuthError');
require('source-map-support').install();

class Logging {
  // Log Debug
  static logDebug(log) {
    // Log
    log.level = 'D';
    // Log it
    Logging._log(log);
  }

  // Log Info
  static logInfo(log) {
    // Log
    log.level = 'I';
    // Log it
    Logging._log(log);
  }

  // Log Warning
  static logWarning(log) {
    // Log
    log.level = 'W';
    // Log it
    Logging._log(log);
  }

  // Log Error
  static logError(log) {
    // Log
    log.level = 'E';
    // Log it
    Logging._log(log);
  }

  // Get Logs
  static getLogs(dateFrom, level, chargingStation, searchValue, numberOfLogs, sortDate) {
    return global.storage.getLogs(dateFrom, level, chargingStation, searchValue, numberOfLogs, sortDate);
  }

  // Delete
  static deleteLogs(deleteUpToDate) {
    return global.storage.deleteLogs(deleteUpToDate);
  }

  // Log
  static _log(log) {
    // Log
    log.timestamp = new Date();

    // Set User
    if (log.user) {
      log.userID = log.user.id;
      log.userFullName = log.user.firstName + " " + log.user.name;
    }

    // Check Array
    if (log.detailedMessages && !Array.isArray(log.detailedMessages)){
      // Handle update of array
      log.detailedMessages = [log.detailedMessages];
      // Format
      log.detailedMessages = Logging._format(log.detailedMessages);
    }

    // Log
    global.storage.saveLog(log);
  }

  // Log
  static logReceivedAction(module, chargeBoxIdentity, action, args, headers) {
    // Log
    Logging.logDebug({
      userFullName: "System", source: chargeBoxIdentity, module: module, method: action,
      message: `>> OCPP Request Received`,
      action: action,
      detailedMessages: {
        "args": args,
        "headers": headers
      }
    });
  }

  // Log
  static logSendAction(module, chargeBoxIdentity, action, args) {
    // Log
    Logging.logDebug({
      userFullName: "System", source: chargeBoxIdentity, module: module, method: action,
      message: `>> OCPP Request Sent`,
      action: action,
      detailedMessages: args
    });
  }

  // Log
  static logReturnedAction(module, chargeBoxIdentity, action, result) {
    // Log
    Logging.logDebug({
      userFullName: "System", source: chargeBoxIdentity, module: module, method: action,
      message: `<< OCPP Request Returned`,
      action: action,
      detailedMessages: {
        "result": result
      }
    });
  }

  static _format(detailedMessage) {
    // JSON?
    if (typeof detailedMessage === "object") {
      try {
        // Check that every detailedMessages is parsed
        return JSON.stringify(detailedMessage);
      } catch(err) {
        // Log
        Logging.logWarning({
          source: "Central Server", module: "Logging", method: "_format",
          message: `Error when formatting a Log (stringify): '${err.message}'`,
          detailedMessages: parsedDetailedMessage });
      }
    }
  }

  // Log issues
  static logActionUnexpectedErrorMessageAndSendResponse(action, err, req, res, next) {
    Logging.logUnexpectedErrorMessage(
      action, "RestServer", "N/A", err, "Central Server", (req.user?req.user.id:null));
    res.status(500).send({"message": Utils.hideShowMessage(err.message)});
    next();
  }

  // Log issues
  static logUnexpectedErrorMessage(action, module, method, err, source="Central Server", user="System") {
    Logging.logError({
      "userFullName": "System",
      "source": source, "module": module, "method": method,
      "action": action, "message": `${err.message}`,
      "detailedMessages": err.stack });
  }

  // Used to log exception in catch(...) only
  static logActionExceptionMessageAndSendResponse(action, exception, req, res, next) {
    if (exception instanceof AppError) {
      // Log Error
      Logging.logActionExceptionMessageAndSendResponse(
        action, exception, req, res, next, exception.errorCode);
    } else if (exception instanceof AppAuthError) {
      // Log Auth Error
      Logging.logActionUnauthorizedMessageAndSendResponse(
        action, exception.entity, exception.value, req, res, next, exception.errorCode);
    } else {
      // Log Unexpected
      Logging.logActionUnexpectedErrorMessageAndSendResponse(
        action, exception.message, req, res, next);
    }
  }

  // Used to check URL params (not in catch)
  static logActionExceptionMessageAndSendResponse(action, exception, req, res, next, errorCode=500) {
    // Log
    Logging.logActionExceptionMessage(action, exception, req, res);
    // Send error
    res.status(errorCode).send({"message": Utils.hideShowMessage(exception.message)});
    next();
  }

  // Used to check URL params (not in catch)
  static logActionErrorMessageAndSendResponse(action, message, req, res, next, errorCode=500) {
    // Log
    Logging.logActionExceptionMessageAndSendResponse(action, new Error(message), req, res, next, errorCode);
  }

  // Log issues
  static logActionExceptionMessage(action, exception, req, res) {
    // Clear password
    if (action==="login" && req.body.password) {
      req.body.password = "####";
    }
    Logging.logError({
      userID: (req.user?req.user.id:null), userFullName: Utils.buildUserFullName(req.user),
      source: "Central Server", module: "RestServer", method: "N/A",
      action: action, message: exception.message,
      detailedMessages: [{
        "stack": exception.stack,
        "request": req.body}] });
  }

  // Log issues
  static logActionUnauthorizedMessage(action, entity, value, req, res) {
    // Log
    Logging.logActionErrorMessage(action,
      `User ${Utils.buildUserFullName(req.user)} with Role '${req.user.role}' and ID '${req.user.id}' is not authorised to perform '${action}' on ${entity} ${(value?"'"+value+"'":"")}`, req, res);
  }

  // Log issues
  static logActionUnauthorizedMessageAndSendResponse(action, entity, value, req, res, next) {
    // Log
    Logging.logActionErrorMessageAndSendResponse(action,
      `Not authorised to perform '${action}' on ${entity} ${(value?"'"+value+"'":"")} (Role='${req.user.role}')`, req, res, next);
  }
}

module.exports=Logging;
