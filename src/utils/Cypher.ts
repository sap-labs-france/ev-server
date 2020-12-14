import { CryptoKeySetting, KeySettings, KeySettingsType } from '../types/Setting';

import BackendError from '../exception/BackendError';
import Configuration from './Configuration';
import Constants from './Constants';
import CryptoConfiguration from '../types/configuration/CryptoConfiguration';
import SettingStorage from '../storage/mongodb/SettingStorage';
import _ from 'lodash';
import crypto from 'crypto';

const IV_LENGTH = 16;
const MODULE_NAME = 'Cypher';

export default class Cypher {
  private static configuration: CryptoConfiguration;

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

    // Check if Crypto Key settings exists
    if (keySettings) {
      // Detect new config Cypher key
      if ((keySettings.cryptoKey.newKey) && (keySettings.cryptoKey.newKey !== configCryptoKey)) {
        await SettingStorage.deleteSetting(tenantID, keySettings.id);
        // Save newKey
        const cryptoKeySetting = {
          oldKey: keySettings.cryptoKey.newKey,
          newKey: configCryptoKey
        } as CryptoKeySetting;
        const keySettingToSave = {
          identifier: keySettings.identifier,
          type: keySettings.type,
          cryptoKey: cryptoKeySetting
        } as KeySettings;
        await SettingStorage.saveCryptoKeySettings(tenantID, keySettingToSave);
      } else if ((keySettings.cryptoKey.oldKey) && (keySettings.cryptoKey.oldKey !== configCryptoKey)) {
        await SettingStorage.deleteSetting(tenantID, keySettings.id);
        // Save newKey
        const cryptoKeySetting = {
          oldKey: keySettings.cryptoKey.oldKey,
          newKey: configCryptoKey
        } as CryptoKeySetting;
        const keySettingToSave = {
          identifier: keySettings.identifier,
          type: keySettings.type,
          cryptoKey: cryptoKeySetting
        } as KeySettings;
        await SettingStorage.saveCryptoKeySettings(tenantID, keySettingToSave);
      }
    } else {
      // Save Config Crypto Key in Tenant Settings
      const cryptoKeySetting = {
        oldKey: configCryptoKey
      } as CryptoKeySetting;

      const keySettingToSave = {
        identifier: 'cryptoKey',
        type: KeySettingsType.CRYPTO_KEY,
        cryptoKey: cryptoKeySetting
      } as KeySettings;

      await SettingStorage.saveCryptoKeySettings(tenantID, keySettingToSave);
    }


  }

  public static encrypt(data: string): string {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(Cypher.getConfiguration().algorithm, Buffer.from(Cypher.getConfiguration().key), iv);
    let encryptedData = cipher.update(data);
    encryptedData = Buffer.concat([encryptedData, cipher.final()]);
    return iv.toString('hex') + ':' + encryptedData.toString('hex');
  }

  public static decrypt(data: string): string {
    const dataParts = data.split(':');
    const iv = Buffer.from(dataParts.shift(), 'hex');
    const encryptedData = Buffer.from(dataParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv(Cypher.getConfiguration().algorithm, Buffer.from(Cypher.getConfiguration().key), iv);
    let decrypted = decipher.update(encryptedData);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  }

  public static hash(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  public static encryptSensitiveDataInJSON(obj: Record<string, any>): void {
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
            _.set(obj, property, Cypher.encrypt(value));
          }
        }
      }
    } else {
      obj.sensitiveData = [];
    }
  }

  public static decryptSensitiveDataInJSON(obj: Record<string, any>): void {
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
            _.set(obj, property, Cypher.decrypt(value));
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
