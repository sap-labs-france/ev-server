import Constants from '../utils/Constants';
import Logging from '../utils/Logging';
import SchedulerTask from './SchedulerTask';
import { ServerAction } from '../types/Server';
import { TaskConfig } from '../types/TaskConfig';
import Tenant from '../types/Tenant';
import TenantStorage from '../storage/mongodb/TenantStorage';
import Utils from '../utils/Utils';
import moment from 'moment';

const MODULE_NAME = 'TenantSchedulerTask';

export default abstract class TenantSchedulerTask extends SchedulerTask {
  public async processTask(config: TaskConfig): Promise<void> {
    // Get the Tenants
    const tenants = await TenantStorage.getTenants({}, Constants.DB_PARAMS_MAX_LIMIT);
    // Process them
    for (const tenant of tenants.result) {
      const tenantCorrelationID = Utils.generateShortNonUniqueID();
      const startMigrationTimeInTenant = moment();
      await Logging.logDebug({
        tenantID: Constants.DEFAULT_TENANT,
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
          tenantID: Constants.DEFAULT_TENANT,
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
      const totalMigrationTimeSecsInTenant = moment.duration(moment().diff(startMigrationTimeInTenant)).asSeconds();
      await Logging.logDebug({
        tenantID: Constants.DEFAULT_TENANT,
        action: ServerAction.SCHEDULER,
        module: MODULE_NAME, method: 'processTask',
        message: `The Task '${this.getName()}~${this.getCorrelationID()}~${tenantCorrelationID}' has been run successfully in ${totalMigrationTimeSecsInTenant} secs for Tenant ${Utils.buildTenantName(tenant)}`
      });
      await Logging.logDebug({
        tenantID: tenant.id,
        action: ServerAction.SCHEDULER,
        module: MODULE_NAME, method: 'processTask',
        message: `The Task '${this.getName()}~${this.getCorrelationID()}~${tenantCorrelationID}' has been run successfully in ${totalMigrationTimeSecsInTenant} secs`
      });
    }
  }

  public async beforeProcessTenant(tenant: Tenant, config: TaskConfig): Promise<void> {
  }

  public async processTenant(tenant: Tenant, config: TaskConfig): Promise<void> {
  }

  public async afterProcessTenant(tenant: Tenant, config: TaskConfig): Promise<void> {
  }
}
