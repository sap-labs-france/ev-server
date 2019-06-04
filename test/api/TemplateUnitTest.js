const path = require('path');
global.appRoot = path.resolve(__dirname, '../../src');
const chai = require('chai');
const {expect} = require('chai');
const chaiSubset = require('chai-subset');
const moment = require('moment');
chai.use(chaiSubset);
const {TENANT_CONTEXTS, SITE_CONTEXTS, SITE_AREA_CONTEXTS, CHARGING_STATION_CONTEXTS} = require('./contextProvider/ContextConstants');
// const ContextBuilder = require('./contextProvider/ContextBuilder');
const ContextProvider = require('./contextProvider/ContextProvider');

// For Visual Studio it is recommended to install Mocha sidebar and Chai snippets
// Mocha is the test framework and chai provides functions to check expectations

describe('Unit test template', function() {
  this.timeout(10000); // Not mandatory will automatically stop the unit test after that period of time

  before(async () => {
    chai.config.includeStack = true;
    // Used to create data before teh whole test chain is started
    // To simplify you can use the ContextProvider to get a tenant and some preloaded entities
    // To be used with care as more than 20 tenants!!!
    await ContextProvider.prepareContexts();
    this.tenantContext = await ContextProvider.getTenantContext(TENANT_CONTEXTS.TENANT_WITH_ALL_COMPONENTS);
    // It will build all tenants except if you provide input arguments to limit to some contexts only. 
    // if you want to limit tom some context only
    // await ContextProvider.prepareContext([TENANT_CONTEXTS.TENANT_WITH_ALL_COMPONENTS with any additional context], [ORGANIZATION_CONTEXTS.SITE_WITH_ACL with any additional context]);
    // Or you can call the get directly which will provide you the tenant and build it if it does not exist
    this.tenantContextAll = await ContextProvider.getTenantContext(TENANT_CONTEXTS.TENANT_WITH_ALL_COMPONENTS);
  });

  afterEach(async () => {
    console.log('Reinitialize content after each test');
    ContextProvider.cleanUpCreatedContent();
    // await ContextProvider.initializeAllTenantContents(); //.then(() => done());
  });

  after(async () => {
    // console.log('Reinitialize content after complete test scenario');
    // await ContextBuilder.initializeAllTenantContents();
  });

  describe('Unit test global description level 1', () => {
    it('simple unit test 1', async () => {
      const adminUser = this.tenantContextAll.getContextUser({role: 'A', status: 'A', assignedToSite: true});
      const siteContext = this.tenantContextAll.getSiteContext(SITE_CONTEXTS.SITE_BASIC);
      const siteAreaContext = siteContext.getSiteAreaContext(SITE_AREA_CONTEXTS.WITH_ACL);
      const chargingStationContext = siteAreaContext.getChargingStationContext(CHARGING_STATION_CONTEXTS.ASSIGNED_OCCP16);
      const response = await chargingStationContext.startTransaction(1, adminUser.tagIDs[0], 0, moment());
      expect(response).to.not.be.null;
      expect(response.data).to.not.be.null;
      expect(response.data.transactionId).to.be.above(1);
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