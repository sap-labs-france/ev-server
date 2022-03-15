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
  public newSiteArea: any;
  public testAsset: any;
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

async function createSiteArea() {
  // Create the site area
  testData.newSiteArea = await testData.userService.createEntity(
    testData.userService.siteAreaApi,
    Factory.siteArea.build({ siteID: testData.createdSites[0].id })
  );
}

async function createAsset() {
  // Create Asset
  testData.testAsset = await testData.userService.createEntity(
    testData.userService.assetApi,
    Factory.asset.build({
      siteAreaID: testData.newSiteArea.id,
      assetType: 'PR'
    })
  );
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

describe('Site', () => {
  jest.setTimeout(1000000); // Will automatically stop the unit test after that period of time

  beforeAll(async () => {
    chai.config.includeStack = true;
    await ContextProvider.defaultInstance.prepareContexts();
  });

  afterAll(async () => {
    // Final clean up at the end
    await ContextProvider.defaultInstance.cleanUpCreatedContent();
  });

  describe('With component Organization (utorg)', () => {

    beforeAll(async () => {
      testData.tenantContext = await ContextProvider.defaultInstance.getTenantContext(ContextDefinition.TENANT_CONTEXTS.TENANT_WITH_ALL_COMPONENTS);
      testData.centralUserContext = testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN);
      testData.centralUserService = new CentralServerService(
        testData.tenantContext.getTenant().subdomain,
        testData.centralUserContext
      );
    });

    describe('Where admin user', () => {

      beforeAll(async () => {
        login(ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN);
        await createSite();
        await createSiteArea();
        await createAsset();
      });

      afterAll(async () => {
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
        // Delete Asset
        await testData.centralUserService.deleteEntity(
          testData.centralUserService.assetApi,
          testData.testAsset,
          false
        );
        // Delete site area
        await testData.centralUserService.deleteEntity(
          testData.centralUserService.siteAreaApi,
          testData.newSiteArea,
          false
        );
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

      it('Assets, Charging stations and transactions should be aligned with organizations entities', async () => {
        const chargingStations = await testData.userService.chargingStationApi.readAll({});
        let transaction = (await testData.userService.transactionApi.readAllCompleted({}, { limit: 1, skip: 0 })).data.result[0];
        let chargingStation = (await testData.userService.chargingStationApi.readById(chargingStations.data.result[0].id)).data;
        // Conserve site areas ID to re init the context
        const oldChargingStationSiteAreaID = chargingStation.siteAreaID;
        // Conserve company ID to re init the context
        const oldTransactionCompanyID = transaction.companyID;
        // Get the site of the transaction
        const transactionSite = (await testData.userService.siteApi.readById(transaction.siteID)).data;
        // Change the companyID of the Site
        transactionSite.companyID = testData.tenantContext.getContext().companies[0].id;
        // Update
        await testData.userService.updateEntity(
          testData.userService.siteApi,
          transactionSite
        );
        // Get the updated site
        transaction = (await testData.userService.transactionApi.readById(transaction.id)).data;
        expect(transaction.companyID).to.equal(testData.tenantContext.getContext().companies[0].id);
        // Assign Charging Station
        await testData.userService.siteAreaApi.assignChargingStations(
          testData.newSiteArea.id, [chargingStation.id]);
        testData.createdSites[0].companyID = testData.tenantContext.getContext().companies[1].id;
        // Update
        await testData.userService.updateEntity(
          testData.userService.siteApi,
          testData.createdSites[0]
        );
        // Get the assigned asset
        testData.testAsset = (await testData.userService.assetApi.readById(testData.testAsset.id)).data;
        expect(testData.testAsset.companyID).to.equal(testData.tenantContext.getContext().companies[1].id);
        // Get the assigned charging station
        chargingStation = (await testData.userService.chargingStationApi.readById(chargingStations.data.result[0].id)).data;
        expect(chargingStation.companyID).to.equal(testData.tenantContext.getContext().companies[1].id);
        // Put back the context in place
        testData.createdSites[0].companyID = testData.tenantContext.getContext().companies[0].id;
        // Update
        await testData.userService.updateEntity(
          testData.userService.siteApi,
          testData.createdSites[0]
        );
        transactionSite.companyID = oldTransactionCompanyID;
        // Update
        await testData.userService.updateEntity(
          testData.userService.siteApi,
          transactionSite
        );
        // Remove charging station from site area
        await testData.userService.siteAreaApi.removeChargingStations(
          testData.newSiteArea.id, [chargingStation.id]);
        chargingStation = (await testData.userService.chargingStationApi.readById(chargingStation.id)).data;
        // Put back the context in place
        if (oldChargingStationSiteAreaID) {
          await testData.userService.siteAreaApi.assignChargingStations(
            oldChargingStationSiteAreaID, [chargingStation.id]);
        }
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

      beforeAll(async () => {
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

      afterAll(async () => {
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
        // Delete created asset
        testData.createdUsers = [];
        await testData.centralUserService.deleteEntity(
          testData.centralUserService.assetApi,
          testData.testAsset,
          false
        );
        await testData.centralUserService.deleteEntity(
          testData.centralUserService.siteAreaApi,
          testData.newSiteArea,
          false
        );
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

      it(
        'Should not find a site he is not assigned to in the site list',
        async () => {
          try {
            // Check if the created entity is in the list
            await testData.userService.checkEntityInList(
              testData.userService.siteApi,
              testData.createdSites[1]
            );
          } catch (error) {
            expect(error.actual.result).to.not.containSubset([{ id: testData.createdSites[1].id }]);
          }
        }
      );

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

      it(
        'Should be able to update a site for which he is site admin',
        async () => {
          // Change entity
          testData.createdSites[2].name = 'New Name';
          // Update
          const updateResult = await testData.userService.updateEntity(
            testData.userService.siteApi,
            testData.createdSites[2]
          );
          expect(updateResult.status).to.eq(StatusCodes.OK);
        }
      );

      it(
        'Should not be able to update a site for which he is site owner',
        async () => {
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
        }
      );
      it(
        'Should not be able to assign a user to a site he is assigned to',
        async () => {
          const assignmentResult = await assignUserToSite(ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN, testData.createdSites[0]);
          expect(assignmentResult.status).to.eq(403);
        }
      );

      it(
        'Should not be able to assign a user to a site he is not assigned to',
        async () => {
          const assignmentResult = await assignUserToSite(ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN, testData.createdSites[1]);
          expect(assignmentResult.status).to.eq(403);
        }
      );

      it(
        'Should not be able to assign a user to a site for which he is site admin',
        async () => {
          const assignmentResult = await assignUserToSite(ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN, testData.createdSites[2]);
          expect(assignmentResult.status).to.eq(403);
        }
      );

      it(
        'Should not be able to assign a user to a site for which he is site owner',
        async () => {
          const assignmentResult = await assignUserToSite(ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN, testData.createdSites[3]);
          expect(assignmentResult.status).to.eq(403);
        }
      );

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

      it(
        'Should not be able to delete a site for which he is site admin',
        async () => {
          try {
            await testData.userService.deleteEntity(
              testData.userService.siteApi,
              testData.createdSites[2]
            );
          } catch (error) {
            expect(error.actual).to.eq(403);
          }
        }
      );

      it(
        'Should not be able to delete a site for which he is site owner',
        async () => {
          try {
            await testData.userService.deleteEntity(
              testData.userService.siteApi,
              testData.createdSites[3]
            );
          } catch (error) {
            expect(error.actual).to.eq(403);
          }
        }
      );

    });
  });
});
