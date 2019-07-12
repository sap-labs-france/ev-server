import cluster from 'cluster';
import moment from 'moment';
import AddSensitiveDataInSettingsTask from './tasks/AddSensitiveDataInSettingsTask';
import CleanupTransactionTask from './tasks/CleanupTransactionTask';
import Constants from '../utils/Constants';
import CreateConsumptionsTask from './tasks/CreateConsumptionsTask';
import RunLock from '../utils/Locking';
import Logging from '../utils/Logging';
import MigrateTenantSettingsTask from './tasks/MigrateTenantSettingsTask';
import MigrationStorage from '../storage/mongodb/MigrationStorage';
import NormalizeTransactionsTask from './tasks/NormalizeTransactionsTask';
import TenantMigrationTask from './tasks/TenantMigrationTask';
import TransactionsAddTimezoneTask from './tasks/TransactionsAddTimezoneTask';
import UpdateABBMeterValuesTask from './tasks/UpdateKebaMeterValuesTask';
import UpdateTransactionExtraInactivityTask from './tasks/UpdateTransactionExtraInactivityTask';
import UpdateTransactionInactivityTask from './tasks/UpdateTransactionInactivityTask';
import UpdateTransactionSimplePriceTask from './tasks/UpdateTransactionSimplePriceTask';
import UpdateTransactionSoCTask from './tasks/UpdateTransactionSoCTask';
import UsersAddNotificationsFlagTask from './tasks/UsersAddNotificationsFlagTask';
import SiteUsersHashIDsTask from './tasks/SiteUsersHashIDsTask';


export default class MigrationHandler {
  // Migrate method
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
      currentMigrationTasks.push(new SiteUsersHashIDsTask());
      // currentMigrationTasks.push(new AddSensitiveDataInSettingsTask());

      // Get the already done migrations from the DB
      const migrationTasksDone = await MigrationStorage.getMigrations();

      // Check
      for (const currentMigrationTask of currentMigrationTasks) {
        // Check if not already done
        const migrationTaskDone = migrationTasksDone.find((migrationTask) => {
          // Same name and version
          return ((currentMigrationTask.getName() === migrationTask.name) &&
            (currentMigrationTask.getVersion() === migrationTask.version));
        });
        // Already processed?
        if (migrationTaskDone) {
          // Yes
          Logging.logInfo({
            tenantID: Constants.DEFAULT_TENANT,
            source: 'Migration', action: 'Migration',
            module: 'MigrationHandler', method: 'migrate',
            message: `${currentMigrationTask.isAsynchronous() ? 'Asynchronous' : 'Synchronous'} task '${currentMigrationTask.getName()}' Version '${currentMigrationTask.getVersion()}' has already been processed`
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
        source: 'Migration', action: 'Migration',
        module: 'MigrationHandler', method: 'migrate',
        message: `All synchronous migration tasks have been run with success in ${totalMigrationTimeSecs} secs`
      });
    } catch (error) {
      // Log in the console also
      // eslint-disable-next-line no-console
      console.log(error);
      // Log
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

