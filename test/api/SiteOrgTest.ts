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

function login(userRole) {
  testData.userContext = testData.tenantContext.getUserContext(userRole);
  if (testData.userContext === testData.centralUserContext) {
    // Reuse the central user service (to avoid double login)
    testData.userService = testData.centralUserService;
  } else {
    testData.userService = new CentralServerService(
      testData.tenantContext.getTenant().subdomain,
      testData.userContext
    );
  }
}

async function createSite() {
  // Create a site
  testData.newSite = await testData.userService.createEntity(
    testData.userService.siteApi,
    Factory.site.build({ companyID: testData.tenantContext.getContext().companies[0].id })
  );
  testData.createdSites.push(testData.newSite);
}

async function assignUserToSite(userRole, site) {
  // Assign the user to the site
  const userContext = await testData.tenantContext.getUserContext(userRole);
  await testData.userService.siteApi.addUsersToSite(site.id, [userContext.id]);
}


describe('Site tests', function() {
  this.timeout(1000000); // Will automatically stop the unit test after that period of time

  before(async () => {
    chai.config.includeStack = true;
    await ContextProvider.defaultInstance.prepareContexts();
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

    describe('Where admin user', () => {

      before(async () => {
        login(ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN);
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

    describe('Where basic user', () => {

      before(async () => {
        login(ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN);
        await createSite();
        await assignUserToSite(ContextDefinition.USER_CONTEXTS.BASIC_USER, testData.newSite);
        await createSite();
        login(ContextDefinition.USER_CONTEXTS.BASIC_USER);
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

      it('Should find a site he is assigned to', async () => {
        await testData.userService.getEntityById(
          testData.userService.siteApi,
          testData.createdSites[0]
        );
      });

      it('Should find a site he is assigned to in the site list', async () => {
        // Check if the created entity is in the list
        await testData.userService.checkEntityInList(
          testData.userService.siteApi,
          testData.createdSites[0]
        );
      });

      it('Should not find a site he is not assigned to', async () => {
        try {
          await testData.userService.getEntityById(
            testData.userService.siteApi,
            testData.createdSites[1]
          );
        } catch (error) {
          expect(error.actual).to.eq(403);
        }
      });

      it('Should not find a site he is not assigned to in the site list', async () => {
        try {
        // Check if the created entity is in the list
          await testData.userService.checkEntityInList(
            testData.userService.siteApi,
            testData.createdSites[1]
          );
        } catch (error) {
          expect(error.actual.result).to.not.containSubset([{ id: testData.createdSites[1].id }]);
        }
      });

      it('Should not be able to create a new site', async () => {
        try {
          await testData.userService.createEntity(
            testData.userService.siteApi,
            Factory.site.build({ companyID: testData.tenantContext.getContext().companies[0].id })
          );
        } catch (error) {
          expect(error.actual).to.eq(403);
        }
      });

      it('Should not be able to update the site', async () => {
        try {
          // Change entity
          testData.newSite.name = 'New Name';
          // Update
          await testData.userService.updateEntity(
            testData.userService.siteApi,
            testData.newSite
          );
        } catch (error) {
          expect(error.actual).to.eq(403);
        }
      });

      it('Should not be able to delete the created site', async () => {
        try {
        // Delete the created entity
          await testData.userService.deleteEntity(
            testData.userService.siteApi,
            testData.newSite
          );
        } catch (error) {
          expect(error.actual).to.eq(403);
        }
      });

    });
  });
});
