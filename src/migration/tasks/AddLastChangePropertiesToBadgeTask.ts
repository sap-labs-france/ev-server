import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import MigrationTask from '../MigrationTask';
import { ServerAction } from '../../types/Server';
import Tenant from '../../types/Tenant';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import UserStorage from '../../storage/mongodb/UserStorage';
import Utils from '../../utils/Utils';
import global from '../../types/GlobalType';

const MODULE_NAME = 'AddLastChangePropertiesToBadgeTask';

export default class AddLastChangePropertiesToBadgeTask extends MigrationTask {
  async migrate(): Promise<void> {
    const tenants = await TenantStorage.getTenants({}, Constants.DB_PARAMS_MAX_LIMIT);
    for (const tenant of tenants.result) {
      await this.migrateTenant(tenant);
    }
  }

  async migrateTenant(tenant: Tenant): Promise<void> {
    const users = await UserStorage.getUsers(tenant.id, {
      issuer: true,
    }, Constants.DB_PARAMS_MAX_LIMIT);
    const tagCollection = global.database.getCollection<any>(tenant.id, 'tags');
    let counter = 0;
    for (const user of users.result) {
      const tags = await tagCollection.find({ 'userID': Utils.convertToObjectID(user.id), lastChangedOn: null }).toArray();
      if (!Utils.isEmptyArray(tags)) {
        for (const tag of tags) {
          const lastChangedOn = user.lastChangedOn ? user.lastChangedOn : user.createdOn;
          const lastChangedBy = user.lastChangedBy ? user.lastChangedBy : user.createdBy;
          await tagCollection.updateOne(
            {
              '_id': tag._id
            },
            {
              $set: {
                'lastChangedOn': lastChangedOn ? lastChangedOn : new Date(),
                'lastChangedBy': lastChangedBy ? Utils.convertToObjectID(lastChangedBy.id) : null
              }
            },
            { upsert: false }
          );
          counter++;
        }
      }
    }
    // Log in the default tenant
    if (counter > 0) {
      Logging.logDebug({
        tenantID: Constants.DEFAULT_TENANT,
        action: ServerAction.MIGRATION,
        module: MODULE_NAME, method: 'migrateTenant',
        message: `${counter} Tags's last changed properties have been updated in Tenant '${tenant.name}'`
      });
    }
  }

  getVersion(): string {
    return '1.1';
  }

  getName(): string {
    return 'AddLastChangePropertiesToBadgeTask';
  }

  isAsynchronous(): boolean {
    return true;
  }
}
