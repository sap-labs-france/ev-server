import chai, { expect } from 'chai';
import chaiSubset from 'chai-subset';
chai.use(chaiSubset);
const path = require('path');
import global from'../../src/types/GlobalType';
import CentralServerService from './client/CentralServerService';
import Factory from '../factories/Factory';
 
global.appRoot = path.resolve(__dirname, '../../src');

class TestData {
  public newOcpiEndpoint: any;
}

const testData: TestData = new TestData();

describe('OCPI Endpoint tests', function() {
  this.timeout(30000);

  describe('Success cases', () => {
    it('Should create a new Ocpi Endpoint', async () => {
      // Check
      expect(testData.newOcpiEndpoint).to.not.be.null;
      // Create the entity
      testData.newOcpiEndpoint = await CentralServerService.DefaultInstance.createEntity(
        CentralServerService.DefaultInstance.ocpiEndpointApi, Factory.ocpiEndpoint.build({ }));
    });

    it('Should find the created Ocpi Endpoint by id', async () => {
      // Check if the created entity can be retrieved with its id
      await CentralServerService.DefaultInstance.getEntityById(
        CentralServerService.DefaultInstance.ocpiEndpointApi, testData.newOcpiEndpoint);
    });

    it('Should find the created Ocpi Endpoint in the Ocpi Endpoint list', async () => {
      // Check if the created entity is in the list
      await CentralServerService.DefaultInstance.checkEntityInList(
        CentralServerService.DefaultInstance.ocpiEndpointApi, testData.newOcpiEndpoint);
    });

    it('Should update the Ocpi Endpoint', async () => {
      // Change entity
      testData.newOcpiEndpoint.name = 'NewName';
      testData.newOcpiEndpoint.baseUrl = 'http://new.url/versions';
      testData.newOcpiEndpoint.countryCode = 'AA';
      testData.newOcpiEndpoint.partyId = 'AA';
      testData.newOcpiEndpoint.localToken = 'newlocaltoken';
      testData.newOcpiEndpoint.token = 'newremotetoken';
      // Update
      await CentralServerService.DefaultInstance.updateEntity(
        CentralServerService.DefaultInstance.ocpiEndpointApi, testData.newOcpiEndpoint);
    });

    it('Should find the updated Ocpi Endpoint by id', async () => {
      // Check if the updated entity can be retrieved with its id
      const updatedOcpiEndpoint = await CentralServerService.DefaultInstance.getEntityById(
        CentralServerService.DefaultInstance.ocpiEndpointApi, testData.newOcpiEndpoint);
      // Check
      expect(updatedOcpiEndpoint.name).to.equal(testData.newOcpiEndpoint.name);
    });

    it('Should delete the created Ocpi Endpoint', async () => {
      // Delete the created entity
      await CentralServerService.DefaultInstance.deleteEntity(
        CentralServerService.DefaultInstance.ocpiEndpointApi, testData.newOcpiEndpoint);
    });

    it('Should not find the deleted Ocpi Endpoint with its id', async () => {
      // Check if the deleted entity cannot be retrieved with its id
      await CentralServerService.DefaultInstance.checkDeletedEntityById(
        CentralServerService.DefaultInstance.ocpiEndpointApi, testData.newOcpiEndpoint);
    });
  });

  describe('Error cases', () => {

  });
});
