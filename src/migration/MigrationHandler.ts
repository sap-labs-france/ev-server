import Constants from '../utils/Constants';
import { LockEntity } from '../types/Locking';
import LockingManager from '../locking/LockingManager';
import Logging from '../utils/Logging';
import MigrateUserMobileDataTask from './tasks/MigrateUserMobileDataTask';
import MigrationStorage from '../storage/mongodb/MigrationStorage';
import MigrationTask from './MigrationTask';
import { ServerAction } from '../types/Server';
import Utils from '../utils/Utils';
import moment from 'moment';

const MODULE_NAME = 'MigrationHandler';

export default class MigrationHandler {
  public static async migrate(processAsyncTasksOnly = false): Promise<void> {
    // Create a Lock for migration
    const migrationLock = LockingManager.createExclusiveLock(Constants.DEFAULT_TENANT_ID, LockEntity.DATABASE, 'migration', 3600);
    if (await LockingManager.acquire(migrationLock)) {
      try {
        const startTime = moment();
        await Logging.logInfo({
          tenantID: Constants.DEFAULT_TENANT_ID,
          action: ServerAction.MIGRATION,
          module: MODULE_NAME, method: 'migrate',
          message: `Running ${processAsyncTasksOnly ? 'asynchronous' : 'synchronous'} migration tasks...`
        });
        // Create tasks
        const migrationTasks = MigrationHandler.createMigrationTasks();
        // Get the already done migrations from the DB
        const migrationTasksCompleted = await MigrationStorage.getMigrations();
        for (const migrationTask of migrationTasks) {
          // Check if not already done
          const foundMigrationTaskCompleted = migrationTasksCompleted.find((migrationTaskCompleted) =>
            // Same name and version
            (migrationTask.getName() === migrationTaskCompleted.name &&
             migrationTask.getVersion() === migrationTaskCompleted.version)
          );
          // Already processed?
          if (foundMigrationTaskCompleted) {
            continue;
          }
          if (migrationTask.isAsynchronous() && processAsyncTasksOnly) {
            // Execute Async
            await MigrationHandler.executeTask(migrationTask);
          } else if (!migrationTask.isAsynchronous() && !processAsyncTasksOnly) {
            // Execute Sync
            await MigrationHandler.executeTask(migrationTask);
          }
        }
        // Log Total Processing Time
        const totalTimeSecs = moment.duration(moment().diff(startTime)).asSeconds();
        await Logging.logInfo({
          tenantID: Constants.DEFAULT_TENANT_ID,
          action: ServerAction.MIGRATION,
          module: MODULE_NAME, method: 'migrate',
          message: `The ${processAsyncTasksOnly ? 'asynchronous' : 'synchronous'} migration has been run in ${totalTimeSecs} secs`
        });
      } catch (error) {
        await Logging.logError({
          tenantID: Constants.DEFAULT_TENANT_ID,
          action: ServerAction.MIGRATION,
          module: MODULE_NAME, method: 'migrate',
          message: error.message,
          detailedMessages: { error: error.stack }
        });
      } finally {
        // Release lock
        await LockingManager.release(migrationLock);
      }
    }
    // Process async tasks one by one
    if (!processAsyncTasksOnly) {
      setTimeout(() => {
        void MigrationHandler.migrate(true);
      }, 5000);
    }
  }

  private static async executeTask(currentMigrationTask: MigrationTask): Promise<void> {
    try {
      // Log Start Task
      let logMsg = `${currentMigrationTask.isAsynchronous() ? 'Asynchronous' : 'Synchronous'} Migration Task '${currentMigrationTask.getName()}' Version '${currentMigrationTask.getVersion()}' is running...`;
      await Logging.logInfo({
        tenantID: Constants.DEFAULT_TENANT_ID,
        action: ServerAction.MIGRATION,
        module: MODULE_NAME, method: 'executeTask',
        message: logMsg
      });
      // Log in the console also
      Utils.isDevelopmentEnv() && Logging.logConsoleDebug(logMsg);
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
      logMsg = `${currentMigrationTask.isAsynchronous() ? 'Asynchronous' : 'Synchronous'} Migration Task '${currentMigrationTask.getName()}' Version '${currentMigrationTask.getVersion()}' has run with success in ${totalTaskTimeSecs} secs`;
      await Logging.logInfo({
        tenantID: Constants.DEFAULT_TENANT_ID,
        action: ServerAction.MIGRATION,
        module: MODULE_NAME, method: 'executeTask',
        message: logMsg
      });
      // Log in the console also
      Utils.isDevelopmentEnv() && Logging.logConsoleDebug(logMsg);
    } catch (error) {
      const logMsg = `${currentMigrationTask.isAsynchronous() ? 'Asynchronous' : 'Synchronous'} Migration Task '${currentMigrationTask.getName()}' Version '${currentMigrationTask.getVersion()}' has failed with error: ${error.message as string}`;
      await Logging.logError({
        tenantID: Constants.DEFAULT_TENANT_ID,
        action: ServerAction.MIGRATION,
        module: MODULE_NAME, method: 'executeTask',
        message: logMsg,
        detailedMessages: { error: error.stack }
      });
      Logging.logConsoleError(logMsg);
    }
  }

  private static createMigrationTasks(): MigrationTask[] {
    const currentMigrationTasks: MigrationTask[] = [];
    // ---------------------------------------------------------------------------------------
    // ACHTUNG - Keeping old tasks is useless and dangerous.
    // Why? Because a migration task should run only once!
    //
    // If we consider the tenant "redirect" feature, we may face the situation
    // where a task is performed twice. This is may lead to unpredictable results.
    //
    // Best Practices: Comment out old tasks as soon as possible!
    // ---------------------------------------------------------------------------------------
    currentMigrationTasks.push(new MigrateUserMobileDataTask());
    return currentMigrationTasks;
  }
}
