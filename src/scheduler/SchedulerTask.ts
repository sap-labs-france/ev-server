import moment from 'moment';
import Constants from '../utils/Constants';
import Logging from '../utils/Logging';
import { TaskConfig } from './TaskConfig';
import Tenant from '../types/Tenant';
import TenantStorage from '../storage/mongodb/TenantStorage';
import { Subtasks } from '../types/configuration/SchedulerConfiguration';

export default abstract class SchedulerTask {
  async run(name: string, config: TaskConfig, subtasks: Subtasks[]): Promise<void> {
    const startMigrationTime = moment();
    Logging.logInfo({
      tenantID: Constants.DEFAULT_TENANT,
      module: 'SchedulerTask', method: 'run',
      action: 'Scheduler',
      message: `The task '${name}' is running...`
    });
    // Get the Tenants
    const tenants = await TenantStorage.getTenants({}, Constants.DB_PARAMS_MAX_LIMIT);
    // Process them
    for (const tenant of tenants.result) {
      const startMigrationTimeInTenant = moment();
      Logging.logInfo({
        tenantID: tenant.id,
        module: 'SchedulerTask', method: 'run',
        action: 'Scheduler',
        message: `The task '${name}' is running...`
      });
      // Process
      await this.processTenant(tenant, config, subtasks);
      // Log Total Processing Time in Tenant
      const totalMigrationTimeSecsInTenant = moment.duration(moment().diff(startMigrationTimeInTenant)).asSeconds();
      Logging.logInfo({
        tenantID: tenant.id,
        module: 'SchedulerTask', method: 'run',
        action: 'Scheduler',
        message: `The task '${name}' has been run successfully in ${totalMigrationTimeSecsInTenant} secs`
      });
    }
    // Log Total Processing Time
    const totalMigrationTimeSecs = moment.duration(moment().diff(startMigrationTime)).asSeconds();
    Logging.logInfo({
      tenantID: Constants.DEFAULT_TENANT,
      module: 'SchedulerTask', method: 'run',
      action: 'Scheduler',
      message: `The task '${name}' has been run successfully in ${totalMigrationTimeSecs} secs`
    });
  }

  abstract async processTenant(tenant: Tenant, config: TaskConfig, subtasks: Subtasks[]): Promise<void>;
}
