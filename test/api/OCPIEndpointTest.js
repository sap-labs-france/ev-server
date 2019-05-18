const path = require('path');
global.appRoot = path.resolve(__dirname, '../../src');
const {expect} = require('chai');
const CentralServerService = require('./client/CentralServerService');
const Factory = require('../factories/Factory');

describe('OCPI Endpoint tests', function () {
  this.timeout(30000);

  describe('Success cases', () => {
    it('Should create a new Ocpi Endpoint', async () => {
      // Check
      expect(this.newOcpiEndpoint).to.not.be.null;
      // Create the entity
      this.newOcpiEndpoint = await CentralServerService.createEntity(
        CentralServerService.ocpiEndpointApi, Factory.ocpiEndpoint.build( { }));
    });

    it('Should find the created Ocpi Endpoint by id', async () => {
      // Check if the created entity can be retrieved with its id
      await CentralServerService.getEntityById(
        CentralServerService.ocpiEndpointApi, this.newOcpiEndpoint);
    });

    it('Should find the created Ocpi Endpoint in the Ocpi Endpoint list', async () => {
      // Check if the created entity is in the list
      await CentralServerService.checkEntityInList(
        CentralServerService.ocpiEndpointApi, this.newOcpiEndpoint);
    });

    it('Should update the Ocpi Endpoint', async () => {
      // Change entity
      this.newOcpiEndpoint.name = "NewName";
      this.newOcpiEndpoint.baseUrl = "http://new.url/versions";
      this.newOcpiEndpoint.countryCode = "AA";
      this.newOcpiEndpoint.partyId = "AA";
      this.newOcpiEndpoint.localToken = "newlocaltoken";
      this.newOcpiEndpoint.token = "newremotetoken";
      // Update
      await CentralServerService.updateEntity(
        CentralServerService.ocpiEndpointApi, this.newOcpiEndpoint);
    });

    it('Should find the updated Ocpi Endpoint by id', async () => {
      // Check if the updated entity can be retrieved with its id
      let updatedOcpiEndpoint = await CentralServerService.getEntityById(
        CentralServerService.ocpiEndpointApi, this.newOcpiEndpoint);
      // Check
      expect(updatedOcpiEndpoint.name).to.equal(this.newOcpiEndpoint.name);
    });

    it('Should delete the created Ocpi Endpoint', async () => {
      // Delete the created entity
      await CentralServerService.deleteEntity(
        CentralServerService.ocpiEndpointApi, this.newOcpiEndpoint);
    });

    it('Should not find the deleted Ocpi Endpoint with its id', async () => {
      // Check if the deleted entity cannot be retrieved with its id
      await CentralServerService.checkDeletedEntityById(
        CentralServerService.ocpiEndpointApi, this.newOcpiEndpoint);
    });
  });

  describe('Error cases', () => {

  });
});
