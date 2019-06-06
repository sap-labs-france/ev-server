import Logging from '../utils/Logging';
import Constants from '../utils/Constants';
import moment from 'moment';
import cluster from 'cluster';
import MigrationStorage from '../storage/mongodb/MigrationStorage';
import UpdateTransactionInactivityTask from './tasks/UpdateTransactionInactivityTask';
import TenantMigrationTask from './tasks/TenantMigrationTask';
import UpdateTransactionSoCTask from './tasks/UpdateTransactionSoCTask';
import UpdateABBMeterValuesTask from './tasks/UpdateKebaMeterValuesTask';
import NormalizeTransactionsTask from './tasks/NormalizeTransactionsTask';
import CreateConsumptionsTask from './tasks/CreateConsumptionsTask';
import CleanupTransactionTask from './tasks/CleanupTransactionTask';
import TransactionsAddTimezoneTask from './tasks/TransactionsAddTimezoneTask';
import UsersAddNotificationsFlagTask from './tasks/UsersAddNotificationsFlagTask';
import UpdateTransactionSimplePriceTask from './tasks/UpdateTransactionSimplePriceTask';
import MigrateTenantSettingsTask from './tasks/MigrateTenantSettingsTask';
import UpdateTransactionExtraInactivityTask from './tasks/UpdateTransactionExtraInactivityTask';

export default class MigrationHandler {
  // Migrate method
  static async migrate() {
    try {
      if (!cluster.isMaster) {
        return;
      }

      const startMigrationTime = moment();
      const currentMigrationTasks = [];
      
      // Clean previously running migration belonging to the current host at startup
      await MigrationStorage.cleanRunningMigrations();

      // Log
      Logging.logInfo({
        tenantID: Constants.DEFAULT_TENANT,
        source: "Migration", action: "Migration",
        module: "MigrationHandler", method: "migrate",
        message: `Running migration tasks...`
      });

      // Create tasks
      currentMigrationTasks.push(new UpdateTransactionInactivityTask());
      currentMigrationTasks.push(new TenantMigrationTask());
      currentMigrationTasks.push(new UpdateTransactionSoCTask());
      currentMigrationTasks.push(new UpdateABBMeterValuesTask());
      currentMigrationTasks.push(new NormalizeTransactionsTask());
      currentMigrationTasks.push(new CleanupTransactionTask());
      currentMigrationTasks.push(new CreateConsumptionsTask());
      currentMigrationTasks.push(new TransactionsAddTimezoneTask());
      currentMigrationTasks.push(new UpdateTransactionSimplePriceTask());
      currentMigrationTasks.push(new UsersAddNotificationsFlagTask());
      currentMigrationTasks.push(new MigrateTenantSettingsTask());
      currentMigrationTasks.push(new UpdateTransactionExtraInactivityTask());

      // Get the already done migrations from the DB
      const migrationTasksDone = await MigrationStorage.getMigrations();

      // Get the already running migrations from the DB
      const migrationTasksRunning = await MigrationStorage.getRunningMigrations();

      // Check
      for (const currentMigrationTask of currentMigrationTasks) {
        // Check if not already done
        const migrationTaskDone = migrationTasksDone.find((migrationTaskDone) => {
          // Same name and version
          return ((currentMigrationTask.getName() === migrationTaskDone.name) &&
            (currentMigrationTask.getVersion() === migrationTaskDone.version));
        });
        // Already processed?
        if (migrationTaskDone) {
          // Yes
          Logging.logInfo({
            tenantID: Constants.DEFAULT_TENANT,
            source: "Migration", action: "Migration",
            module: "MigrationHandler", method: "migrate",
            message: `${currentMigrationTask.isAsynchronous() ? 'Asynchronous' : 'Synchronous'} task '${currentMigrationTask.getName()}' Version '${currentMigrationTask.getVersion()}' has already been processed`
          });
          // Continue
          continue;
        }

        // Check if not already running
        const migrationTaskRunning = migrationTasksRunning.find((migrationTaskRunning) => {
          // Same name and version
          return ((currentMigrationTask.getName() === migrationTaskRunning.name) &&
            (currentMigrationTask.getVersion() === migrationTaskRunning.version));
        });
        // Already running?
        if (migrationTaskRunning) {
          // Yes
          Logging.logInfo({
            tenantID: Constants.DEFAULT_TENANT,
            source: "Migration", action: "Migration",
            module: "MigrationHandler", method: "migrate",
            message: `${currentMigrationTask.isAsynchronous() ? 'Asynchronous' : 'Synchronous'} task '${currentMigrationTask.getName()}' Version '${currentMigrationTask.getVersion()}' is already running`
          });
          // Continue
          continue;
        }

        // Check if async
        if (currentMigrationTask.isAsynchronous()) {
          // Execute async
          setTimeout(() => {
            // Execute Migration Task sync
            MigrationHandler.executeTask(currentMigrationTask);
          }, 1000);
        } else {
          // Execute Migration Task sync
          await MigrationHandler.executeTask(currentMigrationTask);
        }
      }
      // Log Total Processing Time
      const totalMigrationTimeSecs = moment.duration(moment().diff(startMigrationTime)).asSeconds();
      Logging.logInfo({
        tenantID: Constants.DEFAULT_TENANT,
        source: "Migration", action: "Migration",
        module: "MigrationHandler", method: "migrate",
        message: `All synchronous migration tasks have been run with success in ${totalMigrationTimeSecs} secs`
      });
    } catch (error) {
      // Log in the console also
      // eslint-disable-next-line no-console
      console.log(error);
      // Log
      Logging.logError({
        tenantID: Constants.DEFAULT_TENANT,
        source: "Migration", action: "Migration",
        module: "MigrationHandler", method: "migrate",
        message: error.toString(),
        detailedMessages: error
      });
    }
  }

  static async executeTask(currentMigrationTask) {
    // Log Start Task
    Logging.logInfo({
      tenantID: Constants.DEFAULT_TENANT,
      source: "Migration", action: "Migration",
      module: "MigrationHandler", method: "migrate",
      message: `${currentMigrationTask.isAsynchronous() ? 'Asynchronous' : 'Synchronous'} task '${currentMigrationTask.getName()}' Version '${currentMigrationTask.getVersion()}' is running...`
    });
    // Log in the console also
    // eslint-disable-next-line no-console
    console.log(`Migration Task '${currentMigrationTask.getName()}' Version '${currentMigrationTask.getVersion()}' is running ${cluster.isWorker ? 'in worker ' + cluster.worker.id : 'in master'}...`);

    // Start time and date
    const startTaskTime = moment();
    const startDate = new Date();

    const currentMigration = {
      name: currentMigrationTask.getName(),
      version: currentMigrationTask.getVersion(),
      timestamp: startDate
    };

    // Flag the migration as running
    await MigrationStorage.saveRunningMigration(currentMigration);

    // Execute Migration
    await currentMigrationTask.migrate();

    // Remove the migration from the running ones
    await MigrationStorage.deleteRunningMigration(currentMigration);

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
      source: "Migration", action: "Migration",
      module: "MigrationHandler", method: "migrate",
      message: `${currentMigrationTask.isAsynchronous() ? 'Asynchronous' : 'Synchronous'} task '${currentMigrationTask.getName()}' Version '${currentMigrationTask.getVersion()}' has run with success in ${totalTaskTimeSecs} secs`
    });
    // Log in the console also
    // eslint-disable-next-line no-console
    console.log(`Migration Task '${currentMigrationTask.getName()}' Version '${currentMigrationTask.getVersion()}' has run with success in ${totalTaskTimeSecs} secs ${cluster.isWorker ? 'in worker ' + cluster.worker.id : 'in master'}`);

    // Save to the DB
    await MigrationStorage.saveMigration({
      name: currentMigrationTask.getName(),
      version: currentMigrationTask.getVersion(),
      timestamp: new Date(),
      durationSecs: totalTaskTimeSecs
    });
  }
}


