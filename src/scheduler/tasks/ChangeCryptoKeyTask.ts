import { CryptoSettings, CryptoSettingsType, TechnicalSettings } from '../../types/Setting';

import Configuration from '../../utils/Configuration';
import Cypher from '../../utils/Cypher';
import SchedulerTask from '../SchedulerTask';
import SettingStorage from '../../storage/mongodb/SettingStorage';
import Tenant from '../../types/Tenant';
import Utils from '../../utils/Utils';

export default class ChangeCryptoKeyTask extends SchedulerTask {
  public async processTenant(tenant: Tenant): Promise<void> {
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
      } as CryptoSettings;
      await SettingStorage.saveCryptoSettings(tenant.id, keySettingToSave);
      // migrate sensitive data to the new key
      await Cypher.handleCryptoSettingsChange(tenant.id);
    }
  }
}
