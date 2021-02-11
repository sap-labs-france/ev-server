import { AccountActivationSetting, CryptoKeySetting, CryptoSettingsType, SettingDB } from '../../types/Setting';

import Constants from '../../utils/Constants';
import MigrationTask from '../MigrationTask';
import SettingStorage from '../../storage/mongodb/SettingStorage';
import Tenant from '../../types/Tenant';
import TenantComponents from '../../types/TenantComponents';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import Utils from '../../utils/Utils';

export default class MigrateAccountActivationSettingsFromConfigToDBTask extends MigrationTask {
  public async migrate(): Promise<void> {
    const tenants = await TenantStorage.getTenants({}, Constants.DB_PARAMS_MAX_LIMIT);
    for (const tenant of tenants.result) {
      await this.migrateTenant(tenant);
    }
  }

  public async migrateTenant(tenant: Tenant): Promise<void> {
    const accountActivationSetting = await SettingStorage.getAccountActivationSettings(tenant.id);
    // If no account activation setting exists, initialize it
    if (Utils.isEmptyObject(accountActivationSetting)) {
      // Create new account activation setting in tenant
      const settingsToSave = {
        identifier: TenantComponents.ACCOUNT_ACTIVATION,
        createdOn: new Date(),
        doNotActivateByDefault: false
      } as AccountActivationSetting;

      await SettingStorage.saveSettings(tenant.id, settingsToSave);
    }
  }

  public getVersion(): string {
    return '1.0';
  }

  public getName(): string {
    return 'MigrateAccountActivationSettingsFromConfig';
  }
}
