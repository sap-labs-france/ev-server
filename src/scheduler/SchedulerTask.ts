import { TaskConfig } from './TaskConfig';
import Tenant from '../entity/Tenant';
import Logging from '../utils/Logging';
import Constants from '../utils/Constants';

export default abstract class SchedulerTask {
  async run(name: string, config: TaskConfig): Promise<void> {
    Logging.logInfo({
      tenantID: Constants.DEFAULT_TENANT,
      module: 'SchedulerTask',
      method: 'run', action: 'Initialization',
      message: `The task ${name} is running`
    });
    const tenants = await Tenant.getTenants();
    for (const tenant of tenants.result) {
      Logging.logInfo({
        tenantID: tenant.getID(),
        module: 'SchedulerTask',
        method: 'run', action: 'Initialization',
        message: `The task ${name} is starting`
      });
      await this.processTenant(tenant, config);
      Logging.logInfo({
        tenantID: tenant.getID(),
        module: 'SchedulerTask',
        method: 'run', action: 'Initialization',
        message: `The task ${name} is completed`
      });
    }
  }

  abstract async processTenant(tenant: Tenant, config: TaskConfig): Promise<void>;
}
