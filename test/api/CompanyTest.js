const CentralServerService = require('./client/CentralServerService');
const Factory = require('../factories/Factory');
const {expect} = require('chai');

describe('Company tests', () => {
  this.timeout(10000);

  describe('Green cases', () => {
    it('Should create a new company', async () => {
      // Create
      this.newCompany = await CentralServerService.createEntity(
        CentralServerService.company, Factory.company.build());
    });

    it('Should find the created company by id', async () => {
      // Check if the created entity can be retrieved with its id
      await CentralServerService.checkEntityById(
        CentralServerService.company, this.newCompany);
    });

    it('Should find the created company in the company list', async () => {
      // Check if the created entity is in the list
      await CentralServerService.checkCreatedEntityInList(
        CentralServerService.company, this.newCompany);
    });

    it('Should update the company', async () => {
      // Change entity
      this.newCompany.name = "New Name";
      // Update
      await CentralServerService.updateEntity(
        CentralServerService.company, this.newCompany);
    });

    it('Should find the updated company by id', async () => {
      // Check if the updated entity can be retrieved with its id
      let updatedCompany = await CentralServerService.checkEntityById(
        CentralServerService.company, this.newCompany);
      // Check
      expect(updatedCompany.name).to.equal(this.newCompany.name);
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
