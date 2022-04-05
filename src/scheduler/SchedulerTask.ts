import Constants from '../utils/Constants';
import LockingHelper from '../locking/LockingHelper';
import LockingManager from '../locking/LockingManager';
import Logging from '../utils/Logging';
import { ServerAction } from '../types/Server';
import { TaskConfig } from '../types/TaskConfig';
import Utils from '../utils/Utils';
import moment from 'moment';

const MODULE_NAME = 'SchedulerTask';

export default abstract class SchedulerTask {
  private name: string;
  private correlationID: string;

  public async run(name: string, config: TaskConfig): Promise<void> {
    this.name = name;
    this.correlationID = Utils.generateShortNonUniqueID();
    // Get the lock
    const scheduledTaskLock = await LockingHelper.acquireScheduledTaskLock(Constants.DEFAULT_TENANT_ID, name);
    if (scheduledTaskLock) {
      try {
        const startTime = moment();
        await Logging.logInfo({
          tenantID: Constants.DEFAULT_TENANT_ID,
          action: ServerAction.SCHEDULER,
          module: MODULE_NAME, method: 'run',
          message: `The Task '${name}~${this.correlationID}' is running...`
        });
        try {
          // Hook
          await this.beforeTaskRun(config);
          // Process
          await this.processTask(config);
          // Hook
          await this.afterTaskRun(config);
        } catch (error) {
          await Logging.logError({
            tenantID: Constants.DEFAULT_TENANT_ID,
            action: ServerAction.SCHEDULER,
            module: MODULE_NAME, method: 'run',
            message: `Error while running the Task '${this.getName()}~${this.correlationID}': ${error.message as string}`,
            detailedMessages: { error: error.stack }
          });
        }
        // Log Total Processing Time
        const totalTimeSecs = moment.duration(moment().diff(startTime)).asSeconds();
        await Logging.logInfo({
          tenantID: Constants.DEFAULT_TENANT_ID,
          action: ServerAction.SCHEDULER,
          module: MODULE_NAME, method: 'run',
          message: `The Task '${name}~${this.correlationID}' has been run in ${totalTimeSecs} secs`
        });
      } finally {
        // Release lock
        await LockingManager.release(scheduledTaskLock);
      }
    }
  }

  public getName(): string {
    return this.name;
  }

  public getCorrelationID(): string {
    return this.correlationID;
  }

  protected async beforeTaskRun(config: TaskConfig): Promise<void> {
  }

  protected async afterTaskRun(config: TaskConfig): Promise<void> {
  }

  protected abstract processTask(config: TaskConfig): Promise<void>;
}
