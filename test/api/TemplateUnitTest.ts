import path from 'path';
import TSGlobal from '../../src/types/GlobalType';
declare const global: TSGlobal;
global.appRoot = path.resolve(__dirname, '../../src');
import CONTEXTS from './contextProvider/ContextConstants';
import ContextProvider from './contextProvider/ContextProvider';
import chai from 'chai';
import {expect} from 'chai';
import chaiSubset from 'chai-subset';
chai.use(require('chai-datetime'));
chai.use(chaiSubset);
chai.use(require('../helpers/responseHelper'));
import moment from 'moment';

// For Visual Studio it is recommended to install Mocha sidebar and Chai snippets
// Mocha is the test framework and chai provides functions to check expectations

describe('Template for Dev Unit Test', function() {
  this.timeout(10000); // Not mandatory will automatically stop the unit test after that period of time

  before(async () => {
    chai.config.includeStack = true;
    // Used to prepare data before the whole test chain is started
    await ContextProvider.DefaultInstance.prepareContexts();
  });

  afterEach(() => {
    // Should be called after each UT to clean up created data
    ContextProvider.DefaultInstance.cleanUpCreatedContent();
  });

  after(async () => {
    // Can be called at the end to ensure proper data clean up
    // ContextProvider.cleanUpCreatedContent();
  });

  describe('Unit test global description level 1', () => {
    it('Usage of context with all components', async () => {
      const tenantContextAll = await ContextProvider.DefaultInstance.getTenantContext(CONTEXTS.TENANT_CONTEXTS.TENANT_WITH_ALL_COMPONENTS);
      const user = tenantContextAll.getContextUser(CONTEXTS.USER_CONTEXTS.BASIC_USER);
      const siteContext = tenantContextAll.getSiteContext(CONTEXTS.SITE_CONTEXTS.SITE_BASIC);
      const siteAreaContext = siteContext.getSiteAreaContext(CONTEXTS.SITE_AREA_CONTEXTS.WITH_ACL);
      const chargingStationContext = siteAreaContext.getChargingStationContext(CONTEXTS.CHARGING_STATION_CONTEXTS.ASSIGNED_OCCP16);
      const response = await chargingStationContext.startTransaction(1, user.tagIDs[0], 0, moment());
      expect(response).to.be.transactionValid;
      const userCentralService = tenantContextAll.getUserCentralServerService(CONTEXTS.USER_CONTEXTS.BASIC_USER);
      const tenantListResponse = await userCentralService.transactionApi.readAllActive({});
    });

  });

  describe('Unit test 2 global description  level 1', () => {
    it('simple unit test 1', () => {
      const test = 2;
      expect(test).to.equal(2);
    });
  });
});

function timeout(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
