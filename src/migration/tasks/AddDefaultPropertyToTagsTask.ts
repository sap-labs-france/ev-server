import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import MigrationTask from '../MigrationTask';
import { ServerAction } from '../../types/Server';
import Tenant from '../../types/Tenant';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import global from '../../types/GlobalType';

const MODULE_NAME = 'AddDefaultPropertyToTagsTask';

export default class AddDefaultPropertyToTagsTask extends MigrationTask {
  async migrate(): Promise<void> {
    const tenants = await TenantStorage.getTenants({}, Constants.DB_PARAMS_MAX_LIMIT);
    for (const tenant of tenants.result) {
      await this.migrateTenant(tenant);
    }
  }

  async migrateTenant(tenant: Tenant): Promise<void> {
    // Add the default property to tags
    const result = await global.database.getCollection<any>(tenant.id, 'tags').updateMany(
      {
        default: null,
        issuer: true,
      },
      { $set: { default: false } }
    );
    // Log in the default tenant
    if (result.modifiedCount > 0) {
      Logging.logDebug({
        tenantID: Constants.DEFAULT_TENANT,
        module: MODULE_NAME, method: 'migrateTenant',
        action: ServerAction.MIGRATION,
        message: `${result.modifiedCount} Tag's default properties have been updated in Tenant '${tenant.name}'`
      });
    }
  }

  getVersion(): string {
    return '1.0';
  }

  getName(): string {
    return 'AddDefaultPropertyToTagsTask';
  }

  isAsynchronous(): boolean {
    return true;
  }
}
