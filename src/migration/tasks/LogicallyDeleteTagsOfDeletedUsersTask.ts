import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import MigrationTask from '../MigrationTask';
import { ServerAction } from '../../types/Server';
import Tenant from '../../types/Tenant';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import { UpdateWriteOpResult } from 'mongodb';
import Utils from '../../utils/Utils';
import global from '../../types/GlobalType';

const MODULE_NAME = 'LogicallyDeleteTagsOfDeletedUsersTask';

export default class LogicallyDeleteTagsOfDeletedUsersTask extends MigrationTask {
  async migrate(): Promise<void> {
    const tenants = await TenantStorage.getTenants({}, Constants.DB_PARAMS_MAX_LIMIT);
    for (const tenant of tenants.result) {
      await this.migrateTenant(tenant);
    }
  }

  async migrateTenant(tenant: Tenant): Promise<void> {
    let updated = 0;
    let result: UpdateWriteOpResult;
    // Get deleted Users
    const users = await global.database.getCollection<any>(tenant.id, 'users').find({
      deleted: true
    }).toArray();
    if (!Utils.isEmptyArray(users)) {
      for (const user of users) {
        // Update
        result = await global.database.getCollection(tenant.id, 'tags').updateMany(
          {
            userID: user._id
          },
          {
            $set: {
              deleted: true,
            }
          }
        );
        updated += result.modifiedCount;
      }
    }
    // Log in the default tenant
    if (updated > 0) {
      Logging.logDebug({
        tenantID: Constants.DEFAULT_TENANT,
        action: ServerAction.MIGRATION,
        module: MODULE_NAME, method: 'migrateTenant',
        message: `${updated} Tag(s) have been marked logically deleted in Tenant '${tenant.name}'`
      });
    }
  }

  getVersion(): string {
    return '1.0';
  }

  getName(): string {
    return 'LogicallyDeleteTagsOfDeletedUsersTask';
  }

  isAsynchronous(): boolean {
    return true;
  }
}

