import { BillingSettings, BillingSettingsType, SettingDB } from '../../types/Setting';

import AppError from '../../exception/AppError';
import Constants from '../../utils/Constants';
import Cypher from '../../utils/Cypher';
import { HTTPError } from '../../types/HTTPError';
import SettingStorage from './SettingStorage';
import TenantComponents from '../../types/TenantComponents';
import _ from 'lodash';

const MODULE_NAME = 'BillingSettingStorage';
export default class BillingSettingStorage {

  public static alterBillingSettings(billingSettings: BillingSettings, setting: SettingDB, encryptSensitiveData: boolean): BillingSettings {
    // Encrypt Sensitive Data
    if (encryptSensitiveData) {
      Cypher.hashSensitiveDataInJSON(setting);
    }
    // Extract the data
    const content = setting.content;
    billingSettings.id = setting.id;
    billingSettings.sensitiveData = setting.sensitiveData;
    billingSettings.backupSensitiveData = setting.backupSensitiveData;
    // Billing Common Properties
    if (content.billing) {
      const { isTransactionBillingActivated, immediateBillingAllowed, periodicBillingAllowed, taxID, usersLastSynchronizedOn } = content.billing;
      billingSettings.billing = {
        isTransactionBillingActivated,
        immediateBillingAllowed,
        periodicBillingAllowed,
        usersLastSynchronizedOn,
        taxID,
      };
    }
    // Billing Concrete Implementation Properties
    if (content.stripe) {
      billingSettings.type = BillingSettingsType.STRIPE;
      const { url, publicKey, secretKey } = content.stripe;
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

  public static async saveBillingSetting(tenantID: string, settingID: string, newBillingSettings: Partial<BillingSettings>, encryptSensitiveData = false): Promise<string> {
    // Load previous settings
    const settings = await SettingStorage.getSettings(tenantID, { settingID }, Constants.DB_PARAMS_SINGLE_RECORD);
    if (settings?.result?.[0]?.content) {
      // Build internal structure
      const settingsToSave = settings.result[0];
      if (encryptSensitiveData) {
        await BillingSettingStorage.processSensitiveData(tenantID, settingsToSave, newBillingSettings);
      }
      const { isTransactionBillingActivated, usersLastSynchronizedOn } = settingsToSave.content.billing;
      const { immediateBillingAllowed, periodicBillingAllowed, taxID } = newBillingSettings.billing;
      // Common Properties
      settingsToSave.content.billing = {
        isTransactionBillingActivated,usersLastSynchronizedOn,
        immediateBillingAllowed, periodicBillingAllowed, taxID
      };
      // STRIPE Properties
      if (settingsToSave.content.type === BillingSettingsType.STRIPE) {
        settingsToSave.content.stripe = newBillingSettings.stripe;
      }
      // Save
      return SettingStorage.saveSettings(tenantID, settingsToSave);
    }
    return null;
  }

  private static async processSensitiveData(tenantID: string, setting: SettingDB, billingSettings: Partial<BillingSettings>) {
    const { identifier, type, sensitiveData, billing, stripe } = billingSettings;
    const settingUpdate: SettingDB = {
      identifier,
      sensitiveData,
      content: {
        type,
        billing,
        stripe
      }
    };
    await BillingSettingStorage._processSensitiveData(tenantID, setting, settingUpdate);
  }

  private static async _processSensitiveData(tenantID: string, setting: SettingDB, settingUpdate: SettingDB) {
    // Process the sensitive data if any
    // Preprocess the data to take care of updated values
    if (settingUpdate.sensitiveData) {
      if (!Array.isArray(settingUpdate.sensitiveData)) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          errorCode: HTTPError.CYPHER_INVALID_SENSITIVE_DATA_ERROR,
          message: `The property 'sensitiveData' for Setting with ID '${settingUpdate.id}' is not an array`,
          module: MODULE_NAME,
          method: 'handleUpdateSetting',
        });
      }
      // Process sensitive properties
      for (const property of settingUpdate.sensitiveData) {
      // Get the sensitive property from the request
        const valueInRequest = _.get(settingUpdate, property);
        if (valueInRequest && valueInRequest.length > 0) {
        // Get the sensitive property from the DB
          const valueInDb = _.get(setting, property);
          if (valueInDb && valueInDb.length > 0) {
            const hashedValueInDB = Cypher.hash(valueInDb);
            if (valueInRequest !== hashedValueInDB) {
            // Yes: Encrypt
              _.set(settingUpdate, property, await Cypher.encrypt(tenantID, valueInRequest));
            } else {
            // No: Put back the encrypted value
              _.set(settingUpdate, property, valueInDb);
            }
          } else {
          // Value in db is empty then encrypt
            _.set(settingUpdate, property, await Cypher.encrypt(tenantID, valueInRequest));
          }
        } else {
          throw new AppError({
            source: Constants.CENTRAL_SERVER,
            errorCode: HTTPError.CYPHER_INVALID_SENSITIVE_DATA_ERROR,
            message: `The property '${property}' for Setting with ID '${settingUpdate.id}' is not set`,
            module: MODULE_NAME,
            method: 'handleUpdateSetting',
          });
        }
      }
    } else {
      settingUpdate.sensitiveData = [];
    }
  }

}
