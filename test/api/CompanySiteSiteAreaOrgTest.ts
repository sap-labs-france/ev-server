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
  public newSite: any;
  public newSiteArea: any;
  public createdCompanies: any[] = [];
  public createdSites: any[] = [];
  public createdSiteAreas: any[] = [];
  public createdUsers: any[] = [];
}

const testData = new TestData();

describe('Company, Site, Site Area', () => {
  jest.setTimeout(60000); // Will automatically stop the unit test after that period of time

  beforeAll(async () => {
    chai.config.includeStack = true;
    await ContextProvider.defaultInstance.prepareContexts();
  });

  afterEach(() => {
    // Can be called after each UT to clean up created data
  });

  afterAll(async () => {
    // Final clean up at the end
    await ContextProvider.defaultInstance.cleanUpCreatedContent();
  });

  describe('With component Organization (utorg)', () => {

    beforeAll(async () => {
      testData.tenantContext = await ContextProvider.defaultInstance.getTenantContext(ContextDefinition.TENANT_CONTEXTS.TENANT_ORGANIZATION);
      testData.centralUserContext = testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN);
      testData.centralUserService = new CentralServerService(
        testData.tenantContext.getTenant().subdomain,
        testData.centralUserContext
      );
    });

    afterAll(async () => {
      // Delete any created site area
      for (const siteArea of testData.createdSiteAreas) {
        await testData.centralUserService.deleteEntity(
          testData.centralUserService.siteAreaApi,
          siteArea,
          false
        );
      }
      testData.createdSiteAreas = [];
      // Delete any created site
      for (const site of testData.createdSites) {
        await testData.centralUserService.deleteEntity(
          testData.centralUserService.siteApi,
          site,
          false
        );
      }
      testData.createdSites = [];
      // Delete any created company
      for (const company of testData.createdCompanies) {
        await testData.centralUserService.deleteEntity(
          testData.centralUserService.companyApi,
          company,
          false
        );
      }
      testData.createdCompanies = [];
      // Delete any created user
      for (const user of testData.createdUsers) {
        await testData.centralUserService.deleteEntity(
          testData.centralUserService.userApi,
          user,
          false
        );
      }
      testData.createdUsers = [];
    });

    describe('Where admin user', () => {

      beforeAll(async () => {
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

      beforeEach(async () => {
        // Create a new Company
        testData.newCompany = await testData.userService.createEntity(
          testData.userService.companyApi,
          Factory.company.build()
        );
        testData.createdCompanies.push(testData.newCompany);
        expect(testData.newCompany).to.not.be.null;
        // Create a new Site
        testData.newSite = await testData.userService.createEntity(
          testData.userService.siteApi,
          Factory.site.build({
            companyID: testData.newCompany.id
          })
        );
        testData.createdSites.push(testData.newSite);
        expect(testData.newSite).to.not.be.null;
        // Create a new Site Area
        testData.newSiteArea = await testData.userService.createEntity(
          testData.userService.siteAreaApi,
          Factory.siteArea.build({
            siteID: testData.newSite.id
          })
        );
        testData.createdSiteAreas.push(testData.newSiteArea);
        expect(testData.newSiteArea).to.not.be.null;
      });

      afterEach(async () => {
        // Delete the new Company
        await testData.centralUserService.deleteEntity(
          testData.centralUserService.companyApi,
          testData.newCompany,
          false
        );
        // Delete the new site
        await testData.centralUserService.deleteEntity(
          testData.centralUserService.siteApi,
          testData.newSite,
          false
        );
        // Delete the new site area
        await testData.centralUserService.deleteEntity(
          testData.centralUserService.siteAreaApi,
          testData.newSiteArea,
          false
        );
      });

      it(
        'Should be able to delete a site which will automatically delete the site area',
        async () => {
          // Delete the Site
          await testData.userService.deleteEntity(
            testData.userService.siteApi,
            testData.newSite
          );
          // Check Site does not exist
          await testData.userService.checkDeletedEntityById(
            testData.userService.siteApi,
            testData.newSite
          );
          // Check Site Area does not exist
          await testData.userService.checkDeletedEntityById(
            testData.userService.siteAreaApi,
            testData.newSiteArea
          );
        }
      );

      it(
        'Should be able to delete a company which will automatically delete the site and the site area',
        async () => {
          // Delete the Site
          await testData.userService.deleteEntity(
            testData.userService.companyApi,
            testData.newCompany
          );
          // Check Company does not exist
          await testData.userService.checkDeletedEntityById(
            testData.userService.companyApi,
            testData.newCompany
          );
          // Check Site does not exist
          await testData.userService.checkDeletedEntityById(
            testData.userService.siteApi,
            testData.newSite
          );
          // Check Site Area does not exist
          await testData.userService.checkDeletedEntityById(
            testData.userService.siteAreaApi,
            testData.newSiteArea
          );
        }
      );

    });

  });

});
