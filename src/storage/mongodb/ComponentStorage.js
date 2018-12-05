const ObjectID = require('mongodb').ObjectID;
const Constants = require('../../utils/Constants');
const Database = require('../../utils/Database');
const Utils = require('../../utils/Utils');
const BackendError = require('../../exception/BackendError');
const DatabaseUtils = require('./DatabaseUtils');
const Logging = require('../../utils/Logging');

class ComponentStorage {
  static async getComponent(tenantID, id) {
    // Debug
    const uniqueTimerID = Logging.traceStart('ComponentStorage', 'getComponent');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    const Component = require('../../entity/Component'); // Avoid circular deps!!!
    // Create Aggregation
    const aggregation = [];
    // Filters
    aggregation.push({
      $match: { _id: Utils.convertToObjectID(id) }
    });
    // Add Created By / Last Changed By
    DatabaseUtils.pushCreatedLastChangedInAggregation(tenantID, aggregation);
    // Read DB
    const componentsMDB = await global.database.getCollection(tenantID, 'components')
      .aggregate(aggregation)
      .toArray();
    // Set
    let component = null;
    if (componentsMDB && componentsMDB.length > 0) {
      // Create
      component = new Component(tenantID, componentsMDB[0]);
    }
    // Debug
    Logging.traceEnd('ComponentStorage', 'getComponent', uniqueTimerID);
    return component;
  }

  static async getComponentByIdentifier(tenantID, identifier) {
    const Component = require('../../entity/Component'); // Avoid circular deps!!!
    let component = null;
    // Debug
    const uniqueTimerID = Logging.traceStart('getComponentByIdentifier', 'getComponentByIdentifier');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Read DB
    const componentsMDB = await global.database.getCollection(tenantID, 'components')
      .find({ 'identifier': identifier })
      .limit(1)
      .toArray();
    // Check deleted
    if (componentsMDB && componentsMDB.length > 0) {
      // Ok
      component = new Component(tenantID, componentsMDB[0]);
    }
    // Debug
    Logging.traceEnd('getComponentByIdentifier', 'getComponentByIdentifier', uniqueTimerID);
    return component;
  }

  static async saveComponent(tenantID, componentToSave) {
    // Debug
    const uniqueTimerID = Logging.traceStart('ComponentStorage', 'saveComponent');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    const Component = require('../../entity/Component'); // Avoid circular deps!!!
    // Check if ID is provided
    if (!componentToSave.id && !componentToSave.identifier) {
      // ID must be provided!
      throw new BackendError(
        Constants.CENTRAL_SERVER,
        "Component has no ID and no Identifier",
        "ComponentStorage", "saveComponent");
    }
    const componentFilter = {};
    // Build Request
    if (componentToSave.id) {
      componentFilter._id = Utils.convertUserToObjectID(componentToSave.id);
    } else {
      componentFilter._id = new ObjectID();
    }
    // Set Created By
    componentToSave.createdBy = Utils.convertUserToObjectID(componentToSave.createdBy);
    componentToSave.lastChangedBy = Utils.convertUserToObjectID(componentToSave.lastChangedBy);
    // Transfer
    const component = {};
    Database.updateComponent(componentToSave, component, false);
    // Modify
    const result = await global.database.getCollection(tenantID, 'components').findOneAndUpdate(
      componentFilter,
      { $set: component },
      { upsert: true, new: true, returnOriginal: false });
    // Debug
    Logging.traceEnd('ComponentStorage', 'saveComponent', uniqueTimerID);
    // Create
    return new Component(tenantID, result.value);
  }

  // Delegate
  static async getComponents(tenantID, params = {}, limit, skip, sort) {
    // Debug
    const uniqueTimerID = Logging.traceStart('ComponentStorage', 'getComponents');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    const Component = require('../../entity/Component'); // Avoid circular deps!!!
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

    // Create Aggregation
    const aggregation = [];
    // Filters
    if (filters) {
      aggregation.push({
        $match: filters
      });
    }

    // Count Records
    const componentsCountMDB = await global.database.getCollection(tenantID, 'components')
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
    const componentsMDB = await global.database.getCollection(tenantID, 'components')
      .aggregate(aggregation, { collation: { locale: Constants.DEFAULT_LOCALE, strength: 2 } })
      .toArray();
    const components = [];
    // Check
    if (componentsMDB && componentsMDB.length > 0) {
      // Create
      for (const componentMDB of componentsMDB) {
        // Add
        components.push(new Component(tenantID, componentMDB));
      }
    }
    // Debug
    Logging.traceEnd('ComponentStorage', 'getComponents', uniqueTimerID);
    // Ok
    return {
      count: (componentsCountMDB.length > 0 ? componentsCountMDB[0].count : 0),
      result: components
    };
  }

  static async deleteComponent(tenantID, id) {
    // Debug
    const uniqueTimerID = Logging.traceStart('ComponentStorage', 'deleteComponent');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Delete Component
    await global.database.getCollection(tenantID, 'components')
      .findOneAndDelete({ '_id': Utils.convertToObjectID(id) });
    // Debug
    Logging.traceEnd('ComponentStorage', 'deleteComponent', uniqueTimerID);
  }
}

module.exports = ComponentStorage;
