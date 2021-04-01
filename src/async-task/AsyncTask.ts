import AsyncTask from '../types/AsyncTask';
import Constants from '../utils/Constants';
import Logging from '../utils/Logging';
import { ServerAction } from '../types/Server';
import moment from 'moment';

const MODULE_NAME = 'AbstractAsyncTask';

export default abstract class AbstractAsyncTask {
  protected asyncTask: AsyncTask;

  public constructor(asyncTask: AsyncTask) {
    this.asyncTask = asyncTask;
  }

  public async run(): Promise<void> {
    const startTime = moment();
    await Logging.logInfo({
      tenantID: Constants.DEFAULT_TENANT,
      action: ServerAction.ASYNC_TASK,
      module: MODULE_NAME, method: 'run',
      message: `The async task '${this.asyncTask.name}' is running...`
    });
    // Execute
    await this.executeAsyncTask();
    // Log Total Processing Time
    const totalMigrationTimeSecs = moment.duration(moment().diff(startTime)).asSeconds();
    await Logging.logInfo({
      tenantID: Constants.DEFAULT_TENANT,
      action: ServerAction.SCHEDULER,
      module: MODULE_NAME, method: 'run',
      message: `The task '${this.asyncTask.name}' has been run in ${totalMigrationTimeSecs} secs`
    });
  }

  protected abstract executeAsyncTask(): Promise<void>;
}
