const {expect} = require('chai');
const chai = require('chai');
const chaiSubset = require('chai-subset');
chai.use(chaiSubset);
const CentralServerService = require('./client/CentralServerService');
const Factory = require('../factories/Factory');

describe('User tests', function() {
  this.timeout(10000);

  describe('Green cases', () => {
    it('Should create a new user', async () => {
      // Create
      this.newUser = await CentralServerService.createEntity(
        CentralServerService.user, Factory.user.build());
      // Remove Passwords
      delete this.newUser.passwords;
    });

    it('Should find the created user by id', async () => {
      // Check if the created entity can be retrieved with its id
      await CentralServerService.checkEntityById(
        CentralServerService.user, this.newUser);
    });

    it('Should find the created user in the user list', async () => {
      // Check if the created entity is in the list
      await CentralServerService.checkCreatedEntityInList(
        CentralServerService.user, this.newUser);
    });

    it('Should update the user', async () => {
      // Change entity
      this.newUser.name = "New Name";
      // Update
      await CentralServerService.updateEntity(
        CentralServerService.user, this.newUser);
    });

    it('Should find the updated user by id', async () => {
      // Check if the updated entity can be retrieved with its id
      let updatedUser = await CentralServerService.checkEntityById(
        CentralServerService.user, this.newUser);
      // Check
      expect(updatedUser.name).to.equal(this.newUser.name);
    });

    it('Should delete the created user', async () => {
      // Delete the created entity
      await CentralServerService.deleteEntity(
        CentralServerService.user, this.newUser);
    });

    it('Should not find the deleted user with its id', async () => {
      // Check if the deleted entity cannot be retrieved with its id
      await CentralServerService.checkDeletedEntityById(
        CentralServerService.user, this.newUser);
    });
  });
});
