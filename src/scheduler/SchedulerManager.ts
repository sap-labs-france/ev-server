import cron from 'node-cron';
import Configuration from '../utils/Configuration';
import Constants from '../utils/Constants';
import Logging from '../utils/Logging';
import LoggingDatabaseTableCleanupTask from './tasks/LoggingDatabaseTableCleanupTask';
import OCPIPatchLocationsTask from './tasks/OCPIPatchLocationsTask';
import SchedulerTask from './SchedulerTask';
import SynchronizeRefundTransactionsTask from './tasks/SynchronizeRefundTransactionsTask';
import PeriodicNotificationsTask from './tasks/PeriodicNotificationsTask';

export default class SchedulerManager {
  private static schedulerConfig = Configuration.getSchedulerConfig();

  static init() {
    // Active?
    if (SchedulerManager.schedulerConfig.active) {
      // Log
      Logging.logInfo({
        tenantID: Constants.DEFAULT_TENANT,
        module: 'Scheduler', method: 'init',
        action: 'Scheduler',
        message: 'The Scheduler is active'
      });
      // Yes: init
      for (const task of SchedulerManager.schedulerConfig.tasks) {
        // Active?
        if (!task.active) {
          Logging.logError({
            tenantID: Constants.DEFAULT_TENANT,
            module: 'Scheduler', method: 'init',
            action: 'Scheduler',
            message: `The task '${task.name}' is inactive`
          });
          continue;
        }
        let schedulerTask: SchedulerTask;
        // Tasks
        switch (task.name) {
          case 'LoggingDatabaseTableCleanupTask':
            schedulerTask = new LoggingDatabaseTableCleanupTask();
            break;
          case 'PeriodicNotificationsTask':
            // The task runs every five minutes
            schedulerTask = new PeriodicNotificationsTask();
            break;
          case 'OCPIPatchLocationsTask':
            schedulerTask = new OCPIPatchLocationsTask();
            break;
          case 'SynchronizeRefundTransactionsTask':
            schedulerTask = new SynchronizeRefundTransactionsTask();
            break;
          default:
            Logging.logError({
              tenantID: Constants.DEFAULT_TENANT,
              module: 'Scheduler', method: 'init',
              action: 'Scheduler',
              message: `The task '${task.name}' is unknown`
            });
        }
        if (schedulerTask) {
          cron.schedule(task.periodicity, async (): Promise<void> => await schedulerTask.run(task.name, task.config, task.subtasks));
          Logging.logInfo({
            tenantID: Constants.DEFAULT_TENANT,
            module: 'Scheduler', method: 'init',
            action: 'Scheduler',
            message: `The task '${task.name}' has been scheduled with periodicity ''${task.periodicity}'`
          });
        }
      }
    } else {
      // Log
      Logging.logWarning({
        tenantID: Constants.DEFAULT_TENANT,
        module: 'Scheduler', method: 'init',
        action: 'Scheduler',
        message: 'The Scheduler is inactive'
      });
    }
  }
}

