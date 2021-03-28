import AsyncTask, { AsyncTaskStatus, AsyncTasks } from '../types/AsyncTask';

import AbstractAsyncTask from './AsyncTask';
import { ActionsResponse } from '../types/GlobalType';
import AsyncTaskStorage from '../storage/mongodb/AsyncTaskStorage';
import Configuration from '../utils/Configuration';
import Constants from '../utils/Constants';
import ImportTagsAsyncTask from './tasks/TagsImportAsyncTask';
import LockingHelper from '../locking/LockingHelper';
import LockingManager from '../locking/LockingManager';
import Logging from '../utils/Logging';
import { ServerAction } from '../types/Server';
import User from '../types/User';
import UserToken from '../types/UserToken';
import Utils from '../utils/Utils';

const MODULE_NAME = 'AsyncTaskManager';

export default class AsyncTaskManager {
  private static asyncTaskConfig = Configuration.getAsyncTaskConfig();

  public static async handleAsyncTasks(): Promise<void> {
    // Active?
    if (AsyncTaskManager.asyncTaskConfig.active) {
      await Logging.logDebug({
        tenantID: Constants.DEFAULT_TENANT,
        action: ServerAction.ASYNC_TASK,
        module: MODULE_NAME, method: 'handleAsyncTasks',
        message: 'Checking if there is async task to process...'
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
      const asyncTasks = await AsyncTaskStorage.getAsyncTasks( { status: AsyncTaskStatus.NEW }, Constants.DB_PARAMS_MAX_LIMIT);
      // Process them
      let abstractAsyncTask: AbstractAsyncTask;
      if (!Utils.isEmptyArray(asyncTasks.result)) {
        await Promise.map(asyncTasks.result,
          async (asyncTask: AsyncTask) => {
            // Tasks
            switch (asyncTask.name) {
              case AsyncTasks.TAGS_IMPORT:
                abstractAsyncTask = new ImportTagsAsyncTask(asyncTask);
                break;
              default:
                await Logging.logError({
                  tenantID: Constants.DEFAULT_TENANT,
                  action: ServerAction.ASYNC_TASK,
                  module: MODULE_NAME, method: 'handleAsyncTasks',
                  message: `The async task '${asyncTask.name}' is unknown`
                });
            }
            if (abstractAsyncTask) {
              // Get the lock
              const asyncTaskLock = await LockingHelper.createAsyncTaskLock(Constants.DEFAULT_TENANT, asyncTask);
              if (asyncTaskLock) {
                try {
                  const startAsyncTaskTime = new Date().getTime();
                  asyncTask.execTimestamp = new Date();
                  asyncTask.execHost = Utils.getHostname();
                  // Log
                  await Logging.logInfo({
                    tenantID: Constants.DEFAULT_TENANT,
                    action: ServerAction.ASYNC_TASK,
                    module: MODULE_NAME, method: 'handleAsyncTasks',
                    message: `The task '${asyncTask.name}' is running...`
                  });
                  // Update the task
                  asyncTask.status = AsyncTaskStatus.RUNNING;
                  await AsyncTaskStorage.saveAsyncTask(asyncTask);
                  // Run
                  await abstractAsyncTask.run();
                  // Update the task
                  const asyncTaskTotalDurationSecs = Math.trunc((new Date().getTime() - startAsyncTaskTime) / 1000);
                  asyncTask.status = AsyncTaskStatus.SUCCESS;
                  asyncTask.execTimeSecs = asyncTaskTotalDurationSecs;
                  await AsyncTaskStorage.saveAsyncTask(asyncTask);
                  processedTask.inSuccess++;
                  // Log
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
                    message: `Error while running the async task '${asyncTask.name}': ${error.message}`,
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
              `{{inSuccess}} async task(s) were successfully processed in ${totalDurationSecs} secs`,
              `{{inError}} async task(s) failed to be processed in ${totalDurationSecs} secs`,
              `{{inSuccess}} async task(s) were successfully processed in ${totalDurationSecs} secs and {{inError}} failed`,
              `No async task to process`
            );
          });
      }
    }
  }

  public static async createAndSaveAsyncTasks(asyncTask: Omit<AsyncTask, 'id'>, user?: UserToken|User|string): Promise<void> {
    // Check
    if (Utils.isNullOrUndefined(asyncTask)) {
      throw new Error("The async task must not be null");
    }
    // Check
    if (Utils.isNullOrUndefined(asyncTask.name)) {
      throw new Error("The Name of the async task is mandatory");
    }
    if (Utils.isNullOrUndefined(asyncTask.tenantID)) {
      throw new Error("The Tenant ID of the async task is mandatory");
    }
    if (!Utils.isNullOrUndefined(asyncTask.parameters) && (typeof asyncTask.parameters !== 'object')) {
      throw new Error("The Parameters of the async task must be a Json document");
    }
    // Set
    asyncTask.status = AsyncTaskStatus.NEW;
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
