const {expect} = require('chai');
const CentralServerService = require('./client/CentralServerService');
const Factory = require('../factories/Factory');

describe('Ocpiendpoint tests', function () {
  this.timeout(30000);

  describe('Success cases', () => {
    it('Should create a new ocpiendpoint', async () => {
      // Check
      expect(this.newOcpiendpoint).to.not.be.null;
      // Create the entity
      this.newOcpiendpoint = await CentralServerService.createEntity(
        CentralServerService.ocpiendpointApi, Factory.ocpiendpoint.build( { }));
    });

    it('Should find the created ocpiendpoint by id', async () => {
      // Check if the created entity can be retrieved with its id
      await CentralServerService.getEntityById(
        CentralServerService.ocpiendpointApi, this.newOcpiendpoint);
    });

    it('Should find the created ocpiendpoint in the ocpiendpoint list', async () => {
      // Check if the created entity is in the list
      await CentralServerService.checkEntityInList(
        CentralServerService.ocpiendpointApi, this.newOcpiendpoint);
    });

    it('Should update the ocpiendpoint', async () => {
      // Change entity
      this.newOcpiendpoint.identifier = "New Identifier";
      // Update
      await CentralServerService.updateEntity(
        CentralServerService.ocpiendpointApi, this.newOcpiendpoint);
    });

    it('Should find the updated ocpiendpoint by id', async () => {
      // Check if the updated entity can be retrieved with its id
      let updatedSetting = await CentralServerService.getEntityById(
        CentralServerService.ocpiendpointApi, this.newOcpiendpoint);
      // Check
      expect(updatedSetting.identifier).to.equal(this.newOcpiendpoint.identifier);
    });

    it('Should delete the created ocpiendpoint', async () => {
      // Delete the created entity
      await CentralServerService.deleteEntity(
        CentralServerService.ocpiendpointApi, this.newOcpiendpoint);
    });

    it('Should not find the deleted ocpiendpoint with its id', async () => {
      // Check if the deleted entity cannot be retrieved with its id
      await CentralServerService.checkDeletedEntityById(
        CentralServerService.ocpiendpointApi, this.newOcpiendpoint);
    });
  });

  describe('Error cases', () => {

  });
});
