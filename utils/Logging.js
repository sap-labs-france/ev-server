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
    }

    // Log
    global.storage.saveLog(log);
  }

  // Log
  static logReceivedAction(module, chargeBoxIdentity, action, args, headers) {
    // Log
    Logging.logDebug({
      source: chargeBoxIdentity, module: module, method: action,
      message: `>> ${action} >> Received`,
      detailedMessages: {
        "args": JSON.stringify(args),
        "headers": JSON.stringify(headers)
      }
    });
  }

  // Log
  static logSendAction(module, chargeBoxIdentity, action, args) {
    // Log
    Logging.logDebug({
      source: chargeBoxIdentity, module: module, method: action,
      message: `>> ${action} >> Sent`,
      detailedMessages: {
        "args": JSON.stringify(args)
      }
    });
  }

  // Log
  static logReturnedAction(module, chargeBoxIdentity, action, result) {
    // Log
    Logging.logDebug({
      source: chargeBoxIdentity, module: module, method: action,
      message: `<< ${action} << Returned`,
      detailedMessages: {
        "result": JSON.stringify(result)
      }
    });
  }

}

module.exports=Logging;
