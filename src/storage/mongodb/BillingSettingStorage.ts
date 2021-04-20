import { BillingSettings, BillingSettingsType, SettingDB } from '../../types/Setting';

import Constants from '../../utils/Constants';
import SettingStorage from './SettingStorage';
import TenantComponents from '../../types/TenantComponents';

const MODULE_NAME = 'BillingSettingStorage';

export default class BillingSettingStorage {

  public static async getBillingSettings(tenantID: string): Promise<BillingSettings[]> {
    const settings = await SettingStorage.getSettings(tenantID, { identifier: TenantComponents.BILLING }, Constants.DB_PARAMS_SINGLE_RECORD);
    if (settings && settings.count > 0) {
      const allBillingSettings: BillingSettings[] = settings.result.map((setting) => BillingSettingStorage.convertToBillingSettings(setting));
      return allBillingSettings;
    }
    return null;
  }

  public static async getBillingSetting(tenantID: string, settingID: string): Promise<BillingSettings> {
    const settings = await SettingStorage.getSettings(tenantID, { settingID }, Constants.DB_PARAMS_SINGLE_RECORD);
    if (settings?.result?.[0]?.content) {
      const setting: SettingDB = settings.result[0];
      return BillingSettingStorage.convertToBillingSettings(setting);
    }
    return null;
  }

  public static async saveBillingSetting(tenantID: string, billingSettings: BillingSettings): Promise<string> {
    const { id, identifier, sensitiveData, backupSensitiveData, category } = billingSettings;
    const { createdBy, createdOn, lastChangedBy, lastChangedOn } = billingSettings;
    const { type, billing, stripe } = billingSettings;
    const setting: SettingDB = {
      id, identifier, sensitiveData, backupSensitiveData, category,
      createdBy, createdOn, lastChangedBy, lastChangedOn,
      content: {
        type,
        billing,
        stripe,
      },
    };
    return SettingStorage.saveSettings(tenantID, setting);
  }

  private static convertToBillingSettings(setting: SettingDB): BillingSettings {
    const { id, sensitiveData, backupSensitiveData, category } = setting;
    const { createdBy, createdOn, lastChangedBy, lastChangedOn } = setting;
    const { content } = setting;

    let billingSettings: BillingSettings = null;
    if (content.type === BillingSettingsType.STRIPE) {
      billingSettings = {
        identifier: TenantComponents.BILLING,
        type: BillingSettingsType.STRIPE,
        id, sensitiveData, backupSensitiveData, category,
        createdBy, createdOn, lastChangedBy, lastChangedOn,
        billing: content.billing,
        stripe: content.stripe
      };
    }
    return billingSettings;
  }
}
