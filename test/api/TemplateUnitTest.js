const path = require('path');
global.appRoot = path.resolve(__dirname, '../../src');
const chai = require('chai');
const {expect} = require('chai');
const chaiSubset = require('chai-subset');
const moment = require('moment');
chai.use(chaiSubset);
const {TENANT_CONTEXTS, ORGANIZATION_CONTEXTS} = require('./contextProvider/ContextConstants');
const ContextProvider = require('./contextProvider/ContextProvider');

// For Visual Studio it is recommended to install Mocha sidebar and Chai snippets
// Mocha is the test framework and chai provides functions to check expectations

describe('Unit test template', function() {
  this.timeout(500000); // Not mandatory will automatically stop the unit test after that period of time

  before(async () => {
    chai.config.includeStack = true;
    // Used to create data before teh whole test chain is started
    // To simplify you can use the ContextProvider to get a tenant and some preloaded entities
    // To be used with care as more than 20 tenants!!!
    await ContextProvider.prepareContexts();
    this.tenantContext = await ContextProvider.getTenantContext(TENANT_CONTEXTS.TENANT_WITH_ALL_COMPONENTS, ORGANIZATION_CONTEXTS.SITE_WITH_ACL)
    // It will build all tenants except if you provide input arguments to limit to some contexts only. 
    // if you want to limit tom some context only
    // await ContextProvider.prepareContext([TENANT_CONTEXTS.TENANT_WITH_ALL_COMPONENTS with any additional context], [ORGANIZATION_CONTEXTS.SITE_WITH_ACL with any additional context]);
    // Or you can call the get directly which will provide you the tenant and build it if it does not exist
    this.tenantContextAll = await ContextProvider.getTenantContext(TENANT_CONTEXTS.TENANT_WITH_ALL_COMPONENTS, ORGANIZATION_CONTEXTS.SITE_WITH_ACL);
  });

  afterEach(async () => {
    console.log('Reinitialize content after each test');
    await ContextProvider.initializeAllTenantContents(); //.then(() => done());
  });

  after(async () => {
    // console.log('Reinitialize content after complete test scenario');
    // await ContextProvider.initializeAllTenantContents();
  });

  describe('Unit test global description level 1', () => {
    it('simple unit test 1', async () => {
      const test = 2;
      //startTransaction(chargingStation, connectorId, tagId, meterStart, startDate, expectedStatus = 'Accepted')
      await this.tenantContextAll.startTransaction(this.tenantContextAll.getOrganizationContext(ORGANIZATION_CONTEXTS.SITE_WITH_ACL).getChargingStations()[0], 1, 
        this.tenantContextAll.context.users[0].tagIDs[0], 0, moment());
      expect(test).to.equal(2);
    });

    it('simple unit test 2', async () => {
      const test = 2;
      expect(test).to.equal(2);
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