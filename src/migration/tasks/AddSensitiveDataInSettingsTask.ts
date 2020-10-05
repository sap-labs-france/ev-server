import { PricingSettingsType, RefundSettingsType } from '../../types/Setting';

import Constants from '../../utils/Constants';
import Cypher from '../../utils/Cypher';
import MigrationTask from '../MigrationTask';
import Tenant from '../../types/Tenant';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import global from '../../types/GlobalType';

export default class AddSensitiveDataInSettingsTask extends MigrationTask {
  public async migrate(): Promise<void> {
    const tenants = await TenantStorage.getTenants({}, Constants.DB_PARAMS_MAX_LIMIT);

    for (const tenant of tenants.result) {
      await this.migrateTenant(tenant);
    }
  }

  public async migrateTenant(tenant: Tenant): Promise<void> {
    // Read all Settings
    const settings: any = await global.database.getCollection(tenant.id, 'settings')
      .aggregate([{
        $match: {
          'sensitiveData': { $exists: false }
        }
      }])
      .toArray();
    // Process each setting
    for (const setting of settings) {
      // Add sensitiveData property if not present
      setting.sensitiveData = [];
      // Concur
      if (setting.content.type === RefundSettingsType.CONCUR) {
        setting.sensitiveData = ['content.concur.clientSecret'];
        // Encrypt
        if (setting.content.concur.clientSecret) {
          setting.content.concur.clientSecret = Cypher.encrypt(setting.content.concur.clientSecret);
        } else {
          setting.content.concur.clientSecret = '';
        }
      // Convergent Charging
      } else if (setting.content.type === PricingSettingsType.CONVERGENT_CHARGING) {
        setting.sensitiveData = ['content.convergentCharging.password'];
        if (setting.content.convergentCharging.password) {
          setting.content.convergentCharging.password = Cypher.encrypt(setting.content.convergentCharging.password);
        } else {
          setting.content.convergentCharging.password = '';
        }
      }
      // Update
      await global.database.getCollection(tenant.id, 'settings').findOneAndUpdate(
        { '_id': setting._id },
        { $set: setting },
        { upsert: true, returnOriginal: false }
      );
    }
  }

  public getVersion(): string {
    return '1.0';
  }

  public getName(): string {
    return 'AddSensitiveDataInSettings';
  }
}
