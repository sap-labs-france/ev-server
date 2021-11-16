import chai, { expect } from 'chai';

import Asset from '../../src/types/Asset';
import CentralServerService from './client/CentralServerService';
import Company from '../../src/types/Company';
import ContextDefinition from './context/ContextDefinition';
import ContextProvider from './context/ContextProvider';
import Factory from '../factories/Factory';
import Site from '../../src/types/Site';
import SiteArea from '../../src/types/SiteArea';
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
  public newCompany: Company;
  public createdCompanies: Company[] = [];
  public newSite: Site;
  public createdSites: Site[] = [];
  public newSiteArea: SiteArea;
  public createdSiteAreas: SiteArea[] = [];
  public newAsset: Asset;
  public createdAssets: Asset[] = [];
}

const testData: TestData = new TestData();

describe('Asset', function() {
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

  describe('With component Asset (utasset)', () => {

    before(async () => {
      testData.tenantContext = await ContextProvider.defaultInstance.getTenantContext(ContextDefinition.TENANT_CONTEXTS.TENANT_ASSET);
      testData.centralUserContext = testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN);
      expect(testData.centralUserContext).to.not.be.null;
      testData.centralUserService = new CentralServerService(
        testData.tenantContext.getTenant().subdomain,
        testData.centralUserContext
      );
      testData.userService = testData.centralUserService;
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

    after(async () => {
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
      // Delete any created asset
      for (const asset of testData.createdAssets) {
        await testData.centralUserService.deleteEntity(
          testData.centralUserService.assetApi,
          asset,
          false
        );
      }
      testData.createdAssets = [];
    });

    describe('Where admin user', () => {

      before(() => {
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
        const createdAsset = await testData.userService.getEntityById(
          testData.userService.assetApi,
          testData.newAsset
        );
        expect(createdAsset.issuer).to.equal(true);
        expect(createdAsset.siteID).to.equal(testData.createdSiteAreas[0].siteID);
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

      it('Should be able to find assets in error', async () => {
        // Create a new Site Area
        const newSiteArea = await testData.userService.createEntity(
          testData.userService.siteAreaApi,
          Factory.siteArea.build({
            siteID: testData.newSite.id
          })
        );
        testData.createdSiteAreas.push(newSiteArea);
        expect(newSiteArea).to.not.be.null;

        // Create a new asset
        const newAsset = await testData.userService.createEntity(
          testData.userService.assetApi,
          Factory.asset.build({
            siteAreaID: newSiteArea.id,
            assetType: 'PR'
          })
        );
        testData.createdAssets.push(newAsset);

        // Delete the site area
        await testData.userService.deleteEntity(
          testData.userService.siteAreaApi,
          newSiteArea
        );

        // Read all in error
        const response = await testData.userService.assetApi.readAllInError({ });
        expect(response.status).to.be.eq(StatusCodes.OK);
        expect(response.data.count).to.be.eq(1);
      });
    });

    describe('Where basic user', () => {
      before(async () => {
        const adminContext = testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN);
        const basicUserContext = testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.BASIC_USER);
        if (adminContext === testData.centralUserContext) {
          // Reuse the central user service (to avoid double login)
          testData.userService = testData.centralUserService;
        } else {
          testData.userService = new CentralServerService(
            testData.tenantContext.getTenant().subdomain,
            adminContext
          );
        }
        // Create a new Asset
        testData.newAsset = await testData.userService.createEntity(
          testData.userService.assetApi,
          Factory.asset.build({
            siteAreaID: testData.createdSiteAreas[0].id,
            assetType: 'PR'
          })
        );
        testData.createdAssets.push(testData.newAsset);
        expect(testData.newAsset).to.not.be.null;
        // Assign basic user to site
        let response = await testData.userService.siteApi.addUsersToSite(testData.newSite.id, [basicUserContext.id]);
        expect(response.status).to.be.eq(StatusCodes.OK);
        response = await testData.userService.siteApi.assignSiteAdmin(testData.newSite.id, basicUserContext.id);
        expect(response.status).to.be.eq(StatusCodes.OK);
        // Login as basic user
        testData.userContext = basicUserContext;
        testData.userService = new CentralServerService(
          testData.tenantContext.getTenant().subdomain,
          testData.userContext
        );
      });

      // Should not be able to create an asset
      it('Should not be able to create an asset', async () => {
        const newAssetToCreateResponse = await testData.userService.createEntity(
          testData.userService.assetApi,
          Factory.asset.build({
            siteAreaID: testData.createdSiteAreas[0].id,
            assetType: 'CO'
          }),
          false
        );
        expect(newAssetToCreateResponse.status).to.equal(StatusCodes.FORBIDDEN);
      });

      // Should not be able to update an asset
      it('Should not be able to update an asset', async () => {
        testData.newAsset.name = 'New Name';
        const assetToUpdateResponse = await testData.userService.updateEntity(
          testData.userService.assetApi,
          testData.newAsset,
          false
        );
        expect(assetToUpdateResponse.status).to.equal(StatusCodes.FORBIDDEN);
      });

      // Should not be able to delete an asset
      it('Should not be able to delete an asset', async () => {
        const assetToDeleteResponse = await testData.userService.deleteEntity(
          testData.userService.assetApi,
          testData.newAsset,
          false
        );
        expect(assetToDeleteResponse.status).to.equal(StatusCodes.FORBIDDEN);
      });

      // Should be able to view the assets
      it('Should be able to view existing assets of sites user is admin of', async () => {
        // Check if the created entity is in the list
        await testData.userService.checkEntityInList(
          testData.userService.assetApi,
          testData.newAsset
        );
      });
    });
  });
});

