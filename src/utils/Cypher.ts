import { CryptoKeySetting, CryptoSetting, SettingDB } from '../types/Setting';

import BackendError from '../exception/BackendError';
import Constants from './Constants';
import { LockEntity } from '../types/Locking';
import LockingManager from '../locking/LockingManager';
import SettingStorage from '../storage/mongodb/SettingStorage';
import Utils from './Utils';
import _ from 'lodash';
import crypto from 'crypto';

const IV_LENGTH = 16;
const MODULE_NAME = 'Cypher';

export default class Cypher {

  public static async encrypt(tenantID: string, data: string, useFormerKey = false): Promise<string> {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cryptoSetting = await Cypher.getCryptoSetting(tenantID);
    const algo = useFormerKey ? Utils.buildAlgorithm(cryptoSetting.formerKeyProperties) : Utils.buildAlgorithm(cryptoSetting.keyProperties);
    const key = useFormerKey ? Buffer.from(cryptoSetting.formerKey) : Buffer.from(cryptoSetting.key);
    const cipher = crypto.createCipheriv(algo, key, iv);
    let encryptedData = cipher.update(data);
    encryptedData = Buffer.concat([encryptedData, cipher.final()]);
    return iv.toString('hex') + ':' + encryptedData.toString('hex');
  }

  public static async decrypt(tenantID: string, data: string, useFormerKey = false): Promise<string> {
    const dataParts = data.split(':');
    const iv = Buffer.from(dataParts.shift(), 'hex');
    const encryptedData = Buffer.from(dataParts.join(':'), 'hex');
    const cryptoSetting = await Cypher.getCryptoSetting(tenantID);
    const algo = useFormerKey ? Utils.buildAlgorithm(cryptoSetting.formerKeyProperties) : Utils.buildAlgorithm(cryptoSetting.keyProperties);
    const key = useFormerKey ? Buffer.from(cryptoSetting.formerKey) : Buffer.from(cryptoSetting.key);
    const decipher = crypto.createDecipheriv(algo, key , iv);
    let decrypted = decipher.update(encryptedData);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  }

  public static hash(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  public static async encryptSensitiveDataInJSON(tenantID: string, obj: Record<string, any>, useFormerKey = false): Promise<void> {
    if (typeof obj !== 'object') {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME,
        method: 'encryptSensitiveDataInJSON',
        message: `The parameter ${obj} is not an object`
      });
    }
    if ('sensitiveData' in obj) {
      // Check that sensitive data is an array
      if (!Array.isArray(obj.sensitiveData)) {
        throw new BackendError({
          source: Constants.CENTRAL_SERVER,
          module: MODULE_NAME,
          method: 'encryptSensitiveDataInJSON',
          message: 'The property \'sensitiveData\' is not an array'
        });
      }
      for (const property of obj.sensitiveData as string[]) {
        // Check that the property does exist otherwise skip to the next property
        if (_.has(obj, property)) {
          const value = _.get(obj, property);
          // If the value is undefined, null or empty then do nothing and skip to the next property
          if (value && value.length > 0) {
            _.set(obj, property, await Cypher.encrypt(tenantID, value, useFormerKey));
          }
        }
      }
    } else {
      obj.sensitiveData = [];
    }
  }

  public static async decryptSensitiveDataInJSON(tenantID: string, obj: Record<string, any>, useFormerKey = false): Promise<void> {
    if (typeof obj !== 'object') {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME,
        method: 'decryptSensitiveDataInJSON',
        message: `The parameter ${obj} is not an object`
      });
    }
    if ('sensitiveData' in obj) {
      // Check that sensitive data is an array
      if (!Array.isArray(obj.sensitiveData)) {
        throw new BackendError({
          source: Constants.CENTRAL_SERVER,
          module: MODULE_NAME,
          method: 'decryptSensitiveDataInJSON',
          message: 'The property \'sensitiveData\' is not an array'
        });
      }
      for (const property of obj.sensitiveData as string[]) {
        // Check that the property does exist otherwise skip to the next property
        if (_.has(obj, property)) {
          const value = _.get(obj, property);
          // If the value is undefined, null or empty then do nothing and skip to the next property
          if (value && value.length > 0) {
            _.set(obj, property, await Cypher.decrypt(tenantID, value, useFormerKey));
          }
        }
      }
    }
  }

  public static hashSensitiveDataInJSON(obj: Record<string, any>): void {
    if (typeof obj !== 'object') {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME,
        method: 'hashSensitiveDataInJSON',
        message: `The parameter ${obj} is not an object`
      });
    }
    if (obj.sensitiveData) {
      // Check that sensitive data is an array
      if (!Array.isArray(obj.sensitiveData)) {
        throw new BackendError({
          source: Constants.CENTRAL_SERVER,
          module: MODULE_NAME,
          method: 'hashSensitiveDataInJSON',
          message: 'The property \'sensitiveData\' is not an array'
        });
      }
      for (const property of obj.sensitiveData as string[]) {
        // Check that the property does exist otherwise skip to the next property
        if (_.has(obj, property)) {
          const value = _.get(obj, property);
          // If the value is undefined, null or empty then do nothing and skip to the next property
          if (value && value.length > 0) {
            _.set(obj, property, Cypher.hash(value));
          }
        }
      }
    }
  }

  // This method will be reused in a Scheduler task that resumes migation
  public static async handleCryptoSettingsChange(tenantID: string): Promise<void> {
    const createDatabaseLock = LockingManager.createExclusiveLock(tenantID, LockEntity.DATABASE, 'migrate-settings-sensitive-data');
    try {
      if (await LockingManager.acquire(createDatabaseLock)) {
        try {
          await Cypher.migrate(tenantID);
          await Cypher.cleanupFormerSensitiveData(tenantID);
          const keySettings = await SettingStorage.getCryptoSettings(tenantID);
          keySettings.crypto.migrationToBeDone = false;
          await Cypher.saveCryptoSetting(tenantID, keySettings);
        } catch (err) {
          throw new BackendError({
            source: Constants.CENTRAL_SERVER,
            module: MODULE_NAME,
            method: 'handleCryptoSettingsChange',
            message: `Sensitive Data migration for tenant with ID: ${tenantID} failed.`
          });
        } finally {
          // Release the database Lock
          await LockingManager.release(createDatabaseLock);
        }
      }
    } catch (err) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME,
        method: 'handleCryptoSettingsChange',
        message: `Sensitive Data migration in progress for tenant with ID: ${tenantID}.`
      });
    }
  }

  public static async migrate(tenantID: string): Promise<void> {
    const cryptoSetting = await Cypher.getCryptoSetting(tenantID);
    await Cypher.migrateSettings(tenantID, cryptoSetting);
  }

  public static async getSettingsWithSensitiveData(tenantID: string): Promise<SettingDB[]> {
    // Get all settings per tenant
    const settings = await SettingStorage.getSettings(tenantID, {},
      Constants.DB_PARAMS_MAX_LIMIT);
    // Filter settings with sensitiveData
    return settings.result.filter((value: SettingDB) => {
      if (value?.sensitiveData && !Utils.isEmptyArray(value?.sensitiveData)) {
        return true;
      }
    });
  }

  public static async migrateSettings(tenantID: string, cryptoSetting: CryptoSetting): Promise<void> {

    const settingsToMigrate = await Cypher.getSettingsWithSensitiveData(tenantID);
    // If tenant has settings with sensitive data, migrate them
    if (!Utils.isEmptyArray(settingsToMigrate)) {
      // Migrate
      for (const setting of settingsToMigrate) {
        if (!setting.backupSensitiveData && Utils.isEmptyArray(setting.backupSensitiveData)) {
          // Save former senitive data in setting
          const backupSensitiveData = Cypher.prepareFormerSenitiveData(setting);
          setting.backupSensitiveData = backupSensitiveData;
          // Decrypt sensitive data with former key and key properties
          await Cypher.decryptSensitiveDataInJSON(tenantID,setting, true);
          // Encrypt sensitive data with new key and key properties
          await Cypher.encryptSensitiveDataInJSON(tenantID, setting);
          // Save setting with sensitive data encrypted with new key
          await SettingStorage.saveSettings(tenantID, setting);
        }
      }
    }
  }

  public static async cleanupFormerSensitiveData(tenantID: string): Promise<void> {
    const settingsToCleanup = await Cypher.getSettingsWithSensitiveData(tenantID);
    // If tenant has settings with sensitive data, clean them
    if (!Utils.isEmptyArray(settingsToCleanup)) {
      // Cleanup
      for (const setting of settingsToCleanup) {
        if (setting.backupSensitiveData) {
          delete setting.backupSensitiveData;
          await SettingStorage.saveSettings(tenantID, setting);
        }
      }
    }
  }

  public static async saveCryptoSetting(tenantID: string, cryptoSettingToSave: CryptoKeySetting): Promise<void> {
    // Build internal structure
    const settingsToSave = {
      id: cryptoSettingToSave.id,
      identifier: 'crypto',
      lastChangedOn: new Date(),
      content: {
        crypto: cryptoSettingToSave.crypto
      },
    } as SettingDB;
    // Save
    await SettingStorage.saveSettings(tenantID, settingsToSave);
  }

  private static async getCryptoSetting(tenantID: string): Promise<CryptoSetting> {
    const cryptoSettings = await SettingStorage.getCryptoSettings(tenantID);
    if (!cryptoSettings || !cryptoSettings.crypto) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME,
        method: 'getCryptoSetting',
        message: `Tenant ID '${tenantID}' does not have crypto settings.`
      });
    }
    return cryptoSettings.crypto;
  }

  private static prepareFormerSenitiveData(setting: SettingDB): string[] {
    const backupSensitiveData: string[] = [];
    for (const property of setting.sensitiveData) {
    // Check that the property does exist otherwise skip to the next property
      if (_.has(setting, property)) {
        const value: string = _.get(setting, property);
        // If the value is undefined, null or empty then do nothing and skip to the next property
        if (value && value.length > 0) {
          backupSensitiveData[property] = value;
        }
      }
    }
    return backupSensitiveData;
  }
}
