import chai, { expect } from 'chai';

import CentralServerService from '../api/client/CentralServerService';
import ContextDefinition from './context/ContextDefinition';
import ContextProvider from './context/ContextProvider';
import Factory from '../factories/Factory';
import SiteContext from './context/SiteContext';
import TenantContext from './context/TenantContext';
import chaiSubset from 'chai-subset';

chai.use(chaiSubset);

class TestData {
  public tenantContext: TenantContext;
  public centralUserContext: any;
  public centralUserService: CentralServerService;
  public userContext: any;
  public userService: CentralServerService;
  public siteContext: SiteContext;
  public siteAreaContext: any;
  public newSite: any;
  public newUser: any;
  public createdSites: any[] = [];
  public createdUsers: any[] = [];
}

const testData: TestData = new TestData();

describe('Site tests', function() {
  this.timeout(1000000); // Will automatically stop the unit test after that period of time

  before(async () => {
    chai.config.includeStack = true;
    await ContextProvider.defaultInstance.prepareContexts();
  });

  afterEach(() => {
    // Can be called after each UT to clean up created data
  });

  after(async () => {
    // Final clean up at the end
    await ContextProvider.defaultInstance.cleanUpCreatedContent();
  });

  describe('With component Organization (tenant utorg)', () => {

    before(async () => {
      testData.tenantContext = await ContextProvider.defaultInstance.getTenantContext(ContextDefinition.TENANT_CONTEXTS.TENANT_ORGANIZATION);
      testData.centralUserContext = testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN);
      testData.centralUserService = new CentralServerService(
        testData.tenantContext.getTenant().subdomain,
        testData.centralUserContext
      );
    });

    after(async () => {
      // Delete any created site
      testData.createdSites.forEach(async (site) => {
        await testData.centralUserService.deleteEntity(
          testData.centralUserService.siteApi,
          site,
          false
        );
      });
      testData.createdSites = [];
      // Delete any created user
      testData.createdUsers.forEach(async (user) => {
        await testData.centralUserService.deleteEntity(
          testData.centralUserService.userApi,
          user,
          false
        );
      });
      testData.createdUsers = [];
    });

    describe('Where admin user', () => {

      before(async () => {
        testData.userContext = testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN);
        if (testData.userContext === testData.centralUserContext) {
          // Reuse the central user service (to avoid double login)
          testData.userService = testData.centralUserService;
        } else {
          testData.userService = new CentralServerService(
            testData.tenantContext.getTenant().subdomain,
            testData.userContext
          );
        }
      });

      it('Should be able to create a new site', async () => {
        // Create the entity
        testData.newSite = await testData.userService.createEntity(
          testData.userService.siteApi,
          Factory.site.build({ companyID: testData.tenantContext.getContext().companies[0].id })
        );
        testData.createdSites.push(testData.newSite);
      });

      it('Should find the created site by id', async () => {
        // Check if the created entity can be retrieved with its id
        await testData.userService.getEntityById(
          testData.userService.siteApi,
          testData.newSite
        );
      });

      it('Should find the created site in the site list', async () => {
        // Check if the created entity is in the list
        await testData.userService.checkEntityInList(
          testData.userService.siteApi,
          testData.newSite
        );
      });

      it('Should be able to update the site', async () => {
        // Change entity
        testData.newSite.name = 'New Name';
        // Update
        await testData.userService.updateEntity(
          testData.userService.siteApi,
          testData.newSite
        );
      });

      it('Should find the updated site by id', async () => {
        // Check if the updated entity can be retrieved with its id
        const updatedSite = await testData.userService.getEntityById(
          testData.userService.siteApi,
          testData.newSite
        );
        // Check
        expect(updatedSite.name).to.equal(testData.newSite.name);
      });

      it('Should be able to delete the created site', async () => {
        // Delete the created entity
        await testData.userService.deleteEntity(
          testData.userService.siteApi,
          testData.newSite
        );
      });

      it('Should not find the deleted site with its id', async () => {
        // Check if the deleted entity cannot be retrieved with its id
        await testData.userService.checkDeletedEntityById(
          testData.userService.siteApi,
          testData.newSite
        );
      });

      it('Should not be able to create a site without a company', async () => {
        // Try to create the entity
        const response = await testData.userService.createEntity(
          testData.userService.siteApi,
          Factory.site.build(),
          false
        );
        expect(response.status).to.equal(500);
      });

    });

  });

});
