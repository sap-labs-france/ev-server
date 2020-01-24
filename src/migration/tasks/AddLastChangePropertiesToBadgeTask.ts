import Constants from '../../utils/Constants';
import global from '../../types/GlobalType';
import Logging from '../../utils/Logging';
import MigrationTask from '../MigrationTask';
import Tenant from '../../types/Tenant';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import UserStorage from '../../storage/mongodb/UserStorage';
import Utils from '../../utils/Utils';

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
    Logging.logDebug({
      tenantID: Constants.DEFAULT_TENANT,
      module: 'AddLastChangePropertiesToBadgeTask', method: 'migrateTenant',
      action: 'Migrate',
      message: `${counter} tags(s) have been updated in Tenant '${tenant.name}'`
    });
  }

  getVersion() {
    return '0.9';
  }

  getName() {
    return 'AddLastChangePropertiesToBadgeTask';
  }
}
