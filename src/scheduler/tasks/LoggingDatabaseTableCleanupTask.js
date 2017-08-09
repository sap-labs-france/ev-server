const Logging = require('../../utils/Logging');
const moment = require('moment');

class LoggingDatabaseTableCleanupTask {
    static run() {
      Logging.logInfo({
        userFullName: "System", source: "Central Server", module: "LoggingDatabaseTableCleanupTask",
        method: "run", action: "LogsCleanup",
        message: `The task 'loggingDatabaseTableCleanupTask' is being run` });

      // Delete date
      let deleteUpToDate = moment().subtract(1, "w").toDate().toISOString();
      console.log(deleteUpToDate);
      // Delete
      Logging.deleteLogs(deleteUpToDate);
    }
}

module.exports=LoggingDatabaseTableCleanupTask;
