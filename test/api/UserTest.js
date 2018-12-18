const {expect} = require('chai');
const chai = require('chai');
const chaiSubset = require('chai-subset');
chai.use(chaiSubset);
const CentralServerService = require('./client/CentralServerService');
const Factory = require('../factories/Factory');

describe('User tests', function() {
  this.timeout(30000);

  describe('Success cases', () => {
    it('Should create a new user', async () => {
      // Create
      this.newUser = await CentralServerService.createEntity(
        CentralServerService.userApi, Factory.user.build());
      // Remove Passwords
      delete this.newUser.passwords;
    });

    it('Should find the created user by id', async () => {
      // Check if the created entity can be retrieved with its id
      await CentralServerService.getEntityById(
        CentralServerService.userApi, this.newUser);
    });

    it('Should find the created user in the user list', async () => {
      // Check if the created entity is in the list
      await CentralServerService.checkEntityInList(
        CentralServerService.userApi, this.newUser);
    });

    it('Should update the user', async () => {
      // Change entity
      this.newUser.name = "New Name";
      // Update
      await CentralServerService.updateEntity(
        CentralServerService.userApi, this.newUser);
    });

    it('Should find the updated user by id', async () => {
      // Check if the updated entity can be retrieved with its id
      let updatedUser = await CentralServerService.getEntityById(
        CentralServerService.userApi, this.newUser);
      // Check
      expect(updatedUser.name).to.equal(this.newUser.name);
    });

    it('Should delete the created user', async () => {
      // Delete the created entity
      await CentralServerService.deleteEntity(
        CentralServerService.userApi, this.newUser);
    });

    it('Should not find the deleted user with its id', async () => {
      // Check if the deleted entity cannot be retrieved with its id
      await CentralServerService.checkDeletedEntityById(
        CentralServerService.userApi, this.newUser);
    });
  });

  describe('Find Users In Error', () => {
    it('Should not find an active user', async () => {
      const user = await CentralServerService.createEntity(
        CentralServerService.userApi, Factory.user.build({status: 'A'}));
      const response = await CentralServerService.userApi.readAllInError({}, 100);
      expect(response.status).to.equal(200);
      response.data.result.forEach(u => expect(u.id).to.not.equal(user.id));

      await CentralServerService.deleteEntity(
        CentralServerService.userApi, user);
    });

    it('Should find a pending user', async () => {
      const user = await CentralServerService.createEntity(
        CentralServerService.userApi, Factory.user.build({status: 'P'}));
      const response = await CentralServerService.userApi.readAllInError({}, 100);
      expect(response.status).to.equal(200);
      const found = response.data.result.find(u => u.id === user.id);
      expect(found).to.not.be.null;

      await CentralServerService.deleteEntity(
        CentralServerService.userApi, user);
    });

    it('Should find a blocked user', async () => {
      const user = await CentralServerService.createEntity(
        CentralServerService.userApi, Factory.user.build({status: 'B'}));
      const response = await CentralServerService.userApi.readAllInError({}, 100);
      expect(response.status).to.equal(200);
      const found = response.data.result.find(u => u.id === user.id);
      expect(found).to.not.be.null;

      await CentralServerService.deleteEntity(
        CentralServerService.userApi, user);
    });

    it('Should find a locked user', async () => {
      const user = await CentralServerService.createEntity(
        CentralServerService.userApi, Factory.user.build({status: 'L'}));
      const response = await CentralServerService.userApi.readAllInError({}, 100);
      expect(response.status).to.equal(200);
      const found = response.data.result.find(u => u.id === user.id);
      expect(found).to.not.be.null;

      await CentralServerService.deleteEntity(
        CentralServerService.userApi, user);
    });

    it('Should find an inactive user', async () => {
      const user = await CentralServerService.createEntity(
        CentralServerService.userApi, Factory.user.build({status: 'I'}));
      const response = await CentralServerService.userApi.readAllInError({}, 100);
      expect(response.status).to.equal(200);
      const found = response.data.result.find(u => u.id === user.id);
      expect(found).to.not.be.null;

      await CentralServerService.deleteEntity(
        CentralServerService.userApi, user);
    });
  });
});
