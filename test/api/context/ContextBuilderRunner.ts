import chai, { expect } from 'chai';

import ContextBuilder from './ContextBuilder';

// For Visual Studio it is recommended to install Mocha sidebar and Chai snippets
// Mocha is the test framework and chai provides functions to check expectations

describe('Unit test Context Builder', function() {
  jest.setTimeout(500000); // Not mandatory will automatically stop the unit test after that period of time

  beforeAll(async () => {
    chai.config.includeStack = true;
    // Used to create data before teh whole test chain is started
    // To simplify you can use the ContextBuilder to get a tenant and some preloaded entities
    // To be used with care as more than 20 tenants!!!
    const contextBuilder = new ContextBuilder();
    await contextBuilder.prepareContexts();
    // pragma this.tenantContext = await ContextBuilder.getTenantContext(TENANT_CONTEXTS.TENANT_WITH_ALL_COMPONENTS, SITE_CONTEXTS.SITE_BASIC)
    // It will build all tenants except if you provide input arguments to limit to some contexts only.
    // if you want to limit tom some context only
    // await ContextBuilder.prepareContext([TENANT_CONTEXTS.TENANT_WITH_ALL_COMPONENTS with any additional context], [ORGANIZATION_CONTEXTS.SITE_WITH_ACL with any additional context]);
    // Or you can call the get directly which will provide you the tenant and build it if it does not exist
    // this.tenantContextAll = await ContextBuilder.getTenantContext(TENANT_CONTEXTS.TENANT_WITH_ALL_COMPONENTS, SITE_CONTEXTS.SITE_WITH_AUTO_USER_ASSIGNMENT);
    console.log('unit test context initialized');
  });

  afterEach(async () => {
    // pragma console.log('Reinitialize content after each test');
    // await ContextBuilder.initializeAllTenantContents(); //.then(() => done());
  });

  afterAll(async () => {
    // pragma console.log('Reinitialize content after complete test scenario');
    // await ContextBuilder.initializeAllTenantContents();
  });

  describe('Context builder test case', () => {
    it('Builder dummy test', async () => {
      const test = 2;
      // pragma const adminUser = this.tenantContextAll.getUserContext(null, 'florent.pernice@sap.com');
      // startTransaction(chargingStation, connectorId, tagId, meterStart, startDate, expectedStatus = OCPPStatus.ACCEPTED);
      // await this.tenantContextAll.startTransaction(this.tenantContextAll.getOrganizationContext(SITE_CONTEXTS.SITE_BASIC).getChargingStations()[0], 1,
      // adminUser.tagIDs[0], 0, moment());
      expect(test).to.equal(2);
    });

  });

});
