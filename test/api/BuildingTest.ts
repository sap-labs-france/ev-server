import chai, { expect } from 'chai';
import chaiSubset from 'chai-subset';
import CentralServerService from './client/CentralServerService';
import CONTEXTS from './contextProvider/ContextConstants';
import ContextProvider from './contextProvider/ContextProvider';
import TenantContext from './contextProvider/TenantContext';
import Factory from '../factories/Factory';

chai.use(chaiSubset);

class TestData {
  public tenantContext: TenantContext;
  public centralUserContext: any;
  public centralUserService: CentralServerService;
  public userContext: any;
  public userService: CentralServerService;
  public newCompany: any;
  public createdCompanies: any[] = [];
  public newSite: any;
  public createdSites: any[] = [];
  public newSiteArea: any;
  public createdSiteAreas: any[] = [];
  public newBuilding: any;
  public createdBuildings: any[] = [];
}

const testData: TestData = new TestData();

describe('Building Test', function() {
  this.timeout(1000000); // Will automatically stop the unit test after that period of time

  before(async () => {
    chai.config.includeStack = true;
    await ContextProvider.DefaultInstance.prepareContexts();
  });

  afterEach(() => {
    // Can be called after each UT to clean up created data
  });

  after(async () => {
    // Final clean up at the end
    await ContextProvider.DefaultInstance.cleanUpCreatedContent();
  });

  describe('With component Building (tenant ut-building)', () => {

    before(async () => {
      testData.tenantContext = await ContextProvider.DefaultInstance.getTenantContext(CONTEXTS.TENANT_CONTEXTS.TENANT_BUILDING);
      testData.centralUserContext = testData.tenantContext.getUserContext(CONTEXTS.USER_CONTEXTS.DEFAULT_ADMIN);
      expect(testData.centralUserContext).to.not.be.null;
      testData.centralUserService = new CentralServerService(
        testData.tenantContext.getTenant().subdomain,
        testData.centralUserContext
      );
    });

    after(async () => {
      // Delete any created company
      testData.createdCompanies.forEach(async (company) => {
        await testData.centralUserService.deleteEntity(
          testData.centralUserService.companyApi,
          company,
          false
        );
      });
      testData.createdCompanies = [];
      // Delete any created site
      testData.createdSites.forEach(async (site) => {
        await testData.centralUserService.deleteEntity(
          testData.centralUserService.siteApi,
          site,
          false
        );
      });
      testData.createdSites = [];
      // Delete any created site area
      testData.createdSiteAreas.forEach(async (siteArea) => {
        await testData.centralUserService.deleteEntity(
          testData.centralUserService.siteAreaApi,
          siteArea,
          false
        );
      });
      testData.createdSiteAreas = [];
      // Delete any created building
      testData.createdBuildings.forEach(async (building) => {
        await testData.centralUserService.deleteEntity(
          testData.centralUserService.buildingApi,
          building,
          false
        );
      });
      testData.createdBuildings = [];
    });

    describe('Where admin user', () => {

      before(async () => {
        testData.userContext = testData.tenantContext.getUserContext(CONTEXTS.USER_CONTEXTS.DEFAULT_ADMIN);
        if (testData.userContext === testData.centralUserContext) {
          // Reuse the central user service (to avoid double login)
          testData.userService = testData.centralUserService;
        } else {
          testData.userService = new CentralServerService(
            testData.tenantContext.getTenant().subdomain,
            testData.userContext
          );
        }
        // Create a new Company
        testData.newCompany = await testData.userService.createEntity(
          testData.userService.companyApi,
          Factory.company.build()
        );
        testData.createdCompanies.push(testData.newCompany);
        // Check
        expect(testData.newCompany).to.not.be.null;
        // Create a new Site
        testData.newSite = await testData.userService.createEntity(
          testData.userService.siteApi,
          Factory.site.build({
            companyID: testData.newCompany.id
          })
        );
        testData.createdSites.push(testData.newSite);
        // Check
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

      it('Should be able to create a new Building', async () => {
        // Create
        testData.newBuilding = await testData.userService.createEntity(
          testData.userService.buildingApi,
          Factory.building.build({ siteAreaID: testData.createdSiteAreas[0].id })
        );
        testData.createdBuildings.push(testData.newBuilding);
      });

      it('Should find the created building by id', async () => {
        // Check if the created entity can be retrieved with its id
        await testData.userService.getEntityById(
          testData.userService.buildingApi,
          testData.newBuilding
        );
      });

      it('Should find the created building in the building list', async () => {
        // Check if the created entity is in the list
        await testData.userService.checkEntityInList(
          testData.userService.buildingApi,
          testData.newBuilding
        );
      });

      it('Should be able to update the building', async () => {
        // Change entity
        testData.newBuilding.name = 'New Name';
        // Update
        await testData.userService.updateEntity(
          testData.userService.buildingApi,
          testData.newBuilding
        );
      });

      it('Should find the updated building by id', async () => {
        // Check if the updated entity can be retrieved with its id
        const updatedBuilding = await testData.userService.getEntityById(
          testData.userService.buildingApi,
          testData.newBuilding
        );
        expect(updatedBuilding.name).to.equal(testData.newBuilding.name);
      });

      it('Should be able to delete the created building', async () => {
        // Delete the created entity
        await testData.userService.deleteEntity(
          testData.userService.buildingApi,
          testData.newBuilding
        );
      });

      it('Should not find the deleted building with its id', async () => {
        // Check if the deleted entity cannot be retrieved with its id
        await testData.centralUserService.checkDeletedEntityById(
          testData.userService.buildingApi,
          testData.newBuilding
        );
      });
    });
  });
});

