import AsyncTask, { AsyncTaskStatus, AsyncTasks } from '../types/AsyncTask';
import global, { ActionsResponse, DatabaseDocumentChange } from '../types/GlobalType';

import AbstractAsyncTask from './AsyncTask';
import AsyncTaskConfiguration from '../types/configuration/AsyncTaskConfiguration';
import AsyncTaskStorage from '../storage/mongodb/AsyncTaskStorage';
import BillTransactionAsyncTask from './tasks/BillTransactionAsyncTask';
import Constants from '../utils/Constants';
import EndTransactionAsyncTask from './tasks/EndTransactionAsyncTask';
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
import { Promise } from 'bluebird';
import { ServerAction } from '../types/Server';
import SynchronizeCarCatalogsAsyncTask from './tasks/SynchronizeCarCatalogsAsyncTask';
import TagsImportAsyncTask from './tasks/TagsImportAsyncTask';
import UsersImportAsyncTask from './tasks/UsersImportAsyncTask';
import Utils from '../utils/Utils';

const MODULE_NAME = 'AsyncTaskManager';

export default class AsyncTaskManager {
  private static asyncTaskConfig: AsyncTaskConfiguration;

  public static async init(asyncTaskConfig: AsyncTaskConfiguration): Promise<void> {
    // Keep the conf
    AsyncTaskManager.asyncTaskConfig = asyncTaskConfig;
    // Turn all Running task to Pending
    await AsyncTaskStorage.updateRunningAsyncTaskToPending();
    // First run
    AsyncTaskManager.handleAsyncTasks().catch((error) => {
      Logging.logPromiseError(error);
    });
    // Listen to DB events
    await global.database.watchDatabaseCollection(Constants.DEFAULT_TENANT_OBJECT, 'asynctasks',
      (documentID: unknown, documentChange: DatabaseDocumentChange, document: unknown) => {
        if (documentChange === DatabaseDocumentChange.UPDATE ||
            documentChange === DatabaseDocumentChange.INSERT) {
          // Check status
          if (document['status'] === AsyncTaskStatus.PENDING) {
            // Trigger the Async Framework
            AsyncTaskManager.handleAsyncTasks().catch((error) => {
              Logging.logPromiseError(error);
            });
          }
        }
      }
    );
  }

  public static async handleAsyncTasks(): Promise<void> {
    let failedToAcquireLock = false;
    await Logging.logDebug({
      tenantID: Constants.DEFAULT_TENANT_ID,
      action: ServerAction.ASYNC_TASK,
      module: MODULE_NAME, method: 'handleAsyncTasks',
      message: 'Checking asynchronous task to process...'
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
    if (!Utils.isEmptyArray(asyncTasks.result)) {
      await Logging.logInfo({
        tenantID: Constants.DEFAULT_TENANT_ID,
        action: ServerAction.ASYNC_TASK,
        module: MODULE_NAME, method: 'handleAsyncTasks',
        message: `${asyncTasks.result.length} asynchronous task(s) are going to be processed...`
      });
      await Promise.map(asyncTasks.result,
        async (asyncTask: AsyncTask) => {
          // Tasks
          const abstractAsyncTask = await AsyncTaskManager.createTask(asyncTask);
          if (abstractAsyncTask) {
            // Get the lock
            const asyncTaskLock = await LockingHelper.acquireAsyncTaskLock(Constants.DEFAULT_TENANT_ID, asyncTask.id);
            if (asyncTaskLock) {
              const startAsyncTaskTime = new Date().getTime();
              try {
                // Update the task
                asyncTask.execTimestamp = new Date();
                asyncTask.execHost = Utils.getHostName();
                asyncTask.status = AsyncTaskStatus.RUNNING;
                asyncTask.lastChangedOn = asyncTask.execTimestamp;
                await AsyncTaskStorage.saveAsyncTask(asyncTask);
                // Log
                await Logging.logInfo({
                  tenantID: Constants.DEFAULT_TENANT_ID,
                  action: ServerAction.ASYNC_TASK,
                  module: MODULE_NAME, method: 'handleAsyncTasks',
                  message: `The Task '${asyncTask.name}~${abstractAsyncTask.getCorrelationID()}' is running...`
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
                  tenantID: Constants.DEFAULT_TENANT_ID,
                  action: ServerAction.ASYNC_TASK,
                  module: MODULE_NAME, method: 'handleAsyncTasks',
                  message: `The Task '${asyncTask.name}~${abstractAsyncTask.getCorrelationID()}' has been processed in ${asyncTaskTotalDurationSecs} secs`
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
                  tenantID: Constants.DEFAULT_TENANT_ID,
                  module: MODULE_NAME, method: 'handleAsyncTasks',
                  action: ServerAction.ASYNC_TASK,
                  message: `Error while running the Task '${asyncTask.name}~${abstractAsyncTask.getCorrelationID()}': ${error.message as string}`,
                  detailedMessages: { error: error.stack, asyncTask }
                });
              } finally {
                // Release lock
                await LockingManager.release(asyncTaskLock);
              }
            } else {
              failedToAcquireLock = true;
            }
          }
        },
        { concurrency: nbrTasksInParallel });
      // Log result
      const totalDurationSecs = Utils.truncTo((new Date().getTime() - startTime) / 1000, 2);
      void Logging.logActionsResponse(Constants.DEFAULT_TENANT_ID, ServerAction.ASYNC_TASK,
        MODULE_NAME, 'handleAsyncTasks', processedTask,
        `{{inSuccess}} asynchronous task(s) were successfully processed in ${totalDurationSecs} secs`,
        `{{inError}} asynchronous task(s) failed to be processed in ${totalDurationSecs} secs`,
        `{{inSuccess}} asynchronous task(s) were successfully processed in ${totalDurationSecs} secs and {{inError}} failed`,
        'No asynchronous task to process'
      );
      // Do not retry right away when lock failed to be acquired (infinite loop), wait for the Job
      if (!failedToAcquireLock) {
        // Retrigger the Async Framework
        AsyncTaskManager.handleAsyncTasks().catch((error) => {
          Logging.logPromiseError(error);
        });
      }
    } else {
      await Logging.logDebug({
        tenantID: Constants.DEFAULT_TENANT_ID,
        action: ServerAction.ASYNC_TASK,
        module: MODULE_NAME, method: 'handleAsyncTasks',
        message: 'No asynchronous task to process'
      });
    }
  }

  private static async createTask(asyncTask: AsyncTask): Promise<AbstractAsyncTask> {
    const correlationID = Utils.generateShortNonUniqueID();
    switch (asyncTask.name) {
      case AsyncTasks.END_TRANSACTION:
        return new EndTransactionAsyncTask(asyncTask, correlationID);
      case AsyncTasks.BILL_TRANSACTION:
        return new BillTransactionAsyncTask(asyncTask, correlationID);
      case AsyncTasks.TAGS_IMPORT:
        return new TagsImportAsyncTask(asyncTask, correlationID);
      case AsyncTasks.USERS_IMPORT:
        return new UsersImportAsyncTask(asyncTask, correlationID);
      case AsyncTasks.SYNCHRONIZE_CAR_CATALOGS:
        return new SynchronizeCarCatalogsAsyncTask(asyncTask, correlationID);
      case AsyncTasks.OCPI_PUSH_TOKENS:
        return new OCPIPushTokensAsyncTask(asyncTask, correlationID);
      case AsyncTasks.OCPI_PULL_LOCATIONS:
        return new OCPIPullLocationsAsyncTask(asyncTask, correlationID);
      case AsyncTasks.OCPI_PULL_SESSIONS:
        return new OCPIPullSessionsAsyncTask(asyncTask, correlationID);
      case AsyncTasks.OCPI_PULL_CDRS:
        return new OCPIPullCdrsAsyncTask(asyncTask, correlationID);
      case AsyncTasks.OCPI_CHECK_CDRS:
        return new OCPICheckCdrsAsyncTask(asyncTask, correlationID);
      case AsyncTasks.OCPI_CHECK_SESSIONS:
        return new OCPICheckSessionsAsyncTask(asyncTask, correlationID);
      case AsyncTasks.OCPI_CHECK_LOCATIONS:
        return new OCPICheckLocationsAsyncTask(asyncTask, correlationID);
      case AsyncTasks.OCPI_PULL_TOKENS:
        return new OCPIPullTokensAsyncTask(asyncTask, correlationID);
      case AsyncTasks.OCPI_PUSH_EVSE_STATUSES:
        return new OCPIPushEVSEStatusesAsyncTask(asyncTask, correlationID);
      default:
        await Logging.logError({
          tenantID: Constants.DEFAULT_TENANT_ID,
          action: ServerAction.ASYNC_TASK,
          module: MODULE_NAME, method: 'handleAsyncTasks',
          message: `The asynchronous task '${asyncTask.name as string}' is unknown`
        });
    }
  }
}
