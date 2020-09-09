import Constants from '../utils/Constants';
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
    const startMigrationTime = moment();
    Logging.logInfo({
      tenantID: Constants.DEFAULT_TENANT,
      action: ServerAction.SCHEDULER,
      module: MODULE_NAME, method: 'run',
      message: `The task '${name}' is running...`
    });
    // Get the Tenants
    const tenants = await TenantStorage.getTenants({}, Constants.DB_PARAMS_MAX_LIMIT);
    // Process them
    for (const tenant of tenants.result) {
      try {
        const startMigrationTimeInTenant = moment();
        Logging.logInfo({
          tenantID: tenant.id,
          action: ServerAction.SCHEDULER,
          module: MODULE_NAME, method: 'run',
          message: `The task '${name}' is running...`
        });
        // Process
        await this.processTenant(tenant, config);
        // Log Total Processing Time in Tenant
        const totalMigrationTimeSecsInTenant = moment.duration(moment().diff(startMigrationTimeInTenant)).asSeconds();
        Logging.logInfo({
          tenantID: tenant.id,
          action: ServerAction.SCHEDULER,
          module: MODULE_NAME, method: 'run',
          message: `The task '${name}' has been run successfully in ${totalMigrationTimeSecsInTenant} secs`
        });
      } catch (error) {
        Logging.logError({
          tenantID: tenant.id,
          action: ServerAction.SCHEDULER,
          module: MODULE_NAME, method: 'run',
          message: `Error while running the task '${name}': ${error.message}`,
          detailedMessages: { error: error.message, stack: error.stack }
        });
      }
    }
    // Log Total Processing Time
    const totalMigrationTimeSecs = moment.duration(moment().diff(startMigrationTime)).asSeconds();
    Logging.logInfo({
      tenantID: Constants.DEFAULT_TENANT,
      action: ServerAction.SCHEDULER,
      module: MODULE_NAME, method: 'run',
      message: `The task '${name}' has been run in ${totalMigrationTimeSecs} secs over ${tenants.count} tenant(s)`
    });
  }

  public async processTenant(tenant: Tenant, config: TaskConfig): Promise<void> {
    // Empty
  }
}
