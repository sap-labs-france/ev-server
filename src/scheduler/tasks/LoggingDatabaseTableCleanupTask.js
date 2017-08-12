const Logging = require('../../utils/Logging');
const moment = require('moment');

class LoggingDatabaseTableCleanupTask {
    static run() {
      Logging.logInfo({
        userFullName: "System", source: "Central Server", module: "LoggingDatabaseTableCleanupTask",
        method: "run", action: "LogsCleanup",
        message: `The task 'loggingDatabaseTableCleanupTask' is being run` });

      // Delete date
      let deleteUpToDate = moment().subtract(1, "w").startOf("week").toDate().toISOString();
      // Delete
      Logging.deleteLogs(deleteUpToDate).then(result => {
        // Ok?
        if (result.ok === 1) {
          // Ok
          Logging.logInfo({
            userFullName: "System", source: "Central Server", module: "LoggingDatabaseTableCleanupTask",
            method: "run", action: "LogsCleanup",
            message: `${result.n} Log(s) have been deleted up to date ${deleteUpToDate}` });
        } else {
          // Error
          Logging.logError({
            userFullName: "System", source: "Central Server", module: "LoggingDatabaseTableCleanupTask",
            method: "run", action: "LogsCleanup",
            message: `An error occurred when deleting Logs up to date ${deleteUpToDate}` });
        }
      });
    }
}

module.exports=LoggingDatabaseTableCleanupTask;
