// const path = require('path');
// global.appRoot = path.resolve(__dirname, '../../src');
const chai = require('chai');
const {expect} = require('chai');
const chaiSubset = require('chai-subset');
const responseHelper = require('../helpers/responseHelper');
const moment = require('moment');
chai.use(chaiSubset);
chai.use(responseHelper);
const {USER_CONTEXTS, TENANT_CONTEXTS, SITE_CONTEXTS, SITE_AREA_CONTEXTS, CHARGING_STATION_CONTEXTS} = require('./contextProvider/ContextConstants');
// const ContextBuilder = require('./contextProvider/ContextBuilder');
const ContextProvider = require('./contextProvider/ContextProvider');

// For Visual Studio it is recommended to install Mocha sidebar and Chai snippets
// Mocha is the test framework and chai provides functions to check expectations

describe('Unit test template', function() {
  // this.timeout(50000); // Not mandatory will automatically stop the unit test after that period of time

  before(async () => {
    chai.config.includeStack = true;
    // Used to prepare data before the whole test chain is started
    // To simplify you can use the ContextProvider to get a tenant and some preloaded entities
    await ContextProvider.prepareContexts();
    // Retrieve the tenant context for a specific context
    // All contexts are provided in contextProvider/ContextConstants
    this.tenantContextAll = await ContextProvider.getTenantContext(TENANT_CONTEXTS.TENANT_WITH_ALL_COMPONENTS);
  });

  afterEach(async () => {
    console.log('Reinitialize content after each test');
    ContextProvider.cleanUpCreatedContent();
  });

  after(async () => {
    // ContextProvider.cleanUpCreatedContent();
  });

  describe('Unit test global description level 1', () => {
    it('simple unit test 1', async () => {
      const user = this.tenantContextAll.getContextUser(USER_CONTEXTS.BASIC_USER);
      const siteContext = this.tenantContextAll.getSiteContext(SITE_CONTEXTS.SITE_BASIC);
      const siteAreaContext = siteContext.getSiteAreaContext(SITE_AREA_CONTEXTS.WITH_ACL);
      const chargingStationContext = siteAreaContext.getChargingStationContext(CHARGING_STATION_CONTEXTS.ASSIGNED_OCCP16);
      const response = await chargingStationContext.startTransaction(1, user.tagIDs[0], 0, moment());
      expect(response).to.be.transactionValid;
      const userCentralService = this.tenantContextAll.getUserCentralServerService(USER_CONTEXTS.BASIC_USER);
      const tenantListResponse = await userCentralService.transactionApi.readAll({});
    });

  });

  describe('Unit test 2 global description  level 1', () => {
    it('simple unit test 1', async () => {
      const test = 2;
      expect(test).to.equal(2);
    });
  });
});

function timeout(ms) {
  // eslint-disable-next-line no-undef
  return new Promise(resolve => setTimeout(resolve, ms));
}