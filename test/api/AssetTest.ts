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
  public newSite: any;
  public createdSites: any[] = [];
  public newSiteArea: any;
  public createdSiteAreas: any[] = [];
  public newAsset: any;
  public createdAssets: any[] = [];
}

const testData: TestData = new TestData();

describe('Asset Test', function() {
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

  describe('With component Asset (tenant utasset)', () => {

    before(async () => {
      testData.tenantContext = await ContextProvider.defaultInstance.getTenantContext(ContextDefinition.TENANT_CONTEXTS.TENANT_ASSET);
      testData.centralUserContext = testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN);
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
      // Delete any created asset
      testData.createdAssets.forEach(async (asset) => {
        await testData.centralUserService.deleteEntity(
          testData.centralUserService.assetApi,
          asset,
          false
        );
      });
      testData.createdAssets = [];
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

      it('Should be able to create a new Asset', async () => {
        // Create
        testData.newAsset = await testData.userService.createEntity(
          testData.userService.assetApi,
          Factory.asset.build({
            siteAreaID: testData.createdSiteAreas[0].id,
            assetType: 'PR'
          })
        );
        testData.createdAssets.push(testData.newAsset);
      });

      it('Should find the created asset by id', async () => {
        // Check if the created entity can be retrieved with its id
        await testData.userService.getEntityById(
          testData.userService.assetApi,
          testData.newAsset
        );
      });

      it('Should find the created asset in the asset list', async () => {
        // Check if the created entity is in the list
        await testData.userService.checkEntityInList(
          testData.userService.assetApi,
          testData.newAsset
        );
      });

      it('Should be able to update the asset', async () => {
        // Change entity
        testData.newAsset.name = 'New Name';
        // Update
        await testData.userService.updateEntity(
          testData.userService.assetApi,
          testData.newAsset
        );
      });

      it('Should find the updated asset by id', async () => {
        // Check if the updated entity can be retrieved with its id
        const updatedAsset = await testData.userService.getEntityById(
          testData.userService.assetApi,
          testData.newAsset
        );
        expect(updatedAsset.name).to.equal(testData.newAsset.name);
      });

      it('Should be able to delete the created asset', async () => {
        // Delete the created entity
        await testData.userService.deleteEntity(
          testData.userService.assetApi,
          testData.newAsset
        );
      });

      it('Should not find the deleted asset with its id', async () => {
        // Check if the deleted entity cannot be retrieved with its id
        await testData.centralUserService.checkDeletedEntityById(
          testData.userService.assetApi,
          testData.newAsset
        );
      });
    });
  });
});

