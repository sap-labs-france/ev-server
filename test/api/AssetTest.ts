import { AssetConnectionType, AssetSettingsType, SettingDB } from '../../src/types/Setting';
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
import { TenantComponents } from '../../src/types/Tenant';
import TenantContext from './context/TenantContext';
import chaiSubset from 'chai-subset';
import config from '../config';

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
  public ioThinkAssetConnectorID: string;
  public pending: boolean;
  public settings: SettingDB;
}

const testData: TestData = new TestData();
// Conditional test execution function
const describeif = (condition) => condition ? describe : describe.skip;
// Check if ioThink asset connector parameters are set
const ioThinkConfigProvided = config.get('assetConnectors.ioThink.user') && config.get('assetConnectors.ioThink.password') && config.get('assetConnectors.ioThink.meterID');

const createOrUpdateSettings = async (settingID: string, url: string, user: string, password: string): Promise<SettingDB> => {
  const settings = await testData.centralUserService.settingApi.readAll({});
  let newSetting = false;
  let setting: SettingDB = settings.data.result.find((s: SettingDB) => s.identifier === TenantComponents.ASSET);
  if (!setting) {
    setting = {} as SettingDB;
    setting.identifier = TenantComponents.ASSET;
    newSetting = true;
  }
  setting.content = {
    type: AssetSettingsType.ASSET,
    asset: {
      connections: [{
        id: settingID,
        name: 'Testing IoThink Asset Connector',
        description: 'Testing IoThink Asset Connector',
        url: url,
        timestamp: (new Date()),
        type: AssetConnectionType.IOTHINK,
        refreshIntervalMins: 1,
        iothinkConnection: {
          user: user,
          password: password
        }
      }]
    }
  };
  setting.sensitiveData = ['content.asset.connections[0].iothinkConnection.password'];
  if (newSetting) {
    await testData.centralUserService.settingApi.create(setting);
  } else {
    await testData.centralUserService.settingApi.update(setting);
  }
  const settingsUpdated = await testData.centralUserService.settingApi.readAll({});
  const settingUpdated: SettingDB = settingsUpdated.data.result.find((s) => s.identifier === TenantComponents.ASSET);
  return settingUpdated;
};

const deleteAssetConnectorSettings = async (setting: SettingDB) => {
  if (setting) {
    setting.content.asset.connections = [];
    await testData.centralUserService.settingApi.update(setting);
  }
};

describe('Asset', () => {
  jest.setTimeout(1000000); // Will automatically stop the unit test after that period of time

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

  describe('With component Asset (utasset)', () => {

    beforeAll(async () => {
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

      beforeAll(() => {
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
      beforeAll(async () => {
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
      it(
        'Should be able to view existing assets of sites user is admin of',
        async () => {
          // Check if the created entity is in the list
          await testData.userService.checkEntityInList(
            testData.userService.assetApi,
            testData.newAsset
          );
        }
      );
    });

    describeif(ioThinkConfigProvided)('IoThink Asset Connector tests', () => {
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
        // Create a new Asset
        testData.newAsset = await testData.userService.createEntity(
          testData.userService.assetApi,
          Factory.asset.build({
            siteAreaID: testData.newSiteArea.id,
            assetType: 'PR',
          })
        );
        testData.createdAssets.push(testData.newAsset);
        expect(testData.newAsset).to.not.be.null;
      });

      it('Should be able to create an ioThink asset connector', async () => {
          const settingID = '0123456789abcdef';
          const url = config.get('assetConnectors.ioThink.url');
          const user = config.get('assetConnectors.ioThink.user');
          const password = config.get('assetConnectors.ioThink.password');
          testData.settings = await createOrUpdateSettings(settingID, url, user, password);
          expect(testData.settings.content.asset.connections[0].id).to.be.eq(settingID);
          testData.ioThinkAssetConnectorID = settingID;
        });

      it(
        'Should be able to connect ioThink asset connector connection',
        async () => {
          const response = await testData.centralUserService.assetApi.checkAssetConnectorLink(testData.ioThinkAssetConnectorID);
          expect(response.data?.status).to.be.eq('Success');
          expect(response.data?.connectionIsValid).to.be.eq(true);
        }
      );

      it(
        'Should be able to connect existing asset to asset connector',
        async () => {
          // Change entity
          testData.newAsset.dynamicAsset = true;
          testData.newAsset.meterID = config.get('assetConnectors.ioThink.meterID');
          testData.newAsset.connectionID = testData.ioThinkAssetConnectorID;
          // Update
          await testData.userService.updateEntity(
            testData.userService.assetApi,
            testData.newAsset
          );
        }
      );

      it('Should be able to retrieve latest consumption', async () => {
          const response = await testData.centralUserService.assetApi.retrieveLatestConsumption(testData.newAsset.id);
          expect(response.data?.status).to.be.eq('Success');
        });

      it(
        'Should not be able to retrieve latest consumption with incorrect credentials',
        async () => {
          // Change entity
          const settingID = '0123456789abcdef';
          const url = config.get('assetConnectors.ioThink.url');
          const user = 'WrongUser';
          const password = 'WrongPassword';
          testData.settings = await createOrUpdateSettings(settingID, url, user, password);
          expect(testData.settings.content.asset.connections[0].id).to.be.eq(settingID);
          const response = await testData.centralUserService.assetApi.retrieveLatestConsumption(testData.newAsset.id);
          expect(response.status).to.be.eq(StatusCodes.INTERNAL_SERVER_ERROR);
        }
      );

      afterAll(async () => {
        await deleteAssetConnectorSettings(testData.settings);
      });
    });
  });
});
