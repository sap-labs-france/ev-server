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
  private taskID: string;

  public async run(name: string, config: TaskConfig): Promise<void> {
    this.name = name;
    this.taskID = Utils.generateShortNonUniqueID();
    // Get the lock
    const scheduledTaskLock = await LockingHelper.acquireScheduledTaskLock(Constants.DEFAULT_TENANT, name);
    if (scheduledTaskLock) {
      try {
        const startMigrationTime = moment();
        await Logging.logInfo({
          tenantID: Constants.DEFAULT_TENANT,
          action: ServerAction.SCHEDULER,
          module: MODULE_NAME, method: 'run',
          message: `The Task '${name}~${this.taskID}' is running...`
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
            tenantID: Constants.DEFAULT_TENANT,
            action: ServerAction.SCHEDULER,
            module: MODULE_NAME, method: 'run',
            message: `Error while running the Task '${this.getName()}~${this.taskID}': ${error.message as string}`,
            detailedMessages: { error: error.stack }
          });
        }
        // Log Total Processing Time
        const totalMigrationTimeSecs = moment.duration(moment().diff(startMigrationTime)).asSeconds();
        await Logging.logInfo({
          tenantID: Constants.DEFAULT_TENANT,
          action: ServerAction.SCHEDULER,
          module: MODULE_NAME, method: 'run',
          message: `The Task '${name}~${this.taskID}' has been run in ${totalMigrationTimeSecs} secs`
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

  public getTaskID(): string {
    return this.taskID;
  }

  public async beforeTaskRun(config: TaskConfig): Promise<void> {
  }

  public async processTask(config: TaskConfig): Promise<void> {
  }

  public async afterTaskRun(config: TaskConfig): Promise<void> {
  }
}
