import Constants from '../../utils/Constants';
import DatabaseUtils from '../../storage/mongodb/DatabaseUtils';
import Logging from '../../utils/Logging';
import MigrationTask from '../MigrationTask';
import { ServerAction } from '../../types/Server';
import Tenant from '../../types/Tenant';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import UserStorage from '../../storage/mongodb/UserStorage';
import Utils from '../../utils/Utils';
import global from '../../types/GlobalType';

const MODULE_NAME = 'UpdateEmailsToLowercaseTask';

export default class UpdateEmailsToLowercaseTask extends MigrationTask {
  async migrate(): Promise<void> {
    const tenants = await TenantStorage.getTenants({}, Constants.DB_PARAMS_MAX_LIMIT);
    for (const tenant of tenants.result) {
      await this.migrateTenant(tenant);
    }
  }

  async migrateTenant(tenant: Tenant): Promise<void> {
    let updated = 0;
    // Get all the Users
    const users = (await UserStorage.getUsers(tenant, {}, Constants.DB_PARAMS_MAX_LIMIT, ['id', 'email'])).result;
    if (!Utils.isEmptyArray(users)) {
      for (const user of users) {
        await global.database.getCollection<any>(tenant.id, 'users').updateOne(
          { _id: DatabaseUtils.convertToObjectID(user.id) },
          {
            $set: {
              email: user.email.toLowerCase(),
            }
          }
        );
        updated++;
      }
    }
    // Log in the default tenant
    if (updated > 0) {
      await Logging.logDebug({
        tenantID: Constants.DEFAULT_TENANT,
        module: MODULE_NAME, method: 'migrateTenant',
        action: ServerAction.MIGRATION,
        message: `${updated} User(s) mail have been updated in Tenant ${Utils.buildTenantName(tenant)}`
      });
    }
  }

  getVersion(): string {
    return '1.0';
  }

  getName(): string {
    return 'UpdateEmailsToLowercaseTask';
  }

  isAsynchronous(): boolean {
    return true;
  }
}
