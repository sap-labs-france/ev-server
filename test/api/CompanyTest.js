const {expect} = require('chai');
const chai = require('chai');
const chaiSubset = require('chai-subset');
chai.use(chaiSubset);
const CentralServerService = require('./client/CentralServerService');
const Factory = require('../factories/Factory');


describe('Company tests', function() {
  this.timeout(10000);

  it('should create a new company', async () => {
    // Create the entity
    this.newCompany = await CentralServerService.createEntity(
      CentralServerService.company, Factory.company);
  });

  it('should find the created company by id', async () => {
    // Check if the created entity can be retrieved with its id
    this.newCompany = await CentralServerService.checkCreatedEntityById(
      CentralServerService.company, this.newCompany);
  });

  it('should find a created company in the company list', async () => {
    // Check if the created entity is in the list
    await CentralServerService.checkCreatedEntityInList(
      CentralServerService.company, this.newCompany);
  });

  it('should delete the created company', async () => {
    // Check created entity and get the returned entity
    await CentralServerService.deleteEntity(
      CentralServerService.company, this.newCompany);
  });

  it('should not find the deleted company with its id', async () => {
    // Check if the created entity can be retrieved with its id
    await CentralServerService.checkDeletedEntityById(
      CentralServerService.company, this.newCompany);
  });
});
