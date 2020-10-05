import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import MigrationTask from '../MigrationTask';
import { ServerAction } from '../../types/Server';
import Tenant from '../../types/Tenant';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import { UpdateWriteOpResult } from 'mongodb';
import Utils from '../../utils/Utils';
import global from '../../types/GlobalType';

const MODULE_NAME = 'AlignTagsWithUsersIssuerTask';

export default class AlignTagsWithUsersIssuerTask extends MigrationTask {
  async migrate(): Promise<void> {
    const tenants = await TenantStorage.getTenants({}, Constants.DB_PARAMS_MAX_LIMIT);
    for (const tenant of tenants.result) {
      await this.migrateTenant(tenant);
    }
  }

  async migrateTenant(tenant: Tenant): Promise<void> {
    let updated = 0;
    let result: UpdateWriteOpResult;
    // Get users
    const usersMDB = await global.database.getCollection<any>(tenant.id, 'users').find({
      issuer: true,
    }).toArray();
    if (!Utils.isEmptyArray(usersMDB)) {
      // Update tags
      for (const userMDB of usersMDB) {
        result = await global.database.getCollection(tenant.id, 'tags').updateMany(
          {
            userID: userMDB._id
          },
          {
            $set: {
              issuer: userMDB.issuer,
            }
          }
        );
        updated += result.modifiedCount;
      }
      Logging.logInfo({
        tenantID: Constants.DEFAULT_TENANT,
        action: ServerAction.MIGRATION,
        module: MODULE_NAME, method: 'migrateTenant',
        message: `${updated} Tag's issuer properties have been updated in Tenant '${tenant.name}'`,
      });
    }
  }

  getVersion(): string {
    return '1.0';
  }

  getName(): string {
    return 'AlignTagsWithUsersIssuerTask';
  }

  isAsynchronous(): boolean {
    return true;
  }
}
