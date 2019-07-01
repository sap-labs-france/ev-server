import path from 'path';
import chai, { expect } from 'chai';
import chaiSubset from 'chai-subset';
import global from'../../src/types/GlobalType';

global.appRoot = path.resolve(__dirname, '../../src');

chai.use(chaiSubset);

class TestData {
  public newUser: any;
}

const testData: TestData = new TestData();

describe('User tests', function() {
  this.timeout(30000);

  describe('Success cases', () => {
    it('Should create a new user', async () => {
      // Create
      testData.newUser = await CentralServerService.DefaultInstance.createEntity(
        CentralServerService.DefaultInstance.userApi, Factory.user.build());
      // Remove Passwords
      delete testData.newUser.passwords;
    });

    it('Should find the created user by id', async () => {
      // Check if the created entity can be retrieved with its id
      await CentralServerService.DefaultInstance.getEntityById(
        CentralServerService.DefaultInstance.userApi, testData.newUser);
    });

    it('Should find the created user in the user list', async () => {
      // Check if the created entity is in the list
      await CentralServerService.DefaultInstance.checkEntityInList(
        CentralServerService.DefaultInstance.userApi, testData.newUser);
    });

    it('Should update the user', async () => {
      // Change entity
      testData.newUser.name = 'New Name';
      // Update
      await CentralServerService.DefaultInstance.updateEntity(
        CentralServerService.DefaultInstance.userApi, testData.newUser);
    });

    it('Should find the updated user by id', async () => {
      // Check if the updated entity can be retrieved with its id
      const updatedUser = await CentralServerService.DefaultInstance.getEntityById(
        CentralServerService.DefaultInstance.userApi, testData.newUser);
      // Check
      expect(updatedUser.name).to.equal(testData.newUser.name);
    });

    it('Should delete the created user', async () => {
      // Delete the created entity
      await CentralServerService.DefaultInstance.deleteEntity(
        CentralServerService.DefaultInstance.userApi, testData.newUser);
    });

    it('Should not find the deleted user with its id', async () => {
      // Check if the deleted entity cannot be retrieved with its id
      await CentralServerService.DefaultInstance.checkDeletedEntityById(
        CentralServerService.DefaultInstance.userApi, testData.newUser);
    });
  });

  describe('Find Users In Error', () => {
    it('Should not find an active user', async () => {
      const user = await CentralServerService.DefaultInstance.createEntity(
        CentralServerService.DefaultInstance.userApi, Factory.user.build({ status: 'A' }));
      const response = await CentralServerService.DefaultInstance.userApi.readAllInError({}, { limit: 100, skip: 0 });
      expect(response.status).to.equal(200);
      response.data.result.forEach((u) => {
        return expect(u.id).to.not.equal(user.id);
      });

      await CentralServerService.DefaultInstance.deleteEntity(
        CentralServerService.DefaultInstance.userApi, user);
    });

    it('Should find a pending user', async () => {
      const user = await CentralServerService.DefaultInstance.createEntity(
        CentralServerService.DefaultInstance.userApi, Factory.user.build({ status: 'P' }));
      const response = await CentralServerService.DefaultInstance.userApi.readAllInError({}, { limit: 100, skip: 0 });
      expect(response.status).to.equal(200);
      const found = response.data.result.find((u) => {
        return u.id === user.id;
      });
      expect(found).to.not.be.null;

      await CentralServerService.DefaultInstance.deleteEntity(
        CentralServerService.DefaultInstance.userApi, user);
    });

    it('Should find a blocked user', async () => {
      const user = await CentralServerService.DefaultInstance.createEntity(
        CentralServerService.DefaultInstance.userApi, Factory.user.build({ status: 'B' }));
      const response = await CentralServerService.DefaultInstance.userApi.readAllInError({}, { limit: 100, skip: 0 });
      expect(response.status).to.equal(200);
      const found = response.data.result.find((u) => {
        return u.id === user.id;
      });
      expect(found).to.not.be.null;

      await CentralServerService.DefaultInstance.deleteEntity(
        CentralServerService.DefaultInstance.userApi, user);
    });

    it('Should find a locked user', async () => {
      const user = await CentralServerService.DefaultInstance.createEntity(
        CentralServerService.DefaultInstance.userApi, Factory.user.build({ status: 'L' }));
      const response = await CentralServerService.DefaultInstance.userApi.readAllInError({}, { limit: 100, skip: 0 });
      expect(response.status).to.equal(200);
      const found = response.data.result.find((u) => {
        return u.id === user.id;
      });
      expect(found).to.not.be.null;

      await CentralServerService.DefaultInstance.deleteEntity(
        CentralServerService.DefaultInstance.userApi, user);
    });

    it('Should find an inactive user', async () => {
      const user = await CentralServerService.DefaultInstance.createEntity(
        CentralServerService.DefaultInstance.userApi, Factory.user.build({ status: 'I' }));
      const response = await CentralServerService.DefaultInstance.userApi.readAllInError({}, { limit: 100, skip: 0 });
      expect(response.status).to.equal(200);
      const found = response.data.result.find((u) => {
        return u.id === user.id;
      });
      expect(found).to.not.be.null;

      await CentralServerService.DefaultInstance.deleteEntity(
        CentralServerService.DefaultInstance.userApi, user);
    });
  });
});
