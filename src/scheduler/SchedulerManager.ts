import cron from 'node-cron';
import Configuration from '../utils/Configuration';
import Constants from '../utils/Constants';
import Logging from '../utils/Logging';
import LoggingDatabaseTableCleanupTask from './tasks/LoggingDatabaseTableCleanupTask';
import OCPIPatchLocationsTask from './tasks/OCPIPatchLocationsTask';

const _schedulerConfig = Configuration.getSchedulerConfig();
export default class SchedulerManager {
  static init() {
    // Active?
    if (_schedulerConfig.active) {
      // Log
      Logging.logInfo({
        tenantID: Constants.DEFAULT_TENANT,
        module: 'Scheduler',
        method: 'init', action: 'Initialization',
        message: 'The Scheduler is active'
      });
      // Yes: init
      for (const task of _schedulerConfig.tasks) {
        // Active?
        if (!task.active) {
          // Log
          Logging.logError({
            tenantID: Constants.DEFAULT_TENANT,
            module: 'Scheduler',
            method: 'init', action: 'Initialization',
            message: `The task '${task.name}' is inactive`
          });
          // No
          return;
        }
        // Tasks
        switch (task.name) {
          // Cleanup of logging table
          case 'loggingDatabaseTableCleanup':
            const loggingDatabaseTableCleanupTask = new LoggingDatabaseTableCleanupTask();
            cron.schedule(task.periodicity, loggingDatabaseTableCleanupTask.run.bind(SchedulerManager, task.config));
            Logging.logInfo({
              tenantID: Constants.DEFAULT_TENANT,
              module: 'Scheduler',
              method: 'init', action: 'Initialization',
              message: `The task '${task.name}' has been scheduled with periodicity ''${task.periodicity}'`
            });
            break;
          // Cleanup of logging table
          case 'OCPIPatchLocationsTask':
            const ocpiPatvhLocationsTask = new OCPIPatchLocationsTask();
            cron.schedule(task.periodicity, ocpiPatvhLocationsTask.run.bind(SchedulerManager, task.config));
            Logging.logInfo({
              tenantID: Constants.DEFAULT_TENANT,
              module: 'Scheduler',
              method: 'init', action: 'Initialization',
              message: `The task '${task.name}' has been scheduled with periodicity ''${task.periodicity}'`
            });
            break;
          // Unknown task
          default:
            // Log
            Logging.logError({
              tenantID: Constants.DEFAULT_TENANT,
              module: 'Scheduler',
              method: 'init', action: 'Initialization',
              message: `The task '${task.name}' is unknown`
            });
        }
      }
    } else {
      // Log
      Logging.logError({
        tenantID: Constants.DEFAULT_TENANT,
        module: 'Scheduler',
        method: 'init', action: 'Initialization',
        message: 'The Scheduler is inactive'
      });
    }
  }
}

