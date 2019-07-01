import path from 'path';
import { expect } from 'chai';
 import global from'../../src/types/GlobalType';
import Factory from '../factories/Factory';
import CentralServerService from '../api/client/CentralServerService';

global.appRoot = path.resolve(__dirname, '../../src');

class TestData {
  public newSetting: any;
}

const testData: TestData = new TestData();

describe('Setting tests', function() {
  this.timeout(30000);

  describe('Success cases', () => {
    it('Should create a new setting', async () => {
      // Check
      expect(testData.newSetting).to.not.be.null;
      // Create the entity
      testData.newSetting = await CentralServerService.DefaultInstance.createEntity(
        CentralServerService.DefaultInstance.settingApi, Factory.setting.build({ }));
    });

    it('Should find the created setting by id', async () => {
      // Check if the created entity can be retrieved with its id
      await CentralServerService.DefaultInstance.getEntityById(
        CentralServerService.DefaultInstance.settingApi, testData.newSetting);
    });

    it('Should find the created setting in the setting list', async () => {
      // Check if the created entity is in the list
      await CentralServerService.DefaultInstance.checkEntityInList(
        CentralServerService.DefaultInstance.settingApi, testData.newSetting);
    });

    it('Should find the created setting in the setting list with identifier', async () => {
      // Check if the created entity is in the list
      await CentralServerService.DefaultInstance.checkEntityInListWithParams(
        CentralServerService.DefaultInstance.settingApi, testData.newSetting, { Identifier: testData.newSetting.identifier });
    });

    it('Should update the setting', async () => {
      // Change entity
      testData.newSetting.identifier = 'New Identifier';
      testData.newSetting.content = JSON.parse('{ "newproperty": "newvalue" }');
      // Update
      await CentralServerService.DefaultInstance.updateEntity(
        CentralServerService.DefaultInstance.settingApi, testData.newSetting);
    });

    it('Should find the updated setting by id', async () => {
      // Check if the updated entity can be retrieved with its id
      const updatedSetting = await CentralServerService.DefaultInstance.getEntityById(
        CentralServerService.DefaultInstance.settingApi, testData.newSetting);
      // Check
      expect(updatedSetting.identifier).to.equal(testData.newSetting.identifier);
      expect(updatedSetting.content).to.have.property('newproperty').to.be.equal('newvalue');
    });

    it('Should delete the created setting', async () => {
      // Delete the created entity
      await CentralServerService.DefaultInstance.deleteEntity(
        CentralServerService.DefaultInstance.settingApi, testData.newSetting);
    });

    it('Should not find the deleted setting with its id', async () => {
      // Check if the deleted entity cannot be retrieved with its id
      await CentralServerService.DefaultInstance.checkDeletedEntityById(
        CentralServerService.DefaultInstance.settingApi, testData.newSetting);
    });
  });

  describe('Error cases', () => {
  });
});
