import chai, { expect } from 'chai';
import chaiSubset from 'chai-subset';
import path from 'path';
import Factory from '../factories/Factory';
import CentralServerService from '../api/client/CentralServerService';
 import global from'../../src/types/GlobalType';

global.appRoot = path.resolve(__dirname, '../../src');

chai.use(chaiSubset);

class TestData {
  public newCompany: any;
  public newSite: any;
  public newSiteArea: any;
  public newUser: any;
}

const testData: TestData = new TestData();

describe('Site tests', function() {
  this.timeout(30000);

  describe('Success cases', () => {
    before(async () => {
      // Create the Company
      testData.newCompany = await CentralServerService.DefaultInstance.createEntity(
        CentralServerService.DefaultInstance.companyApi, Factory.company.build());
      expect(testData.newCompany).to.not.be.null;
      // Create User
      testData.newUser = await CentralServerService.DefaultInstance.createEntity(
        CentralServerService.DefaultInstance.userApi, Factory.user.build());
        expect(testData.newUser).to.not.be.null;
    });

    after(async () => {
      // Delete the Company
      await CentralServerService.DefaultInstance.deleteEntity(
        CentralServerService.DefaultInstance.companyApi, testData.newCompany);
      // Delete User
      await CentralServerService.DefaultInstance.deleteEntity(
        CentralServerService.DefaultInstance.userApi, testData.newUser);
    });

    it('Should create a new site', async () => {
      // Check
      expect(testData.newCompany).to.not.be.null;
      // Create the entity
      testData.newSite = await CentralServerService.DefaultInstance.createEntity(
        CentralServerService.DefaultInstance.siteApi, Factory.site.build(
          { companyID: testData.newCompany.id }));
    });

    it('Should find the created site by id', async () => {
      // Check if the created entity can be retrieved with its id
      await CentralServerService.DefaultInstance.getEntityById(
        CentralServerService.DefaultInstance.siteApi, testData.newSite);
    });

    it('Should find the created site in the site list', async () => {
      // Check if the created entity is in the list
      await CentralServerService.DefaultInstance.checkEntityInList(
        CentralServerService.DefaultInstance.siteApi, testData.newSite);
    });

    it('Should update the site', async () => {
      // Change entity
      testData.newSite.name = 'New Name';
      // Update
      await CentralServerService.DefaultInstance.updateEntity(
        CentralServerService.DefaultInstance.siteApi, testData.newSite);
    });

    it('Should find the updated site by id', async () => {
      // Check if the updated entity can be retrieved with its id
      const updatedSite = await CentralServerService.DefaultInstance.getEntityById(
        CentralServerService.DefaultInstance.siteApi, testData.newSite);
      // Check
      expect(updatedSite.name).to.equal(testData.newSite.name);
    });

    it('Should delete the created site', async () => {
      // Delete the created entity
      await CentralServerService.DefaultInstance.deleteEntity(
        CentralServerService.DefaultInstance.siteApi, testData.newSite);
    });

    it('Should not find the deleted site with its id', async () => {
      // Check if the deleted entity cannot be retrieved with its id
      await CentralServerService.DefaultInstance.checkDeletedEntityById(
        CentralServerService.DefaultInstance.siteApi, testData.newSite);
    });
  });

  describe('Error cases', () => {
    it('Should not create a site area without a site', async () => {
      // Create the entity
      const response = await CentralServerService.DefaultInstance.createEntity(
        CentralServerService.DefaultInstance.siteApi, Factory.site.build(), false);
      expect(response.status).to.equal(500);
    });
  });
});
