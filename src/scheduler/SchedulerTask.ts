import Constants from '../utils/Constants';
import LockingHelper from '../locking/LockingHelper';
import LockingManager from '../locking/LockingManager';
import Logging from '../utils/Logging';
import { ServerAction } from '../types/Server';
import { TaskConfig } from '../types/TaskConfig';
import Tenant from '../types/Tenant';
import TenantStorage from '../storage/mongodb/TenantStorage';
import moment from 'moment';

const MODULE_NAME = 'SchedulerTask';

export default abstract class SchedulerTask {
  private name: string;

  public async run(name: string, config: TaskConfig): Promise<void> {
    this.name = name;
    // Get the lock
    const scheduledTaskLock = await LockingHelper.acquireScheduledTaskLock(Constants.DEFAULT_TENANT, name);
    if (scheduledTaskLock) {
      try {
        const startMigrationTime = moment();
        await Logging.logInfo({
          tenantID: Constants.DEFAULT_TENANT,
          action: ServerAction.SCHEDULER,
          module: MODULE_NAME, method: 'run',
          message: `The task '${name}' is running...`
        });
        // Hook
        await this.beforeTaskRun(config);
        // Get the Tenants
        const tenants = await TenantStorage.getTenants({}, Constants.DB_PARAMS_MAX_LIMIT);
        // Process them
        for (const tenant of tenants.result) {
          try {
            const startMigrationTimeInTenant = moment();
            await Logging.logInfo({
              tenantID: tenant.id,
              action: ServerAction.SCHEDULER,
              module: MODULE_NAME, method: 'run',
              message: `The task '${name}' is running...`
            });
            // Hook
            await this.beforeProcessTenant(tenant, config);
            // Process
            await this.processTenant(tenant, config);
            // Log Total Processing Time in Tenant
            const totalMigrationTimeSecsInTenant = moment.duration(moment().diff(startMigrationTimeInTenant)).asSeconds();
            await Logging.logInfo({
              tenantID: tenant.id,
              action: ServerAction.SCHEDULER,
              module: MODULE_NAME, method: 'run',
              message: `The task '${name}' has been run successfully in ${totalMigrationTimeSecsInTenant} secs`
            });
          } catch (error) {
            await Logging.logError({
              tenantID: tenant.id,
              action: ServerAction.SCHEDULER,
              module: MODULE_NAME, method: 'run',
              message: `Error while running the task '${name}': ${error.message}`,
              detailedMessages: { error: error.stack }
            });
          } finally {
            // Hook
            await this.afterProcessTenant(tenant, config);
          }
        }
        // Hook
        await this.afterTaskRun(config);
        // Log Total Processing Time
        const totalMigrationTimeSecs = moment.duration(moment().diff(startMigrationTime)).asSeconds();
        await Logging.logInfo({
          tenantID: Constants.DEFAULT_TENANT,
          action: ServerAction.SCHEDULER,
          module: MODULE_NAME, method: 'run',
          message: `The task '${name}' has been run in ${totalMigrationTimeSecs} secs over ${tenants.count} tenant(s)`
        });
      } finally {
        // Release lock
        await LockingManager.release(scheduledTaskLock);
      }
    }
  }

  public async beforeTaskRun(config: TaskConfig): Promise<void> {
  }

  public async beforeProcessTenant(tenant: Tenant, config: TaskConfig): Promise<void> {
  }

  public async processTenant(tenant: Tenant, config: TaskConfig): Promise<void> {
  }

  public async afterProcessTenant(tenant: Tenant, config: TaskConfig): Promise<void> {
  }

  public async afterTaskRun(config: TaskConfig): Promise<void> {
  }
}
