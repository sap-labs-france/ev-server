import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import MigrationTask from '../MigrationTask';
import { ServerAction } from '../../types/Server';
import Tenant from '../../types/Tenant';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import global from '../../types/GlobalType';

const MODULE_NAME = 'AddActivePropertyToTagsTask';

export default class AddActivePropertyToTagsTask extends MigrationTask {
  async migrate(): Promise<void> {
    const tenants = await TenantStorage.getTenants({}, Constants.DB_PARAMS_MAX_LIMIT);
    for (const tenant of tenants.result) {
      await this.migrateTenant(tenant);
    }
  }

  async migrateTenant(tenant: Tenant): Promise<void> {
    // Add the active property to tags
    const result = await global.database.getCollection<any>(tenant.id, 'tags').updateMany(
      {},
      { $set: { 'active': true } }
    );
    // Log in the default tenant
    if (result.modifiedCount > 0) {
      Logging.logDebug({
        tenantID: Constants.DEFAULT_TENANT,
        module: MODULE_NAME, method: 'migrateTenant',
        action: ServerAction.MIGRATION,
        message: `${result.modifiedCount} Tag(s) have been updated in Tenant '${tenant.name}'`
      });
    }
    // Remove deleted property from tags
    await global.database.getCollection<any>(tenant.id, 'tags').updateMany(
      { },
      { $unset: { 'deleted': '' } }
    );
  }

  getVersion(): string {
    return '1.0';
  }

  getName(): string {
    return 'AddActivePropertyToTagsTask';
  }
}
