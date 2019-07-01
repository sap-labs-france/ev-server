import { expect } from 'chai';
import CentralServerService from './client/CentralServerService';
import Factory from '../factories/Factory';

class TestData {
  newCompany: any;
}

const testData = new TestData();

describe('Company Org tests', function() {
  this.timeout(30000);

  describe('Success cases', () => {
    it('Should create a new company', async () => {
      // Create
      testData.newCompany = await CentralServerService.DefaultInstance.createEntity(
        CentralServerService.DefaultInstance.companyApi, Factory.company.build());
    });

    it('Should find the created company by id', async () => {
      // Check if the created entity can be retrieved with its id
      await CentralServerService.DefaultInstance.getEntityById(
        CentralServerService.DefaultInstance.companyApi, testData.newCompany);
    });

    it('Should find the created company in the company list', async () => {
      // Check if the created entity is in the list
      await CentralServerService.DefaultInstance.checkEntityInList(
        CentralServerService.DefaultInstance.companyApi, testData.newCompany);
    });

    it('Should update the company', async () => {
      // Change entity
      testData.newCompany.name = 'New Name';
      // Update
      await CentralServerService.DefaultInstance.updateEntity(
        CentralServerService.DefaultInstance.companyApi, testData.newCompany);
    });

    it('Should find the updated company by id', async () => {
      // Check if the updated entity can be retrieved with its id
      const updatedCompany = await CentralServerService.DefaultInstance.getEntityById(
        CentralServerService.DefaultInstance.companyApi, testData.newCompany);
      // Check
      expect(updatedCompany.name).to.equal(testData.newCompany.name);
    });

    it('Should delete the created company', async () => {
      // Delete the created entity
      await CentralServerService.DefaultInstance.deleteEntity(
        CentralServerService.DefaultInstance.companyApi, testData.newCompany);
    });

    it('Should not find the deleted company with its id', async () => {
      // Check if the deleted entity cannot be retrieved with its id
      await CentralServerService.DefaultInstance.checkDeletedEntityById(
        CentralServerService.DefaultInstance.companyApi, testData.newCompany);
    });
  });
});
