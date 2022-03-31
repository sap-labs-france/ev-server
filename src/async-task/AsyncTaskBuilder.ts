import AsyncTask, { AsyncTaskStatus } from '../types/AsyncTask';

import AsyncTaskStorage from '../storage/mongodb/AsyncTaskStorage';
import Constants from '../utils/Constants';
import Logging from '../utils/Logging';
import { ServerAction } from '../types/Server';
import Utils from '../utils/Utils';

const MODULE_NAME = 'AsyncTaskBuilder';

export default class AsyncTaskBuilder {
  public static async createAndSaveAsyncTasks(asyncTask: Omit<AsyncTask, 'id'>): Promise<void> {
    if (Utils.isNullOrUndefined(asyncTask)) {
      throw new Error('The asynchronous task must not be null');
    }
    if (Utils.isNullOrUndefined(asyncTask.name)) {
      throw new Error('The Name of the asynchronous task is mandatory');
    }
    if (!Utils.isNullOrUndefined(asyncTask.parameters) && (typeof asyncTask.parameters !== 'object')) {
      throw new Error('The Parameters of the asynchronous task must be a Json document');
    }
    // Set
    asyncTask.status = AsyncTaskStatus.PENDING;
    asyncTask.createdOn = new Date();
    // Save
    await AsyncTaskStorage.saveAsyncTask(asyncTask as AsyncTask);
    // Log
    await Logging.logInfo({
      tenantID: Constants.DEFAULT_TENANT_ID,
      action: ServerAction.ASYNC_TASK,
      module: MODULE_NAME, method: 'createAndSaveAsyncTasks',
      message: `The asynchronous task '${asyncTask.name}' has been saved successfully and will be processed soon`
    });
  }
}
