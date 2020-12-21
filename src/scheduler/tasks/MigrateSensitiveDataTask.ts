import Constants from '../../utils/Constants';
import Cypher from '../../utils/Cypher';
import SchedulerTask from '../SchedulerTask';
import { SettingDB } from '../../types/Setting';
import SettingStorage from '../../storage/mongodb/SettingStorage';
import { TaskConfig } from '../../types/TaskConfig';
import Tenant from '../../types/Tenant';
import Utils from '../../utils/Utils';

export default class MigrateSensitiveDataTask extends SchedulerTask {

  public async processTenant(tenant: Tenant, config: TaskConfig): Promise<void> {
    // Detect if Crypto Key changed
    const isCryptoKeyChanged:boolean = await Cypher.detectConfigurationKey(tenant.id);

    // Migrate only if cryptoKey changed
    if (isCryptoKeyChanged) {
      // Get all settings per tenant
      const settings = await SettingStorage.getSettings(tenant.id, {},
        Constants.DB_PARAMS_MAX_LIMIT);

      // Filter settings with sensitiveData
      const reducedSettings = settings.result.filter((
        value: SettingDB) => {
        if (value?.sensitiveData && !Utils.isEmptyArray(value?.sensitiveData)) {
          return true;
        }
      });

      // Save sensitiveData from settings in Migration collection per Tenant

      if (reducedSettings && !Utils.isEmptyArray(reducedSettings)) {
        await Cypher.migrateAllSensitiveData(tenant.id, reducedSettings);
      }
    }
  }
}
