import { MobileSettingsType, SettingDB, TechnicalSettings } from '../../types/Setting';

import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import { ServerAction } from '../../types/Server';
import SettingStorage from '../../storage/mongodb/SettingStorage';
import Tenant from '../../types/Tenant';
import TenantMigrationTask from '../TenantMigrationTask';
import Utils from '../../utils/Utils';

const MODULE_NAME = 'FillMobileAppSettingsTask';

export default class FillMobileAppSettingsTask extends TenantMigrationTask {
  public async migrateTenant(tenant: Tenant): Promise<void> {
    let updated = 0;
    let mobileSettingToSave: Partial<SettingDB>;
    // Get mobile setting
    const mobileSetting = await SettingStorage.getSettingByIdentifier(tenant, TechnicalSettings.MOBILE);
    if (!mobileSetting) {
      mobileSettingToSave = {
        identifier : TechnicalSettings.MOBILE,
        content : {
          type: MobileSettingsType.MOBILE,
          mobile: {
            settingsIOSMobileAppID: 'eMobility',
            settingsAndroidMobileAppID: 'com.emobility',
            scheme: 'eMobility'
          }
        }
      };
      await SettingStorage.saveSettings(tenant, mobileSettingToSave);
      updated++;
    }
    // Log in the default tenant
    if (updated > 0) {
      await Logging.logDebug({
        tenantID: Constants.DEFAULT_TENANT_ID,
        module: MODULE_NAME, method: 'migrateTenant',
        action: ServerAction.MIGRATION,
        message: `${updated} Mobile application setting has been inserted in Tenant ${Utils.buildTenantName(tenant)}`
      });
    }
  }

  public getVersion(): string {
    return '1.5';
  }

  public getName(): string {
    return 'FillMobileAppSettingsTask';
  }

  public isAsynchronous(): boolean {
    return true;
  }
}
