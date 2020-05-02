import AddActivePropertyToTagsTask from './tasks/AddActivePropertyToTagsTask';
import AddInactivityStatusInTransactionsTask from './tasks/AddInactivityStatusInTransactionsTask';
import AddIssuerFieldTask from './tasks/AddIssuerFieldTask';
import AddLastChangePropertiesToBadgeTask from './tasks/AddLastChangePropertiesToBadgeTask';
import AddLimitToConsumptionsTask from './tasks/AddLimitToConsumptionsTask';
import AddNotificationsFlagsToUsersTask from './tasks/AddNotificationsFlagsToUsersTask';
import AddSensitiveDataInSettingsTask from './tasks/AddSensitiveDataInSettingsTask';
import AddTagTypeTask from './tasks/AddTagTypeTask';
import AddTransactionRefundStatusTask from './tasks/AddTransactionRefundStatusTask';
import CleanupAllTransactionsTask from './tasks/CleanupAllTransactionsTask';
import CleanupMeterValuesTask from './tasks/CleanupMeterValuesTask';
import CleanupOrphanBadgeTask from './tasks/CleanupOrphanBadgeTask';
import Constants from '../utils/Constants';
import InitialCarImportTask from './tasks/InitialCarImportTask';
import { LockEntity } from '../types/Locking';
import LockingManager from '../locking/LockingManager';
import Logging from '../utils/Logging';
import MigrateCoordinatesTask from './tasks/MigrateCoordinatesTask';
import MigrateOcpiSettingTask from './tasks/MigrateOcpiSettingTask';
import MigrationStorage from '../storage/mongodb/MigrationStorage';
import RenameTagPropertiesTask from './tasks/RenameTagPropertiesTask';
import { ServerAction } from '../types/Server';
import SiteUsersHashIDsTask from './tasks/SiteUsersHashIDsTask';
import UpdateChargingStationTemplatesTask from './tasks/UpdateChargingStationTemplatesTask';
import UpdateConsumptionsToObjectIDs from './tasks/UpdateConsumptionsToObjectIDs';
import cluster from 'cluster';
import moment from 'moment';

const MODULE_NAME = 'MigrationHandler';

export default class MigrationHandler {
  static async migrate() {
    // Check we're on the master nodejs process
    if (!cluster.isMaster) {
      return;
    }
    // Create a Lock for migration
    const migrationLock = LockingManager.createExclusiveLock(Constants.DEFAULT_TENANT, LockEntity.DATABASE, 'migration');
    if (!(await LockingManager.acquire(migrationLock))) {
      return;
    }
    try {
      const startMigrationTime = moment();
      const currentMigrationTasks = [];
      // Log
      Logging.logInfo({
        tenantID: Constants.DEFAULT_TENANT,
        action: ServerAction.MIGRATION,
        module: MODULE_NAME, method: 'migrate',
        message: 'Running migration tasks...'
      });
      // Create tasks
      currentMigrationTasks.push(new SiteUsersHashIDsTask());
      currentMigrationTasks.push(new AddTransactionRefundStatusTask());
      currentMigrationTasks.push(new AddSensitiveDataInSettingsTask());
      currentMigrationTasks.push(new AddNotificationsFlagsToUsersTask());
      currentMigrationTasks.push(new MigrateCoordinatesTask());
      currentMigrationTasks.push(new MigrateOcpiSettingTask());
      currentMigrationTasks.push(new AddTagTypeTask());
      currentMigrationTasks.push(new CleanupAllTransactionsTask());
      currentMigrationTasks.push(new CleanupMeterValuesTask());
      currentMigrationTasks.push(new RenameTagPropertiesTask());
      currentMigrationTasks.push(new AddInactivityStatusInTransactionsTask());
      currentMigrationTasks.push(new UpdateChargingStationTemplatesTask());
      currentMigrationTasks.push(new AddIssuerFieldTask());
      currentMigrationTasks.push(new CleanupOrphanBadgeTask());
      currentMigrationTasks.push(new AddLastChangePropertiesToBadgeTask());
      currentMigrationTasks.push(new AddLimitToConsumptionsTask());
      currentMigrationTasks.push(new AddActivePropertyToTagsTask());
      currentMigrationTasks.push(new InitialCarImportTask());
      currentMigrationTasks.push(new UpdateConsumptionsToObjectIDs());
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
          continue;
        }
        // Check
        if (currentMigrationTask.isAsynchronous()) {
          // Execute Async
          setTimeout(() => {
            MigrationHandler._executeTask(currentMigrationTask).catch(() => {});
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
        action: ServerAction.MIGRATION,
        module: MODULE_NAME, method: 'migrate',
        message: `The migration has been run in ${totalMigrationTimeSecs} secs`
      });
    } catch (error) {
      Logging.logError({
        tenantID: Constants.DEFAULT_TENANT,
        action: ServerAction.MIGRATION,
        module: MODULE_NAME, method: 'migrate',
        message: error.toString(),
        detailedMessages: { error: error.message, stack: error.stack }
      });
    } finally {
      // Release lock
      await LockingManager.release(migrationLock);
    }
  }

  static async _executeTask(currentMigrationTask): Promise<void> {
    // Create a Lock by migration name (for async tasks)
    const migrateTaskLock = LockingManager.createExclusiveLock(Constants.DEFAULT_TENANT, LockEntity.DATABASE, `migrate~task~${currentMigrationTask.getName()}`);
    // Acquire the migration lock
    if (!(await LockingManager.acquire(migrateTaskLock))) {
      return;
    }
    try {
      // Log Start Task
      Logging.logInfo({
        tenantID: Constants.DEFAULT_TENANT,
        action: ServerAction.MIGRATION,
        module: MODULE_NAME, method: 'migrate',
        message: `${currentMigrationTask.isAsynchronous() ? 'Asynchronous' : 'Synchronous'} task '${currentMigrationTask.getName()}' Version '${currentMigrationTask.getVersion()}' is running...`
      });
      // Log in the console also
      // eslint-disable-next-line no-console
      console.log(`${currentMigrationTask.isAsynchronous() ? 'Asynchronous' : 'Synchronous'} Migration Task '${currentMigrationTask.getName()}' Version '${currentMigrationTask.getVersion()}' is running ${cluster.isWorker ? 'in worker ' + cluster.worker.id : 'in master'}...`);
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
        action: ServerAction.MIGRATION,
        module: MODULE_NAME, method: 'migrate',
        message: `${currentMigrationTask.isAsynchronous() ? 'Asynchronous' : 'Synchronous'} task '${currentMigrationTask.getName()}' Version '${currentMigrationTask.getVersion()}' has run with success in ${totalTaskTimeSecs} secs`
      });
      // Log in the console also
      // eslint-disable-next-line no-console
      console.log(`${currentMigrationTask.isAsynchronous() ? 'Asynchronous' : 'Synchronous'} Migration Task '${currentMigrationTask.getName()}' Version '${currentMigrationTask.getVersion()}' has run with success in ${totalTaskTimeSecs} secs ${cluster.isWorker ? 'in worker ' + cluster.worker.id : 'in master'}`);
    } catch (error) {
      throw error;
    } finally {
      // Release the migration lock
      await LockingManager.release(migrateTaskLock);
    }
  }
}

