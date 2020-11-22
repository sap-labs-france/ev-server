import AddActivePropertyToTagsTask from './tasks/AddActivePropertyToTagsTask';
import AddConsumptionAmpsToConsumptionsTask from './tasks/AddConsumptionAmpsToConsumptionsTask';
import AddCreatedPropertiesToTagTask from './tasks/AddCreatedPropertiesToTagTask';
import AddDefaultPropertyToTagsTask from './tasks/AddDefaultPropertyToTagsTask';
import AddDescriptionToTagsTask from './tasks/AddDescriptionToTagsTask';
import AddInactivityStatusInTransactionsTask from './tasks/AddInactivityStatusInTransactionsTask';
import AddIssuerFieldTask from './tasks/AddIssuerFieldTask';
import AddLastChangePropertiesToBadgeTask from './tasks/AddLastChangePropertiesToBadgeTask';
import AddNotificationsFlagsToUsersTask from './tasks/AddNotificationsFlagsToUsersTask';
import AddSensitiveDataInSettingsTask from './tasks/AddSensitiveDataInSettingsTask';
import AddSiteAreaLimitToConsumptionsTask from './tasks/AddSiteAreaLimitToConsumptionsTask';
import AddTagTypeTask from './tasks/AddTagTypeTask';
import AddTransactionRefundStatusTask from './tasks/AddTransactionRefundStatusTask';
import AddUserInTransactionsTask from './tasks/AddUserInTransactionsTask';
import AlignTagsWithUsersIssuerTask from './tasks/AlignTagsWithUsersIssuerTask';
import CleanupMeterValuesTask from './tasks/CleanupMeterValuesTask';
import CleanupOrphanBadgeTask from './tasks/CleanupOrphanBadgeTask';
import CleanupSiteAreasTask from './tasks/CleanupSiteAreasTask';
import Constants from '../utils/Constants';
import DeleteChargingStationPropertiesTask from './tasks/DeleteChargingStationPropertiesTask';
import InitialCarImportTask from './tasks/InitialCarImportTask';
import { LockEntity } from '../types/Locking';
import LockingManager from '../locking/LockingManager';
import Logging from '../utils/Logging';
import LogicallyDeleteTagsOfDeletedUsersTask from './tasks/LogicallyDeleteTagsOfDeletedUsersTask';
import MigrateCoordinatesTask from './tasks/MigrateCoordinatesTask';
import MigrateOcpiSettingTask from './tasks/MigrateOcpiSettingTask';
import MigrateOcpiTransactionsTask from './tasks/MigrateOcpiTransactionsTask';
import MigrationStorage from '../storage/mongodb/MigrationStorage';
import MigrationTask from './MigrationTask';
import RecomputeAllTransactionsConsumptionsTask from './tasks/RecomputeAllTransactionsConsumptionsTask';
import RenameChargingStationPropertiesTask from './tasks/RenameChargingStationPropertiesTask';
import RenameTagPropertiesTask from './tasks/RenameTagPropertiesTask';
import RenameTransactionsAndConsumptionsTask from './tasks/RenameTransactionsAndConsumptionsTask';
import { ServerAction } from '../types/Server';
import SiteUsersHashIDsTask from './tasks/SiteUsersHashIDsTask';
import UnmarkTransactionExtraInactivitiesTask from './tasks/UnmarkTransactionExtraInactivitiesTask';
import UpdateChargingStationStaticLimitationTask from './tasks/UpdateChargingStationStaticLimitationTask';
import UpdateConsumptionsToObjectIDsTask from './tasks/UpdateConsumptionsToObjectIDsTask';
import UpdateLimitsInConsumptionsTask from './tasks/UpdateLimitsInConsumptionsTask';
import cluster from 'cluster';
import moment from 'moment';

const MODULE_NAME = 'MigrationHandler';

export default class MigrationHandler {
  public static async migrate(processAsyncTasksOnly = false): Promise<void> {
    // Check we're on the master nodejs process
    if (!cluster.isMaster) {
      return;
    }
    // Create a Lock for migration
    const migrationLock = LockingManager.createExclusiveLock(Constants.DEFAULT_TENANT, LockEntity.DATABASE, 'migration');
    if (await LockingManager.acquire(migrationLock)) {
      try {
        const startMigrationTime = moment();
        const currentMigrationTasks: MigrationTask[] = [];
        // Log
        Logging.logInfo({
          tenantID: Constants.DEFAULT_TENANT,
          action: ServerAction.MIGRATION,
          module: MODULE_NAME, method: 'migrate',
          message: `Running ${processAsyncTasksOnly ? 'asynchronous' : 'synchronous'} migration tasks...`
        });
        // Create tasks
        currentMigrationTasks.push(new SiteUsersHashIDsTask());
        currentMigrationTasks.push(new AddTransactionRefundStatusTask());
        currentMigrationTasks.push(new AddSensitiveDataInSettingsTask());
        currentMigrationTasks.push(new AddNotificationsFlagsToUsersTask());
        currentMigrationTasks.push(new MigrateCoordinatesTask());
        currentMigrationTasks.push(new MigrateOcpiSettingTask());
        currentMigrationTasks.push(new AddTagTypeTask());
        currentMigrationTasks.push(new CleanupMeterValuesTask());
        currentMigrationTasks.push(new RenameTagPropertiesTask());
        currentMigrationTasks.push(new AddInactivityStatusInTransactionsTask());
        currentMigrationTasks.push(new AddIssuerFieldTask());
        currentMigrationTasks.push(new CleanupOrphanBadgeTask());
        currentMigrationTasks.push(new AddActivePropertyToTagsTask());
        currentMigrationTasks.push(new InitialCarImportTask());
        currentMigrationTasks.push(new UpdateConsumptionsToObjectIDsTask());
        currentMigrationTasks.push(new AddSiteAreaLimitToConsumptionsTask());
        currentMigrationTasks.push(new MigrateOcpiTransactionsTask());
        currentMigrationTasks.push(new UpdateChargingStationStaticLimitationTask());
        currentMigrationTasks.push(new AddSiteAreaLimitToConsumptionsTask());
        currentMigrationTasks.push(new UpdateLimitsInConsumptionsTask());
        currentMigrationTasks.push(new RenameTransactionsAndConsumptionsTask());
        currentMigrationTasks.push(new AddConsumptionAmpsToConsumptionsTask());
        currentMigrationTasks.push(new RenameChargingStationPropertiesTask());
        currentMigrationTasks.push(new CleanupSiteAreasTask());
        currentMigrationTasks.push(new UnmarkTransactionExtraInactivitiesTask());
        currentMigrationTasks.push(new RecomputeAllTransactionsConsumptionsTask());
        currentMigrationTasks.push(new AddUserInTransactionsTask());
        currentMigrationTasks.push(new AlignTagsWithUsersIssuerTask());
        currentMigrationTasks.push(new AddLastChangePropertiesToBadgeTask());
        currentMigrationTasks.push(new LogicallyDeleteTagsOfDeletedUsersTask());
        currentMigrationTasks.push(new AddCreatedPropertiesToTagTask());
        currentMigrationTasks.push(new AddDescriptionToTagsTask());
        currentMigrationTasks.push(new AddDefaultPropertyToTagsTask());
        currentMigrationTasks.push(new DeleteChargingStationPropertiesTask());
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
          if (currentMigrationTask.isAsynchronous() && processAsyncTasksOnly) {
            // Execute Async
            await MigrationHandler.executeTask(currentMigrationTask);
          } else if (!currentMigrationTask.isAsynchronous() && !processAsyncTasksOnly) {
            // Execute Sync
            await MigrationHandler.executeTask(currentMigrationTask);
          }
        }
        // Log Total Processing Time
        const totalMigrationTimeSecs = moment.duration(moment().diff(startMigrationTime)).asSeconds();
        Logging.logInfo({
          tenantID: Constants.DEFAULT_TENANT,
          action: ServerAction.MIGRATION,
          module: MODULE_NAME, method: 'migrate',
          message: `The ${processAsyncTasksOnly ? 'asynchronous' : 'synchronous'} migration has been run in ${totalMigrationTimeSecs} secs`
        });
      } catch (error) {
        Logging.logError({
          tenantID: Constants.DEFAULT_TENANT,
          action: ServerAction.MIGRATION,
          module: MODULE_NAME, method: 'migrate',
          message: error.message,
          detailedMessages: { error: error.message, stack: error.stack }
        });
      } finally {
        // Release lock
        await LockingManager.release(migrationLock);
      }
    }
    // Process async tasks one by one
    if (!processAsyncTasksOnly) {
      setTimeout(() => {
        MigrationHandler.migrate(true).catch(() => { });
      }, 5000);
    }
  }

  private static async executeTask(currentMigrationTask: MigrationTask): Promise<void> {
    try {
      // Log Start Task
      let logMsg = `${currentMigrationTask.isAsynchronous() ? 'Asynchronous' : 'Synchronous'} Migration Task '${currentMigrationTask.getName()}' Version '${currentMigrationTask.getVersion()}' is running ${cluster.isWorker ? 'in worker ' + cluster.worker.id.toString() : 'in master'}...`;
      Logging.logInfo({
        tenantID: Constants.DEFAULT_TENANT,
        action: ServerAction.MIGRATION,
        module: MODULE_NAME, method: 'executeTask',
        message: logMsg
      });
      // Log in the console also
      console.log(logMsg);
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
      logMsg = `${currentMigrationTask.isAsynchronous() ? 'Asynchronous' : 'Synchronous'} Migration Task '${currentMigrationTask.getName()}' Version '${currentMigrationTask.getVersion()}' has run with success in ${totalTaskTimeSecs} secs ${cluster.isWorker ? 'in worker ' + cluster.worker.id.toString() : 'in master'}`;
      Logging.logInfo({
        tenantID: Constants.DEFAULT_TENANT,
        action: ServerAction.MIGRATION,
        module: MODULE_NAME, method: 'executeTask',
        message: logMsg
      });
      // Log in the console also
      console.log(logMsg);
    } catch (error) {
      const logMsg = `${currentMigrationTask.isAsynchronous() ? 'Asynchronous' : 'Synchronous'} Migration Task '${currentMigrationTask.getName()}' Version '${currentMigrationTask.getVersion()}' has failed with error: ${error.toString()} ${cluster.isWorker ? 'in worker ' + cluster.worker.id.toString() : 'in master'}`;
      Logging.logError({
        tenantID: Constants.DEFAULT_TENANT,
        action: ServerAction.MIGRATION,
        module: MODULE_NAME, method: 'executeTask',
        message: logMsg,
        detailedMessages: { error: error.message, stack: error.stack }
      });
      console.log(logMsg);
    }
  }
}
