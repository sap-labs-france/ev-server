import chai, { expect } from 'chai';

import Asset from '../../src/types/Asset';
import CentralServerService from './client/CentralServerService';
import Company from '../../src/types/Company';
import ContextDefinition from './context/ContextDefinition';
import ContextProvider from './context/ContextProvider';
import Factory from '../factories/Factory';
import { Setting } from '../../src/types/Setting';
import Site from '../../src/types/Site';
import SiteArea from '../../src/types/SiteArea';
import TenantContext from './context/TenantContext';
import chaiSubset from 'chai-subset';

chai.use(chaiSubset);

class TestData {
  public centralUserContext: any;
  public centralUserService: CentralServerService;
  public userContext: any;
  public tenantContext: TenantContext;
  public userService: CentralServerService;
  public newCompany: Company;
  public newSite: Site;
  public newSiteArea: SiteArea;
  public newAsset: Asset;
  public newAssetConnector: Setting;
  public createdCompanies: Company[] = [];
  public createdSites: Site[] = [];
  public createdSiteAreas: SiteArea[] = [];
  public createdAssets: Asset[] = [];
}

const testData: TestData = new TestData();

describe('AssetIntegration', function() {
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
      // Create a new Asset
      testData.newAsset = await testData.userService.createEntity(
        testData.userService.assetApi,
        Factory.asset.build({
          siteAreaID: testData.newSiteArea.id,
          assetType: 'CO-PR'
        })
      );
      testData.createdAssets.push(testData.newAsset);
      expect(testData.newAsset).to.not.be.null;
      // Create a IoThink connection object in settings
      const ioThinkAssetConnectorId = 100;
      testData.newAssetConnector = await testData.userService.createEntity(
        testData.userService.settingApi,
        Factory.setting.build({
          identifier: 'asset',
          content: {
            type: 'asset',
            asset: {
              connections: [{
                id: ioThinkAssetConnectorId,
                name: 'ioThink Asset Connector',
                description: 'IoThink Asset Connector',
                url: 'https://api.kheiron-sp.io',
                type: 'iothink',
                refreshIntervalMins: 1,
              }]
            }
          }
        })
      );
    });

    // Should be able to fetch values from IoThink asset

    // Should be able to fetch values form Wit asset

  });
});
