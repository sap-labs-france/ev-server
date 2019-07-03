// Goal : Check that the cypher class (which is mainly used to encrypt/decrypt and hash sensitive data used in settings)
//        works as intended. Store the encrypted global key in variable OLD_ENCRYPTED_KEY in order to try to detect
//        a change in this key.

import chai, { expect } from 'chai';
import chaiDatetime from 'chai-datetime';
import chaiSubset from 'chai-subset';
import responseHelper from '../helpers/responseHelper';
import cypher from '../../src/utils/Cypher';
import CypherJSON from './client/utils/CypherJSON';

chai.use(chaiDatetime);
chai.use(chaiSubset);
chai.use(responseHelper);

const FAKE_JSON: CypherJSON = { 'sensitiveData': ['content.secret1', 'content.secret2'], 'content': { 'secret1': 'Harry', 'secret2': 'Potter' } };
const FAKE_WORD = 'Expelliarmus';
const OLD_ENCRYPTED_KEY = "74e0ef8fcb63d3c00ae8984df3b702a7:2c67959cc2c7dca52ebb66d93e98d72260b4199ef03e44a4efe2f3591e9fb2e0";

describe('Cypher Tests', function() {
  this.timeout(30000);

  describe('Success cases', () => {
    it('Check that encryption and decryption work', () => {
      const encrypted = cypher.encrypt(FAKE_WORD);
      // Check
      expect(FAKE_WORD).to.equal(cypher.decrypt(encrypted));
    });

    it('Check that hashing works', () => {
      const hashed = cypher.hash(FAKE_WORD);
      // Check
      expect(FAKE_WORD).to.not.equal(hashed);
    });

    it('Check that the sensitive data present in JSONs are encrypted', () => {
      const testJSON: CypherJSON = { 'sensitiveData': ['content.secret1', 'content.secret2'], 'content': { 'secret1': 'Harry', 'secret2': 'Potter' } };
      cypher.encryptSensitiveDataInJSON(testJSON);
      // Check encryption
      expect(FAKE_JSON.content.secret1).to.not.equal(testJSON.content.secret1);
      expect(FAKE_JSON.content.secret2).to.not.equal(testJSON.content.secret2);
      // Check decryption
      cypher.decryptSensitiveDataInJSON(testJSON);
      expect(FAKE_JSON.content.secret1).to.equal(testJSON.content.secret1);
      expect(FAKE_JSON.content.secret2).to.equal(testJSON.content.secret2);
    });

    it('Check that the global encryption key is unchanged', () => {
      const decrypted = cypher.decrypt(OLD_ENCRYPTED_KEY);
      // Check
      expect(cypher.getConfiguration().key).to.equal(decrypted);
    });

  });

});
