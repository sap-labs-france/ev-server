import chai, { expect } from 'chai';

import CentralServerService from './client/CentralServerService';
import ContextDefinition from './context/ContextDefinition';
import ContextProvider from './context/ContextProvider';
import Factory from '../factories/Factory';
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
  public createdCompanies: any[] = [];
  public createdUsers: any[] = [];
}

const testData = new TestData();

describe('Company Org tests', function() {
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

});
