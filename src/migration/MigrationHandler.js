const MigrateStartStopTransactionTask = require('./tasks/MigrateStartStopTransactionTask');
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
        // Stop/Start Transaction
        // ---------------------------------------------------------------------
        let migrateStartStopTransactionTask = new MigrateStartStopTransactionTask();
        let migrationFiltered = migrations.filter((migration) => {
          return migration.name === migrateStartStopTransactionTask.getName();
        });
        // Run the migration?
        if (!migrationFiltered || migrationFiltered.length === 0 || migrationFiltered[0].version !== migrateStartStopTransactionTask.getVersion()) {
          // Log
          Logging.logInfo({
            userFullName: "System", source: "BootStrap", module: "start", method: "-", action: "Migrate",
            message: `Migration task ${migrateStartStopTransactionTask.getName()} version ${migrateStartStopTransactionTask.getVersion()} is running` });
          // Yes: Migrate
          promises.push(migrateStartStopTransactionTask.migrate().then(result => {
            let migration = {};
            migration.name = migrateStartStopTransactionTask.getName();
            migration.version = migrateStartStopTransactionTask.getVersion();
            migration.timestamp = new Date();
            // Save
            return global.storage.saveMigration(migration);
          }));
        } else {
          // Log
          Logging.logInfo({
            userFullName: "System", source: "BootStrap", module: "start", method: "-", action: "Migrate",
            message: `Migration task ${migrateStartStopTransactionTask.getName()} version ${migrateStartStopTransactionTask.getVersion()} has already been run` });
        }
        // Wait
        Promise.all(promises).then((results) => {
          // Log
          Logging.logInfo({
            userFullName: "System", source: "BootStrap", module: "start", method: "-", action: "Migrate",
            message: `The migration has finished with success` });
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
