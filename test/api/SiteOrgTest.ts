import chai, { expect } from 'chai';

import CentralServerService from '../api/client/CentralServerService';
import ContextDefinition from './context/ContextDefinition';
import ContextProvider from './context/ContextProvider';
import Factory from '../factories/Factory';
import SiteContext from './context/SiteContext';
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

async function assignUserToSite(userRole, site): Promise<any> {
  // Assign the user to the site
  const userContext = await testData.tenantContext.getUserContext(userRole);
  return testData.userService.siteApi.addUsersToSite(site.id, [userContext.id]);
}


async function assignSitesToUser(userRole, sites: string[]): Promise<any> {
  // Assign the user to the site
  const userContext = await testData.tenantContext.getUserContext(userRole);
  return testData.userService.siteApi.addSitesToUser(userContext.id, sites);
}

async function unassignSitesToUser(userRole, sites: string[]): Promise<any> {
  // Assign the user to the site
  const userContext = await testData.tenantContext.getUserContext(userRole);
  return testData.userService.siteApi.unassignSitesToUser(userContext.id, sites);
}

async function assignSiteAdmin(userRole, site) {
  // Assign the user as admin to the site
  const userContext = await testData.tenantContext.getUserContext(userRole);
  await assignUserToSite(userRole, site);
  await testData.userService.siteApi.assignSiteAdmin(site.id, userContext.id);
}

async function assignSiteOwner(userRole, site) {
  // Assign the user as owner to the site
  const userContext = await testData.tenantContext.getUserContext(userRole);
  await assignUserToSite(userRole, site);
  await testData.userService.siteApi.assignSiteOwner(site.id, userContext.id);

}

describe('Site', function() {
  this.timeout(1000000); // Will automatically stop the unit test after that period of time

  before(async () => {
    chai.config.includeStack = true;
    await ContextProvider.defaultInstance.prepareContexts();
  });

  after(async () => {
    // Final clean up at the end
    await ContextProvider.defaultInstance.cleanUpCreatedContent();
  });

  describe('With component Organization (utorg)', () => {

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
        for (const site of testData.createdSites) {
          await testData.centralUserService.deleteEntity(
            testData.centralUserService.siteApi,
            site,
            false
          );
        }
        testData.createdSites = [];
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

      it('Should be able to assign a user to a site', async () => {
        await assignUserToSite(ContextDefinition.USER_CONTEXTS.BASIC_USER, testData.newSite);
        const res = await testData.userService.siteApi.readUsersForSite(testData.newSite.id);
        expect(res.data.count).to.eq(1);
        const userContext = await testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.BASIC_USER);
        expect(res.data.result.map((site) => site.user.id)).to.contain(userContext.id);
      });

      it('Should be able to unassign a site to a user', async () => {
        await unassignSitesToUser(ContextDefinition.USER_CONTEXTS.BASIC_USER, [testData.newSite.id]);
        const res = await testData.userService.siteApi.readUsersForSite(testData.newSite.id);
        expect(res.data.count).to.eq(0);
        const userContext = await testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.BASIC_USER);
        expect(res.data.result.map((site) => site.user.id)).to.not.contain(userContext.id);
      });

      it('Should be able to assign a site to a user', async () => {
        await assignSitesToUser(ContextDefinition.USER_CONTEXTS.BASIC_USER, [testData.newSite.id]);
        const res = await testData.userService.siteApi.readUsersForSite(testData.newSite.id);
        expect(res.data.count).to.eq(1);
        const userContext = await testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.BASIC_USER);
        expect(res.data.result.map((site) => site.user.id)).to.contain(userContext.id);
      });

      it('Should be able to assign site admin to a site', async () => {
        await assignSiteAdmin(ContextDefinition.USER_CONTEXTS.BASIC_USER, testData.newSite);
        const res = await testData.userService.siteApi.readUsersForSite(testData.newSite.id);
        expect(res.data.count).to.eq(1);
        const userContext = await testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.BASIC_USER);
        expect(res.data.result.map((site) => site.user.id)).to.contain(userContext.id);
        expect(res.data.result.filter((site) => site.siteAdmin === true).map((site) => site.user.id)).to.contain(userContext.id);
      });

      it('Should be able to assign site owner to a site', async () => {
        await assignSiteOwner(ContextDefinition.USER_CONTEXTS.BASIC_USER, testData.newSite);
        const res = await testData.userService.siteApi.readUsersForSite(testData.newSite.id);
        expect(res.data.count).to.eq(1);
        const userContext = await testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.BASIC_USER);
        expect(res.data.result.map((site) => site.user.id)).to.contain(userContext.id);
        expect(res.data.result.filter((site) => site.siteOwner === true).map((site) => site.user.id)).to.contain(userContext.id);
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
        expect(response.status).to.equal(StatusCodes.INTERNAL_SERVER_ERROR);
      });

    });

    describe('Where basic user', () => {

      before(async () => {
        login(ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN);
        await createSite();
        await assignUserToSite(ContextDefinition.USER_CONTEXTS.BASIC_USER, testData.createdSites[0]);
        await createSite();
        await createSite();
        await assignSiteAdmin(ContextDefinition.USER_CONTEXTS.BASIC_USER, testData.createdSites[2]);
        await createSite();
        await assignSiteOwner(ContextDefinition.USER_CONTEXTS.BASIC_USER, testData.createdSites[3]);
        login(ContextDefinition.USER_CONTEXTS.BASIC_USER);
      });

      after(async () => {
        // Delete any created site
        for (const site of testData.createdSites) {
          await testData.centralUserService.deleteEntity(
            testData.centralUserService.siteApi,
            site,
            false
          );
        }
        testData.createdSites = [];
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

      it('Should not be able to update a site he is assigned to', async () => {
        // Change entity
        testData.createdSites[0].name = 'New Name';
        // Try to update
        try {
          const updateResult = await testData.userService.updateEntity(
            testData.userService.siteApi,
            testData.createdSites[0]
          );
          expect(updateResult.status).to.not.eq(StatusCodes.OK);
        } catch (error) {
          expect(error.actual).to.eq(403);
        }
      });

      it('Should not be able to update a site he is not assigned to', async () => {
        // Change entity
        testData.createdSites[1].name = 'New Name';
        // Try to update
        try {
          const updateResult = await testData.userService.updateEntity(
            testData.userService.siteApi,
            testData.createdSites[1]
          );
          expect(updateResult.status).to.not.eq(StatusCodes.OK);
        } catch (error) {
          expect(error.actual).to.eq(403);
        }
      });

      it('Should be able to update a site for which he is site admin', async () => {
        // Change entity
        testData.createdSites[2].name = 'New Name';
        // Update
        const updateResult = await testData.userService.updateEntity(
          testData.userService.siteApi,
          testData.createdSites[2]
        );
        expect(updateResult.status).to.eq(StatusCodes.OK);
      });

      it('Should not be able to update a site for which he is site owner', async () => {
        // Change entity
        testData.createdSites[3].name = 'New Name';
        // Try to update
        try {
          const updateResult = await testData.userService.updateEntity(
            testData.userService.siteApi,
            testData.createdSites[3]
          );
          expect(updateResult.status).to.not.eq(StatusCodes.OK);
        } catch (error) {
          expect(error.actual).to.eq(403);
        }
      });
      it('Should not be able to assign a user to a site he is assigned to', async () => {
        const assignmentResult = await assignUserToSite(ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN, testData.createdSites[0]);
        expect(assignmentResult.status).to.eq(403);
      });

      it('Should not be able to assign a user to a site he is not assigned to', async () => {
        const assignmentResult = await assignUserToSite(ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN, testData.createdSites[1]);
        expect(assignmentResult.status).to.eq(403);
      });

      it('Should not be able to assign a user to a site for which he is site admin', async () => {
        const assignmentResult = await assignUserToSite(ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN, testData.createdSites[2]);
        expect(assignmentResult.status).to.eq(403);
      });

      it('Should not be able to assign a user to a site for which he is site owner', async () => {
        const assignmentResult = await assignUserToSite(ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN, testData.createdSites[3]);
        expect(assignmentResult.status).to.eq(403);
      });

      it('Should not be able to delete a site he is assigned to', async () => {
        try {
          await testData.userService.deleteEntity(
            testData.userService.siteApi,
            testData.createdSites[0]
          );
        } catch (error) {
          expect(error.actual).to.eq(403);
        }
      });

      it('Should not be able to delete a site he is not assigned to', async () => {
        try {
          await testData.userService.deleteEntity(
            testData.userService.siteApi,
            testData.createdSites[1]
          );
        } catch (error) {
          expect(error.actual).to.eq(403);
        }
      });

      it('Should not be able to delete a site for which he is site admin', async () => {
        try {
          await testData.userService.deleteEntity(
            testData.userService.siteApi,
            testData.createdSites[2]
          );
        } catch (error) {
          expect(error.actual).to.eq(403);
        }
      });

      it('Should not be able to delete a site for which he is site owner', async () => {
        try {
          await testData.userService.deleteEntity(
            testData.userService.siteApi,
            testData.createdSites[3]
          );
        } catch (error) {
          expect(error.actual).to.eq(403);
        }
      });

    });
  });
});
