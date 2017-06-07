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
  static getLogs(numberOfLogging) {
    return global.storage.getLogs(numberOfLogging);
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
          message: `Error when formatting a Log (stringify): '${err.toString()}'`,
          detailedMessages: parsedDetailedMessage });
      }
    }
  }

  // Log issues
  static logActionUnexpectedErrorMessageAndSendResponse(action, err, req, res, next) {
    Logging.logError({
      userID: req.user.id, userFullName: `${req.user.firstName} ${req.user.name}`,
      source: "Central Server", module: "RestServer", method: "N/A",
      action: action, message: `${err.toString()}`,
      detailedMessages: err.stack });
    res.status(500).send(`{"message": ${err.toString()}}`);
    next();
  };

  // Log issues
  static logActionErrorMessageAndSendResponse(action, message, req, res, next) {
    Logging.logError({
      userID: req.user.id, userFullName: `${req.user.firstName} ${req.user.name}`,
      source: "Central Server", module: "RestServer", method: "N/A",
      action: action, message: message,
      detailedMessages: [{
          "stack": new Error().stack,
          "request": req.body}] });
    res.status(500).send({"message": message});
    next();
  };

  // Log issues
  static logActionUnauthorizedMessageAndSendResponse(entity, action, req, res, next) {
    // Log
    Logging.logActionErrorMessageAndSendResponse(action,
      `User ${req.user.firstName} ${req.user.name} with Role ID '${req.user.role}' is not authorised to perform '${action}' on '${entity}'`, req, res, next);
  };
}

module.exports=Logging;
