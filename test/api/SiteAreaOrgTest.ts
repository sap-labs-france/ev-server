import chai, { expect } from 'chai';

import CentralServerService from '../api/client/CentralServerService';
import ContextDefinition from './context/ContextDefinition';
import ContextProvider from './context/ContextProvider';
import Factory from '../factories/Factory';
import SiteAreaContext from './context/SiteAreaContext';
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
  public siteAreaContext: SiteAreaContext;
  public newSiteArea: any;
  public newUser: any;
  public createdSiteAreas: any[] = [];
  public createdUsers: any[] = [];
}

const testData: TestData = new TestData();

describe('Site Area tests', function() {
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
      testData.siteContext = testData.tenantContext.getSiteContext(ContextDefinition.SITE_CONTEXTS.SITE_BASIC);
      testData.siteAreaContext = testData.siteContext.getSiteAreaContext(ContextDefinition.SITE_AREA_CONTEXTS.WITH_ACL);
    });

    after(async () => {
      // Delete any created site area
      testData.createdSiteAreas.forEach(async (siteArea) => {
        await testData.centralUserService.deleteEntity(
          testData.centralUserService.siteAreaApi,
          siteArea,
          false
        );
      });
      testData.createdSiteAreas = [];
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
        // Check
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
        expect(response.status).to.equal(500);
      });

      it('Should not be able to read consumption without site Area ID', async () => {
        // Try to call Consumptions without Site Area ID
        const response = await testData.centralUserService.siteAreaApi.readConsumption(null,null,null);
        expect(response.status).to.equal(500);
        expect(response.data.message).to.equal('The ID must be provided');
      });

      it('Should not be able to read consumption without start and end date', async () => {
        // Try to call Consumptions without start and end date
        const response = await testData.centralUserService.siteAreaApi.readConsumption(testData.siteAreaContext.getSiteArea().id, null, null);
        expect(response.status).to.equal(500);
        expect(response.data.message).to.equal('Start date and end date must be provided');
      });

      it('Should not be able to read consumption with end date before start date', async () => {
        // Try to call Consumptions with end date before start date
        const response = await testData.centralUserService.siteAreaApi.readConsumption(testData.siteAreaContext.getSiteArea().id, new Date(), new Date(new Date().getTime() - (24 * 60 * 60 * 1000)));
        expect(response.status).to.equal(500);
      });

    });
    describe('Where basic user', () => {

      before(async () => {
        // Create the entity
        testData.newSiteArea = await testData.userService.createEntity(
          testData.userService.siteAreaApi,
          Factory.siteArea.build({ siteID: testData.siteContext.getSite().id })
        );
        testData.userContext = testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.BASIC_USER);
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

      it('Should not be able to create a new site area', async () => {
        // Create the entity
        const response = await testData.userService.createEntity(
          testData.userService.siteAreaApi,
          Factory.siteArea.build({ siteID: testData.siteContext.getSite().id }), false
        );
        expect(response.status).to.equal(560);
      });

      it('Should not be able to update the site area', async () => {
        // Change entity
        testData.newSiteArea.name = 'New Name';
        // Update
        const response = await testData.userService.updateEntity(
          testData.userService.siteAreaApi,
          testData.newSiteArea, false
        );
        expect(response.status).to.equal(560);
      });

      it('Should not be able to delete the created site area', async () => {
        // Delete the created entity
        const response = await testData.userService.deleteEntity(
          testData.userService.siteAreaApi,
          testData.newSiteArea,
          false
        );
        expect(response.status).to.equal(560);
      });

      it('Should not be able to create a site area without a site', async () => {
        // Try to create the entity
        const response = await testData.userService.createEntity(
          testData.userService.siteAreaApi,
          Factory.siteArea.build(),
          false
        );
        expect(response.status).to.equal(500);
      });

      it('Should not be able to read consumption without site Area ID', async () => {
        // Try to call Consumptions without Site Area ID
        const response = await testData.centralUserService.siteAreaApi.readConsumption(null,null,null);
        expect(response.status).to.equal(500);
        expect(response.data.message).to.equal('The ID must be provided');
      });

      it('Should not be able to read consumption without start and end date', async () => {
        // Try to call Consumptions without start and end date
        const response = await testData.centralUserService.siteAreaApi.readConsumption(testData.siteAreaContext.getSiteArea().id, null, null);
        expect(response.status).to.equal(500);
        expect(response.data.message).to.equal('Start date and end date must be provided');
      });

      it('Should not be able to read consumption with end date before start date', async () => {
        // Try to call Consumptions with end date before start date
        const response = await testData.centralUserService.siteAreaApi.readConsumption(testData.siteAreaContext.getSiteArea().id, new Date(), new Date(new Date().getTime() - (24 * 60 * 60 * 1000)));
        expect(response.status).to.equal(500);
      });

    });

  });

});
