const path = require('path');
global.appRoot = path.resolve(__dirname, '../../src');
const {expect} = require('chai');
const CentralServerService = require('./client/CentralServerService');
const Factory = require('../factories/Factory');

describe('Site tests', function () {
  this.timeout(30000);

  describe('Success cases', () => {
    before(async () => {
      // Create the Company
      this.newCompany = await CentralServerService.createEntity(
        CentralServerService.companyApi, Factory.company.build());
      expect(this.newCompany).to.not.be.null;
      // Create User
      this.newUser = await CentralServerService.createEntity(
        CentralServerService.userApi, Factory.user.build());
      expect(this.newUser).to.not.be.null;
    });

    after(async () => {
      // Delete the Company
      await CentralServerService.deleteEntity(
        CentralServerService.companyApi, this.newCompany);
      // Delete User
      await CentralServerService.deleteEntity(
        CentralServerService.userApi, this.newUser);
    });

    it('Should create a new site', async () => {
      // Check
      expect(this.newCompany).to.not.be.null;
      // Create the entity
      this.newSite = await CentralServerService.createEntity(
        CentralServerService.siteApi, Factory.site.build(
          { companyID: this.newCompany.id }));
    });

    it('Should find the created site by id', async () => {
      // Check if the created entity can be retrieved with its id
      await CentralServerService.getEntityById(
        CentralServerService.siteApi, this.newSite);
    });

    it('Should find the created site in the site list', async () => {
      // Check if the created entity is in the list
      await CentralServerService.checkEntityInList(
        CentralServerService.siteApi, this.newSite);
    });

    it('Should update the site', async () => {
      // Change entity
      this.newSite.name = "New Name";
      // Update
      await CentralServerService.updateEntity(
        CentralServerService.siteApi, this.newSite);
    });

    it('Should find the updated site by id', async () => {
      // Check if the updated entity can be retrieved with its id
      let updatedSite = await CentralServerService.getEntityById(
        CentralServerService.siteApi, this.newSite);
      // Check
      expect(updatedSite.name).to.equal(this.newSite.name);
    });

    it('Should delete the created site', async () => {
      // Delete the created entity
      await CentralServerService.deleteEntity(
        CentralServerService.siteApi, this.newSite);
    });

    it('Should not find the deleted site with its id', async () => {
      // Check if the deleted entity cannot be retrieved with its id
      await CentralServerService.checkDeletedEntityById(
        CentralServerService.siteApi, this.newSite);
    });
  });

  describe('Error cases', () => {
    it('Should not create a site area without a site', async () => {
      // Create the entity
      let response = await CentralServerService.createEntity(
        CentralServerService.siteApi, Factory.site.build(), false);
      expect(response.status).to.equal(500);
    });
  });
});
