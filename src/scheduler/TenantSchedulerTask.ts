import Constants from '../utils/Constants';
import Logging from '../utils/Logging';
import SchedulerTask from './SchedulerTask';
import { ServerAction } from '../types/Server';
import SettingStorage from '../storage/mongodb/SettingStorage';
import { TaskConfig } from '../types/TaskConfig';
import Tenant from '../types/Tenant';
import TenantStorage from '../storage/mongodb/TenantStorage';
import Utils from '../utils/Utils';
import moment from 'moment';

const MODULE_NAME = 'TenantSchedulerTask';

export default abstract class TenantSchedulerTask extends SchedulerTask {
  public async processTask(config: TaskConfig): Promise<void> {
    // Current task environment
    const currentTaskEnv = process.env.TASK_ENV || 'FARGATE_ALL_PRD'; // Environment is not set in Fargate
    // Get global task settings
    let isTaskExecutionDisabled = false;
    const taskSettings = await SettingStorage.getTaskSettings(Constants.DEFAULT_TENANT_OBJECT);
    // Check if tasks are disabled for this environment
    if (taskSettings && taskSettings.task &&
      (taskSettings.task.disableAllTasks || !Utils.isEmptyArray(taskSettings.task.disableTasksInEnv) && taskSettings.task.disableTasksInEnv.includes(currentTaskEnv))) {
      // Tasks are disabled for this environment
      isTaskExecutionDisabled = true;
      await Logging.logInfo({
        tenantID: Constants.DEFAULT_TENANT_ID,
        action: ServerAction.SCHEDULER,
        module: MODULE_NAME, method: 'processTask',
        message: `Tasks on envirnoment: '${currentTaskEnv}' are disabled, '${this.getName()}~${this.getCorrelationID()}' will not run...`
      });
    }
    // Execute tasks only when settings allows it
    if (!isTaskExecutionDisabled) {
      // Get the Tenants
      const tenants = await TenantStorage.getTenants({}, Constants.DB_PARAMS_MAX_LIMIT);
      // Process them
      for (const tenant of tenants.result) {
        // Check if redirect domain is provided
        if (tenant.redirectDomain || tenant.idleMode) {
          // Ignore this tenant
          continue;
        }
        // Check if tenant task needs to run on a specific environment
        if (tenant.taskExecutionEnv && tenant.taskExecutionEnv !== currentTaskEnv) {
          await Logging.logInfo({
            tenantID: Constants.DEFAULT_TENANT_ID,
            action: ServerAction.SCHEDULER,
            module: MODULE_NAME, method: 'processTask',
            message: `The Task '${this.getName()}~${this.getCorrelationID()}' is skipped for Tenant ${Utils.buildTenantName(tenant)}, on environement '${currentTaskEnv}'...`
          });
          // Ignore execution on this environment
          continue;
        }
        const tenantCorrelationID = Utils.generateShortNonUniqueID();
        const startTimeInTenant = moment();
        await Logging.logDebug({
          tenantID: Constants.DEFAULT_TENANT_ID,
          action: ServerAction.SCHEDULER,
          module: MODULE_NAME, method: 'processTask',
          message: `The Task '${this.getName()}~${this.getCorrelationID()}~${tenantCorrelationID}' is running for Tenant ${Utils.buildTenantName(tenant)}...`
        });
        await Logging.logDebug({
          tenantID: tenant.id,
          action: ServerAction.SCHEDULER,
          module: MODULE_NAME, method: 'processTask',
          message: `The Task '${this.getName()}~${this.getCorrelationID()}~${tenantCorrelationID}' is running...`
        });
        try {
          // Hook
          await this.beforeProcessTenant(tenant, config);
          // Process
          await this.processTenant(tenant, config);
          // Hook
          await this.afterProcessTenant(tenant, config);
        } catch (error) {
          await Logging.logError({
            tenantID: Constants.DEFAULT_TENANT_ID,
            action: ServerAction.SCHEDULER,
            module: MODULE_NAME, method: 'processTask',
            message: `Error while running the Task '${this.getName()}~${this.getCorrelationID()}~${tenantCorrelationID}' for Tenant ${Utils.buildTenantName(tenant)}: ${error.message as string}`,
            detailedMessages: { error: error.stack }
          });
          await Logging.logError({
            tenantID: tenant.id,
            action: ServerAction.SCHEDULER,
            module: MODULE_NAME, method: 'processTask',
            message: `Error while running the Task '${this.getName()}~${this.getCorrelationID()}~${tenantCorrelationID}': ${error.message as string}`,
            detailedMessages: { error: error.stack }
          });
        }
        // Log Total Processing Time in Tenant
        const totalTimeSecsInTenant = moment.duration(moment().diff(startTimeInTenant)).asSeconds();
        await Logging.logDebug({
          tenantID: Constants.DEFAULT_TENANT_ID,
          action: ServerAction.SCHEDULER,
          module: MODULE_NAME, method: 'processTask',
          message: `The Task '${this.getName()}~${this.getCorrelationID()}~${tenantCorrelationID}' has been run successfully in ${totalTimeSecsInTenant} secs for Tenant ${Utils.buildTenantName(tenant)}`
        });
        await Logging.logDebug({
          tenantID: tenant.id,
          action: ServerAction.SCHEDULER,
          module: MODULE_NAME, method: 'processTask',
          message: `The Task '${this.getName()}~${this.getCorrelationID()}~${tenantCorrelationID}' has been run successfully in ${totalTimeSecsInTenant} secs`
        });
      }
    }
  }

  protected async beforeProcessTenant(tenant: Tenant, config: TaskConfig): Promise<void> {
  }

  protected async processTenant(tenant: Tenant, config: TaskConfig): Promise<void> {
  }

  protected async afterProcessTenant(tenant: Tenant, config: TaskConfig): Promise<void> {
  }
}
