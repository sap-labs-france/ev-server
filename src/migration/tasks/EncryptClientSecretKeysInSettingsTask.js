const Tenant = require('../../entity/Tenant');
const MigrationTask = require('../MigrationTask');
const Safe = require('../../utils/Safe');

class EncryptClientSecretKeysInSettingsTask extends MigrationTask {
  async migrate() {
    const tenants = await Tenant.getTenants();
    for (const tenant of tenants.result) {
      await this.migrateTenant(tenant);
    }
  }

  async migrateTenant(tenant) {
    // Read all Settings
    const settings = await global.database.getCollection(tenant.getID(), 'settings').aggregate([]).toArray();
    // Process each setting
    for (const setting of settings) {
      // Encrypt clientSecret (Concur) if found
      if (setting.content.type === "concur"
        && setting.content.concur.clientSecret
        && setting.content.concur.clientSecret.length > 0) {
        setting.content.concur.clientSecret = Safe.encrypt(setting.content.concur.clientSecret);
        await global.database.getCollection(tenant.getID(), 'settings').findOneAndUpdate({
          "_id": setting._id
        }, {
          $set: setting
        }, {upsert: true, new: true, returnOriginal: false});
        // Encrypt password (Convergent Charing) if found
      } else if (setting.content.type === "convergentCharging"
        && setting.content.convergentCharging.password
        && setting.content.convergentCharging.password.length > 0) {
        setting.content.convergentCharging.password = Safe.encrypt(setting.content.convergentCharging.password);
        await global.database.getCollection(tenant.getID(), 'settings').findOneAndUpdate({
          "_id": setting._id
        }, {
          $set: setting
        }, {upsert: true, new: true, returnOriginal: false});
      }
    }
  }

  getVersion() {
    return "1.0";
  }

  getName() {
    return "EncryptClientSecretKeysInSettings";
  }
}

module.exports = EncryptClientSecretKeysInSettingsTask;
