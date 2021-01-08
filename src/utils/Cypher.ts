import { CryptoSetting, CryptoSettingsType, KeyCryptoSetting, KeySettings, SettingDB } from '../types/Setting';
import { SensitiveData, SettingSensitiveData } from '../types/SensitiveData';

import BackendError from '../exception/BackendError';
import Configuration from './Configuration';
import Constants from './Constants';
import CryptoConfiguration from '../types/configuration/CryptoConfiguration';
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
  private static algorithm: string;

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

  public static async migrateCryptoKey(tenantID: string): Promise<void> {
    // Crypto Key from config file
    const configCryptoKey: string = Configuration.getCryptoConfig().key;
    // Crypto Key Settings from config file
    const configCryptoKeySettings: KeyCryptoSetting = {
      blockCypher: Configuration.getCryptoConfig().blockCypher,
      keySize: Configuration.getCryptoConfig().keySize,
      operationMode: Configuration.getCryptoConfig().operationMode
    };

    // Crypto Key Setting from db
    const keySettings = await SettingStorage.getCryptoSettings(tenantID);

    // If no Crypto Key Setting exist, initialize them with Crypto Key from config file
    if (!keySettings) {
      // Create New Crypto Key in Tenant Settings
      const keySettingToSave = {
        identifier: TenantComponents.CRYPTO,
        type: CryptoSettingsType.CRYPTO,
        crypto: {
          key: configCryptoKey,
          keySetting: configCryptoKeySettings,
          migrationDone: true
        }
      } as KeySettings;
      await SettingStorage.saveCryptoSettings(tenantID, keySettingToSave);
    }
  }

  public static getAlgorithm(key: string): string {
    let algorithm: string;
    if (key === this.cryptoSetting?.formerKey) {
      algorithm = `${this.cryptoSetting.formerKeySetting.blockCypher.toLowerCase()}-${this.cryptoSetting.formerKeySetting.keySize}-${this.cryptoSetting.formerKeySetting.operationMode.toLowerCase()}`;
    } else if (key === this.cryptoSetting?.key) {
      algorithm = `${this.cryptoSetting.keySetting.blockCypher.toLowerCase()}-${this.cryptoSetting.keySetting.keySize}-${this.cryptoSetting.keySetting.operationMode.toLowerCase()}`;
    }
    return algorithm;
  }

  public static getCryptoKeySync(): string {
    return this.cryptoSetting?.migrationDone ? this.cryptoSetting?.key : this.cryptoSetting?.formerKey;
  }

  public static async getCryptoKey(tenantID: string): Promise<string> {
    if (!this.cryptoSetting) {
      this.keySetting = await SettingStorage.getCryptoSettings(tenantID);
      this.cryptoSetting = this.keySetting.crypto;
    }
    return this.cryptoSetting?.migrationDone ? this.cryptoSetting?.key : this.cryptoSetting?.formerKey;
  }

  public static async getMigrationDone(tenantID: string): Promise<{ migrationDone: boolean, migrationId: string }> {
    this.keySetting = await SettingStorage.getCryptoSettings(tenantID);
    this.cryptoSetting = this.keySetting.crypto;
    return {
      migrationDone: this.cryptoSetting.migrationDone,
      migrationId: this.cryptoSetting.sensitiveDataMigrationId
    };
  }

  public static async setMigrationDone(tenantID:string): Promise<void> {
    this.cryptoSetting.migrationDone = true;
    this.cryptoSetting.sensitiveDataMigrationId = null;
    const keySettingToSave = {
      id: this.keySetting.id,
      identifier: TenantComponents.CRYPTO,
      type: CryptoSettingsType.CRYPTO,
      crypto: this.cryptoSetting
    } as KeySettings;
    await SettingStorage.saveCryptoSettings(tenantID, keySettingToSave);
  }

  public static async saveMigrationId(tenantID:string, migrationId: string): Promise<void> {
    this.cryptoSetting.sensitiveDataMigrationId = migrationId;
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

  public static prepareSaveSensitiveDataMigration(setting: SettingDB,
    valueBeforeDecrypt: string[], valueAfterDecrypt: string[], valueAfterEncrypt: string[]): SettingSensitiveData {
    const allSensitiveData: SensitiveData[] = [];
    for (const property of setting.sensitiveData) {
      const sensitiveData = {
        identifier: setting.identifier,
        path: property,
        initialValue: {
          encryptedValue: valueBeforeDecrypt[property],
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

    return {
      id: setting.id,
      identifier: setting.identifier,
      path: setting.sensitiveData,
      sensitiveData: allSensitiveData
    };
  }

  public static async migrateSensitiveData(tenantID: string, setting: SettingDB): Promise<void> {
    // Get sensitive data encrypted with former key
    const valueBeforeDecrypt = this.getSensitiveDatainSetting(setting);
    // Decrypt sensitive data with former key
    this.decryptSensitiveDataInJSON(setting, this.cryptoSetting.formerKey);
    // Get sensitive data in clear format
    const valueAfterDecrypt = this.getSensitiveDatainSetting(setting);
    // Encrypt sensitive data with new key
    this.encryptSensitiveDataInJSON(setting, this.cryptoSetting.key);
    // Get sensitive data encrypted with new key
    const valueAfterEncrypt = this.getSensitiveDatainSetting(setting);

    // Save setting with sensitive data encrypted with new key
    await SettingStorage.saveSettings(tenantID, setting);

    // Prepare sensitive data migration
    const settingSensitiveData = this.prepareSaveSensitiveDataMigration(setting, valueBeforeDecrypt, valueAfterDecrypt, valueAfterEncrypt);
    // Save sensitive data migration of setting
    await SensitiveDataMigrationStorage.saveSensitiveData(tenantID, settingSensitiveData);
  }

  public static async getMigrateSettingsIdentifiers(tenantID: string): Promise<string[]> {
    const migration = await SensitiveDataMigrationStorage.getSensitiveDataMigration(tenantID);
    return migration?.settingSensitiveData?.map((setting) => setting.identifier);
  }

  public static async migrateAllSensitiveData(tenantID: string, settings: SettingDB[]): Promise<void> {
    try {
      const identifiers = await this.getMigrateSettingsIdentifiers(tenantID);
      // For each setting that contains sensitive data, migrate that data
      for (const setting of settings) {
        if (!identifiers?.includes(setting.identifier)) {
          await this.migrateSensitiveData(tenantID, setting);
        }
      }
    } catch (err) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME,
        method: 'migrateAllSensitiveData',
        message: 'Migration of sensitive data failed'
      });
    }
  }

  public static encrypt(data: string, key: string): string {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(this.getAlgorithm(key), Buffer.from(key), iv);
    let encryptedData = cipher.update(data);
    encryptedData = Buffer.concat([encryptedData, cipher.final()]);
    return iv.toString('hex') + ':' + encryptedData.toString('hex');
  }

  public static decrypt(data: string, key: string): string {
    const dataParts = data.split(':');
    const iv = Buffer.from(dataParts.shift(), 'hex');
    const encryptedData = Buffer.from(dataParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv(this.getAlgorithm(key), Buffer.from(key), iv);
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
