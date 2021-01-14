// Goal : Check that the cypher class (which is mainly used to encrypt/decrypt and hash sensitive data used in settings)
//        works as intended. Store the encrypted FAKE_WORD in variable FAKE_WORD_ENCRYPTED in order to try to detect
//        a change in this key.

import chai, { expect } from 'chai';

import { CryptoSetting } from '../types/Setting';
import CypherJSON from './client/utils/CypherJSON';
import chaiDatetime from 'chai-datetime';
import chaiSubset from 'chai-subset';
import cypher from '../../src/utils/Cypher';
import responseHelper from '../helpers/responseHelper';

chai.use(chaiDatetime);
chai.use(chaiSubset);
chai.use(responseHelper);

const FAKE_JSON: CypherJSON = { 'sensitiveData': ['content.secret1', 'content.secret2'], 'content': { 'secret1': 'Harry', 'secret2': 'Potter' } };
const FAKE_WORD = 'Wingardium Leviosa';
const FAKE_WORD_ENCRYPTED = '04480e7ab47eb5729faea20f0844dffa:81927d0bc660c4548b27cc0e3427d6874ea3';

const CRYPTO_KEY: CryptoSetting = {
  'key': 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  'keyProperties': {
    'blockCypher': 'AES',
    'blockSize': 256,
    'operationMode': 'CTR'
  }
};

describe('Cypher Tests', function() {
  this.timeout(30000);

  describe('Success cases', () => {
    it('Check that encryption and decryption work', () => {
      const encrypted = cypher.encrypt(FAKE_WORD, CRYPTO_KEY);
      expect(FAKE_WORD).to.equal(cypher.decrypt(encrypted, CRYPTO_KEY));
    });

    it('Check that hashing works', () => {
      const hashed = cypher.hash(FAKE_WORD);
      expect(FAKE_WORD).to.not.equal(hashed);
    });

    it('Check that the sensitive data present in JSONs are encrypted', () => {
      const testJSON: CypherJSON = { 'sensitiveData': ['content.secret1', 'content.secret2'], 'content': { 'secret1': 'Harry', 'secret2': 'Potter' } };
      cypher.encryptSensitiveDataInJSON(testJSON, CRYPTO_KEY);
      // Check encryption
      expect(FAKE_JSON.content.secret1).to.not.equal(testJSON.content.secret1);
      expect(FAKE_JSON.content.secret2).to.not.equal(testJSON.content.secret2);
      // Check decryption
      cypher.decryptSensitiveDataInJSON(testJSON, CRYPTO_KEY);
      expect(FAKE_JSON.content.secret1).to.equal(testJSON.content.secret1);
      expect(FAKE_JSON.content.secret2).to.equal(testJSON.content.secret2);
    });

    it('Check that the global encryption key is unchanged', () => {
      const decrypted = cypher.decrypt(FAKE_WORD_ENCRYPTED, CRYPTO_KEY);
      expect(FAKE_WORD).to.equal(decrypted);
    });
  });
});
