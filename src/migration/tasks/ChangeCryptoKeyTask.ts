import { CryptoSettings, CryptoSettingsType, TechnicalSettings } from '../../types/Setting';

import Configuration from '../../utils/Configuration';
import Constants from '../../utils/Constants';
import Cypher from '../../utils/Cypher';
import Logging from '../../utils/Logging';
import MigrationTask from '../MigrationTask';
import { ServerAction } from '../../types/Server';
import SettingStorage from '../../storage/mongodb/SettingStorage';
import Tenant from '../../types/Tenant';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import Utils from '../../utils/Utils';

const MODULE_NAME = 'ChangeCryptoKeyTask';

export default class ChangeCryptoKeyTask extends MigrationTask {
  async migrate(): Promise<void> {
    const tenants = await TenantStorage.getTenants({}, Constants.DB_PARAMS_MAX_LIMIT);
    for (const tenant of tenants.result) {
      await this.migrateTenant(tenant);
    }
  }

  async migrateTenant(tenant: Tenant): Promise<void> {
    // Get crypto key settings from config file & db
    const historicalCryptoSettings = Configuration.getCryptoConfig();
    const currentCryptoSettings = await SettingStorage.getCryptoSettings(tenant.id);
    if (currentCryptoSettings.crypto.key === historicalCryptoSettings.key || !currentCryptoSettings) {
      // If they match, generate a new key with the default algorithm
      const keySettingToSave: CryptoSettings = {
        id: currentCryptoSettings.id,
        identifier: TechnicalSettings.CRYPTO,
        type: CryptoSettingsType.CRYPTO,
        crypto: {
          formerKey: currentCryptoSettings.crypto.key,
          formerKeyProperties: currentCryptoSettings.crypto.keyProperties,
          key: Utils.generateRandomKey(Utils.getDefaultKeyProperties()),
          keyProperties: Utils.getDefaultKeyProperties(),
          migrationToBeDone: true
        }
      };
      await SettingStorage.saveCryptoSettings(tenant.id, keySettingToSave);
      // Migrate sensitive data to the new key
      await Cypher.handleCryptoSettingsChange(tenant.id);
      // Log in the default tenant
      await Logging.logDebug({
        tenantID: Constants.DEFAULT_TENANT,
        action: ServerAction.MIGRATION,
        module: MODULE_NAME,
        method: 'migrateTenant',
        message: `Crypto settings have been updated in Tenant '${tenant.name}'`
      });
    }
  }

  getVersion(): string {
    return '1.0';
  }

  getName(): string {
    return 'ChangeCryptoKeyTask';
  }
}
