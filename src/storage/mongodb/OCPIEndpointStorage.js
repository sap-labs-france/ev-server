const ObjectID = require('mongodb').ObjectID;
const Constants = require('../../utils/Constants');
const Database = require('../../utils/Database');
const Utils = require('../../utils/Utils');
const BackendError = require('../../exception/BackendError');
const DatabaseUtils = require('./DatabaseUtils');
const Logging = require('../../utils/Logging');

class OCPIEndpointStorage {
  static async getOcpiEndpoint(tenantID, id) {
    // Debug
    const uniqueTimerID = Logging.traceStart('OCPIEndpointStorage', 'getOcpiEndpoint');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    const OCPIEndpoint = require('../../entity/OCPIEndpoint'); // Avoid circular deps!!!
    // Create Aggregation
    const aggregation = [];
    // Filters
    aggregation.push({
      $match: {_id: Utils.convertToObjectID(id)}
    });
    // Add Created By / Last Changed By
    DatabaseUtils.pushCreatedLastChangedInAggregation(tenantID,aggregation);
    // Read DB
    const ocpiEndpointsMDB = await global.database.getCollection(tenantID, 'ocpiendpoints')
      .aggregate(aggregation)
      .toArray();
    // Set
    let ocpiEndpoint = null;
    if (ocpiEndpointsMDB && ocpiEndpointsMDB.length > 0) {
      // Create
      ocpiEndpoint = new OCPIEndpoint(tenantID, ocpiEndpointsMDB[0]);
    }
    // Debug
    Logging.traceEnd('OCPIEndpointStorage', 'getOcpiEndpoint', uniqueTimerID, {id});
    return ocpiEndpoint;
  }

  static async getOcpiEndpointWithToken(tenantID, token) {
    // Debug
    const uniqueTimerID = Logging.traceStart('OCPIEndpointStorage', 'getOcpiEndpointWithToken');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    const OCPIEndpoint = require('../../entity/OCPIEndpoint'); // Avoid circular deps!!!
    // Create Aggregation
    const aggregation = [];
    // Filters
    aggregation.push({
      $match: {localToken: token}
    });
    // Add Created By / Last Changed By
    DatabaseUtils.pushCreatedLastChangedInAggregation(tenantID,aggregation);
    // Read DB
    const ocpiEndpointsMDB = await global.database.getCollection(tenantID, 'ocpiendpoints')
      .aggregate(aggregation)
      .toArray();
    // Set
    let ocpiEndpoint = null;
    if (ocpiEndpointsMDB && ocpiEndpointsMDB.length > 0) {
      // Create
      ocpiEndpoint = new OCPIEndpoint(tenantID, ocpiEndpointsMDB[0]);
    }
    // Debug
    Logging.traceEnd('OCPIEndpointStorage', 'getOcpiEndpointWithToken', uniqueTimerID, {token});
    return ocpiEndpoint;
  }

  static async saveOcpiEndpoint(tenantID, ocpiEndpointToSave) {
    // Debug
    const uniqueTimerID = Logging.traceStart('OCPIEndpointStorage', 'saveOcpiEndpoint');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    const OCPIEndpoint = require('../../entity/OCPIEndpoint'); // Avoid circular deps!!!
    // Check if ID is provided
    if (!ocpiEndpointToSave.id && !ocpiEndpointToSave.name) {
      // ID must be provided!
      throw new BackendError(
        Constants.CENTRAL_SERVER,
        "OCPIEndpoint has no ID and no Name",
        "OCPIEndpointStorage", "saveOcpiEndpoint");
    }
    const ocpiEndpointFilter = {};
    // Build Request
    if (ocpiEndpointToSave.id) {
      ocpiEndpointFilter._id = Utils.convertUserToObjectID(ocpiEndpointToSave.id);
    } else {
      ocpiEndpointFilter._id = new ObjectID();
    }
    // Set Created By
    ocpiEndpointToSave.createdBy = Utils.convertUserToObjectID(ocpiEndpointToSave.createdBy);
    ocpiEndpointToSave.lastChangedBy = Utils.convertUserToObjectID(ocpiEndpointToSave.lastChangedBy);
    // Transfer
    const ocpiEndpoint = {};
    Database.updateOcpiEndpoint(ocpiEndpointToSave, ocpiEndpoint, false);
    // Modify
    const result = await global.database.getCollection(tenantID, 'ocpiendpoints').findOneAndUpdate(
      ocpiEndpointFilter,
      {$set: ocpiEndpoint},
      {upsert: true, new: true, returnOriginal: false});
    // Debug
    Logging.traceEnd('OCPIEndpointStorage', 'saveOcpiEndpoint', uniqueTimerID, {ocpiEndpointToSave});
    // Create
    return new OCPIEndpoint(tenantID, result.value);
  }

  // get default ocpiEndpoint - 
  // not quite sure how multiple OcpiEndpoint will be handled in futur - for now keep use the first available
  static async getDefaultOcpiEndpoint(tenantID) {
    const ocpiEndpoints = await this.getOcpiEndpoints(tenantID);

    return (ocpiEndpoints.result && ocpiEndpoints.result.length > 0)?ocpiEndpoints.result[0]:undefined;
  }

  // Delegate
  static async getOcpiEndpoints(tenantID, params = {}, limit, skip, sort) {
    // Debug
    const uniqueTimerID = Logging.traceStart('OCPIEndpointStorage', 'getOcpiEndpoints');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    const OCPIEndpoint = require('../../entity/OCPIEndpoint'); // Avoid fucking circular deps!!!
    // Check Limit
    limit = Utils.checkRecordLimit(limit);
    // Check Skip
    skip = Utils.checkRecordSkip(skip);
    // Set the filters
    const filters = {};
    // Source?
    if (params.search) {
      // Build filter
      filters.$or = [
        {"name": {$regex: params.search, $options: 'i'}}
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
    const ocpiEndpointsCountMDB = await global.database.getCollection(tenantID, 'ocpiendpoints')
      .aggregate([...aggregation, {$count: "count"}])
      .toArray();
    // Add Created By / Last Changed By
    DatabaseUtils.pushCreatedLastChangedInAggregation(tenantID,aggregation);
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
          name: 1
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
    const ocpiEndpointsMDB = await global.database.getCollection(tenantID, 'ocpiendpoints')
      .aggregate(aggregation, {collation: {locale: Constants.DEFAULT_LOCALE, strength: 2}})
      .toArray();
    const ocpiEndpoints = [];
    // Check
    if (ocpiEndpointsMDB && ocpiEndpointsMDB.length > 0) {
      // Create
      for (const ocpiEndpointMDB of ocpiEndpointsMDB) {
        // Add
        ocpiEndpoints.push(new OCPIEndpoint(tenantID, ocpiEndpointMDB));
      }
    }
    // Debug
    Logging.traceEnd('OCPIEndpointStorage', 'getOcpiEndpoints',uniqueTimerID, {params, limit, skip, sort});
    // Ok
    return {
      count: (ocpiEndpointsCountMDB.length > 0 ? ocpiEndpointsCountMDB[0].count : 0),
      result: ocpiEndpoints
    };
  }

  static async deleteOcpiEndpoint(tenantID, id) {
    // Debug
    const uniqueTimerID = Logging.traceStart('OCPIEndpointStorage', 'deleteOcpiEndpoint');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Delete OcpiEndpoint
    await global.database.getCollection(tenantID, 'ocpiendpoints')
      .findOneAndDelete({'_id': Utils.convertToObjectID(id)});
    // Debug
    Logging.traceEnd('OCPIEndpointStorage', 'deleteOcpiEndpoint', uniqueTimerID, {id});
  }
}

module.exports = OCPIEndpointStorage;
