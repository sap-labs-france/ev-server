import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import MigrationTask from '../MigrationTask';
import { ServerAction } from '../../types/Server';
import TagStorage from '../../storage/mongodb/TagStorage';
import Tenant from '../../types/Tenant';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import UserStorage from '../../storage/mongodb/UserStorage';

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
    }, Constants.DB_PARAMS_MAX_LIMIT);
    if (users.count > 0) {
      for (const user of users.result) {
        const tagsMDB = await TagStorage.getTags(tenant.id, {
          userIDs: [user.id]
        }, Constants.DB_PARAMS_SINGLE_RECORD);
        if (tagsMDB.count === 1) {
          if (!tagsMDB.result[0].default) {
            tagsMDB.result[0].default = true;
            await TagStorage.saveTag(tenant.id, tagsMDB.result[0]);
            modifiedCount++;
          }
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
