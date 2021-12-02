import Constants from '../utils/Constants';
import MigrationTask from './MigrationTask';
import Tenant from '../types/Tenant';
import TenantStorage from '../storage/mongodb/TenantStorage';

export default abstract class TenantMigrationTask extends MigrationTask {
  public async migrate(): Promise<void> {
    const tenants = await TenantStorage.getTenants({}, Constants.DB_PARAMS_MAX_LIMIT);
    for (const tenant of tenants.result) {
      await this.migrateTenant(tenant);
    }
  }

  public abstract migrateTenant(tenant: Tenant): Promise<void>;
}
