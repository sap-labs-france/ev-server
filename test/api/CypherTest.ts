import chai, { expect } from 'chai';
import chaiSubset from 'chai-subset';
import path from 'path';
import cypher from '../../src/utils/Cypher';
import CypherJSON from './client/utils/CypherJSON';
import TSGlobal from '../../src/types/GlobalType';

declare const global: TSGlobal;
global.appRoot = path.resolve(__dirname, '../../src');

chai.use(require('chai-datetime'));
chai.use(chaiSubset);
chai.use(require('../helpers/responseHelper'));

// For Visual Studio it is recommended to install Mocha sidebar and Chai snippets
// Mocha is the test framework and chai provides functions to check expectations
const FAKE_JSON: CypherJSON = { 'sensitiveData': ['content.secret1', 'content.secret2'], 'content': { 'secret1': 'Harry', 'secret2': 'Potter' } };
const FAKE_WORD = 'Expelliarmus';

describe('Cypher Tests', function() {
  this.timeout(30000);

  describe('Success cases', () => {
    it('Should encrypt and decrypt data', () => {
      const encrypted = cypher.encrypt(FAKE_WORD);
      // Check
      expect(FAKE_WORD).to.equal(cypher.decrypt(encrypted));
    });

    it('Should hash data', () => {
      const hashed = cypher.hash(FAKE_WORD);
      // Check
      expect(FAKE_WORD).to.not.equal(hashed);
    });

    it('Should encrypt and decrypt sensitive data in a JSON', () => {
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

  });

});
