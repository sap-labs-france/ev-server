import Tenant from '../../entity/Tenant';
import MigrationTask from '../MigrationTask';
import TSGlobal from '../../types/GlobalType';
declare const global: TSGlobal;

export default class UsersAddNotificationsFlagTask extends MigrationTask {
  async migrate() {
    const tenants = await Tenant.getTenants();
    for (const tenant of tenants.result) {
      await this.migrateTenant(tenant);
    }
  }

  async migrateTenant(tenant) {
    // Read all Users
    const users = await global.database.getCollection(tenant.getID(), 'users')
      .aggregate([
        { $match: {"notificationsActive": { $exists: false }}}
      ])
      .toArray();
    // Process each user
    for (const user of users) {
      // Add
      await global.database.getCollection(tenant.getID(), 'users').findOneAndReplace(
        { "_id": user._id },
        { $set: { notificationsActive: true }},
        { upsert: true, returnOriginal: false });
    }
  }

  getVersion() {
    return "1.0";
  }

  getName() {
    return "UsersAddNotificationsFlag";
  }
}

