const {expect} = require('chai');
const CentralServerService = require('./client/CentralServerService');
const Factory = require('../factories/Factory');


describe('Site tests', function() {
  this.timeout(10000);

  before(async () => {
    // Create the Company
    this.newCompany = await CentralServerService.createEntity(
      CentralServerService.company, Factory.company.build());
  });

  after(async () => {
    // Delete the Company
    await CentralServerService.deleteEntity(
      CentralServerService.company, this.newCompany);
  });

  it('Should create a new site', async () => {
    // Check
    expect(this.newCompany).to.not.be.null;
    // Create the entity
    this.newSite = await CentralServerService.createEntity(
      CentralServerService.site, Factory.site.build({ companyID: this.newCompany.id }));
  });

  it('Should find the created site by id', async () => {
    // Check if the created entity can be retrieved with its id
    await CentralServerService.checkCreatedEntityById(
      CentralServerService.site, this.newSite);
  });

  it('Should find the created site in the site list', async () => {
    // Check if the created entity is in the list
    await CentralServerService.checkCreatedEntityInList(
      CentralServerService.site, this.newSite);
  });

  it('Should delete the created site', async () => {
    // Delete the created entity
    await CentralServerService.deleteEntity(
      CentralServerService.site, this.newSite);
  });

  it('Should not find the deleted site with its id', async () => {
    // Check if the deleted entity cannot be retrieved with its id
    await CentralServerService.checkDeletedEntityById(
      CentralServerService.site, this.newSite);
  });
});
