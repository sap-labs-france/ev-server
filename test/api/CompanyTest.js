const CentralServerService = require('./client/CentralServerService');
const Factory = require('../factories/Factory');

describe('Company tests', function() {
  this.timeout(10000);

  describe('Green cases', function() {
    it('Should create a new company', async () => {
      // Create
      this.newCompany = await CentralServerService.createEntity(
        CentralServerService.company, Factory.company.build());
    });

    it('Should find the created company by id', async () => {
      // Check if the created entity can be retrieved with its id
      await CentralServerService.checkCreatedEntityById(
        CentralServerService.company, this.newCompany);
    });

    it('Should find the created company in the company list', async () => {
      // Check if the created entity is in the list
      await CentralServerService.checkCreatedEntityInList(
        CentralServerService.company, this.newCompany);
    });

    it('Should delete the created company', async () => {
      // Delete the created entity
      await CentralServerService.deleteEntity(
        CentralServerService.company, this.newCompany);
    });

    it('Should not find the deleted company with its id', async () => {
      // Check if the deleted entity cannot be retrieved with its id
      await CentralServerService.checkDeletedEntityById(
        CentralServerService.company, this.newCompany);
    });
  });
});
