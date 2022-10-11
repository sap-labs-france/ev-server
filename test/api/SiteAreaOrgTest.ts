import chai, { expect } from 'chai';

import Asset from '../../src/types/Asset';
import CentralServerService from '../api/client/CentralServerService';
import Constants from '../../src/utils/Constants';
import ContextDefinition from './context/ContextDefinition';
import ContextProvider from './context/ContextProvider';
import Factory from '../factories/Factory';
import { HTTPError } from '../../src/types/HTTPError';
import Site from '../../src/types/Site';
import SiteArea from '../../src/types/SiteArea';
import SiteAreaContext from './context/SiteAreaContext';
import SiteContext from './context/SiteContext';
import { StatusCodes } from 'http-status-codes';
import TenantContext from './context/TenantContext';
import { Voltage } from '../../src/types/ChargingStation';
import chaiSubset from 'chai-subset';

chai.use(chaiSubset);

class TestData {
  public tenantContext: TenantContext;
  public centralUserContext: any;
  public centralUserService: CentralServerService;
  public testAsset: Asset;
  public userContext: any;
  public userService: CentralServerService;
  public siteContext: SiteContext;
  public siteAreaContext: SiteAreaContext;
  public newSiteArea: any;
  public newSubSiteArea: any;
  public newSubSubSiteArea: any;
  public newUser: any;
  public siteWithSiteAdmin: Site;
  public siteWithoutSiteAdmin: Site;
  public siteAreaWithSiteAdmin: SiteArea;
  public siteAreaWithoutSiteAdmin: SiteArea;
  public createdSiteAreas: any[] = [];
  public createdSites: any[] = [];
  public createdUsers: any[] = [];
}

const testData: TestData = new TestData();

/**
 * @param userRole
 */
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

async function createSiteArea() {
  // Create the site area
  testData.newSiteArea = await testData.userService.createEntity(
    testData.userService.siteAreaApi,
    Factory.siteArea.build({ siteID: testData.siteContext.getSite().id })
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

/**
 *
 */
async function createSiteWithoutSiteAdmin() {
  // Create a site
  const siteData = Factory.site.build({ companyID: testData.tenantContext.getContext().companies[0].id });
  testData.siteWithoutSiteAdmin = await testData.userService.createEntity(
    testData.userService.siteApi,
    siteData
  );
  testData.createdSites.push(testData.siteWithoutSiteAdmin);
}

/**
 *
 */
async function createSiteWithSiteAdmin() {
  // Create a site
  testData.siteWithSiteAdmin = await testData.userService.createEntity(
    testData.userService.siteApi,
    Factory.site.build({ companyID: testData.tenantContext.getContext().companies[1].id })
  );
  await assignSiteAdmin(ContextDefinition.USER_CONTEXTS.BASIC_USER, testData.siteWithSiteAdmin);
  testData.createdSites.push(testData.siteWithSiteAdmin);
}
/**
 * @param userRole
 * @param site
 */
async function assignSiteAdmin(userRole, site) {
  // Assign the user as admin to the site
  const userContext = await testData.tenantContext.getUserContext(userRole);
  // Assign the user to the site
  await testData.userService.siteApi.addUsersToSite(site.id, [userContext.id]);
  await testData.userService.siteApi.assignSiteAdmin(site.id, userContext.id);
}

describe('Site Area', () => {
  jest.setTimeout(1000000); // Will automatically stop the unit test after that period of time

  beforeAll(async () => {
    chai.config.includeStack = true;
    await ContextProvider.defaultInstance.prepareContexts();
  });

  afterAll(async () => {
    // Final clean up at the end
    await ContextProvider.defaultInstance.cleanUpCreatedContent();
  });

  describe('With all components (utall)', () => {

    beforeAll(async () => {
      testData.tenantContext = await ContextProvider.defaultInstance.getTenantContext(ContextDefinition.TENANT_CONTEXTS.TENANT_WITH_ALL_COMPONENTS);
      testData.centralUserContext = testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN);
      testData.centralUserService = new CentralServerService(
        testData.tenantContext.getTenant().subdomain,
        testData.centralUserContext
      );
      testData.siteContext = testData.tenantContext.getSiteContext(ContextDefinition.SITE_CONTEXTS.SITE_BASIC);
      testData.siteAreaContext = testData.siteContext.getSiteAreaContext(ContextDefinition.SITE_AREA_CONTEXTS.WITH_ACL);
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

    describe('Where admin user', () => {

      beforeAll(async () => {
        login(ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN);
        await createSiteArea();
        await createAsset();

        await createSiteWithSiteAdmin();
        await createSiteWithoutSiteAdmin();
      });

      it('Should be able to create a new site area', async () => {
        // Create the entity
        testData.newSiteArea = await testData.userService.createEntity(
          testData.userService.siteAreaApi,
          Factory.siteArea.build({ siteID: testData.siteContext.getSite().id })
        );
        testData.createdSiteAreas.push(testData.newSiteArea);
      });

      it('Should find the created site area by id', async () => {
        // Check if the created entity can be retrieved with its id
        await testData.userService.getEntityById(
          testData.userService.siteAreaApi,
          testData.newSiteArea
        );
      });

      it('Should find the created site area in the site list', async () => {
        // Check if the created entity is in the list
        await testData.userService.checkEntityInList(
          testData.userService.siteAreaApi,
          testData.newSiteArea
        );
      });

      it('Should be able to update the site area', async () => {
        // Change entity
        testData.newSiteArea.name = 'New Name';
        // Update
        await testData.userService.updateEntity(
          testData.userService.siteAreaApi,
          testData.newSiteArea
        );
      });

      it('Should find the updated site area by id', async () => {
        // Check if the updated entity can be retrieved with its id
        const updatedSiteArea = await testData.userService.getEntityById(
          testData.userService.siteAreaApi,
          testData.newSiteArea
        );
        expect(updatedSiteArea.name).to.equal(testData.newSiteArea.name);
      });

      it('Should be able to delete the created site area', async () => {
        // Delete the created entity
        await testData.userService.deleteEntity(
          testData.userService.siteAreaApi,
          testData.newSiteArea
        );
      });

      it('Should not find the deleted site area with its id', async () => {
        // Check if the deleted entity cannot be retrieved with its id
        await testData.userService.checkDeletedEntityById(
          testData.userService.siteAreaApi,
          testData.newSiteArea
        );
      });

      it('Should not be able to create a site area without a site', async () => {
        // Try to create the entity
        const response = await testData.userService.createEntity(
          testData.userService.siteAreaApi,
          Factory.siteArea.build(),
          false
        );
        expect(response.status).to.equal(StatusCodes.INTERNAL_SERVER_ERROR);
      });

      it(
        'Should not be able to read consumption without site Area ID',
        async () => {
          // Try to call Consumptions without Site Area ID
          const response = await testData.centralUserService.siteAreaApi.readConsumption(null,null,null);
          expect(response.status).to.equal(StatusCodes.BAD_REQUEST);
        }
      );

      it(
        'Should not be able to read consumption without start and end date',
        async () => {
          // Try to call Consumptions without start and end date
          const response = await testData.centralUserService.siteAreaApi.readConsumption(testData.siteAreaContext.getSiteArea().id, null, null);
          expect(response.status).to.equal(StatusCodes.BAD_REQUEST);
        }
      );

      it(
        'Should not be able to read consumption with end date before start date',
        async () => {
          // Try to call Consumptions with end date before start date
          const response = await testData.centralUserService.siteAreaApi.readConsumption(
            testData.siteAreaContext.getSiteArea().id, new Date(), new Date(new Date().getTime() - (24 * 60 * 60 * 1000)));
          expect(response.status).to.equal(StatusCodes.INTERNAL_SERVER_ERROR);
        }
      );

      it('Should be able to assign ChargingStations to SiteArea', async () => {
      // Assign ChargingStation to SiteArea
        const chargingStations = await testData.userService.chargingStationApi.readAll({});
        expect(chargingStations.status).to.equal(StatusCodes.OK);
        const response = await testData.userService.siteAreaApi.assignChargingStations(
          testData.siteAreaContext.getSiteArea().id, [chargingStations.data.result[0].id]);
        expect(response.status).to.equal(StatusCodes.OK);
        // Get the assigned charging station
        const chargingStation = (await testData.userService.chargingStationApi.readById(chargingStations.data.result[0].id)).data;
        // Get the site
        const site = (await testData.userService.siteApi.readById(chargingStation.siteID)).data;
        expect(chargingStation.siteAreaID).to.equal(testData.siteAreaContext.getSiteArea().id);
        expect(chargingStation.siteID).to.equal(testData.siteAreaContext.getSiteArea().siteID);
        expect(chargingStation.companyID).to.equal(site.companyID);
      });

      it('Should be able to remove ChargingStations from SiteArea', async () => {
        // Remove ChargingStation from SiteArea
        const chargingStations = await testData.userService.chargingStationApi.readAll({});
        expect(chargingStations.status).to.equal(StatusCodes.OK);
        const response = await testData.userService.siteAreaApi.removeChargingStations(
          testData.siteAreaContext.getSiteArea().id, [chargingStations.data.result[0].id]);
        expect(response.status).to.equal(StatusCodes.OK);
        // Get the assigned charging station
        const chargingStation = (await testData.userService.chargingStationApi.readById(chargingStations.data.result[0].id)).data;
        // Organizations entities IDs should be removed
        expect(chargingStation.siteAreaID).to.be.null;
        expect(chargingStation.siteID).to.be.null;
        expect(chargingStation.companyID).to.be.null;
      });

      it('Assets, Charging stations, Transactions and Consumption should be aligned with organizations entities', async () => {
        const chargingStations = await testData.userService.chargingStationApi.readAll({});
        let transaction = (await testData.userService.transactionApi.readAllCompleted({}, { limit: 1, skip: 0 })).data.result[0];
        let chargingStation = (await testData.userService.chargingStationApi.readById(chargingStations.data.result[0].id)).data;
        // Conserve site areas IDs to re init the context
        const oldChargingStationSiteAreaID = chargingStation.siteAreaID;
        const oldTransactionSiteAreaID = transaction.siteAreaID;
        const oldTransactionSiteID = transaction.siteID;
        const transactionSiteArea = (await testData.userService.siteAreaApi.readById(oldTransactionSiteAreaID)).data;
        transactionSiteArea.siteID = testData.createdSites[1].id;
        // Update
        await testData.userService.updateEntity(
          testData.userService.siteAreaApi,
          transactionSiteArea
        );
        transaction = (await testData.userService.transactionApi.readById(transaction.id)).data;
        const consumption = (await testData.userService.transactionApi.readAllConsumption({ TransactionId: transaction.id })).data;
        expect(transaction.siteID).to.equal(testData.createdSites[1].id);
        expect(consumption.siteID).to.equal(testData.createdSites[1].id);
        expect(transaction.companyID).to.equal(testData.createdSites[1].companyID);
        transactionSiteArea.siteID = oldTransactionSiteID;
        // Update
        await testData.userService.updateEntity(
          testData.userService.siteAreaApi,
          transactionSiteArea
        );
        // Create the entity
        testData.newSiteArea = await testData.userService.createEntity(
          testData.userService.siteAreaApi,
          Factory.siteArea.build({ siteID: testData.createdSites[0].id })
        );
        let response = await testData.userService.siteAreaApi.assignChargingStations(
          testData.newSiteArea.id, [chargingStations.data.result[0].id]);
        expect(response.status).to.equal(StatusCodes.OK);
        response = await testData.userService.siteAreaApi.assignAssets(
          testData.newSiteArea.id, [testData.testAsset.id]);
        expect(response.status).to.equal(StatusCodes.OK);
        // Get the assigned asset
        let asset = (await testData.userService.assetApi.readById(testData.testAsset.id)).data;
        expect(asset.siteAreaID).to.equal(testData.newSiteArea.id);
        expect(asset.siteID).to.equal(testData.createdSites[0].id);
        expect(asset.companyID).to.equal(testData.createdSites[0].companyID);
        // Get the assigned charging station
        chargingStation = (await testData.userService.chargingStationApi.readById(chargingStations.data.result[0].id)).data;
        expect(chargingStation.siteAreaID).to.equal(testData.newSiteArea.id);
        expect(chargingStation.siteID).to.equal(testData.createdSites[0].id);
        expect(chargingStation.companyID).to.equal(testData.createdSites[0].companyID);
        // Change site
        testData.newSiteArea.siteID = testData.createdSites[1].id;
        // Update
        await testData.userService.updateEntity(
          testData.userService.siteAreaApi,
          testData.newSiteArea
        );
        // Get the assigned asset
        asset = (await testData.userService.assetApi.readById(testData.testAsset.id)).data;
        expect(asset.siteAreaID).to.equal(testData.newSiteArea.id);
        expect(asset.siteID).to.equal(testData.createdSites[1].id);
        expect(asset.companyID).to.equal(testData.createdSites[1].companyID);
        // Get the assigned charging station
        chargingStation = (await testData.userService.chargingStationApi.readById(chargingStations.data.result[0].id)).data;
        expect(chargingStation.siteAreaID).to.equal(testData.newSiteArea.id);
        expect(chargingStation.siteID).to.equal(testData.createdSites[1].id);
        expect(chargingStation.companyID).to.equal(testData.createdSites[1].companyID);
        // Remove charging station from site area
        await testData.userService.siteAreaApi.removeChargingStations(
          testData.newSiteArea.id, [chargingStation.id]);
        chargingStation = (await testData.userService.chargingStationApi.readById(chargingStation.id)).data;
        expect(chargingStation.siteAreaID).to.be.null;
        expect(chargingStation.siteID).to.be.null;
        expect(chargingStation.companyID).to.be.null;
        // Put back the context in place
        if (oldChargingStationSiteAreaID) {
          await testData.userService.siteAreaApi.assignChargingStations(
            oldChargingStationSiteAreaID, [chargingStation.id]);
        }
        testData.siteAreaContext.setSiteArea((await testData.userService.siteAreaApi.readById(testData.siteAreaContext.getSiteArea().id)).data);
      });

      it('Should be able to assign Assets to SiteArea', async () => {
        // Assign Assets to SiteArea
        const assets = await testData.userService.assetApi.readAll({});
        expect(assets.status).to.equal(StatusCodes.OK);
        const response = await testData.userService.siteAreaApi.assignAssets(
          testData.siteAreaContext.getSiteArea().id, [assets.data.result[0].id]);
        expect(response.status).to.equal(StatusCodes.OK);
        // Get the assigned asset
        const asset = (await testData.userService.assetApi.readById(assets.data.result[0].id)).data;
        // Get the site
        const site = (await testData.userService.siteApi.readById(asset.siteID)).data;
        expect(asset.siteAreaID).to.equal(testData.siteAreaContext.getSiteArea().id);
        expect(asset.siteID).to.equal(testData.siteAreaContext.getSiteArea().siteID);
        expect(asset.companyID).to.equal(site.companyID);
      });

      it('Should be able to remove Assets from SiteArea', async () => {
      // Remove Assets from SiteArea
        const assets = await testData.userService.assetApi.readAll({});
        expect(assets.status).to.equal(StatusCodes.OK);
        const response = await testData.userService.siteAreaApi.removeAssets(
          testData.siteAreaContext.getSiteArea().id, [assets.data.result[0].id]);
        expect(response.status).to.equal(StatusCodes.OK);
        const asset = (await testData.userService.assetApi.readById(assets.data.result[0].id)).data;
        // Organization IDs should be removed
        expect(asset.siteAreaID).to.be.null;
        expect(asset.siteID).to.be.null;
        expect(asset.companyID).to.be.null;
      });
    });

    describe('Where basic user', () => {

      beforeAll(async () => {
        login(ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN);
        await createSiteWithSiteAdmin();
        testData.siteAreaWithSiteAdmin = await testData.userService.createEntity(
          testData.userService.siteAreaApi,
          Factory.siteArea.build({ siteID: testData.siteWithSiteAdmin.id })
        );
        testData.createdSiteAreas.push(testData.siteAreaWithSiteAdmin);
        await createSiteWithoutSiteAdmin();
        testData.siteAreaWithoutSiteAdmin = await testData.userService.createEntity(
          testData.userService.siteAreaApi,
          Factory.siteArea.build({ siteID: testData.siteWithoutSiteAdmin.id })
        );
        testData.createdSiteAreas.push(testData.siteAreaWithoutSiteAdmin);
        // Create the entity
        testData.newSiteArea = await testData.userService.createEntity(
          testData.userService.siteAreaApi,
          Factory.siteArea.build({ siteID: testData.siteContext.getSite().id })
        );
        testData.createdSiteAreas.push(testData.newSiteArea);
        testData.testAsset = await testData.userService.createEntity(
          testData.userService.assetApi,
          Factory.asset.build({
            siteAreaID: testData.newSiteArea.id,
            assetType: 'PR'
          })
        );
        login(ContextDefinition.USER_CONTEXTS.BASIC_USER);
      });

      it('Should not be able to create a new site area', async () => {
        // Create the entity
        const response = await testData.userService.createEntity(
          testData.userService.siteAreaApi,
          Factory.siteArea.build({ siteID: testData.siteWithoutSiteAdmin.id }), false
        );
        expect(response.status).to.equal(StatusCodes.FORBIDDEN);
      });

      it(
        'Should be able to create a new site area if he is site admin',
        async () => {
          // Create the entity
          const response = await testData.userService.createEntity(
            testData.userService.siteAreaApi,
            Factory.siteArea.build({ siteID: testData.siteWithSiteAdmin.id }), false
          );
          expect(response.status).to.equal(StatusCodes.OK);
        }
      );

      it('Should not be able to update the site area', async () => {
        // Change entity
        testData.siteAreaWithoutSiteAdmin.name = 'New Name';
        // Update
        const response = await testData.userService.updateEntity(
          testData.userService.siteAreaApi,
          testData.siteAreaWithoutSiteAdmin, false
        );
        expect(response.status).to.equal(StatusCodes.NOT_FOUND);
      });

      it(
        'Should be able to update the site area if he is site admin',
        async () => {
          // Change entity
          testData.siteAreaWithSiteAdmin.name = 'New Name';
          // Update
          const response = await testData.userService.updateEntity(
            testData.userService.siteAreaApi,
            testData.siteAreaWithSiteAdmin, false
          );
          expect(response.status).to.equal(StatusCodes.OK);
        }
      );

      it('Should not be able to create a site area without a site', async () => {
        // Try to create the entity
        const response = await testData.userService.createEntity(
          testData.userService.siteAreaApi,
          Factory.siteArea.build(),
          false
        );
        expect(response.status).to.equal(StatusCodes.INTERNAL_SERVER_ERROR);
      });

      it(
        'Should not be able to read consumption without site Area ID',
        async () => {
          // Try to call Consumptions without Site Area ID
          const response = await testData.centralUserService.siteAreaApi.readConsumption(null,null,null);
          expect(response.status).to.equal(StatusCodes.BAD_REQUEST);
        }
      );

      it(
        'Should not be able to read consumption without start and end date',
        async () => {
          // Try to call Consumptions without start and end date
          const response = await testData.centralUserService.siteAreaApi.readConsumption(testData.siteAreaContext.getSiteArea().id, null, null);
          expect(response.status).to.equal(StatusCodes.BAD_REQUEST);
        }
      );

      it(
        'Should not be able to read consumption with end date before start date',
        async () => {
          // Try to call Consumptions with end date before start date
          const response = await testData.centralUserService.siteAreaApi.readConsumption(
            testData.siteAreaContext.getSiteArea().id, new Date(), new Date(new Date().getTime() - (24 * 60 * 60 * 1000)));
          expect(response.status).to.equal(StatusCodes.INTERNAL_SERVER_ERROR);
        }
      );

      it('Should not be able to assign ChargingStations to SiteArea', async () => {
        // Try to assign ChargingStation to SiteArea
        const chargingStations = await testData.userService.chargingStationApi.readAll({});
        expect(chargingStations.status).to.equal(StatusCodes.OK);
        const response = await testData.userService.siteAreaApi.assignChargingStations(
          testData.siteAreaWithoutSiteAdmin.id, [chargingStations.data.result[0].id]);
        expect(response.status).to.equal(StatusCodes.FORBIDDEN);
      });

      it(
        'Should not be able to remove ChargingStations from SiteArea',
        async () => {
          // Try to remove ChargingStation from SiteArea
          const chargingStations = await testData.userService.chargingStationApi.readAll({});
          expect(chargingStations.status).to.equal(StatusCodes.OK);
          const response = await testData.userService.siteAreaApi.removeChargingStations(
            testData.siteAreaWithoutSiteAdmin.id, [chargingStations.data.result[0].id]);
          expect(response.status).to.equal(StatusCodes.NOT_FOUND);
        }
      );

      it('Should not be able to assign Assets to SiteArea', async () => {
        const response = await testData.userService.siteAreaApi.assignAssets(
          testData.siteAreaWithoutSiteAdmin.id, [testData.testAsset.id]);
        expect(response.status).to.equal(StatusCodes.FORBIDDEN);
      });

      it('Should not be able to remove Assets from SiteArea', async () => {
        const response = await testData.userService.siteAreaApi.removeAssets(
          testData.siteAreaWithoutSiteAdmin.id, [testData.testAsset.id]);
        expect(response.status).to.equal(StatusCodes.NOT_FOUND);
      });

      it(
        'Should be able to remove ChargingStations from SiteArea if he is SiteAdmin',
        async () => {
          const chargingStations = await testData.userService.chargingStationApi.readAll({});
          expect(chargingStations.status).to.equal(StatusCodes.OK);
          // Remove ChargingStation from SiteArea
          const response = await testData.userService.siteAreaApi.removeChargingStations(
            testData.siteAreaWithSiteAdmin.id, [chargingStations.data.result[0].id]);
          expect(response.status).to.equal(StatusCodes.OK);
        }
      );

      it(
        'Should be able to remove Assets from SiteArea if he is SiteAdmin',
        async () => {
          const response = await testData.userService.siteAreaApi.removeAssets(
            testData.siteAreaWithSiteAdmin.id, [testData.testAsset.id]);
          expect(response.status).to.equal(StatusCodes.OK);
        }
      );

      it('Should not be able to delete the created site area', async () => {
        // Delete the created entity
        const response = await testData.userService.deleteEntity(
          testData.userService.siteAreaApi,
          testData.siteAreaWithoutSiteAdmin,
          false
        );
        expect(response.status).to.equal(StatusCodes.NOT_FOUND);
      });

      it(
        'Should be able to delete the created site area if he is site admin',
        async () => {
          // Delete the created entity
          const response = await testData.userService.deleteEntity(
            testData.userService.siteAreaApi,
            testData.siteAreaWithSiteAdmin,
            false
          );
          expect(response.status).to.equal(StatusCodes.OK);
        }
      );
    });

    describe('Sub Site Area Tests', () => {

      beforeAll(async () => {
        login(ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN);
        // Create the entity
        testData.newSiteArea = await testData.userService.createEntity(
          testData.userService.siteAreaApi,
          Factory.siteArea.build({ siteID: testData.siteContext.getSite().id })
        );
        testData.createdSiteAreas.push(testData.newSiteArea);
      });

      it('Should be able to create a new sub site area', async () => {
        const newSubSiteArea = Factory.siteArea.build({ siteID: testData.siteContext.getSite().id });
        newSubSiteArea.parentSiteAreaID = testData.newSiteArea.id;
        testData.newSubSiteArea = await testData.userService.createEntity(
          testData.userService.siteAreaApi, newSubSiteArea
        );
        testData.createdSiteAreas.push(testData.newSubSiteArea);
      });

      it('Should not be able to create a new sub site area with different smart charging enablement', async () => {
        const newSubSiteArea = Factory.siteArea.build({ siteID: testData.siteContext.getSite().id });
        newSubSiteArea.parentSiteAreaID = testData.newSiteArea.id;
        newSubSiteArea.smartCharging = true;
        const response = await testData.userService.createEntity(testData.userService.siteAreaApi, newSubSiteArea, false);
        expect(response.status).to.equal(HTTPError.SITE_AREA_TREE_ERROR_SMART_CHARGING);
      });

      it('Should be able to create a new sub site area for sub site area', async () => {
        const newSubSubSiteArea = Factory.siteArea.build({ siteID: testData.siteContext.getSite().id });
        newSubSubSiteArea.parentSiteAreaID = testData.newSubSiteArea.id;
        testData.newSubSubSiteArea = await testData.userService.createEntity(testData.userService.siteAreaApi, newSubSubSiteArea);
        testData.createdSiteAreas.push(testData.newSubSubSiteArea);
      });

      it('Should be able to update a sub site area of a sub site area', async () => {
        // Change entity
        testData.newSubSubSiteArea.name = 'New Name';
        // Update
        await testData.userService.updateEntity(
          testData.userService.siteAreaApi,
          testData.newSubSubSiteArea
        );
      });

      it('Should not be able to create circular structure in site area chain', async () => {
        // Change entity
        testData.newSiteArea.parentSiteAreaID = testData.newSubSubSiteArea.id;
        // Update
        const response = await testData.userService.updateEntity(
          testData.userService.siteAreaApi,
          testData.newSiteArea, false
        );
        expect(response.status).to.equal(HTTPError.SITE_AREA_TREE_ERROR);
      });

      it('Should not be able to set undefined parent', async () => {
        // Change entity
        testData.newSubSubSiteArea.parentSiteAreaID = '5ce249a2372f0b1c8caf6532';
        // Update
        const response = await testData.userService.updateEntity(
          testData.userService.siteAreaApi,
          testData.newSubSubSiteArea, false
        );
        expect(response.status).to.equal(StatusCodes.NOT_FOUND);
        const newSubSubSiteAreaResponse = testData.newSubSubSiteArea = await testData.userService.getEntityById(
          testData.userService.siteAreaApi,
          testData.newSubSubSiteArea, false
        );
        testData.newSubSubSiteArea = newSubSubSiteAreaResponse.data;
      });

      it('Should not be able to update number of phases in site area chain', async () => {
        // Change entity
        testData.newSubSubSiteArea.numberOfPhases = 1;
        // Update
        const response = await testData.userService.updateEntity(
          testData.userService.siteAreaApi,
          testData.newSubSubSiteArea, false
        );
        expect(response.status).to.equal(HTTPError.SITE_AREA_TREE_ERROR_SMART_NBR_PHASES);
        const newSubSubSiteAreaResponse = await testData.userService.getEntityById(
          testData.userService.siteAreaApi,
          testData.newSubSubSiteArea, false
        );
        testData.newSubSubSiteArea = newSubSubSiteAreaResponse.data;
      });

      it('Should not be able to update voltage in site area chain', async () => {
        // Change entity
        testData.newSubSubSiteArea.voltage = Voltage.VOLTAGE_110;
        // Update
        const response = await testData.userService.updateEntity(
          testData.userService.siteAreaApi,
          testData.newSubSubSiteArea, false
        );
        expect(response.status).to.equal(HTTPError.SITE_AREA_TREE_ERROR_VOLTAGE);
        const newSubSubSiteAreaResponse = await testData.userService.getEntityById(
          testData.userService.siteAreaApi,
          testData.newSubSubSiteArea, false
        );
        testData.newSubSubSiteArea = newSubSubSiteAreaResponse.data;
      });

      it('Should not be able to update site in the site area chain', async () => {
        // Change entity
        testData.newSubSubSiteArea.siteID = '5ce249a2372f0b1c8caf6532';
        // Update
        const response = await testData.userService.updateEntity(
          testData.userService.siteAreaApi,
          testData.newSubSubSiteArea, false
        );
        expect(response.status).to.equal(HTTPError.SITE_AREA_TREE_ERROR_SITE);
        const newSubSubSiteAreaResponse = await testData.userService.getEntityById(
          testData.userService.siteAreaApi,
          testData.newSubSubSiteArea, false
        );
        testData.newSubSubSiteArea = newSubSubSiteAreaResponse.data;
      });

      it('Should not be able to delete root site area, which still has children', async () => {
        // Delete the created entity
        const response = await testData.userService.deleteEntity(
          testData.userService.siteAreaApi,
          testData.newSiteArea, false
        );
        expect(response.status).to.equal(StatusCodes.OK);
      });

      it('Should be able to delete sub site area, which still has children', async () => {
        // Delete the created entity
        const response = await testData.userService.deleteEntity(
          testData.userService.siteAreaApi,
          testData.newSubSiteArea, false
        );
        expect(response.status).to.equal(StatusCodes.OK);
      });

      it('Should be able to delete sub site area, which do not have children', async () => {
        // Delete the created entity
        await testData.userService.deleteEntity(
          testData.userService.siteAreaApi,
          testData.newSubSubSiteArea
        );
      });
    });
  });
});
