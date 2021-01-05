import { CryptoSetting, CryptoSettingsType, KeySettings, SettingDB } from '../types/Setting';
import { SensitiveData, SettingSensitiveData } from '../types/SensitiveData';

import BackendError from '../exception/BackendError';
import Configuration from './Configuration';
import Constants from './Constants';
import CryptoConfiguration from '../types/configuration/CryptoConfiguration';
import Logging from './Logging';
import SensitiveDataMigrationStorage from '../storage/mongodb/SensitiveDataMigrationStorage';
import SettingStorage from '../storage/mongodb/SettingStorage';
import TenantComponents from '../types/TenantComponents';
import _ from 'lodash';
import crypto from 'crypto';

const IV_LENGTH = 16;
const MODULE_NAME = 'Cypher';

export default class Cypher {
  private static configuration: CryptoConfiguration;
  private static cryptoSetting: CryptoSetting;
  private static keySetting: KeySettings;

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

  public static async getCryptoKey(tenantID: string): Promise<string> {
    if (!this.cryptoSetting) {
      await this.detectConfigurationKey(tenantID);
    }
    return this.cryptoSetting?.migrationDone ? this.cryptoSetting?.key : this.cryptoSetting?.formerKey;
  }

  public static async detectConfigurationKey(tenantID: string): Promise<boolean> {
    let isKeyChanged = false;
    const configCryptoKey: string = Configuration.getCryptoConfig().key;
    const keySettings = await SettingStorage.getCryptoSettings(tenantID);
    let cryptoSettingToSave: CryptoSetting;
    // TODO check for migrationDone

    // Check if Crypto Settings exist
    if (keySettings) {
      this.keySetting = keySettings;
      if (keySettings.crypto?.migrationDone === false) {
        throw new BackendError({
          source: Constants.CENTRAL_SERVER,
          module: MODULE_NAME,
          method: 'detectConfigurationKey',
          message: 'Cannot change crypto key if migration not done'
        });
        // Call a method for completing migration?
        // Also log error?
      }
      // Detect new config Cypher key
      if (keySettings.crypto?.key !== configCryptoKey) {
        cryptoSettingToSave = {
          formerKey: keySettings.crypto.key,
          key: configCryptoKey,
          migrationDone: false
        } as CryptoSetting;
        isKeyChanged = true;
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
        id: keySettings?.id,
        identifier: TenantComponents.CRYPTO,
        type: CryptoSettingsType.CRYPTO,
        crypto: cryptoSettingToSave
      } as KeySettings;
      await SettingStorage.saveCryptoSettings(tenantID, keySettingToSave);
    }
    return isKeyChanged;
  }

  public static async setMigrationDone(tenantID:string): Promise<void> {
    this.cryptoSetting.migrationDone = true;
    const keySettingToSave = {
      id: this.keySetting.id,
      identifier: TenantComponents.CRYPTO,
      type: CryptoSettingsType.CRYPTO,
      crypto: this.cryptoSetting
    } as KeySettings;
    await SettingStorage.saveCryptoSettings(tenantID, keySettingToSave);
  }

  public static getSensitiveDatainSetting(setting: SettingDB): string[] {

    const allSensitiveData: string[] = [];
    for (const property of setting.sensitiveData) {
      // Check that the property does exist otherwise skip to the next property
      if (_.has(setting, property)) {
        const value:string = _.get(setting, property);

        // If the value is undefined, null or empty then do nothing and skip to the next property
        if (value && value.length > 0) {
          allSensitiveData[`${property}`] = value;
        }
      }
    }
    return allSensitiveData;

  }

  public static async migrateSensitiveData(tenantID: string, setting: SettingDB): Promise<SensitiveData[]> {
    try {
      if (this.cryptoSetting) {
        // TODO add check for clearValue

        const valuebeforeDecrypt = this.getSensitiveDatainSetting(setting);
        this.decryptSensitiveDataInJSON(setting, this.cryptoSetting.formerKey);
        const valueAfterDecrypt = this.getSensitiveDatainSetting(setting);
        this.encryptSensitiveDataInJSON(setting, this.cryptoSetting.key);
        const valueAfterEncrypt = this.getSensitiveDatainSetting(setting);

        const allSensitiveData: SensitiveData[] = [];
        for (const property of setting.sensitiveData) {
          const sensitiveData = {
            identifier: setting.identifier,
            path: property,
            initialValue: {
              encryptedValue: valuebeforeDecrypt[property],
              key: this.cryptoSetting.formerKey
            },
            clearValue: valueAfterDecrypt[property],
            migratedValue: {
              encryptedValue: valueAfterEncrypt[property],
              key: this.cryptoSetting.key
            }
          } as SensitiveData;
          allSensitiveData.push(sensitiveData);
        }

        const settingSensitiveData: SettingSensitiveData = {
          id: setting.id,
          identifier: setting.identifier,
          sensitiveData: allSensitiveData
        };
        // Save setting with crypto key migration
        await SettingStorage.saveSettings(tenantID, setting);

        // Save migration of setting
        await SensitiveDataMigrationStorage.saveSensitiveData(tenantID, settingSensitiveData);

        return allSensitiveData;
      }
    } catch (err) {
      console.error(err);
    }
  }

  public static async migrateAllSensitiveData(tenantID: string, settings: SettingDB[]): Promise<SettingSensitiveData[]> {

    const settingsSensitiveData: SettingSensitiveData[] = [];
    for (const setting of settings) {
      const sensitiveData: SensitiveData[] = await this.migrateSensitiveData(tenantID, setting);
      const settingSensitiveData: SettingSensitiveData = {
        id: setting.id,
        identifier: setting.identifier,
        sensitiveData: sensitiveData
      };
      settingsSensitiveData.push(settingSensitiveData);
    }
    return settingsSensitiveData;
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
