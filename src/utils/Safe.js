const crypto = require('crypto');
const Configuration = require('./Configuration');
const InternalError = require('../exception/InternalError');

require('source-map-support').install();

let _configuration;

class Safe {
  static getConfiguration() {
    if (!_configuration) {
      if (Configuration.getAuthorizationConfig()) {
        _configuration = Configuration.getAuthorizationConfig();
      } else {
        throw new InternalError('Crypto configuration is missing');
      }
    }
    return _configuration;
  }

  static encrypt(data) {
    try {
      const cipher = crypto.createCipheriv('aes-256-cbc', this.getConfiguration().key, this.getConfiguration().iv);
      let dataHashed = cipher.update(data, 'utf8', 'hex');
      dataHashed += cipher.final('hex');
      return dataHashed;
    } catch (error) {
      throw new InternalError(`Unable to encrypt data`, error);
    }
  }

  static decrypt(data) {
    try {
      const decipher = crypto.createDecipheriv('aes-256-cbc', this.getConfiguration().key, this.getConfiguration().iv);
      let dataUnhashed = decipher.update(data, 'hex', 'utf-8');
      dataUnhashed += decipher.final('utf-8');
      return dataUnhashed;
    } catch (error) {
      throw new InternalError(`Unable to decrypt data`, error);
    }
  }
}

module.exports = Safe;
