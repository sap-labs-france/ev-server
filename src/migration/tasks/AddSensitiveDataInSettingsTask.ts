import Tenant from '../../entity/Tenant';
import MigrationTask from '../MigrationTask';
import Cipher from '../../utils/Cipher';
import Constants from '../../utils/Constants';
import TSGlobal from '../../types/GlobalType';
declare const global: TSGlobal;



export default class AddSensitiveDataInSettingsTask extends MigrationTask {
  public async migrate() {
    const tenants = await Tenant.getTenants();

    for (const tenant of tenants.result) {
      await this.migrateTenant(tenant);
    }
  }

  public async migrateTenant(tenant) {
    // Read all Settings
    const settings = await global.database.getCollection(tenant.getID(), 'settings').aggregate([]).toArray();
    // Process each setting
    for (const setting of settings) {
      // Add sensitiveData property if not present
      if(!setting.sensitiveData){
          setting.sensitiveData = [];
      }
      // Fill sensitiveData property
      if (setting.content.type === Constants.SETTING_REFUND_CONTENT_TYPE_CONCUR) {
          setting.sensitiveData = ['content.concur.clientSecret'];
      } else if (setting.content.type === Constants.SETTING_PRICING_CONTENT_TYPE_CONVERGENT_CHARGING) {
          setting.sensitiveData = ['content.convergentCharging.password'];
      }
      // Encrypt clientSecret (Concur) or password (ConvergentCharging) if found
      if (setting.content.type === Constants.SETTING_REFUND_CONTENT_TYPE_CONCUR) {
        if(setting.content.concur.clientSecret) {
          setting.content.concur.clientSecret = Cipher.encryptString(setting.content.concur.clientSecret);
        } else {
          setting.content.concur.clientSecret = '';
        }
        await global.database.getCollection(tenant.getID(), 'settings').findOneAndUpdate({
          "_id": setting._id
        }, {
          $set: setting
        }, {upsert: true, /*new: true,*/ returnOriginal: false});
        // Encrypt password (Convergent Charing) if found
      } else if (setting.content.type === Constants.SETTING_PRICING_CONTENT_TYPE_CONVERGENT_CHARGING) {
        if(setting.content.convergentCharging.password) {
          setting.content.convergentCharging.password = Cipher.encryptString(setting.content.convergentCharging.password);
        } else {
          setting.content.convergentCharging.password = '';
        }
        await global.database.getCollection(tenant.getID(), 'settings').findOneAndUpdate({
          "_id": setting._id
        }, {
          $set: setting
        }, {upsert: true, /*new: true,*/ returnOriginal: false});
      }
    }
  }

  public getVersion() {
    return "1.0";
  }

  public getName() {
    return "AddSensitiveDataInSettings";
  }
}

