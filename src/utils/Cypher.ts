import { CryptoSetting, CryptoSettings, SettingDB, TechnicalSettings } from '../types/Setting';
import crypto, { CipherGCM, CipherGCMTypes, DecipherGCM } from 'crypto';

import BackendError from '../exception/BackendError';
import Constants from './Constants';
import { LockEntity } from '../types/Locking';
import LockingManager from '../locking/LockingManager';
import SettingStorage from '../storage/mongodb/SettingStorage';
import { TransformOptions } from 'stream';
import Utils from './Utils';
import _ from 'lodash';

const MODULE_NAME = 'Cypher';

interface CipherOptions extends TransformOptions {
  authTagLength?: number
}

export default class Cypher {
  public static async encrypt(tenantID: string, data: string, useFormerKey = false, cryptoSetting?: CryptoSetting): Promise<string> {
    if (!cryptoSetting) {
      cryptoSetting = (await Cypher.getCryptoSettings(tenantID)).crypto;
    }
    const algo = useFormerKey ? Utils.buildCryptoAlgorithm(cryptoSetting.formerKeyProperties) : Utils.buildCryptoAlgorithm(cryptoSetting.keyProperties);
    const iv = crypto.randomBytes(Cypher.getIVLength(algo));
    const key = useFormerKey ? Buffer.from(cryptoSetting.formerKey) : Buffer.from(cryptoSetting.key);
    const cipher: CipherGCM = crypto.createCipheriv(algo, key, iv, Cypher.getCipherOptions(algo)) as CipherGCM;
    let encryptedData = cipher.update(data);
    encryptedData = Buffer.concat([encryptedData, cipher.final()]);
    if (Cypher.isAuthenticatedEncryptionMode(algo)) {
      const authTag = cipher.getAuthTag();
      if (!Utils.isUndefined(authTag)) {
        return iv.toString('hex') + ':' + encryptedData.toString('hex') + ':' + authTag.toString('hex');
      }
    }
    return iv.toString('hex') + ':' + encryptedData.toString('hex');
  }

  public static async decrypt(tenantID: string, data: string, useFormerKey = false, cryptoSetting?: CryptoSetting): Promise<string> {
    const [ivStr, encryptedDataStr, authTagStr] = data.split(':');
    const iv = Buffer.from(ivStr, 'hex');
    const encryptedData = Buffer.from(encryptedDataStr, 'hex');
    let authTag: Buffer;
    if (!Utils.isUndefined(authTagStr)) {
      authTag = Buffer.from(authTagStr, 'hex');
    }
    if (!cryptoSetting) {
      cryptoSetting = (await Cypher.getCryptoSettings(tenantID)).crypto;
    }
    const algo: string | CipherGCMTypes = useFormerKey ? Utils.buildCryptoAlgorithm(cryptoSetting.formerKeyProperties) : Utils.buildCryptoAlgorithm(cryptoSetting.keyProperties);
    const key = useFormerKey ? Buffer.from(cryptoSetting.formerKey) : Buffer.from(cryptoSetting.key);
    const decipher: DecipherGCM = crypto.createDecipheriv(algo, key, iv, Cypher.getCipherOptions(algo)) as DecipherGCM;
    if (!Utils.isUndefined(authTag) && Cypher.isAuthenticatedEncryptionMode(algo)) {
      decipher.setAuthTag(authTag);
    }
    let decrypted = decipher.update(encryptedData);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  }

  public static hash(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  public static async checkCryptoSettings(cryptoSetting: CryptoSetting): Promise<void> {
    const dataToEncrypt = 'test-data-to-encrypt';
    // Cypher
    const encryptedData = await Cypher.encrypt(null, dataToEncrypt, false, cryptoSetting);
    // Decypher
    const decryptedData = await Cypher.decrypt(null, encryptedData, false, cryptoSetting);
    // Check
    if (decryptedData !== dataToEncrypt) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        message: 'Crypto algorithm check failed',
        module: MODULE_NAME, method: 'checkCryptoSettings',
      });
    }
  }

  public static async encryptSensitiveDataInJSON(tenantID: string, data: Record<string, any>, useFormerKey = false, cryptoSetting?: CryptoSetting): Promise<void> {
    if (typeof data !== 'object') {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME,
        method: 'encryptSensitiveDataInJSON',
        message: `The parameter ${data} is not an object`
      });
    }
    if (Utils.isEmptyArray(data.sensitiveData)) {
      data.sensitiveData = [];
    }
    for (const property of data.sensitiveData as string[]) {
      // Check that the property does exist otherwise skip to the next property
      if (Utils.objectHasProperty(data, property)) {
        const value = _.get(data, property);
        // If the value is undefined, null or empty then do nothing and skip to the next property
        if (value && value.length > 0) {
          _.set(data, property, await Cypher.encrypt(tenantID, value, useFormerKey, cryptoSetting));
        }
      }
    }
  }

  public static async decryptSensitiveDataInJSON(tenantID: string, data: Record<string, any>, useFormerKey = false, cryptoSetting?: CryptoSetting): Promise<void> {
    if (typeof data !== 'object') {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME,
        method: 'decryptSensitiveDataInJSON',
        message: `The parameter ${data} is not an object`
      });
    }
    if (!Utils.isEmptyArray(data.sensitiveData)) {
      for (const property of data.sensitiveData as string[]) {
        // Check that the property does exist otherwise skip to the next property
        if (Utils.objectHasProperty(data, property)) {
          const value = _.get(data, property);
          // If the value is undefined, null or empty then do nothing and skip to the next property
          if (value && value.length > 0) {
            _.set(data, property, await Cypher.decrypt(tenantID, value, useFormerKey, cryptoSetting));
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

  // This method will be reused in a Scheduler task that resumes migration
  public static async handleCryptoSettingsChange(tenantID: string): Promise<void> {
    const createDatabaseLock = LockingManager.createExclusiveLock(tenantID, LockEntity.DATABASE, 'migrate-settings-sensitive-data');
    if (await LockingManager.acquire(createDatabaseLock)) {
      try {
        // Get the crypto key
        const cryptoSettings = await Cypher.getCryptoSettings(tenantID);
        // Migrate Settings
        await Cypher.migrateSettings(tenantID, cryptoSettings.crypto);
        // Cleanup
        await Cypher.cleanupBackupSensitiveData(tenantID);
        // Flag the migration as done
        cryptoSettings.crypto.migrationToBeDone = false;
        await Cypher.saveCryptoSetting(tenantID, cryptoSettings);
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
    } else {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME,
        method: 'handleCryptoSettingsChange',
        message: `Sensitive Data migration is in progress for tenant with ID: ${tenantID}.`
      });
    }
  }

  public static async saveCryptoSetting(tenantID: string, cryptoSettingToSave: CryptoSettings): Promise<void> {
    // Build internal structure
    const settingsToSave = {
      id: cryptoSettingToSave.id,
      identifier: TechnicalSettings.CRYPTO,
      lastChangedOn: new Date(),
      content: {
        crypto: cryptoSettingToSave.crypto
      },
    } as SettingDB;
    // Save
    await SettingStorage.saveSettings(tenantID, settingsToSave);
  }

  private static async getCryptoSettings(tenantID: string): Promise<CryptoSettings> {
    const cryptoSettings = await SettingStorage.getCryptoSettings(tenantID);
    if (!cryptoSettings || !cryptoSettings.crypto) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME,
        method: 'getCryptoSetting',
        message: `Tenant ID '${tenantID}' does not have crypto settings.`
      });
    }
    return cryptoSettings;
  }

  private static async getSettingsWithSensitiveData(tenantID: string): Promise<SettingDB[]> {
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

  private static async migrateSettings(tenantID: string, cryptoSetting: CryptoSetting): Promise<void> {
    const settingsToMigrate = await Cypher.getSettingsWithSensitiveData(tenantID);
    // If tenant has settings with sensitive data, migrate them
    if (!Utils.isEmptyArray(settingsToMigrate)) {
      // Migrate
      for (const settingToMigrate of settingsToMigrate) {
        // Migration already done?
        if (Utils.isEmptyJSon(settingToMigrate.backupSensitiveData)) {
          // Save former sensitive data in setting
          settingToMigrate.backupSensitiveData = Cypher.prepareBackupSensitiveData(settingToMigrate);
          // Decrypt sensitive data with former key and key properties
          await Cypher.decryptSensitiveDataInJSON(tenantID, settingToMigrate, true, cryptoSetting);
          // Encrypt sensitive data with new key and key properties
          await Cypher.encryptSensitiveDataInJSON(tenantID, settingToMigrate, false, cryptoSetting);
          // Save setting with sensitive data encrypted with new key
          await SettingStorage.saveSettings(tenantID, settingToMigrate);
        }
      }
    }
  }

  private static prepareBackupSensitiveData(setting: SettingDB): Record<string, unknown> {
    const backupSensitiveData: Record<string, unknown> = {};
    for (const property of setting.sensitiveData) {
      // Check that the property does exist otherwise skip to the next property
      if (Utils.objectHasProperty(setting, property)) {
        const value = _.get(setting, property) as string;
        // If the value is undefined, null or empty then do nothing and skip to the next property
        if (value && value.length > 0) {
          backupSensitiveData[property] = value;
        }
      }
    }
    return backupSensitiveData;
  }

  private static isAuthenticatedEncryptionMode(algo: string): boolean {
    return algo.includes('gcm') || algo.includes('ccm') || algo.includes('GCM') || algo.includes('CCM') || algo.includes('ocb');
  }

  private static getIVLength(algo: string): number {
    if (algo.includes('ccm') || algo.includes('ocb')) {
      // Bytes
      return 13;
    }
    // Bytes
    return 16;
  }

  private static getCipherOptions(algo: string): CipherOptions {
    if (algo.includes('ccm') || algo.includes('ocb')) {
      return {
        // Bytes
        authTagLength: 16
      };
    }
    return {};
  }

  private static async cleanupBackupSensitiveData(tenantID: string): Promise<void> {
    // Cleanup former encrypted data
    const settingsToCleanup = await Cypher.getSettingsWithSensitiveData(tenantID);
    // If tenant has settings with sensitive data, clean them
    if (!Utils.isEmptyArray(settingsToCleanup)) {
      // Cleanup
      for (const setting of settingsToCleanup) {
        if (Utils.objectHasProperty(setting, 'backupSensitiveData')) {
          delete setting.backupSensitiveData;
          await SettingStorage.saveSettings(tenantID, setting);
        }
      }
    }
  }
}
