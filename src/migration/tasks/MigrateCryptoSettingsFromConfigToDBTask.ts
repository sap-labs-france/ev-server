import { CryptoKeyProperties, CryptoSettingsType, KeySetting } from '../../types/Setting';

import Configuration from '../../utils/Configuration';
import Constants from '../../utils/Constants';
import MigrationTask from '../MigrationTask';
import SettingStorage from '../../storage/mongodb/SettingStorage';
import Tenant from '../../types/Tenant';
import TenantComponents from '../../types/TenantComponents';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import Utils from '../../utils/Utils';

export default class MigrateCryptoSettingsFromConfigToDBTask extends MigrationTask {
  public async migrate(): Promise<void> {
    const tenants = await TenantStorage.getTenants({}, Constants.DB_PARAMS_MAX_LIMIT);

    for (const tenant of tenants.result) {
      await this.migrateTenant(tenant);
    }
  }

  public async migrateTenant(tenant: Tenant): Promise<void> {
    // Crypto Key from config file
    const configCryptoKey: string = Configuration.getCryptoConfig().key;
    // Crypto Key Properties from config file
    const configCryptoKeyProperties: CryptoKeyProperties = Utils.parseConfigCryptoAlgorithm(Configuration.getCryptoConfig().algorithm);
    // Crypto Key Setting from db
    const keySettings = await SettingStorage.getCryptoSettings(tenant.id);
    // If no Crypto Key Setting exist, initialize them with Crypto Key from config file
    if (!keySettings) {
      // Create New Crypto Key in Tenant Settings
      const keySettingToSave = {
        identifier: TenantComponents.CRYPTO,
        type: CryptoSettingsType.CRYPTO,
        crypto: {
          key: configCryptoKey,
          keyProperties: configCryptoKeyProperties,
        }
      } as KeySetting;
      await SettingStorage.saveCryptoSettings(tenant.id, keySettingToSave);
    }
  }

  public getVersion(): string {
    return '1.0';
  }

  public getName(): string {
    return 'MigrateCryptoSettingsFromConfigToDB';
  }
}
