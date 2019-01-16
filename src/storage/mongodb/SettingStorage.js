const ObjectID = require('mongodb').ObjectID;
const Constants = require('../../utils/Constants');
const Database = require('../../utils/Database');
const Utils = require('../../utils/Utils');
const BackendError = require('../../exception/BackendError');
const DatabaseUtils = require('./DatabaseUtils');
const Logging = require('../../utils/Logging');

class SettingStorage {
  static async getSetting(tenantID, id) {
    // Debug
    const uniqueTimerID = Logging.traceStart('SettingStorage', 'getSetting');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    const Setting = require('../../entity/Setting'); // Avoid circular deps!!!
    // Create Aggregation
    const aggregation = [];
    // Filters
    aggregation.push({
      $match: { _id: Utils.convertToObjectID(id) }
    });
    // Add Created By / Last Changed By
    DatabaseUtils.pushCreatedLastChangedInAggregation(tenantID, aggregation);
    // Read DB
    const settingsMDB = await global.database.getCollection(tenantID, 'settings')
      .aggregate(aggregation)
      .toArray();
    // Set
    let setting = null;
    if (settingsMDB && settingsMDB.length > 0) {
      // Create
      setting = new Setting(tenantID, settingsMDB[0]);
    }
    // Debug
    Logging.traceEnd('SettingStorage', 'getSetting', uniqueTimerID);
    return setting;
  }

  /**
   *
   * @param tenantID
   * @param identifier
   * @returns {Promise<Setting>}
   */
  static async getSettingByIdentifier(tenantID, identifier) {
    const Setting = require('../../entity/Setting'); // Avoid circular deps!!!
    let setting = null;
    // Debug
    const uniqueTimerID = Logging.traceStart('SettingStorage', 'getSettingByIdentifier');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Read DB
    const settingsMDB = await global.database.getCollection(tenantID, 'settings')
      .find({ 'identifier': identifier })
      .limit(1)
      .toArray();
    // Check deleted
    if (settingsMDB && settingsMDB.length > 0) {
      // Ok
      setting = new Setting(tenantID, settingsMDB[0]);
    }
    // Debug
    Logging.traceEnd('SettingStorage', 'getSettingByIdentifier', uniqueTimerID);
    return setting;
  }

  static async saveSetting(tenantID, settingToSave) {
    // Debug
    const uniqueTimerID = Logging.traceStart('SettingStorage', 'saveSetting');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    const Setting = require('../../entity/Setting'); // Avoid circular deps!!!
    // Check if ID is provided
    if (!settingToSave.id && !settingToSave.identifier) {
      // ID must be provided!
      throw new BackendError(
        Constants.CENTRAL_SERVER,
        "Setting has no ID and no Identifier",
        "SettingStorage", "saveSetting");
    }
    const settingFilter = {};
    // Build Request
    if (settingToSave.id) {
      settingFilter._id = Utils.convertUserToObjectID(settingToSave.id);
    } else {
      settingFilter._id = new ObjectID();
    }
    // Set Created By
    settingToSave.createdBy = Utils.convertUserToObjectID(settingToSave.createdBy);
    settingToSave.lastChangedBy = Utils.convertUserToObjectID(settingToSave.lastChangedBy);
    // Transfer
    const setting = {};
    Database.updateSetting(settingToSave, setting, false);
    // Modify
    const result = await global.database.getCollection(tenantID, 'settings').findOneAndUpdate(
      settingFilter,
      { $set: setting },
      { upsert: true, new: true, returnOriginal: false });
    // Debug
    Logging.traceEnd('SettingStorage', 'saveSetting', uniqueTimerID);
    // Create
    return new Setting(tenantID, result.value);
  }

  // Delegate
  static async getSettings(tenantID, params = {}, limit, skip, sort) {
    // Debug
    const uniqueTimerID = Logging.traceStart('SettingStorage', 'getSettings');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    const Setting = require('../../entity/Setting'); // Avoid circular deps!!!
    // Check Limit
    limit = Utils.checkRecordLimit(limit);
    // Check Skip
    skip = Utils.checkRecordSkip(skip);
    // Set the filters
    const filters = {};
    // Source?
    if (params.search) {
      //Build filter
      filters.$or = [
        { "identifier": { $regex: params.search, $options: 'i' } }
      ];
    }

    if (params.identifier) {
      if (!filters.$and) {
        filters.$and = [];
      }
      filters.$and.push(
        { 'identifier': params.identifier }
      );
    }

    // Create Aggregation
    const aggregation = [];
    // Filters
    if (filters) {
      aggregation.push({
        $match: filters
      });
    }

    // Count Records
    const settingsCountMDB = await global.database.getCollection(tenantID, 'settings')
      .aggregate([...aggregation, { $count: "count" }])
      .toArray();
    // Add Created By / Last Changed By
    DatabaseUtils.pushCreatedLastChangedInAggregation(tenantID, aggregation);
    // Sort
    if (sort) {
      // Sort
      aggregation.push({
        $sort: sort
      });
    } else {
      // Default
      aggregation.push({
        $sort: {
          identifier: 1
        }
      });
    }
    // Skip
    aggregation.push({
      $skip: skip
    });
    // Limit
    aggregation.push({
      $limit: limit
    });
    // Read DB
    const settingsMDB = await global.database.getCollection(tenantID, 'settings')
      .aggregate(aggregation, { collation: { locale: Constants.DEFAULT_LOCALE, strength: 2 } })
      .toArray();
    const settings = [];
    // Check
    if (settingsMDB && settingsMDB.length > 0) {
      // Create
      for (const settingMDB of settingsMDB) {
        // Add
        settings.push(new Setting(tenantID, settingMDB));
      }
    }
    // Debug
    Logging.traceEnd('SettingStorage', 'getSettings', uniqueTimerID);
    // Ok
    return {
      count: (settingsCountMDB.length > 0 ? settingsCountMDB[0].count : 0),
      result: settings
    };
  }

  static async deleteSetting(tenantID, id) {
    // Debug
    const uniqueTimerID = Logging.traceStart('SettingStorage', 'deleteSetting');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Delete Component
    await global.database.getCollection(tenantID, 'settings')
      .findOneAndDelete({ '_id': Utils.convertToObjectID(id) });
    // Debug
    Logging.traceEnd('SettingStorage', 'deleteSetting', uniqueTimerID);
  }
}

module.exports = SettingStorage;
