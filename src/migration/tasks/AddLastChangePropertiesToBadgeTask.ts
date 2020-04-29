import TenantStorage from '../../storage/mongodb/TenantStorage';
import UserStorage from '../../storage/mongodb/UserStorage';
import global from '../../types/GlobalType';
import { ServerAction } from '../../types/Server';
import Tenant from '../../types/Tenant';
import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import Utils from '../../utils/Utils';
import MigrationTask from '../MigrationTask';

const MODULE_NAME = 'AddLastChangePropertiesToBadgeTask';

export default class AddLastChangePropertiesToBadgeTask extends MigrationTask {
  async migrate() {
    const tenants = await TenantStorage.getTenants({}, Constants.DB_PARAMS_MAX_LIMIT);
    for (const tenant of tenants.result) {
      await this.migrateTenant(tenant);
    }
  }

  async migrateTenant(tenant: Tenant) {
    const users = await UserStorage.getUsers(tenant.id, {}, Constants.DB_PARAMS_MAX_LIMIT);
    const tagCollection = global.database.getCollection<any>(tenant.id, 'tags');

    let counter = 0;
    for (const user of users.result) {
      if (user.tags) {
        for (const tag of user.tags) {
          if (!tag.lastChangedOn) {
            const lastChangedOn = user.lastChangedOn ? user.lastChangedOn : user.createdOn;
            const lastChangedBy = user.lastChangedBy ? user.lastChangedBy : user.createdBy;
            await tagCollection.updateOne(
              {
                '_id': tag.id
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
    }
    // Log in the default tenant
    if (counter > 0) {
      Logging.logDebug({
        tenantID: Constants.DEFAULT_TENANT,
        action: ServerAction.MIGRATION,
        module: MODULE_NAME, method: 'migrateTenant',
        message: `${counter} Tags(s) have been updated in Tenant '${tenant.name}'`
      });
    }
  }

  getVersion() {
    return '1.0';
  }

  getName() {
    return 'AddLastChangePropertiesToBadgeTask';
  }
}
