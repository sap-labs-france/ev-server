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
      source: chargeBoxIdentity, module: module, method: action,
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
      source: chargeBoxIdentity, module: module, method: action,
      message: `<< OCPP Request Sent`,
      action: action,
      detailedMessages: {
        "args": args
      }
    });
  }

  // Log
  static logReturnedAction(module, chargeBoxIdentity, action, result) {
    // Log
    Logging.logDebug({
      source: chargeBoxIdentity, module: module, method: action,
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
      // Check that every detailedMessages is parsed
      return Logging._format(JSON.stringify(detailedMessage));
      // String?
    } else if (typeof detailedMessage === "string") {
      var parsedDetailedMessage = detailedMessage.replace(/\\"/g, '"').replace(/"{/g, '{').replace(/}"/g, '}');
      try {
        // Try to parse it
        parsedDetailedMessage = JSON.stringify(JSON.parse(parsedDetailedMessage));
      } catch(err) {
        // Log
        Logging.logWarning({
          source: "Central Server", module: "Logging", method: "_format",
          message: `Error when formatting a Log: '${err.toString()}'`,
          detailedMessage: parsedDetailedMessage });
      }
      // Replace
      return parsedDetailedMessage;
    } else {
      // Unknown
      return detailedMessage;
    }
  }
}

module.exports=Logging;
