const Tenant = require('../../entity/Tenant');
const MigrationTask = require('../MigrationTask');

class UsersAddNotificationsFlagTask extends MigrationTask {
  async migrate() {
    const tenants = await Tenant.getTenants();
    for (const tenant of tenants.result) {
      await this.migrateTenant(tenant);
    }
  }

  async migrateTenant(tenant) {
    // Read all Users
    const users = await global.database.getCollection(tenant.getID(), 'users')
      .aggregate([])
      .toArray();
    // Process each user
    for (const user of users) {
      const notificationsActive = true;
      // Save it
      if (typeof user.notificationsActive !== 'boolean') {
        await global.database.getCollection(tenant.getID(), 'users').findOneAndReplace(
          { "_id": user._id },
          { $set: { notificationsActive }}, 
          { upsert: true, new: true, returnOriginal: false });
      }
    }
  }

  getVersion() {
    return "1.0";
  }

  getName() {
    return "UsersAddNotificationsFlag";
  }
}

module.exports = UsersAddNotificationsFlagTask;