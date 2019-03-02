const path = require('path');
global.appRoot = path.resolve(__dirname, '../../src');
const {expect} = require('chai');
const CentralServerService = require('./client/CentralServerService');
const Factory = require('../factories/Factory');

describe('OCPI Endpoint tests', function () {
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
      this.newOcpiendpoint.name = "NewName";
      this.newOcpiendpoint.baseUrl = "http://new.url/versions";
      this.newOcpiendpoint.countryCode = "AA";
      this.newOcpiendpoint.partyId = "AA";
      this.newOcpiendpoint.localToken = "newlocaltoken";
      this.newOcpiendpoint.token = "newremotetoken";
      // Update
      await CentralServerService.updateEntity(
        CentralServerService.ocpiendpointApi, this.newOcpiendpoint);
    });

    it('Should find the updated ocpiendpoint by id', async () => {
      // Check if the updated entity can be retrieved with its id
      let updatedOcpiendpoint = await CentralServerService.getEntityById(
        CentralServerService.ocpiendpointApi, this.newOcpiendpoint);
      // Check
      expect(updatedOcpiendpoint.name).to.equal(this.newOcpiendpoint.name);
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
