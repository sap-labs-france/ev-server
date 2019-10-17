import Constants from '../../utils/Constants';
import global from '../../types/GlobalType';
import MigrationTask from '../MigrationTask';
import Tenant from '../../types/Tenant';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import moment from 'moment';

export default class AddLastLoginDateToUsersTask extends MigrationTask {
  async migrate() {
    const tenants = await TenantStorage.getTenants({}, Constants.DB_PARAMS_MAX_LIMIT);
    for (const tenant of tenants.result) {
      await this.migrateTenant(tenant);
    }
  }

  async migrateTenant(tenant) {
    // Read all users
    const users: any = await global.database.getCollection(tenant.id, 'users').aggregate().toArray();
    // Process each user
    for (const user of users) {
      if (!user.lastLogin) {
        user.lastLogin = new Date();
      }
      // Update
      await global.database.getCollection(tenant.id, 'users').findOneAndUpdate(
        { '_id': user._id },
        { $set: user },
        { upsert: true, returnOriginal: false }
      );
    }
  }

  getVersion() {
    return '1.0';
  }

  getName() {
    return 'AddLastLoginDateToUsersTask';
  }
}

