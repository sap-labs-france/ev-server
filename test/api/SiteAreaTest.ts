import chai from 'chai';
import {expect} from 'chai';
import chaiSubset from 'chai-subset';
chai.use(chaiSubset);
const path = require('path');
import TSGlobal from '../../src/types/GlobalType';
declare const global: TSGlobal;
global.appRoot = path.resolve(__dirname, '../../src');
import CentralServerService from './client/CentralServerService';
import Factory from '../factories/Factory';

class TestData {
  public newCompany: any;
  public newSite: any;
  public newSiteArea: any;
}

const testData: TestData = new TestData();

describe('Site Area tests 2', function() {
  this.timeout(30000);

  describe('Success cases', () => {
    before(async () => {
      // Create the Company
      testData.newCompany = await CentralServerService.DefaultInstance.createEntity(
        CentralServerService.DefaultInstance.companyApi, Factory.company.build());
      // Check
      expect(testData.newCompany).to.not.be.null;
      // Create the Site
      testData.newSite = await CentralServerService.DefaultInstance.createEntity(
        CentralServerService.DefaultInstance.siteApi, Factory.site.build({ companyID: testData.newCompany.id }));
      // Check
      expect(testData.newSite).to.not.be.null;
    });
  
    after(async () => {
      // Delete the Site
      await CentralServerService.DefaultInstance.deleteEntity(
        CentralServerService.DefaultInstance.siteApi, testData.newSite);
      // Delete the Company
      await CentralServerService.DefaultInstance.deleteEntity(
        CentralServerService.DefaultInstance.companyApi, testData.newCompany);
    });
    
    it('Should create a new site area', async () => {
      // Check
      expect(testData.newSite).to.not.be.null;
      // Create the entity
      testData.newSiteArea = await CentralServerService.DefaultInstance.createEntity(
        CentralServerService.DefaultInstance.siteAreaApi, Factory.siteArea.build({ siteID: testData.newSite.id }));
    });

    it('Should find the created site area by id', async () => {
      // Check if the created entity can be retrieved with its id
      await CentralServerService.DefaultInstance.getEntityById(
        CentralServerService.DefaultInstance.siteAreaApi, testData.newSiteArea);
    });

    it('Should find the created site area in the site list', async () => {
      // Check if the created entity is in the list
      await CentralServerService.DefaultInstance.checkEntityInList(
        CentralServerService.DefaultInstance.siteAreaApi, testData.newSiteArea);
    });

    it('Should update the site area', async () => {
      // Change entity
      testData.newSiteArea.name = "New Name";
      // Update
      await CentralServerService.DefaultInstance.updateEntity(
        CentralServerService.DefaultInstance.siteAreaApi, testData.newSiteArea);
    });

    it('Should find the updated site area by id', async () => {
      // Check if the updated entity can be retrieved with its id
      let updatedSiteArea = await CentralServerService.DefaultInstance.getEntityById(
        CentralServerService.DefaultInstance.siteAreaApi, testData.newSiteArea);
      // Check
      expect(updatedSiteArea.name).to.equal(testData.newSiteArea.name);
    });

    it('Should delete the created site area', async () => {
      // Delete the created entity
      await CentralServerService.DefaultInstance.deleteEntity(
        CentralServerService.DefaultInstance.siteAreaApi, testData.newSiteArea);
    });

    it('Should not find the deleted site area with its id', async () => {
      // Check if the deleted entity cannot be retrieved with its id
      await CentralServerService.DefaultInstance.checkDeletedEntityById(
        CentralServerService.DefaultInstance.siteAreaApi, testData.newSiteArea);
    });
  });

  describe('Error cases', () => {
    it('Should not create a site area without a site', async () => {
      // Create the entity
      let response = await CentralServerService.DefaultInstance.createEntity(
        CentralServerService.DefaultInstance.siteAreaApi, Factory.siteArea.build(), false);
      expect(response.status).to.equal(500);
    });
  });
});
