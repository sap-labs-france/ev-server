import { CryptoKeySetting, KeySettings, KeySettingsType } from '../types/Setting';

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
  private static cryptoKey: CryptoKeySetting;

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

  public static async detectConfigurationKey(tenantID: string): Promise<void> {

    const configCryptoKey: string = Configuration.getCryptoConfig().key;
    const keySettings = await SettingStorage.getCryptoKeySettings(tenantID);
    let cryptoKeySetting: CryptoKeySetting;

    // Check if Crypto Key settings exists
    if (keySettings) {
      // Detect new config Cypher key
      if (keySettings.cryptoKey.newKey && keySettings.cryptoKey.newKey !== configCryptoKey) {
        cryptoKeySetting = {
          oldKey: keySettings.cryptoKey.newKey
        } as CryptoKeySetting;
      } else if (!keySettings.cryptoKey.newKey && keySettings.cryptoKey.oldKey !== configCryptoKey) {
        // If no newKey exist, detect oldKey change
        cryptoKeySetting = {
          oldKey: keySettings.cryptoKey.oldKey
        } as CryptoKeySetting;
      }
      // If key change detected, prepare KeySettings change
      if (cryptoKeySetting) {
        await SettingStorage.deleteSetting(tenantID, keySettings.id);
        cryptoKeySetting.newKey = configCryptoKey;

        // Key migration of senitive data
        this.cryptoKey = cryptoKeySetting;
        await this.migrateSensitiveData(tenantID);

      }
    } else {
      // Create New Config Crypto Key in Tenant Settings
      cryptoKeySetting = {
        oldKey: configCryptoKey
      } as CryptoKeySetting;
    }

    if (cryptoKeySetting) {
      const keySettingToSave = {
        identifier: TenantComponents.CRYPTO_KEY,
        type: KeySettingsType.CRYPTO_KEY,
        cryptoKey: cryptoKeySetting
      } as KeySettings;
      await SettingStorage.saveCryptoKeySettings(tenantID, keySettingToSave);
    }
  }

  public static async migrateSensitiveDataByIdentifier(tenantID: string, identifier: string): Promise<void> {
    const settings = await SettingStorage.getSettingByIdentifier(tenantID, identifier);
    if (settings) {
      this.decryptSensitiveDataInJSON(settings, this.cryptoKey.oldKey);
      this.encryptSensitiveDataInJSON(settings, this.cryptoKey.newKey);
      await SettingStorage.saveSettings(tenantID, settings);
    }
  }

  public static async migrateSensitiveData(tenantID: string): Promise<void> {
    for (const identifier in TenantComponents) {
      await this.migrateSensitiveDataByIdentifier(tenantID, identifier);
    }
  }

  public static encrypt(data: string, key?: string): string {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cryptoKey = key ? key : Cypher.getConfiguration().key;
    const cipher = crypto.createCipheriv(Cypher.getConfiguration().algorithm, Buffer.from(cryptoKey), iv);
    let encryptedData = cipher.update(data);
    encryptedData = Buffer.concat([encryptedData, cipher.final()]);
    return iv.toString('hex') + ':' + encryptedData.toString('hex');
  }

  public static decrypt(data: string, key?: string): string {
    const dataParts = data.split(':');
    const iv = Buffer.from(dataParts.shift(), 'hex');
    const encryptedData = Buffer.from(dataParts.join(':'), 'hex');
    const cryptoKey = key ? key : Cypher.getConfiguration().key;
    const decipher = crypto.createDecipheriv(Cypher.getConfiguration().algorithm, Buffer.from(cryptoKey), iv);
    let decrypted = decipher.update(encryptedData);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  }

  public static hash(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  public static encryptSensitiveDataInJSON(obj: Record<string, any>, key?: string): void {
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

  public static decryptSensitiveDataInJSON(obj: Record<string, any>, key?: string): void {
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
