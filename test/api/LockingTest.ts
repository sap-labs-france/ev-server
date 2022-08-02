// Goal : Check that the cypher class (which is mainly used to encrypt/decrypt and hash sensitive data used in settings)
//        works as intended. Store the encrypted FAKE_WORD in variable FAKE_WORD_ENCRYPTED in order to try to detect
//        a change in this key.

import Lock, { LockEntity, LockType } from '../../src/types/Locking';
import chai, { expect } from 'chai';

import Constants from '../../src/utils/Constants';
import ContextDefinition from './context/ContextDefinition';
import ContextProvider from './context/ContextProvider';
import LockingHelper from '../../src/locking/LockingHelper';
import LockingManager from '../../src/locking/LockingManager';
import MongoDBStorage from '../../src/storage/mongodb/MongoDBStorage';
import SiteAreaContext from './context/SiteAreaContext';
import SiteContext from './context/SiteContext';
import TenantContext from './context/TenantContext';
import chaiDatetime from 'chai-datetime';
import chaiSubset from 'chai-subset';
import config from '../config';
import global from '../../src/types/GlobalType';
import moment from 'moment';
import responseHelper from '../helpers/responseHelper';

chai.use(chaiDatetime);
chai.use(chaiSubset);
chai.use(responseHelper);

class TestData {
  public exclusiveLock: Lock;
  public siteExclusiveLock: Lock;
  public tenantContext: TenantContext;
  public siteContext: SiteContext;
  public siteAreaContext: SiteAreaContext;
}

const testData = new TestData();
const lockKey = 'test-lock';

describe('Locking', () => {
  jest.setTimeout(100000);

  beforeAll(async () => {
    // Start MongoDB
    global.database = new MongoDBStorage(config.get('storage'));
    await global.database.start();
    // Clean locks
    await global.database.getCollection<any>(Constants.DEFAULT_TENANT_ID, 'locks')
      .deleteMany({});
    // Prepare context
    await ContextProvider.defaultInstance.prepareContexts();
    testData.tenantContext = await ContextProvider.defaultInstance.getTenantContext(ContextDefinition.TENANT_CONTEXTS.TENANT_ORGANIZATION);
    testData.siteContext = testData.tenantContext.getSiteContext(ContextDefinition.SITE_CONTEXTS.SITE_BASIC);
    testData.siteAreaContext = testData.siteContext.getSiteAreaContext(ContextDefinition.SITE_AREA_CONTEXTS.WITH_ACL);
  });

  afterAll(async () => {
    // Clean context
    await ContextProvider.defaultInstance.cleanUpCreatedContent();
    // Close DB connection
    await global.database.stop();
  });

  describe('Exclusive Locks', () => {
    it('Should create an exclusive lock', () => {
      testData.exclusiveLock = LockingManager.createExclusiveLock(Constants.DEFAULT_TENANT_ID, LockEntity.DATABASE, lockKey);
      expect(testData.exclusiveLock).not.null;
      expect(testData.exclusiveLock.id).not.null;
      expect(testData.exclusiveLock.hostname).not.null;
      expect(testData.exclusiveLock.timestamp).not.null;
      expect(testData.exclusiveLock.tenantID).to.eql(Constants.DEFAULT_TENANT_ID);
      expect(testData.exclusiveLock.entity).to.eql(LockEntity.DATABASE);
      expect(testData.exclusiveLock.key).to.eql(lockKey);
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

  describe('Site Area Exclusive Locks', () => {
    it(
      'Should create a Site Area exclusive lock with expiration date',
      async () => {
        // Get the Site Area
        const siteArea = testData.siteAreaContext.getSiteArea();
        // Create and Acquire lock
        testData.siteExclusiveLock = await LockingHelper.acquireSiteAreaSmartChargingLock(
          testData.tenantContext.getTenant().id, siteArea);
        expect(testData.siteExclusiveLock).not.null;
        expect(testData.siteExclusiveLock.id).not.null;
        expect(testData.siteExclusiveLock.hostname).not.null;
        expect(testData.siteExclusiveLock.timestamp).not.null;
        expect(testData.siteExclusiveLock.tenantID).to.eql(testData.tenantContext.getTenant().id);
        expect(testData.siteExclusiveLock.entity).to.eql(LockEntity.SITE_AREA);
        expect(testData.siteExclusiveLock.key).to.eql(siteArea.id + '-smart-charging');
        expect(testData.siteExclusiveLock.type).to.eql(LockType.EXCLUSIVE);
        expect(testData.siteExclusiveLock.expirationDate).to.eql(moment(testData.siteExclusiveLock.timestamp).add(180, 'seconds').toDate());
      }
    );

    it(
      'Should not acquire a second time a Site Area exclusive lock',
      async () => {
        const result = await LockingManager.acquire(testData.siteExclusiveLock);
        expect(result).not.null;
        expect(result).to.eql(false);
      }
    );

    it('Should release a Site Area exclusive lock', async () => {
      const result = await LockingManager.release(testData.siteExclusiveLock);
      expect(result).not.null;
      expect(result).to.eql(true);
    });

    it(
      'Should not release an already released Site Area exclusive lock',
      async () => {
        const result = await LockingManager.release(testData.siteExclusiveLock);
        expect(result).not.null;
        expect(result).to.eql(false);
      }
    );
  });

  describe('Test automatic release of locks', () => {
    it(
      'Should create a Site Area exclusive lock with expiration of 10 seconds',
      async () => {
        // Get the Site Area
        const siteArea = testData.siteAreaContext.getSiteArea();
        // Create and Acquire lock
        testData.siteExclusiveLock = LockingManager.createExclusiveLock(testData.tenantContext.getTenant().id, LockEntity.SITE_AREA, `${siteArea.id}-smart-charging`, 5);
        expect(testData.siteExclusiveLock).not.null;
        expect(testData.siteExclusiveLock.id).not.null;
        expect(testData.siteExclusiveLock.hostname).not.null;
        expect(testData.siteExclusiveLock.timestamp).not.null;
        expect(testData.siteExclusiveLock.tenantID).to.eql(testData.tenantContext.getTenant().id);
        expect(testData.siteExclusiveLock.entity).to.eql(LockEntity.SITE_AREA);
        expect(testData.siteExclusiveLock.key).to.eql(siteArea.id + '-smart-charging');
        expect(testData.siteExclusiveLock.type).to.eql(LockType.EXCLUSIVE);
        expect(testData.siteExclusiveLock.expirationDate).to.eql(moment(testData.siteExclusiveLock.timestamp).add(5, 'seconds').toDate());
        await LockingManager.acquire(testData.siteExclusiveLock);
      }
    );

    it(
      'Should not acquire a second time the Site Area exclusive lock',
      async () => {
        const result = await LockingManager.acquire(testData.siteExclusiveLock);
        expect(result).not.null;
        expect(result).to.eql(false);
      }
    );

    it(
      'Should acquire the lock with a timeout of 10 seconds. First lock should be released after timeout is reached ',
      async () => {
        const result = await LockingManager.acquire(testData.siteExclusiveLock, 10);
        expect(result).not.null;
        expect(result).to.eql(true);
      }
    );

    it('Should release the latest Site Area exclusive lock', async () => {
      const result = await LockingManager.release(testData.siteExclusiveLock);
      expect(result).not.null;
      expect(result).to.eql(true);
    });
  });
});
