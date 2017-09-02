const Logging = require('../utils/Logging');

class MigrationHandler {
  // Migrate method
  static migrate() {
    // Return
    return new Promise((fulfill, reject) => {
      // Log
      Logging.logInfo({
        userFullName: "System", source: "BootStrap", module: "start", method: "-", action: "Migrate",
        message: `Migration has started to run` });
      // Get the Migration
      global.storage.getMigrations().then((migrations) => {
        let promises = [];
        // ---------------------------------------------------------------------
        // Migration task
        // ---------------------------------------------------------------------
        // // Log task is running
        // Logging.logInfo({
        //   userFullName: "System", source: "BootStrap", module: "start", method: "-", action: "Migrate",
        //   message: `Migration task ${migrateStartStopTransactionTask.getName()} version ${migrateStartStopTransactionTask.getVersion()} is running` });

        // // Log tasks has already been run
        // Logging.logInfo({
        //   userFullName: "System", source: "BootStrap", module: "start", method: "-", action: "Migrate",
        //   message: `Migration task ${migrateStartStopTransactionTask.getName()} version ${migrateStartStopTransactionTask.getVersion()} has already been run` });
        // Wait
        Promise.all(promises).then((results) => {
          // Ok
          fulfill(results);
        }).catch((error) => {
          // Error
          reject(error);
        });
      });
    });
  }
}
module.exports=MigrationHandler;
