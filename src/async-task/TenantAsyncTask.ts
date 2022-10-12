import AbstractAsyncTask from './AsyncTask';
import Constants from '../utils/Constants';
import Logging from '../utils/Logging';
import { ServerAction } from '../types/Server';
import Tenant from '../types/Tenant';
import TenantStorage from '../storage/mongodb/TenantStorage';
import Utils from '../utils/Utils';
import moment from 'moment';

const MODULE_NAME = 'TenantAsyncTask';

export default abstract class TenantAsyncTask extends AbstractAsyncTask {

  protected async executeAsyncTask(): Promise<void> {
    // Current task environement
    const currentTaskEnv = process.env.TASK_ENV || 'FARGATE_ALL_PRD'; // Environement is not set in Fargate
    // Get the Tenants
    const tenants = await TenantStorage.getTenants({}, Constants.DB_PARAMS_MAX_LIMIT);
    // Process them
    for (const tenant of tenants.result) {
      // Check if redirect domain is provided
      if (tenant.redirectDomain || tenant.idleMode) {
        // Ignore this tenant
        continue;
      }
      // Check if tenant task needs to run on a specific env
      if (tenant.taskExecutionEnv && tenant.taskExecutionEnv !== currentTaskEnv) {
        // Ignore execution on this environement
        continue;
      }
      const tenantCorrelationID = Utils.generateShortNonUniqueID();
      const startTimeInTenant = moment();
      await Logging.logDebug({
        tenantID: Constants.DEFAULT_TENANT_ID,
        action: ServerAction.ASYNC_TASK,
        module: MODULE_NAME, method: 'executeAsyncTask',
        message: `The Task '${this.getAsyncTask().name}~${this.getCorrelationID()}~${tenantCorrelationID}' is running for Tenant ${Utils.buildTenantName(tenant)}...`
      });
      await Logging.logDebug({
        tenantID: tenant.id,
        action: ServerAction.ASYNC_TASK,
        module: MODULE_NAME, method: 'executeAsyncTask',
        message: `The Task '${this.getAsyncTask().name}~${this.getCorrelationID()}~${tenantCorrelationID}' is running...`
      });
      try {
        // Hook
        await this.beforeExecuteTenantAsyncTask(tenant);
        // Process
        await this.executeTenantAsyncTask(tenant);
        // Hook
        await this.afterExecuteTenantAsyncTask(tenant);
      } catch (error) {
        await Logging.logError({
          tenantID: Constants.DEFAULT_TENANT_ID,
          action: ServerAction.ASYNC_TASK,
          module: MODULE_NAME, method: 'executeAsyncTask',
          message: `Error while running the Task '${this.getAsyncTask().name}~${this.getCorrelationID()}~${tenantCorrelationID}' for Tenant ${Utils.buildTenantName(tenant)}: ${error.message as string}`,
          detailedMessages: { error: error.stack }
        });
        await Logging.logError({
          tenantID: tenant.id,
          action: ServerAction.ASYNC_TASK,
          module: MODULE_NAME, method: 'executeAsyncTask',
          message: `Error while running the Task '${this.getAsyncTask().name}~${this.getCorrelationID()}~${tenantCorrelationID}': ${error.message as string}`,
          detailedMessages: { error: error.stack }
        });
      }
      // Log Total Processing Time in Tenant
      const totalTimeSecsInTenant = moment.duration(moment().diff(startTimeInTenant)).asSeconds();
      await Logging.logDebug({
        tenantID: Constants.DEFAULT_TENANT_ID,
        action: ServerAction.ASYNC_TASK,
        module: MODULE_NAME, method: 'executeAsyncTask',
        message: `The Task '${this.getAsyncTask().name}~${this.getCorrelationID()}~${tenantCorrelationID}' has been run successfully in ${totalTimeSecsInTenant} secs for Tenant ${Utils.buildTenantName(tenant)}`
      });
      await Logging.logDebug({
        tenantID: tenant.id,
        action: ServerAction.ASYNC_TASK,
        module: MODULE_NAME, method: 'executeAsyncTask',
        message: `The Task '${this.getAsyncTask().name}~${this.getCorrelationID()}~${tenantCorrelationID}' has been run successfully in ${totalTimeSecsInTenant} secs`
      });
    }
  }

  protected async beforeExecuteTenantAsyncTask(tenant: Tenant): Promise<void> {
  }

  protected async executeTenantAsyncTask(tenant: Tenant): Promise<void> {
  }

  protected async afterExecuteTenantAsyncTask(tenant: Tenant): Promise<void> {
  }
}
