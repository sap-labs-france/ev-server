import path from 'path';
import TSGlobal from '../../src/types/GlobalType';
declare const global: TSGlobal;
global.appRoot = path.resolve(__dirname, '../../src');
import CentralServerService from './client/CentralServerService';
import Factory from '../factories/Factory';
import chai, {expect} from 'chai';
import chaiSubset from 'chai-subset';

chai.use(chaiSubset);

class TestData {
  newCompany: any;
  newSite: any;
  newSiteArea: any;
}

const testData = new TestData();

describe('Company, Site, Site Area tests', function() {
  this.timeout(30000);

  describe('Success cases', function() {
    beforeEach(async () => {
      // Create the Company
      testData.newCompany = await CentralServerService.DefaultInstance.createEntity(
        CentralServerService.DefaultInstance.companyApi, Factory.company.build());
      // Check
      expect(testData.newCompany).to.not.be.null;
      // Create the Site
      testData.newSite = await CentralServerService.DefaultInstance.createEntity(
        CentralServerService.DefaultInstance.siteApi, Factory.site.build({
          companyID: testData.newCompany.id
        }));
      // Check
      expect(testData.newSite).to.not.be.null;
      // Create the entity
      testData.newSiteArea = await CentralServerService.DefaultInstance.createEntity(
        CentralServerService.DefaultInstance.siteAreaApi, Factory.siteArea.build({
          siteID: testData.newSite.id
        }));
      expect(testData.newSiteArea).to.not.be.null;
    });

    afterEach(async () => {
      // Delete the Site Area
      await CentralServerService.DefaultInstance.deleteEntity(
        CentralServerService.DefaultInstance.siteAreaApi, testData.newSiteArea, false);
      // Delete the Site
      await CentralServerService.DefaultInstance.deleteEntity(
        CentralServerService.DefaultInstance.siteApi, testData.newSite, false);
      // Delete the Company
      await CentralServerService.DefaultInstance.deleteEntity(
        CentralServerService.DefaultInstance.companyApi, testData.newCompany, false);
    });

    it('Should delete site which will delete the site area', async () => {
      // Delete the Site
      await CentralServerService.DefaultInstance.deleteEntity(
        CentralServerService.DefaultInstance.siteApi, testData.newSite);
      // Check Site does not exist
      await CentralServerService.DefaultInstance.checkDeletedEntityById(
        CentralServerService.DefaultInstance.siteApi, testData.newSite);
      // Check Site Area does not exist
      await CentralServerService.DefaultInstance.checkDeletedEntityById(
        CentralServerService.DefaultInstance.siteAreaApi, testData.newSiteArea);
    });

    it('Should delete company which will delete the site area and the site area', async () => {
      // Delete the Site
      await CentralServerService.DefaultInstance.deleteEntity(
        CentralServerService.DefaultInstance.companyApi, testData.newCompany);
      // Check Company does not exist
      await CentralServerService.DefaultInstance.checkDeletedEntityById(
        CentralServerService.DefaultInstance.companyApi, testData.newCompany);
      // Check Site does not exist
      await CentralServerService.DefaultInstance.checkDeletedEntityById(
        CentralServerService.DefaultInstance.siteApi, testData.newSite);
      // Check Site Area does not exist
      await CentralServerService.DefaultInstance.checkDeletedEntityById(
        CentralServerService.DefaultInstance.siteAreaApi, testData.newSiteArea);
    });
  });
});
