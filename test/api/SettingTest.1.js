const {expect} = require('chai');
const CentralServerService = require('./client/CentralServerService');
const Factory = require('../factories/Factory');

describe('Setting tests', function () {
  this.timeout(30000);

  describe('Success cases', () => {
    it('Should create a new setting', async () => {
      // Check
      expect(this.newSetting).to.not.be.null;
      // Create the entity
      this.newSetting = await CentralServerService.createEntity(
        CentralServerService.settingApi, Factory.setting.build( { }));
    });

    it('Should find the created setting by id', async () => {
      // Check if the created entity can be retrieved with its id
      await CentralServerService.getEntityById(
        CentralServerService.settingApi, this.newSetting);
    });

    it('Should find the created setting in the setting list', async () => {
      // Check if the created entity is in the list
      await CentralServerService.checkEntityInList(
        CentralServerService.settingApi, this.newSetting);
    });

    it('Should update the setting', async () => {
      // Change entity
      this.newSetting.identifier = "New Identifier";
      // Update
      await CentralServerService.updateEntity(
        CentralServerService.settingApi, this.newSetting);
    });

    it('Should find the updated setting by id', async () => {
      // Check if the updated entity can be retrieved with its id
      let updatedSetting = await CentralServerService.getEntityById(
        CentralServerService.settingApi, this.newSetting);
      // Check
      expect(updatedSetting.identifier).to.equal(this.newSetting.identifier);
    });

    it('Should delete the created setting', async () => {
      // Delete the created entity
      await CentralServerService.deleteEntity(
        CentralServerService.settingApi, this.newSetting);
    });

    it('Should not find the deleted setting with its id', async () => {
      // Check if the deleted entity cannot be retrieved with its id
      await CentralServerService.checkDeletedEntityById(
        CentralServerService.settingApi, this.newSetting);
    });
  });

  describe('Error cases', () => {
    // it('Should not create a setting area without a setting', async () => { });
  });
});
