import Tenant from '../../entity/Tenant';
import MigrationTask from '../MigrationTask';
import Safe from '../../utils/Safe';
import TSGlobal from '../../types/GlobalType';
declare const global: TSGlobal;



export default class AddSensitiveDataInSettingsTask extends MigrationTask {
    async migrate() {
      const tenants = await Tenant.getTenants();
  
      for (const tenant of tenants.result) {
        await this.migrateTenant(tenant);
      }
    }
  
    async migrateTenant(tenant) {
        console.log(`>>> Start of migration of sensitive data`);
    // Read all Settings
    const settings = await global.database.getCollection(tenant.getID(), 'settings').aggregate([]).toArray();
    // Process each setting
    for (const setting of settings) {
      // Add sensitiveData property if not present
      if(!setting.sensitiveData){
          setting.sensitiveData = [];
      };
      // Fill sensitiveData property
      if (setting.content.type === "concur") {
          setting.sensitiveData = ['content.concur.clientSecret'];
      } else if (setting.content.type === "convergentCharging") {
          setting.sensitiveData = ['content.convergentCharging.password'];
      }
      // Encrypt clientSecret (Concur) or password (ConvergentCharging) if found
      if (setting.content.type === "concur"
        && setting.content.concur.clientSecret
        && setting.content.concur.clientSecret.length > 0) {
        setting.content.concur.clientSecret = Safe.encrypt(setting.content.concur.clientSecret);
        await global.database.getCollection(tenant.getID(), 'settings').findOneAndUpdate({
          "_id": setting._id
        }, {
          $set: setting
        }, {upsert: true, /*new: true,*/ returnOriginal: false});
        // Encrypt password (Convergent Charing) if found
      } else if (setting.content.type === "convergentCharging"
        && setting.content.convergentCharging.password
        && setting.content.convergentCharging.password.length > 0) {
        setting.content.convergentCharging.password = Safe.encrypt(setting.content.convergentCharging.password);
        await global.database.getCollection(tenant.getID(), 'settings').findOneAndUpdate({
          "_id": setting._id
        }, {
          $set: setting
        }, {upsert: true, /*new: true,*/ returnOriginal: false});
      }
    }
  }

  getVersion() {
    return "1.0";
  }

  getName() {
    return "AddSensitiveDataInSettings";
  }
}

