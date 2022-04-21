import Constants from '../utils/Constants';
import Logging from '../utils/Logging';
import MigrationTask from './MigrationTask';
import { ServerAction } from '../types/Server';
import Tenant from '../types/Tenant';
import TenantStorage from '../storage/mongodb/TenantStorage';
import Utils from '../utils/Utils';
import moment from 'moment';

const MODULE_NAME = 'TenantMigrationTask';

export default abstract class TenantMigrationTask extends MigrationTask {
  public async migrate(): Promise<void> {
    const tenants = await TenantStorage.getTenants({}, Constants.DB_PARAMS_MAX_LIMIT);
    for (const tenant of tenants.result) {
      const tenantCorrelationID = Utils.generateShortNonUniqueID();
      const startTimeInTenant = moment();
      await Logging.logDebug({
        tenantID: Constants.DEFAULT_TENANT_ID,
        action: ServerAction.MIGRATION,
        module: MODULE_NAME, method: 'migrate',
        message: `The Task '${this.getName()}~${tenantCorrelationID}' is running for Tenant ${Utils.buildTenantName(tenant)}...`
      });
      try {
        // Migrate
        await this.migrateTenant(tenant);
      } catch (error) {
        await Logging.logError({
          tenantID: Constants.DEFAULT_TENANT_ID,
          action: ServerAction.MIGRATION,
          module: MODULE_NAME, method: 'migrate',
          message: `Error while running the Task '${this.getName()}~${tenantCorrelationID}' for Tenant ${Utils.buildTenantName(tenant)}: ${error.message as string}`,
          detailedMessages: { error: error.stack }
        });
      }
      // Log Total Processing Time
      const totalTimeSecsInTenant = moment.duration(moment().diff(startTimeInTenant)).asSeconds();
      await Logging.logDebug({
        tenantID: Constants.DEFAULT_TENANT_ID,
        action: ServerAction.MIGRATION,
        module: MODULE_NAME, method: 'migrate',
        message: `The Task '${this.getName()}~${tenantCorrelationID}' has been run successfully in ${totalTimeSecsInTenant} secs for Tenant ${Utils.buildTenantName(tenant)}`
      });
    }
  }

  protected abstract migrateTenant(tenant: Tenant): Promise<void>;
}
