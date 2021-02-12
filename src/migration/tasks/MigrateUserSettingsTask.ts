import { UserSetting, UserSettingsContentType, UserSettingsType } from '../../types/Setting';

import Constants from '../../utils/Constants';
import MigrationTask from '../MigrationTask';
import SettingStorage from '../../storage/mongodb/SettingStorage';
import Tenant from '../../types/Tenant';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import Utils from '../../utils/Utils';

export default class MigrateUserSettingsTask extends MigrationTask {
  public async migrate(): Promise<void> {
    const tenants = await TenantStorage.getTenants({}, Constants.DB_PARAMS_MAX_LIMIT);
    for (const tenant of tenants.result) {
      await this.migrateTenant(tenant);
    }
  }

  public async migrateTenant(tenant: Tenant): Promise<void> {
    const userSetting = await SettingStorage.getUserSettings(tenant.id);
    // If no user setting exists, initialize it
    if (Utils.isEmptyObject(userSetting)) {
      // Create new user setting with account activation param
      const settingsToSave = {
        identifier: UserSettingsType.USER,
        content: {
          type: UserSettingsContentType.ACCOUNT_ACTIVATION,
          accountActivation: {
            doNotActivateByDefault: false
          }
        },
        createdOn: new Date(),
      } as UserSetting;

      await SettingStorage.saveSettings(tenant.id, settingsToSave);
    }
  }

  public getVersion(): string {
    return '1.0';
  }

  public getName(): string {
    return 'MigrateUserSettings';
  }
}
