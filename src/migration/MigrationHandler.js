const Logging = require('../utils/Logging');
const Constants = require('../utils/Constants');
const moment = require('moment');
const cluster = require('cluster');
const MigrationStorage = require('../storage/mongodb/MigrationStorage');
const UpdateTransactionInactivityTask = require('./tasks/UpdateTransactionInactivityTask');
const TenantMigrationTask = require('./tasks/TenantMigrationTask');
const UpdateTransactionSoCTask = require('./tasks/UpdateTransactionSoCTask');
const UpdateABBMeterValuesTask = require('./tasks/UpdateKebaMeterValuesTask');
const NormalizeTransactionsTask = require('./tasks/NormalizeTransactionsTask');
const CreateConsumptionsTask = require('./tasks/CreateConsumptionsTask');
const CleanupTransactionTask = require('./tasks/CleanupTransactionTask');
const TransactionsAddTimezoneTask = require('./tasks/TransactionsAddTimezoneTask');
const UsersAddNotificationsFlagTask = require('./tasks/UsersAddNotificationsFlagTask');
const UpdateTransactionSimplePriceTask = require('./tasks/UpdateTransactionSimplePriceTask');
const MigrateTenantSettingsTask = require('./tasks/MigrateTenantSettingsTask');
const UpdateTransactionExtraInactivityTask = require('./tasks/UpdateTransactionExtraInactivityTask');
const EncryptClientSecretKeysInSettingsTask = require('./tasks/EncryptClientSecretKeysInSettingsTask');


class MigrationHandler {
  // Migrate method
  static async migrate() {
    try {
      if (!cluster.isMaster) {
        return;
      }

      const startMigrationTime = moment();
      const currentMigrationTasks = [];

      // Clean previously running migrations belonging to the current host at startup
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
      currentMigrationTasks.push(new EncryptClientSecretKeysInSettingsTask());

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
            MigrationHandler._executeTask(currentMigrationTask);
          }, 1000);
        } else {
          // Execute Migration Task sync
          await MigrationHandler._executeTask(currentMigrationTask);
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

  static async _executeTask(currentMigrationTask) {
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
  }
}

module.exports = MigrationHandler;
