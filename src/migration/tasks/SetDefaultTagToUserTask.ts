import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import MigrationTask from '../MigrationTask';
import { ServerAction } from '../../types/Server';
import Tenant from '../../types/Tenant';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import UserStorage from '../../storage/mongodb/UserStorage';
import global from '../../types/GlobalType';

const MODULE_NAME = 'SetDefaultTagToUserTask';

export default class SetDefaultTagToUserTask extends MigrationTask {
  async migrate(): Promise<void> {
    const tenants = await TenantStorage.getTenants({}, Constants.DB_PARAMS_MAX_LIMIT);
    for (const tenant of tenants.result) {
      await this.migrateTenant(tenant);
    }
  }

  async migrateTenant(tenant: Tenant): Promise<void> {
    let modifiedCount = 0;
    const users = await UserStorage.getUsers(tenant.id, {
      issuer: true,
      withTag: true
    }, Constants.DB_PARAMS_MAX_LIMIT);
    if (users.count > 0) {
      for (const user of users.result) {
        if (user.tags.length === 1 && !user.tags[0].default) {
          await global.database.getCollection<any>(tenant.id, 'tags').findOneAndUpdate(
            { '_id': user.tags[0].id },
            { $set: { 'default': true } }
          );
          modifiedCount++;
        }
      }
    }
    // Log in the default tenant
    if (modifiedCount > 0) {
      Logging.logDebug({
        tenantID: Constants.DEFAULT_TENANT,
        module: MODULE_NAME, method: 'migrateTenant',
        action: ServerAction.MIGRATION,
        message: `${modifiedCount} Tag(s) have been updated in Tenant '${tenant.name}'`
      });
    }
  }

  getVersion(): string {
    return '1.0';
  }

  getName(): string {
    return 'SetDefaultTagToUserTask';
  }
}
