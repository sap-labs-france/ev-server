const Configuration = require('../utils/Configuration');
const cron = require('node-cron');
const Logging = require('../utils/Logging');
const ChargingStationConsumptionTask = require('./tasks/ChargingStationConsumptionTask');
const EndOfChargeNotificationTask = require('./tasks/EndOfChargeNotificationTask');
const LoggingDatabaseTableCleanupTask = require('./tasks/LoggingDatabaseTableCleanupTask');
const ImportUsersTask = require('./tasks/ImportUsersTask');

_schedulerConfig = Configuration.getSchedulerConfig();

class Scheduler {
  static init() {
    // Active?
    if (_schedulerConfig.active) {
      // Log
      Logging.logInfo({
        userFullName: "System", source: "Central Server", module: "Scheduler",
        method: "init", action: "Initialization",
        message: `The Scheduler is active` });
      // Yes: init
      _schedulerConfig.tasks.forEach(task => {
        // Active?
        if (!task.active) {
          // Log
          Logging.logError({
            userFullName: "System", source: "Central Server", module: "Scheduler",
            method: "init", action: "Initialization",
            message: `The task '${task.name}' is inactive` });
          // No
          return;
        }
        // Tasks
        switch (task.name) {
          // Consumption of charging station
          case "chargingStationsConsumption":
            cron.schedule(task.periodicity, ChargingStationConsumptionTask.run);
            Logging.logInfo({
              userFullName: "System", source: "Central Server", module: "Scheduler",
              method: "init", action: "Initialization",
              message: `The task '${task.name}' has been scheduled with periodicity ''${task.periodicity}'` });
            break;

          // Check for importing users
          case "importUsers":
            cron.schedule(task.periodicity, ImportUsersTask.run);
            Logging.logInfo({
              userFullName: "System", source: "Central Server", module: "Scheduler",
              method: "init", action: "Initialization",
              message: `The task '${task.name}' has been scheduled with periodicity ''${task.periodicity}'` });
            break;

          // End of charge notif
          case "endOfChargeNotification":
            cron.schedule(task.periodicity, EndOfChargeNotificationTask.run);
            Logging.logInfo({
              userFullName: "System", source: "Central Server", module: "Scheduler",
              method: "init", action: "Initialization",
              message: `The task '${task.name}' has been scheduled with periodicity ''${task.periodicity}'` });
            break;

          // Cleanup of logging table
          case "loggingDatabaseTableCleanup":
            cron.schedule(task.periodicity, LoggingDatabaseTableCleanupTask.run);
            Logging.logInfo({
              userFullName: "System", source: "Central Server", module: "Scheduler",
              method: "init", action: "Initialization",
              message: `The task '${task.name}' has been scheduled with periodicity ''${task.periodicity}'` });
            break;

          // Unknown task
          default:
            // Log
            Logging.logError({
              userFullName: "System", source: "Central Server", module: "Scheduler",
              method: "init", action: "Initialization",
              message: `The task '${task.name}' is unknown` });
        }
      });
    } else {
      // Log
      Logging.logError({
        userFullName: "System", source: "Central Server", module: "Scheduler",
        method: "init", action: "Initialization",
        message: `The Scheduler is inactive` });
    }
  }
}

module.exports=Scheduler;
