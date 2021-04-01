import AsyncTask, { AsyncTaskStatus, AsyncTasks } from '../types/AsyncTask';

import AbstractAsyncTask from './AsyncTask';
import { ActionsResponse } from '../types/GlobalType';
import AsyncTaskStorage from '../storage/mongodb/AsyncTaskStorage';
import Configuration from '../utils/Configuration';
import Constants from '../utils/Constants';
import LockingHelper from '../locking/LockingHelper';
import LockingManager from '../locking/LockingManager';
import Logging from '../utils/Logging';
import { ServerAction } from '../types/Server';
import TagsImportAsyncTask from './tasks/TagsImportAsyncTask';
import User from '../types/User';
import UserToken from '../types/UserToken';
import UsersImportAsyncTask from './tasks/UsersImportAsyncTask';
import Utils from '../utils/Utils';

const MODULE_NAME = 'AsyncTaskManager';

export default class AsyncTaskManager {
  private static asyncTaskConfig;

  public static async init(): Promise<void> {
    // Get the conf
    AsyncTaskManager.asyncTaskConfig = Configuration.getAsyncTaskConfig();
    // Active?
    if (AsyncTaskManager.asyncTaskConfig?.active) {
      // Turn all Running task to Pending
      const updatedAsyncTasks = await AsyncTaskStorage.updateRunningAsyncTaskToPending();
      // Run it
      if (updatedAsyncTasks > 0) {
        void AsyncTaskManager.handleAsyncTasks();
      }
    }
  }

  public static async handleAsyncTasks(): Promise<void> {
    // Active?
    if (AsyncTaskManager.asyncTaskConfig?.active) {
      await Logging.logDebug({
        tenantID: Constants.DEFAULT_TENANT,
        action: ServerAction.ASYNC_TASK,
        module: MODULE_NAME, method: 'handleAsyncTasks',
        message: 'Checking Async Task to process...'
      });
      const processedTask: ActionsResponse = {
        inError: 0,
        inSuccess: 0,
      };
      const startTime = new Date().getTime();
      // Handle number of instances
      let nbrTasksInParallel = 1;
      if (this.asyncTaskConfig.nbrTasksInParallel > 0) {
        nbrTasksInParallel = this.asyncTaskConfig.nbrTasksInParallel;
      }
      // Get the tasks
      const asyncTasks = await AsyncTaskStorage.getAsyncTasks({ status: AsyncTaskStatus.PENDING }, Constants.DB_PARAMS_MAX_LIMIT);
      // Process them
      let abstractAsyncTask: AbstractAsyncTask;
      if (!Utils.isEmptyArray(asyncTasks.result)) {
        await Logging.logInfo({
          tenantID: Constants.DEFAULT_TENANT,
          action: ServerAction.ASYNC_TASK,
          module: MODULE_NAME, method: 'handleAsyncTasks',
          message: `${asyncTasks.result.length} Async Task(s) are going to be processed...`
        });
        await Promise.map(asyncTasks.result,
          async (asyncTask: AsyncTask) => {
            // Tasks
            switch (asyncTask.name) {
              case AsyncTasks.TAGS_IMPORT:
                abstractAsyncTask = new TagsImportAsyncTask(asyncTask);
                break;
              case AsyncTasks.USERS_IMPORT:
                abstractAsyncTask = new UsersImportAsyncTask(asyncTask);
                break;
              default:
                await Logging.logError({
                  tenantID: Constants.DEFAULT_TENANT,
                  action: ServerAction.ASYNC_TASK,
                  module: MODULE_NAME, method: 'handleAsyncTasks',
                  message: `The Async Task '${asyncTask.name}' is unknown`
                });
            }
            if (abstractAsyncTask) {
              // Get the lock
              const asyncTaskLock = await LockingHelper.createAsyncTaskLock(Constants.DEFAULT_TENANT, asyncTask);
              if (asyncTaskLock) {
                try {
                  const startAsyncTaskTime = new Date().getTime();
                  // Update the task
                  asyncTask.execTimestamp = new Date();
                  asyncTask.execHost = Utils.getHostname();
                  asyncTask.status = AsyncTaskStatus.RUNNING;
                  await AsyncTaskStorage.saveAsyncTask(asyncTask);
                  // Log
                  await Logging.logInfo({
                    tenantID: Constants.DEFAULT_TENANT,
                    action: ServerAction.ASYNC_TASK,
                    module: MODULE_NAME, method: 'handleAsyncTasks',
                    message: `The task '${asyncTask.name}' is running...`
                  });
                  // Run
                  await abstractAsyncTask.run();
                  // Delete the task
                  await AsyncTaskStorage.deleteAsyncTask(asyncTask.id);
                  processedTask.inSuccess++;
                  // Log
                  const asyncTaskTotalDurationSecs = Math.trunc((new Date().getTime() - startAsyncTaskTime) / 1000);
                  await Logging.logInfo({
                    tenantID: Constants.DEFAULT_TENANT,
                    action: ServerAction.ASYNC_TASK,
                    module: MODULE_NAME, method: 'handleAsyncTasks',
                    message: `The task '${asyncTask.name}' has been processed in ${asyncTaskTotalDurationSecs} secs`
                  });
                } catch (error) {
                  processedTask.inError++;
                  // Update the task
                  asyncTask.status = AsyncTaskStatus.ERROR;
                  asyncTask.message = error.message;
                  await AsyncTaskStorage.saveAsyncTask(asyncTask);
                  // Log error
                  Logging.logError({
                    tenantID: Constants.DEFAULT_TENANT,
                    module: MODULE_NAME, method: 'handleAsyncTasks',
                    action: ServerAction.ASYNC_TASK,
                    message: `Error while running the Async Task '${asyncTask.name}': ${error.message}`,
                    detailedMessages: { error: error.message, stack: error.stack, asyncTask }
                  });
                } finally {
                  // Release lock
                  await LockingManager.release(asyncTaskLock);
                }
              }
            }
          },
          { concurrency: nbrTasksInParallel }).then(() => {
          // Log result
          const totalDurationSecs = Math.trunc((new Date().getTime() - startTime) / 1000);
          void Logging.logActionsResponse(Constants.DEFAULT_TENANT, ServerAction.ASYNC_TASK,
            MODULE_NAME, 'handleAsyncTasks', processedTask,
            `{{inSuccess}} Async Task(s) were successfully processed in ${totalDurationSecs} secs`,
            `{{inError}} Async Task(s) failed to be processed in ${totalDurationSecs} secs`,
            `{{inSuccess}} Async Task(s) were successfully processed in ${totalDurationSecs} secs and {{inError}} failed`,
            'No Async Task to process'
          );
        });
      } else {
        await Logging.logInfo({
          tenantID: Constants.DEFAULT_TENANT,
          action: ServerAction.ASYNC_TASK,
          module: MODULE_NAME, method: 'handleAsyncTasks',
          message: 'No Async Task to process'
        });
      }
    }
  }

  public static async createAndSaveAsyncTasks(asyncTask: Omit<AsyncTask, 'id'>, user?: UserToken|User|string): Promise<void> {
    // Check
    if (Utils.isNullOrUndefined(asyncTask)) {
      throw new Error('The Async Task must not be null');
    }
    // Check
    if (Utils.isNullOrUndefined(asyncTask.name)) {
      throw new Error('The Name of the Async Task is mandatory');
    }
    if (Utils.isNullOrUndefined(asyncTask.tenantID)) {
      throw new Error('The Tenant ID of the Async Task is mandatory');
    }
    if (!Utils.isNullOrUndefined(asyncTask.parameters) && (typeof asyncTask.parameters !== 'object')) {
      throw new Error('The Parameters of the Async Task must be a Json document');
    }
    // Set
    asyncTask.status = AsyncTaskStatus.PENDING;
    asyncTask.createdBy = user as User ?? null;
    asyncTask.createdOn = new Date();
    // Save
    await AsyncTaskStorage.saveAsyncTask(asyncTask as AsyncTask);
    // Log
    await Logging.logInfo({
      tenantID: Constants.DEFAULT_TENANT,
      action: ServerAction.ASYNC_TASK,
      module: MODULE_NAME, method: 'createAndSaveAsyncTasks',
      message: `The task '${asyncTask.name}' has been saved successfully and will be processed soon`
    });
  }
}
