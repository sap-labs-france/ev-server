import cluster from 'cluster';
import moment from 'moment';
import AddSensitiveDataInSettingsTask from './tasks/AddSensitiveDataInSettingsTask';
import AddTransactionRefundStatusTask from './tasks/AddTransactionRefundStatusTask';
import AddNotificationsFlagsToUsersTask from './tasks/AddNotificationsFlagsToUsersTask';
import AddLastLoginDateToUsersTask from './tasks/AddLastLoginDateToUsersTask';
import Constants from '../utils/Constants';
import RunLock from '../utils/Locking';
import Logging from '../utils/Logging';
import MigrationStorage from '../storage/mongodb/MigrationStorage';
import SiteUsersHashIDsTask from './tasks/SiteUsersHashIDsTask';

export default class MigrationHandler {
  static async migrate() {
    try {
      // Check we're on the master nodejs process
      if (!cluster.isMaster) {
        return;
      }
      const startMigrationTime = moment();
      const currentMigrationTasks = [];
      // Log
      Logging.logInfo({
        tenantID: Constants.DEFAULT_TENANT,
        source: 'Migration', action: 'Migration',
        module: 'MigrationHandler', method: 'migrate',
        message: 'Running migration tasks...'
      });

      // Create tasks
      currentMigrationTasks.push(new SiteUsersHashIDsTask());
      currentMigrationTasks.push(new AddTransactionRefundStatusTask());
      currentMigrationTasks.push(new AddSensitiveDataInSettingsTask());
      currentMigrationTasks.push(new AddNotificationsFlagsToUsersTask());
      currentMigrationTasks.push(new AddLastLoginDateToUsersTask());

      // Get the already done migrations from the DB
      const migrationTasksDone = await MigrationStorage.getMigrations();

      // Check
      for (const currentMigrationTask of currentMigrationTasks) {
        // Check if not already done
        const migrationTaskDone = migrationTasksDone.find((migrationTask) =>
          // Same name and version
          ((currentMigrationTask.getName() === migrationTask.name) &&
            (currentMigrationTask.getVersion() === migrationTask.version))
        );
        // Already processed?
        if (migrationTaskDone) {
          Logging.logInfo({
            tenantID: Constants.DEFAULT_TENANT,
            source: 'Migration', action: 'Migration',
            module: 'MigrationHandler', method: 'migrate',
            message: `${currentMigrationTask.isAsynchronous() ? 'Asynchronous' : 'Synchronous'} task '${currentMigrationTask.getName()}' Version '${currentMigrationTask.getVersion()}' has already been processed`
          });
          continue;
        }
        // Check
        if (currentMigrationTask.isAsynchronous()) {
          // Execute Async
          setTimeout(() => {
            MigrationHandler._executeTask(currentMigrationTask);
          }, 1000);
        } else {
          // Execute Sync
          await MigrationHandler._executeTask(currentMigrationTask);
        }
      }
      // Log Total Processing Time
      const totalMigrationTimeSecs = moment.duration(moment().diff(startMigrationTime)).asSeconds();
      Logging.logInfo({
        tenantID: Constants.DEFAULT_TENANT,
        source: 'Migration', action: 'Migration',
        module: 'MigrationHandler', method: 'migrate',
        message: `All synchronous migration tasks have been run successfully in ${totalMigrationTimeSecs} secs`
      });
    } catch (error) {
      Logging.logError({
        tenantID: Constants.DEFAULT_TENANT,
        source: 'Migration', action: 'Migration',
        module: 'MigrationHandler', method: 'migrate',
        message: error.toString(),
        detailedMessages: error
      });
    }
  }

  static async _executeTask(currentMigrationTask): Promise<void> {
    // Create a RunLock by migration name and version
    const migrationLock = new RunLock(`Migration ${currentMigrationTask.getName()}~${currentMigrationTask.getVersion()}`);
    // Acquire the migration lock
    if (await migrationLock.tryAcquire()) {
      // Log Start Task
      Logging.logInfo({
        tenantID: Constants.DEFAULT_TENANT,
        source: 'Migration', action: 'Migration',
        module: 'MigrationHandler', method: 'migrate',
        message: `${currentMigrationTask.isAsynchronous() ? 'Asynchronous' : 'Synchronous'} task '${currentMigrationTask.getName()}' Version '${currentMigrationTask.getVersion()}' is running...`
      });
      // Log in the console also
      // eslint-disable-next-line no-console
      console.log(`Migration Task '${currentMigrationTask.getName()}' Version '${currentMigrationTask.getVersion()}' is running ${cluster.isWorker ? 'in worker ' + cluster.worker.id : 'in master'}...`);
      // Start time and date
      const startTaskTime = moment();
      const startDate = new Date();
      // Execute Migration
      await currentMigrationTask.migrate();
      // End time
      const totalTaskTimeSecs = moment.duration(moment().diff(startTaskTime)).asSeconds();
      // End
      // Save to the DB
      await MigrationStorage.saveMigration({
        name: currentMigrationTask.getName(),
        version: currentMigrationTask.getVersion(),
        timestamp: startDate,
        durationSecs: totalTaskTimeSecs
      });
      Logging.logInfo({
        tenantID: Constants.DEFAULT_TENANT,
        source: 'Migration', action: 'Migration',
        module: 'MigrationHandler', method: 'migrate',
        message: `${currentMigrationTask.isAsynchronous() ? 'Asynchronous' : 'Synchronous'} task '${currentMigrationTask.getName()}' Version '${currentMigrationTask.getVersion()}' has run with success in ${totalTaskTimeSecs} secs`
      });
      // Log in the console also
      // eslint-disable-next-line no-console
      console.log(`Migration Task '${currentMigrationTask.getName()}' Version '${currentMigrationTask.getVersion()}' has run with success in ${totalTaskTimeSecs} secs ${cluster.isWorker ? 'in worker ' + cluster.worker.id : 'in master'}`);
      // Release the migration lock
      await migrationLock.release();
    }
  }
}

