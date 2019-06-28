import path from 'path';
import TSGlobal from '../../src/types/GlobalType';
declare const global: TSGlobal;
global.appRoot = path.resolve(__dirname, '../../src');
import CentralServerService from './client/CentralServerService';
import Factory from '../factories/Factory';
import {expect} from 'chai';

let newCompany;
let centralServerService;

describe('Company tests', function() {
  this.timeout(30000);

  before(function() {
    centralServerService = new CentralServerService();
  });


  describe('Success cases', () => {
    it('Should create a new company', async () => {
      // Create
      newCompany = await centralServerService.createEntity(
        centralServerService.companyApi, Factory.company.build());
    });

    it('Should find the created company by id', async () => {
      // Check if the created entity can be retrieved with its id
      await centralServerService.getEntityById(
        centralServerService.companyApi, newCompany);
    });

    it('Should find the created company in the company list', async () => {
      // Check if the created entity is in the list
      await centralServerService.checkEntityInList(
        centralServerService.companyApi, newCompany);
    });

    it('Should update the company', async () => {
      // Change entity
      newCompany.name = "New Name";
      // Update
      await centralServerService.updateEntity(
        centralServerService.companyApi, newCompany);
    });

    it('Should find the updated company by id', async () => {
      // Check if the updated entity can be retrieved with its id
      let updatedCompany = await centralServerService.getEntityById(
        centralServerService.companyApi, newCompany);
      // Check
      expect(updatedCompany.name).to.equal(newCompany.name);
    });

    it('Should delete the created company', async () => {
      // Delete the created entity
      await centralServerService.deleteEntity(
        centralServerService.companyApi, newCompany);
    });

    it('Should not find the deleted company with its id', async () => {
      // Check if the deleted entity cannot be retrieved with its id
      await centralServerService.checkDeletedEntityById(
        centralServerService.companyApi, newCompany);
    });
  });
});
