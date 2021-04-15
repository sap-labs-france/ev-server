import chai, { expect } from 'chai';

import CentralServerService from './client/CentralServerService';
import ContextDefinition from './context/ContextDefinition';
import ContextProvider from './context/ContextProvider';
import Factory from '../factories/Factory';
import { StatusCodes } from 'http-status-codes';
import TenantContext from './context/TenantContext';
import chaiSubset from 'chai-subset';

chai.use(chaiSubset);

class TestData {
  public tenantContext: TenantContext;
  public centralUserContext: any;
  public centralUserService: CentralServerService;
  public userContext: any;
  public userService: CentralServerService;
  public newCompany: any;
  public newSite: any;
  public createdCompanies: any[] = [];
  public createdUsers: any[] = [];
  public createdSites: any[] =[];
}

const testData = new TestData();

/**
 * @param userRole
 */
function login(userRole) {
  testData.userContext = testData.tenantContext.getUserContext(userRole);
  if (testData.userContext === testData.centralUserContext) {
    testData.userService = testData.centralUserService;
  } else {
    testData.userService = new CentralServerService(
      testData.tenantContext.getTenant().subdomain,
      testData.userContext
    );
  }
}

/**
 *
 */
async function loginAsAdminAndCreateCompanyWithASite() {
  login(ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN);
  // Create a company
  testData.newCompany = await testData.userService.createEntity(
    testData.userService.companyApi,
    Factory.company.build()
  );
  testData.createdCompanies.push(testData.newCompany);
  // Create a site and assign it to the created company
  testData.newSite = await testData.userService.createEntity(
    testData.userService.siteApi,
    Factory.site.build({ companyID: testData.newCompany.id })
  );
  testData.createdSites.push(testData.newSite);
  // Assign the basic user to the site
  const basicUserContext = await testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.BASIC_USER);
  await testData.userService.siteApi.addUsersToSite(testData.newSite.id, [basicUserContext.id]);
  // Create a company with no sites
  testData.newCompany = await testData.userService.createEntity(
    testData.userService.companyApi,
    Factory.company.build()
  );
  testData.createdCompanies.push(testData.newCompany);
}

/**
 *
 */
async function loginAsAdminAndRemoveUsersFromSite() {
  login(ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN);
  await testData.userService.siteApi.addUsersToSite(testData.newSite.id, []);
}

describe('Company Org tests', function() {
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

    after(async () => {
      // Delete any created company
      testData.createdCompanies.forEach(async (site) => {
        await testData.centralUserService.deleteEntity(
          testData.centralUserService.companyApi,
          site,
          false
        );
      });
      testData.createdCompanies = [];
      // Delete any created user
      testData.createdUsers.forEach(async (user) => {
        await testData.centralUserService.deleteEntity(
          testData.centralUserService.userApi,
          user,
          false
        );
      });
      testData.createdUsers = [];
      // Remove sites
    });

    describe('Where admin user', () => {

      before(() => {
        login(ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN);
      });

      it('Should be able to create a new company', async () => {
        // Create
        testData.newCompany = await testData.userService.createEntity(
          testData.userService.companyApi,
          Factory.company.build()
        );
        testData.createdCompanies.push(testData.newCompany);
      });

      it('Should find the created company by id', async () => {
        // Check if the created entity can be retrieved with its id
        await testData.userService.getEntityById(
          testData.userService.companyApi,
          testData.newCompany
        );
      });

      it('Should find the created company in the company list', async () => {
        // Check if the created entity is in the list
        await testData.userService.checkEntityInList(
          testData.userService.companyApi,
          testData.newCompany
        );
      });

      it('Should be able to update the company', async () => {
        // Change entity
        testData.newCompany.name = 'New Name';
        // Update
        await testData.userService.updateEntity(
          testData.userService.companyApi,
          testData.newCompany
        );
      });

      it('Should find the updated company by id', async () => {
        // Check if the updated entity can be retrieved with its id
        const updatedCompany = await testData.userService.getEntityById(
          testData.userService.companyApi,
          testData.newCompany
        );
        // Check
        expect(updatedCompany.name).to.equal(testData.newCompany.name);
      });

      it('Should be able to delete the created company', async () => {
        // Delete the created entity
        await testData.userService.deleteEntity(
          testData.userService.companyApi,
          testData.newCompany
        );
      });

      it('Should not find the deleted company with its id', async () => {
        // Check if the deleted entity cannot be retrieved with its id
        await testData.userService.checkDeletedEntityById(
          testData.userService.companyApi,
          testData.newCompany
        );
      });

    });

  });
  describe('Where basic user', () => {

    before(async () => {
      await loginAsAdminAndCreateCompanyWithASite();
      login(ContextDefinition.USER_CONTEXTS.BASIC_USER);
    });

    it('Should be able to read company with site he is assigned to ', async () => {
      await testData.userService.getEntityById(
        testData.userService.companyApi,
        testData.createdCompanies[0]
      );
    });

    it('Should not be able to read company if he is not assigned to a site of that company', async () => {
      try {
        await testData.userService.getEntityById(
          testData.userService.companyApi,
          testData.createdCompanies[1]
        );
      } catch (error) {
        expect(error.actual).to.eq(403);
      }
    });

    it('Should not be able to read company after he was removed from the site assigned to that company', async () => {
      await loginAsAdminAndRemoveUsersFromSite();
      login(ContextDefinition.USER_CONTEXTS.BASIC_USER);

      try {
        await testData.userService.getEntityById(
          testData.userService.companyApi,
          testData.createdCompanies[0]
        );
      } catch (error) {
        expect(error.actual).to.eq(403);
      }
    });

    it('Should not be able to create a new company', async () => {
      try {
        await testData.userService.createEntity(
          testData.userService.companyApi,
          Factory.company.build()
        );
      } catch (error) {
        expect(error.actual).to.eq(403);
      }
    });

    it('Should not be able to update a company', async () => {
      try {
      // Change entity
        testData.newCompany.name = 'New Name';
        // Try to update
        await testData.userService.updateEntity(
          testData.userService.companyApi,
          testData.newCompany
        );
      } catch (error) {
        expect(error.actual).to.eq(403);
      }
    });

    it('Should not be able to delete a company', async () => {
      try {
      // Try to delete
        await testData.userService.deleteEntity(
          testData.userService.companyApi,
          testData.newCompany
        );
      } catch (error) {
        expect(error.actual).to.equal(StatusCodes.FORBIDDEN);
      }
    });
  });
});
