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

  // Log
  static _log(log) {
    // Log
    log.timestamp = new Date();

    // Log
    global.storage.log(log);
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
