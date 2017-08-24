const Configuration = require('../utils/Configuration');
const cron = require('node-cron');
const Logging = require('../utils/Logging');
const ChargingStationConsumptionTask = require('./tasks/ChargingStationConsumptionTask');
const EndOfChargeNotificationTask = require('./tasks/EndOfChargeNotificationTask');
const LoggingDatabaseTableCleanupTask = require('./tasks/LoggingDatabaseTableCleanupTask');
const ImportUsersTask = require('./tasks/ImportUsersTask');

_schedulerConfig = Configuration.getSchedulerConfig();

class SchedulerHandler {
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
            let chargingStationConsumptionTask = new ChargingStationConsumptionTask();
            cron.schedule(task.periodicity, chargingStationConsumptionTask.run);
            Logging.logInfo({
              userFullName: "System", source: "Central Server", module: "Scheduler",
              method: "init", action: "Initialization",
              message: `The task '${task.name}' has been scheduled with periodicity ''${task.periodicity}'` });
            break;

          // Check for importing users
          case "importUsers":
            let importUsersTask = new ImportUsersTask();
            cron.schedule(task.periodicity, importUsersTask.run);
            Logging.logInfo({
              userFullName: "System", source: "Central Server", module: "Scheduler",
              method: "init", action: "Initialization",
              message: `The task '${task.name}' has been scheduled with periodicity ''${task.periodicity}'` });
            break;

          // End of charge notif
          case "endOfChargeNotification":
            let endOfChargeNotificationTask = new EndOfChargeNotificationTask();
            cron.schedule(task.periodicity, endOfChargeNotificationTask.run);
            Logging.logInfo({
              userFullName: "System", source: "Central Server", module: "Scheduler",
              method: "init", action: "Initialization",
              message: `The task '${task.name}' has been scheduled with periodicity ''${task.periodicity}'` });
            break;

          // Cleanup of logging table
          case "loggingDatabaseTableCleanup":
            let loggingDatabaseTableCleanupTask = new LoggingDatabaseTableCleanupTask();
            cron.schedule(task.periodicity, loggingDatabaseTableCleanupTask.run);
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

module.exports=SchedulerHandler;
