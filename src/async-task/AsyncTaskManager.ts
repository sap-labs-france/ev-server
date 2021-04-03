import AsyncTask, { AsyncTaskStatus, AsyncTasks } from '../types/AsyncTask';

import AbstractAsyncTask from './AsyncTask';
import { ActionsResponse } from '../types/GlobalType';
import AsyncTaskStorage from '../storage/mongodb/AsyncTaskStorage';
import Configuration from '../utils/Configuration';
import Constants from '../utils/Constants';
import LockingHelper from '../locking/LockingHelper';
import LockingManager from '../locking/LockingManager';
import Logging from '../utils/Logging';
import OCPICheckCdrsAsyncTask from './tasks/ocpi/OCPICheckCdrsAsyncTask';
import OCPICheckLocationsAsyncTask from './tasks/ocpi/OCPICheckLocationsAsyncTask';
import OCPICheckSessionsAsyncTask from './tasks/ocpi/OCPICheckSessionsAsyncTask';
import OCPIPullCdrsAsyncTask from './tasks/ocpi/OCPIPullCdrsAsyncTask';
import OCPIPullLocationsAsyncTask from './tasks/ocpi/OCPIPullLocationsAsyncTask';
import OCPIPullSessionsAsyncTask from './tasks/ocpi/OCPIPullSessionsAsyncTask';
import OCPIPullTokensAsyncTask from './tasks/ocpi/OCPIPullTokensAsyncTask';
import OCPIPushEVSEStatusesAsyncTask from './tasks/ocpi/OCPIPushEVSEStatusesAsyncTask';
import OCPIPushTokensAsyncTask from './tasks/ocpi/OCPIPushTokensAsyncTask';
import { ServerAction } from '../types/Server';
import SynchronizeCarCatalogsAsyncTask from './tasks/SynchronizeCarCatalogsAsyncTask';
import TagsImportAsyncTask from './tasks/TagsImportAsyncTask';
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
      await AsyncTaskStorage.updateRunningAsyncTaskToPending();
      // Run it
      void AsyncTaskManager.handleAsyncTasks();
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
      const asyncTasks = await AsyncTaskStorage.getAsyncTasks(
        { status: AsyncTaskStatus.PENDING }, Constants.DB_PARAMS_MAX_LIMIT);
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
              case AsyncTasks.SYNCHRONIZE_CAR_CATALOGS:
                abstractAsyncTask = new SynchronizeCarCatalogsAsyncTask(asyncTask);
                break;
              case AsyncTasks.OCPI_PUSH_TOKENS:
                abstractAsyncTask = new OCPIPushTokensAsyncTask(asyncTask);
                break;
              case AsyncTasks.OCPI_PULL_LOCATIONS:
                abstractAsyncTask = new OCPIPullLocationsAsyncTask(asyncTask);
                break;
              case AsyncTasks.OCPI_PULL_SESSIONS:
                abstractAsyncTask = new OCPIPullSessionsAsyncTask(asyncTask);
                break;
              case AsyncTasks.OCPI_PULL_CDRS:
                abstractAsyncTask = new OCPIPullCdrsAsyncTask(asyncTask);
                break;
              case AsyncTasks.OCPI_CHECK_CDRS:
                abstractAsyncTask = new OCPICheckCdrsAsyncTask(asyncTask);
                break;
              case AsyncTasks.OCPI_CHECK_SESSIONS:
                abstractAsyncTask = new OCPICheckSessionsAsyncTask(asyncTask);
                break;
              case AsyncTasks.OCPI_CHECK_LOCATIONS:
                abstractAsyncTask = new OCPICheckLocationsAsyncTask(asyncTask);
                break;
              case AsyncTasks.OCPI_PULL_TOKENS:
                abstractAsyncTask = new OCPIPullTokensAsyncTask(asyncTask);
                break;
              case AsyncTasks.OCPI_PUSH_EVSE_STATUSES:
                abstractAsyncTask = new OCPIPushEVSEStatusesAsyncTask(asyncTask);
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
                const startAsyncTaskTime = new Date().getTime();
                try {
                  // Update the task
                  asyncTask.execTimestamp = new Date();
                  asyncTask.execHost = Utils.getHostname();
                  asyncTask.status = AsyncTaskStatus.RUNNING;
                  asyncTask.lastChangedOn = asyncTask.execTimestamp;
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
                  // Duration
                  const asyncTaskTotalDurationSecs = Utils.truncTo((new Date().getTime() - startAsyncTaskTime) / 1000, 2);
                  // Mark the task
                  asyncTask.status = AsyncTaskStatus.SUCCESS;
                  asyncTask.execDurationSecs = asyncTaskTotalDurationSecs;
                  asyncTask.lastChangedOn = new Date();
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
                  asyncTask.execDurationSecs = Utils.truncTo((new Date().getTime() - startAsyncTaskTime) / 1000, 2);
                  asyncTask.lastChangedOn = new Date();
                  await AsyncTaskStorage.saveAsyncTask(asyncTask);
                  // Log error
                  await Logging.logError({
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
          { concurrency: nbrTasksInParallel });
        // Log result
        const totalDurationSecs = Utils.truncTo((new Date().getTime() - startTime) / 1000, 2);
        void Logging.logActionsResponse(Constants.DEFAULT_TENANT, ServerAction.ASYNC_TASK,
          MODULE_NAME, 'handleAsyncTasks', processedTask,
          `{{inSuccess}} Async Task(s) were successfully processed in ${totalDurationSecs} secs`,
          `{{inError}} Async Task(s) failed to be processed in ${totalDurationSecs} secs`,
          `{{inSuccess}} Async Task(s) were successfully processed in ${totalDurationSecs} secs and {{inError}} failed`,
          'No Async Task to process'
        );
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

  public static async createAndSaveAsyncTasks(asyncTask: Omit<AsyncTask, 'id'>): Promise<void> {
    // Check
    if (Utils.isNullOrUndefined(asyncTask)) {
      throw new Error('The Async Task must not be null');
    }
    // Check
    if (Utils.isNullOrUndefined(asyncTask.name)) {
      throw new Error('The Name of the Async Task is mandatory');
    }
    if (!Utils.isNullOrUndefined(asyncTask.parameters) && (typeof asyncTask.parameters !== 'object')) {
      throw new Error('The Parameters of the Async Task must be a Json document');
    }
    // Set
    asyncTask.status = AsyncTaskStatus.PENDING;
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
