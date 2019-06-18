import crypto from 'crypto';
import Configuration from './Configuration';
import BackendError from '../exception/BackendError';
import _ from 'lodash';


let _configuration;
const IV_LENGTH = 16;

export default class Cipher {
  public static getConfiguration() {
    try {
      if (!_configuration) {
        if (Configuration.getCryptoConfig()) {
          _configuration = Configuration.getCryptoConfig();
        } else {
          throw new Error('Crypto configuration is missing');
        }
      }
      return _configuration;
    } catch (err) {
      throw new BackendError(`Cipher configuration error`, err);
    }
  }

  public static encryptString(text: string): string {
    try {
      const iv = crypto.randomBytes(IV_LENGTH);
      const cipher = crypto.createCipheriv(this.getConfiguration().algorithm, Buffer.from(this.getConfiguration().key), iv);
      let encrypted = cipher.update(text);
      encrypted = Buffer.concat([encrypted, cipher.final()]);
      return iv.toString('hex') + ':' + encrypted.toString('hex');
    } catch (err) {
      throw new BackendError(`Cipher encrypt string error`, err);
    }
  }

  public static decryptString(text: string): string {
    try {
      const textParts = text.split(':');
      const iv = Buffer.from(textParts.shift(), 'hex');
      const encryptedText = Buffer.from(textParts.join(':'), 'hex');
      const decipher = crypto.createDecipheriv(this.getConfiguration().algorithm, Buffer.from(this.getConfiguration().key), iv);
      let decrypted = decipher.update(encryptedText);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      return decrypted.toString();
    } catch (err) {
      throw new BackendError(`Cipher decrypt string error`, err);
    }
  }

  public static hashString(data: string): string {
    try {
      return crypto.createHash('sha256').update(data).digest("hex");
    } catch (error) {
      throw new BackendError(`Cipher hash string error`, error);
    }
  }

  public static encryptJSON(obj: any) {
    try{
      if (typeof obj !== 'object') {
        throw new Error(`The parameter ${obj} passed is not an object`);
      }
      if ('sensitiveData' in obj) {
        if (!Array.isArray(obj.sensitiveData)) { // sensitive data must be an array
          throw new Error(`The property sensitiveData of parameter ${obj} passed is not an array`);
        }
        obj.sensitiveData.forEach((property: string) => { // sensitive data can have multiple values
          if(_.has(obj,property)){ // If the property doesn't exist, skip it and go to the next property
            const value = _.get(obj, property);
            if(value && value.length > 0) { // if the value is undefined, null or empty then do nothing and go to the next property
              _.set(obj, property, this.encryptString(value));
            }
          }
        });
      }
    } catch (err) {
      throw new BackendError('Error during encryption of JSON', err);
    }
  }

  public static decryptJSON(obj: any) {
    try{
      if (typeof obj !== 'object') {
        throw new Error(`The parameter ${obj} passed is not an object`);
      }
      if ('sensitiveData' in obj) {
        if (!Array.isArray(obj.sensitiveData)) { // sensitive data must be an array
          throw new Error(`The property sensitiveData of parameter ${obj} passed is not an array`);
        }
        obj.sensitiveData.forEach((property: string) => { // sensitive data can have multiple values
          if(_.has(obj,property)){ // If the property doesn't exist, skip it and go to the next property
            const value = _.get(obj, property);
            if(value && value.length > 0) { // if the value is undefined, null or empty then do nothing and go to the next property
              _.set(obj, property, this.decryptString(value));
            }
          }
        });
      }
    } catch (error) {
      throw new BackendError('Error during decryption of JSON', error);
    }
  }

  public static hashJSON(obj: any) {
    try{
      if (typeof obj !== 'object') {
        throw new Error(`The parameter ${obj} passed is not an object`);
      }
      if ('sensitiveData' in obj) {
        if (!Array.isArray(obj.sensitiveData)) { // sensitive data must be an array
          throw new Error(`The property sensitiveData of parameter ${obj} passed is not an array`);
        }
        obj.sensitiveData.forEach((property: string) => { // sensitive data can have multiple values
          if(_.has(obj,property)){ // If the property doesn't exist, skip it and go to the next property
            const value = _.get(obj, property);
            if(value && value.length > 0) { // if the value is undefined, null or empty then do nothing and go to the next property
              _.set(obj, property, this.hashString(value));
            }
          }
        });
      }
    } catch (error) {
      throw new BackendError('Error during hash of JSON', error);
    }
  }
}
