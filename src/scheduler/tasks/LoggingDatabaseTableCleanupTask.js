const Logging = require('../../utils/Logging');

class LoggingDatabaseTableCleanupTask {
    static run() {
      Logging.logInfo({
        userFullName: "System", source: "Central Server", module: "LoggingDatabaseTableCleanupTask",
        method: "run", action: "LogsCleanup",
        message: `The task 'loggingDatabaseTableCleanupTask' is being run` });
    }
}

module.exports=LoggingDatabaseTableCleanupTask;
