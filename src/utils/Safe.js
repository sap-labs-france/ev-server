const crypto = require('crypto');
const Configuration = require('./Configuration');

require('source-map-support').install();

const CRYPTO_KEY = Configuration.getCryptoConfig().key;
const CRYPTO_IV = Configuration.getCryptoConfig().iv;

class Safe {
    static encrypt(data){
        try {
            const cipher = crypto.createCipheriv('aes-256-cbc', CRYPTO_KEY, CRYPTO_IV);
            var dataHashed = cipher.update(data, 'utf8', 'hex');
            dataHashed += cipher.final('hex');
            return dataHashed;
        } catch(error) {
            console.log(error);
        }
    }
    static decrypt(data) {
        try {
            const decipher = crypto.createDecipheriv('aes-256-cbc', CRYPTO_KEY, CRYPTO_IV);
            var dataUnhashed = decipher.update(data, 'hex','utf-8');
            dataUnhashed += decipher.final('utf-8');
            return dataUnhashed;
        } catch(error) {
            console.log(error);
        }
    }
}

module.exports = Safe;