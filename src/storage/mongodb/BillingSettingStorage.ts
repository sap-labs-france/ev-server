import { BillingSettings, BillingSettingsType, SettingDB } from '../../types/Setting';

import BackendError from '../../exception/BackendError';
import Constants from '../../utils/Constants';
import Cypher from '../../utils/Cypher';
import SettingStorage from './SettingStorage';
import TenantComponents from '../../types/TenantComponents';

const MODULE_NAME = 'BillingSettingStorage';
export default class BillingSettingStorage {

  public static alterBillingSettings(billingSettings: BillingSettings, setting: SettingDB, encryptSensitiveData: boolean): BillingSettings {
    // Encrypt Sensitive Data
    if (encryptSensitiveData) {
      Cypher.hashSensitiveDataInJSON(setting);
    }
    // Extract the data
    const config = setting.content;
    billingSettings.id = setting.id;
    billingSettings.sensitiveData = setting.sensitiveData;
    billingSettings.backupSensitiveData = setting.backupSensitiveData;
    // Billing Common Properties
    if (config.billing) {
      const { isTransactionBillingActivated, immediateBillingAllowed, periodicBillingAllowed, taxID, usersLastSynchronizedOn } = config.billing;
      billingSettings.billing = {
        isTransactionBillingActivated,
        immediateBillingAllowed,
        periodicBillingAllowed,
        usersLastSynchronizedOn,
        taxID,
      };
    }
    // Billing Concrete Implementation Properties
    if (config.stripe) {
      billingSettings.type = BillingSettingsType.STRIPE;
      const { url, publicKey, secretKey } = config.stripe;
      billingSettings.stripe = {
        url,
        publicKey,
        secretKey,
      };
    }
    return billingSettings;
  }

  public static async getBillingSettings(tenantID: string, encryptSensitiveData = false): Promise<BillingSettings> {
    const settings = await SettingStorage.getSettings(tenantID, { identifier: TenantComponents.BILLING }, Constants.DB_PARAMS_SINGLE_RECORD);
    if (settings?.result?.[0]?.content) {
      const billingSettings = {
        identifier: TenantComponents.BILLING,
      } as BillingSettings;
      BillingSettingStorage.alterBillingSettings(billingSettings, settings.result[0], encryptSensitiveData);
      return billingSettings;
    }
    return null;
  }

  public static async getBillingSetting(tenantID: string, settingID: string, encryptSensitiveData = false): Promise<BillingSettings> {
    const settings = await SettingStorage.getSettings(tenantID, { settingID }, Constants.DB_PARAMS_SINGLE_RECORD);
    if (settings?.result?.[0]?.content) {
      const billingSettings = {
        identifier: TenantComponents.BILLING,
      } as BillingSettings;
      BillingSettingStorage.alterBillingSettings(billingSettings, settings.result[0], encryptSensitiveData);
      return billingSettings;
    }
    return null;
  }

  public static async saveBillingSettings(tenantID: string, billingSettingsToSave: BillingSettings): Promise<string> {
    // Load previous settings
    const settings = await SettingStorage.getBillingSettings(tenantID);
    // Build internal structure
    const settingsToSave = {
      id: billingSettingsToSave.id,
      identifier: billingSettingsToSave.identifier,
      sensitiveData: billingSettingsToSave.sensitiveData,
      backupSensitiveData: billingSettingsToSave.backupSensitiveData,
      lastChangedOn: new Date(),
      content: {
        billing: billingSettingsToSave.billing,
        stripe: billingSettingsToSave.stripe
      },
    } as SettingDB;
    // Preserve Data that the DASHBOARD is not aware off
    settingsToSave.content.billing.isTransactionBillingActivated = settings.billing.isTransactionBillingActivated;
    // Populates implementation-specific data
    if (settings.type === BillingSettingsType.STRIPE) {
      if (!billingSettingsToSave.stripe.secretKey) {
        throw new BackendError({
          source: Constants.CENTRAL_SERVER,
          module: MODULE_NAME,
          method: 'saveBillingSettings',
          message: 'One or several mandatory fields are missing'
        });
      }
      settingsToSave.content.stripe = billingSettingsToSave.stripe;
    }
    // Save
    return SettingStorage.saveSettings(tenantID, settingsToSave);
  }
}
