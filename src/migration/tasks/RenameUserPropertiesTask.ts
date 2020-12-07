import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import MigrationTask from '../MigrationTask';
import { ServerAction } from '../../types/Server';
import Tenant from '../../types/Tenant';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import User from '../../types/User';
import global from '../../types/GlobalType';

const MODULE_NAME = 'RenameUserPropertiesTask';

export default class RenameUserPropertiesTask extends MigrationTask {
  async migrate(): Promise<void> {
    const tenants = await TenantStorage.getTenants({}, Constants.DB_PARAMS_MAX_LIMIT);
    for (const tenant of tenants.result) {
      await this.migrateTenant(tenant);
    }
  }

  async migrateTenant(tenant: Tenant): Promise<void> {
    // Rename the property in the collection
    const result = await global.database.getCollection<User>(tenant.id, 'users').updateMany(
      { 'notifications.sendSmtpAuthError': { $exists: true } },
      { $rename: { 'notifications.sendSmtpAuthError': 'notifications.sendSmtpError' } }
    );
    // Log in the default tenant
    if (result.modifiedCount > 0) {
      Logging.logDebug({
        tenantID: Constants.DEFAULT_TENANT,
        action: ServerAction.MIGRATION,
        module: MODULE_NAME, method: 'migrateTenant',
        message: `${result.modifiedCount} Users' properties have been updated in Tenant '${tenant.name}' ('${tenant.subdomain}')`
      });
    }
  }

  getVersion(): string {
    return '1.3';
  }

  getName(): string {
    return 'RenameUserPropertiesTask';
  }
}
