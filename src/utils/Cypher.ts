import { CryptoSetting, CryptoSettingsType, KeySettings, SettingDB } from '../types/Setting';

import BackendError from '../exception/BackendError';
import Configuration from './Configuration';
import Constants from './Constants';
import CryptoConfiguration from '../types/configuration/CryptoConfiguration';
import SettingStorage from '../storage/mongodb/SettingStorage';
import TenantComponents from '../types/TenantComponents';
import _ from 'lodash';
import crypto from 'crypto';

const IV_LENGTH = 16;
const MODULE_NAME = 'Cypher';

export default class Cypher {
  private static configuration: CryptoConfiguration;
  private static cryptoSetting: CryptoSetting;

  public static getConfiguration(): CryptoConfiguration {
    if (!this.configuration) {
      this.configuration = Configuration.getCryptoConfig();
      if (!this.configuration) {
        throw new BackendError({
          source: Constants.CENTRAL_SERVER,
          module: MODULE_NAME,
          method: 'getConfiguration',
          message: 'Crypto configuration is missing'
        });
      }
    }
    return this.configuration;
  }

  public static getCrypto(): CryptoSetting {
    if (!this.cryptoSetting) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME,
        method: 'getCrypto',
        message: 'Crypto Setting is missing'
      });
    }
    return this.cryptoSetting;
  }

  public static async detectConfigurationKey(tenantID: string): Promise<boolean> {

    const configCryptoKey: string = Configuration.getCryptoConfig().key;
    const keySettings = await SettingStorage.getCryptoSettings(tenantID);
    let cryptoSettingToSave: CryptoSetting;
    // TODO check for migrationDone

    // Check if Crypto Settings exist
    if (keySettings) {
      // Detect new config Cypher key
      if (keySettings.crypto?.key !== configCryptoKey) {
        cryptoSettingToSave = {
          formerKey: keySettings.crypto.key,
          key: configCryptoKey,
          migrationDone: false
        } as CryptoSetting;
      }
    } else {
      // Create New Config Crypto Key in Tenant Settings
      cryptoSettingToSave = {
        key: configCryptoKey
      } as CryptoSetting;
    }

    // Key migration of senitive data
    this.cryptoSetting = cryptoSettingToSave ? cryptoSettingToSave : keySettings.crypto;

    if (cryptoSettingToSave) {
      const keySettingToSave = {
        identifier: TenantComponents.CRYPTO,
        type: CryptoSettingsType.CRYPTO,
        crypto: cryptoSettingToSave
      } as KeySettings;
      await SettingStorage.saveCryptoSettings(tenantID, keySettingToSave);
      return true;
    }
  }

  public static async migrateSensitiveData(tenantID: string, setting: SettingDB): Promise<void> {
    if (this.cryptoSetting) {
      this.decryptSensitiveDataInJSON(setting, this.cryptoSetting.formerKey);
      // TODO add check for clearValue
      this.encryptSensitiveDataInJSON(setting, this.cryptoSetting.key);
      await SettingStorage.saveSettings(tenantID, setting);
    }
  }

  public static async migrateAllSensitiveData(tenantID: string, settings: SettingDB[]): Promise<void> {
    for (const setting of settings) {
      await this.migrateSensitiveData(tenantID, setting);
    }
  }

  public static encrypt(data: string, key: string): string {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(Cypher.getConfiguration().algorithm, Buffer.from(key), iv);
    let encryptedData = cipher.update(data);
    encryptedData = Buffer.concat([encryptedData, cipher.final()]);
    return iv.toString('hex') + ':' + encryptedData.toString('hex');
  }

  public static decrypt(data: string, key: string): string {
    const dataParts = data.split(':');
    const iv = Buffer.from(dataParts.shift(), 'hex');
    const encryptedData = Buffer.from(dataParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv(Cypher.getConfiguration().algorithm, Buffer.from(key), iv);
    let decrypted = decipher.update(encryptedData);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  }

  public static hash(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  public static encryptSensitiveDataInJSON(obj: Record<string, any>, key: string): void {
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
            _.set(obj, property, Cypher.encrypt(value, key));
          }
        }
      }
    } else {
      obj.sensitiveData = [];
    }
  }

  public static decryptSensitiveDataInJSON(obj: Record<string, any>, key: string): void {
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
            _.set(obj, property, Cypher.decrypt(value, key));
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
}
