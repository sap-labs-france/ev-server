// Goal : Check that the cypher class (which is mainly used to encrypt/decrypt and hash sensitive data used in settings)
//        works as intended. Store the encrypted FAKE_WORD in variable FAKE_WORD_ENCRYPTED in order to try to detect
//        a change in this key.

import chai, { expect } from 'chai';
import chaiDatetime from 'chai-datetime';
import chaiSubset from 'chai-subset';
import LockingManager from '../../src/locking/LockingManager';
import MongoDBStorage from '../../src/storage/mongodb/MongoDBStorage';
import global from '../../src/types/GlobalType';
import Lock, { LockEntity, LockType } from '../../src/types/Locking';
import Constants from '../../src/utils/Constants';
import config from '../config';
import responseHelper from '../helpers/responseHelper';

chai.use(chaiDatetime);
chai.use(chaiSubset);
chai.use(responseHelper);

class TestData {
  public exclusiveLock: Lock;
}

const testData = new TestData();
const lockName = 'test-lock';

describe('Locking Tests', function() {
  this.timeout(30000);

  before(async () => {
    // Start MongoDB
    global.database = new MongoDBStorage(config.get('storage'));
    await global.database.start();
  });

  describe('Exclusive Locks', () => {

    it('Should create an exclusive lock', () => {
      testData.exclusiveLock = LockingManager.createExclusiveLock(Constants.DEFAULT_TENANT, LockEntity.DATABASE, lockName)
      expect(testData.exclusiveLock).not.null;
      expect(testData.exclusiveLock.id).not.null;
      expect(testData.exclusiveLock.hostname).not.null;
      expect(testData.exclusiveLock.timestamp).not.null;
      expect(testData.exclusiveLock.name).to.eql(lockName);
      expect(testData.exclusiveLock.entity).to.eql(LockEntity.DATABASE);
      expect(testData.exclusiveLock.tenantID).to.eql(Constants.DEFAULT_TENANT);
      expect(testData.exclusiveLock.type).to.eql(LockType.EXCLUSIVE);
    });

    it('Should acquire an exclusive lock', async () => {
      const result = await LockingManager.acquire(testData.exclusiveLock);
      expect(result).not.null;
      expect(result).to.eql(true);
    });

    it('Should not acquire a second time an exclusive lock', async () => {
      const result = await LockingManager.acquire(testData.exclusiveLock);
      expect(result).not.null;
      expect(result).to.eql(false);
    });

    it('Should release an exclusive lock', async () => {
      const result = await LockingManager.release(testData.exclusiveLock);
      expect(result).not.null;
      expect(result).to.eql(true);
    });

    it('Should not release an already released exclusive lock', async () => {
      const result = await LockingManager.release(testData.exclusiveLock);
      expect(result).not.null;
      expect(result).to.eql(false);
    });
  });
});
