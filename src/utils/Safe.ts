import crypto from 'crypto';
import Configuration from './Configuration';
import InternalError from '../exception/InternalError';
import BackendError from '../exception/BackendError';
import _ from 'lodash';


let _configuration;
const IV_LENGTH = 16;

export default class Safe {
  static getConfiguration() {
    if (!_configuration) {
      if (Configuration.getCryptoConfig()) {
        _configuration = Configuration.getCryptoConfig();
      } else {
        throw new InternalError('Crypto configuration is missing');
      }
    }
    return _configuration;
  }

  static encrypt(text: string): string {
    try {
      let iv = crypto.randomBytes(IV_LENGTH);
      let cipher = crypto.createCipheriv(this.getConfiguration().algorithm, Buffer.from(this.getConfiguration().key), iv);
      let encrypted = cipher.update(text);
      encrypted = Buffer.concat([encrypted, cipher.final()]);
      return iv.toString('hex') + ':' + encrypted.toString('hex');
    } catch (error) {
      throw new BackendError(`Setting encryption error`, error);
    }
  }

  static decrypt(text: string): string {
    try {
      let textParts = text.split(':');
      let iv = Buffer.from(textParts.shift(), 'hex');
      let encryptedText = Buffer.from(textParts.join(':'), 'hex');
      let decipher = crypto.createDecipheriv(this.getConfiguration().algorithm, Buffer.from(this.getConfiguration().key), iv);
      let decrypted = decipher.update(encryptedText);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      return decrypted.toString();
    } catch (error) {
      throw new BackendError(`Setting decryption error`, error);
    }
  }

  static hash(data: string): string {
    try {
      return crypto.createHash('sha256').update(data).digest("hex");
    } catch (error) {
      throw new BackendError(`Setting hash error`, error);
    }
  }
}
