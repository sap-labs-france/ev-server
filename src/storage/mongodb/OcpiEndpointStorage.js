const ObjectID = require('mongodb').ObjectID;
const Constants = require('../../utils/Constants');
const Database = require('../../utils/Database');
const Utils = require('../../utils/Utils');
const AppError = require('../../exception/AppError');
const DatabaseUtils = require('./DatabaseUtils');
const Logging = require('../../utils/Logging');

class OcpiEndpointStorage {
  static async getOcpiEndpoint(tenantID, id) {
    // Debug
    Logging.traceStart('OcpiEndpointStorage', 'getOcpiEndpoint');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    const OcpiEndpoint = require('../../entity/OcpiEndpoint'); // Avoid fucking circular deps!!!
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
      ocpiEndpoint = new OcpiEndpoint(tenantID, ocpiEndpointsMDB[0]);
    }
    // Debug
    Logging.traceEnd('OcpiEndpointStorage', 'getOcpiEndpoint');
    return ocpiEndpoint;
  }

  static async saveOcpiEndpoint(tenantID, ocpiEndpointToSave) {
    // Debug
    Logging.traceStart('OcpiEndpointStorage', 'saveOcpiEndpoint');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    const OcpiEndpoint = require('../../entity/OcpiEndpoint'); // Avoid fucking circular deps!!!
    // Check if ID is provided
    if (!ocpiEndpointToSave.id && !ocpiEndpointToSave.name) {
      // ID must be provided!
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `OCPIEndpoint has no ID and no Name`,
        550, "OcpiEndpointStorage", "saveOcpiEndpoint");
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
    Logging.traceEnd('OcpiEndpointStorage', 'saveOcpiEndpoint');
    // Create
    return new OcpiEndpoint(tenantID, result.value);
  }

  // Delegate
  static async getOcpiEndpoints(tenantID, params = {}, limit, skip, sort) {
    // Debug
    Logging.traceStart('OcpiEndpointStorage', 'getOcpiEndpoints');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    const OcpiEndpoint = require('../../entity/OcpiEndpoint'); // Avoid fucking circular deps!!!
    // Check Limit
    limit = Utils.checkRecordLimit(limit);
    // Check Skip
    skip = Utils.checkRecordSkip(skip);
    // Set the filters
    const filters = {};
    // Source?
    if (params.search) {
      // Build filter TODO: check filters
      // filters.$or = [
      //   {"model": {$regex: params.search, $options: 'i'}}
      // ];
    }
    // Set Company? TODO: check filter
    // if (params.vehicleManufacturerID) {
    //   filters.vehicleManufacturerID = Utils.convertToObjectID(params.vehicleManufacturerID);
    // }

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
      // Default TODO: check default sorting
      // aggregation.push({
      //   $sort: {
      //     manufacturer: 1, model: 1
      //   }
      // });
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
        ocpiEndpoints.push(new OcpiEndpoint(tenantID, ocpiEndpointMDB));
      }
    }
    // Debug
    Logging.traceEnd('OcpiEndpointStorage', 'getOcpiEndpoints');
    // Ok
    return {
      count: (ocpiEndpointsCountMDB.length > 0 ? ocpiEndpointsCountMDB[0].count : 0),
      result: ocpiEndpoints
    };
  }

  static async deleteOcpiEndpoint(tenantID, id) {
    // Debug
    Logging.traceStart('OcpiEndpointStorage', 'deleteOcpiEndpoint');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Delete OcpiEndpoint
    await global.database.getCollection(tenantID, 'ocpiendpoints')
      .findOneAndDelete({'_id': Utils.convertToObjectID(id)});
    // Debug
    Logging.traceEnd('OcpiEndpointStorage', 'deleteOcpiEndpoint');
  }
}

module.exports = OcpiEndpointStorage;
