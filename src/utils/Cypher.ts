import crypto from 'crypto';
import _ from 'lodash';
import BackendError from '../exception/BackendError';
import Configuration from './Configuration';
import Constants from './Constants';

const _configuration = Configuration.getCryptoConfig();
const IV_LENGTH = 16;

export default class Cypher {
  public static getConfiguration() {
    if (!_configuration) {
      throw new BackendError(Constants.CENTRAL_SERVER,
        'Crypto configuration is missing',
        'Cypher', 'getConfiguration');
    }
    return _configuration;
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

  public static encryptSensitiveDataInJSON(obj: any) {
    if (typeof obj !== 'object') {
      throw new BackendError(Constants.CENTRAL_SERVER,
        `The parameter ${obj} is not an object`,
        'Cypher', 'encryptSensitiveDataInJSON');
    }
    if ('sensitiveData' in obj) {
      // Check that sensitive data is an array
      if (!Array.isArray(obj.sensitiveData)) {
        throw new BackendError(Constants.CENTRAL_SERVER,
          'The property \'sensitiveData\' is not an array',
          'Cypher', 'encryptSensitiveDataInJSON');
      }
      obj.sensitiveData.forEach((property: string) => {
        // Check that the property does exist otherwise skip to the next property
        if (_.has(obj, property)) {
          const value = _.get(obj, property);
          // If the value is undefined, null or empty then do nothing and skip to the next property
          if (value && value.length > 0) {
            _.set(obj, property, Cypher.encrypt(value));
          }
        }
      });
    } else {
      obj.sensitiveData = [];
    }
  }

  public static decryptSensitiveDataInJSON(obj: any) {
    if (typeof obj !== 'object') {
      throw new BackendError(Constants.CENTRAL_SERVER,
        `The parameter ${obj} is not an object`,
        'Cypher', 'decryptSensitiveDataInJSON');
    }
    if ('sensitiveData' in obj) {
      // Check that sensitive data is an array
      if (!Array.isArray(obj.sensitiveData)) {
        throw new BackendError(Constants.CENTRAL_SERVER,
          'The property \'sensitiveData\' is not an array',
          'Cypher', 'decryptSensitiveDataInJSON');
      }
      obj.sensitiveData.forEach((property: string) => {
        // Check that the property does exist otherwise skip to the next property
        if (_.has(obj, property)) {
          const value = _.get(obj, property);
          // If the value is undefined, null or empty then do nothing and skip to the next property
          if (value && value.length > 0) {
            _.set(obj, property, Cypher.decrypt(value));
          }
        }
      });
    }
  }

  public static hashSensitiveDataInJSON(obj: any) {
    if (typeof obj !== 'object') {
      throw new BackendError(Constants.CENTRAL_SERVER,
        `The parameter ${obj} is not an object`,
        'Cypher', 'hashSensitiveDataInJSON');
    }
    if (obj.sensitiveData) {
      // Check that sensitive data is an array
      if (!Array.isArray(obj.sensitiveData)) {
        throw new BackendError(Constants.CENTRAL_SERVER,
          'The property \'sensitiveData\' is not an array',
          'Cypher', 'hashSensitiveDataInJSON');
      }
      obj.sensitiveData.forEach((property: string) => {
        // Check that the property does exist otherwise skip to the next property
        if (_.has(obj, property)) {
          const value = _.get(obj, property);
          // If the value is undefined, null or empty then do nothing and skip to the next property
          if (value && value.length > 0) {
            _.set(obj, property, Cypher.hash(value));
          }
        }
      });
    }
  }
}
