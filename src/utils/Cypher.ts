import BackendError from '../exception/BackendError';
import Constants from './Constants';
import { CryptoSetting } from '../types/Setting';
import SettingStorage from '../storage/mongodb/SettingStorage';
import TenantStorage from '../storage/mongodb/TenantStorage';
import Utils from './Utils';
import _ from 'lodash';
import crypto from 'crypto';

const IV_LENGTH = 16;
const MODULE_NAME = 'Cypher';

export default class Cypher {

  public static async encrypt(data: string, tenantID: string): Promise<string> {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cryptoSetting = await Cypher.getCryptoSetting(tenantID);
    const cipher = crypto.createCipheriv(Utils.buildAlgorithm(cryptoSetting.keyProperties), Buffer.from(cryptoSetting.key), iv);
    let encryptedData = cipher.update(data);
    encryptedData = Buffer.concat([encryptedData, cipher.final()]);
    return iv.toString('hex') + ':' + encryptedData.toString('hex');
  }

  public static async decrypt(data: string, tenantID: string): Promise<string> {
    const dataParts = data.split(':');
    const iv = Buffer.from(dataParts.shift(), 'hex');
    const encryptedData = Buffer.from(dataParts.join(':'), 'hex');
    const cryptoSetting = await Cypher.getCryptoSetting(tenantID);
    const decipher = crypto.createDecipheriv(Utils.buildAlgorithm(cryptoSetting.keyProperties), Buffer.from(cryptoSetting.key), iv);
    let decrypted = decipher.update(encryptedData);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  }

  public static hash(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  public static async encryptSensitiveDataInJSON(obj: Record<string, any>, tenantID: string): Promise<void> {
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
            _.set(obj, property, await Cypher.encrypt(value, tenantID));
          }
        }
      }
    } else {
      obj.sensitiveData = [];
    }
  }

  public static async decryptSensitiveDataInJSON(obj: Record<string, any>, tenantID: string): Promise<void> {
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
            _.set(obj, property, await Cypher.decrypt(value, tenantID));
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

  private static async getCryptoSetting(tenantID: string): Promise<CryptoSetting> {
    const cryptoSettings = (await SettingStorage.getCryptoSettings(tenantID)).crypto;
    if (!cryptoSettings) {
      const tenantName = (await TenantStorage.getTenant(tenantID)).name;
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME,
        method: 'getCryptoSetting',
        message: `Tenant ${tenantName} (tenandID: ${tenantID}) does not have crypto settings.`
      });
    }
    return cryptoSettings;
  }
}
