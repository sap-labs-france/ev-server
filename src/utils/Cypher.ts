import crypto from 'crypto';
import Configuration from './Configuration';
import BackendError from '../exception/BackendError';
import _ from 'lodash';
import Constants from './Constants';

const _configuration = Configuration.getCryptoConfig();
const IV_LENGTH = 16;

export default class Cypher {
  public static getConfiguration() {
    if (!_configuration) {
      throw new BackendError(Constants.CENTRAL_SERVER,
        `Crypto configuration is missing`,
        "Cypher", "getConfiguration");
    }
    return _configuration;
  }

  public static encrypt(data: string): string {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(this.getConfiguration().algorithm, Buffer.from(this.getConfiguration().key), iv);
    let encryptedData = cipher.update(data);
    encryptedData = Buffer.concat([encryptedData, cipher.final()]);
    return iv.toString('hex') + ':' + encryptedData.toString('hex');
  }

  public static decrypt(data: string): string {
    const dataParts = data.split(':');
    const iv = Buffer.from(dataParts.shift(), 'hex');
    const encryptedData = Buffer.from(dataParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv(this.getConfiguration().algorithm, Buffer.from(this.getConfiguration().key), iv);
    let decrypted = decipher.update(encryptedData);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  }

  public static hash(data: string): string {
    return crypto.createHash('sha256').update(data).digest("hex");
  }

  public static encryptSensitiveDataInJSON(obj: any) {
    if (typeof obj !== 'object') {
      throw new BackendError(Constants.CENTRAL_SERVER,
        `The parameter ${obj} is not an object`,
        "Cypher", "encryptSensitiveDataInJSON");
    }
    if ('sensitiveData' in obj) {
      // Check that sensitive data is an array
      if (!Array.isArray(obj.sensitiveData)) {
        throw new BackendError(Constants.CENTRAL_SERVER,
          `The property 'sensitiveData' is not an array`,
          "Cypher", "encryptSensitiveDataInJSON");
      }
      obj.sensitiveData.forEach((property: string) => {
        // Check that the property does exist otherwise skip to the next property
        if (_.has(obj, property)) {
          const value = _.get(obj, property);
          // If the value is undefined, null or empty then do nothing and skip to the next property
          if (value && value.length > 0) {
            _.set(obj, property, this.encrypt(value));
          }
        }
      });
    }
  }

  public static decryptSensitiveDataInJSON(obj: any) {
    if (typeof obj !== 'object') {
      throw new BackendError(Constants.CENTRAL_SERVER,
        `The parameter ${obj} is not an object`,
        "Cypher", "decryptSensitiveDataInJSON");
    }
    if ('sensitiveData' in obj) {
      // Check that sensitive data is an array
      if (!Array.isArray(obj.sensitiveData)) {
        throw new BackendError(Constants.CENTRAL_SERVER,
          `The property 'sensitiveData' is not an array`,
          "Cypher", "decryptSensitiveDataInJSON");
      }
      obj.sensitiveData.forEach((property: string) => {
        // Check that the property does exist otherwise skip to the next property
        if (_.has(obj, property)) {
          const value = _.get(obj, property);
          // if the value is undefined, null or empty then do nothing and skip to the next property
          if (value && value.length > 0) {
            _.set(obj, property, this.decrypt(value));
          }
        }
      });
    }
  }

  public static hashSensitiveDataInJSON(obj: any) {
    if (typeof obj !== 'object') {
      throw new BackendError(Constants.CENTRAL_SERVER,
        `The parameter ${obj} is not an object`,
        "Cypher", "hashSensitiveDataInJSON");
    }
    if ('sensitiveData' in obj) {
      // Check that sensitive data is an array
      if (!Array.isArray(obj.sensitiveData)) {
        throw new BackendError(Constants.CENTRAL_SERVER,
          `The property 'sensitiveData' is not an array`,
          "Cypher", "hashSensitiveDataInJSON");
      }
      obj.sensitiveData.forEach((property: string) => {
        // Check that the property does exist otherwise skip to the next property
        if (_.has(obj, property)) {
          const value = _.get(obj, property);
          // if the value is undefined, null or empty then do nothing and skip to the next property
          if (value && value.length > 0) {
            _.set(obj, property, this.hash(value));
          }
        }
      });
    }
  }
}
