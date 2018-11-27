const uuid = require('uuid/v4');
const Constants = require('../../utils/Constants');
const Database = require('../../utils/Database');
const Utils = require('../../utils/Utils');
const ObjectID = require('mongodb').ObjectID;
const AppError = require('../../exception/AppError');
const DatabaseUtils = require('./DatabaseUtils');
const Logging = require('../../utils/Logging');

class TenantStorage {
  static async getTenant(id) {
    const Tenant = require('../../entity/Tenant'); // Avoid fucking circular deps!!!
    // Debug
    const uniqueTimerID = uuid();
    Logging.traceStart('TenantStorage', 'getTenant', uniqueTimerID);
    // Create Aggregation
    const aggregation = [];
    // Filters
    aggregation.push({
      $match: {
        _id: Utils.convertToObjectID(id)
      }
    });
    // Add Created By / Last Changed By
    DatabaseUtils.pushCreatedLastChangedInAggregation('', aggregation);
    // Read DB
    const tenantsMDB = await global.database.getCollection(Constants.DEFAULT_TENANT, 'tenants')
      .aggregate(aggregation)
      .limit(1)
      .toArray();
    let tenant = null;
    // Found?
    if (tenantsMDB && tenantsMDB.length > 0) {
      // Create
      tenant = new Tenant(tenantsMDB[0]);
    }
    // Debug
    Logging.traceEnd('TenantStorage', 'getTenant', uniqueTimerID);
    return tenant;
  }

  static async getTenantByName(name) {
    // Get
    return await TenantStorage.getTenantByFilter({'name': name});
  }

  static async getTenantBySubdomain(subdomain) {
    // Get
    return await TenantStorage.getTenantByFilter({'subdomain': subdomain});
  }

  static async getTenantByFilter(filter) {
    const Tenant = require('../../entity/Tenant'); // Avoid fucking circular deps!!!
    // Debug
    const uniqueTimerID = uuid();
    Logging.traceStart('TenantStorage', 'getTenantByFilter', uniqueTimerID);
    // Read DB
    const tenantsMDB = await global.database.getCollection(Constants.DEFAULT_TENANT, 'tenants')
      .find(filter)
      .limit(1)
      .toArray();
    let tenant = null;
    // Found?
    if (tenantsMDB && tenantsMDB.length > 0) {
      // Create
      tenant = new Tenant(tenantsMDB[0]);
    }
    // Debug
    Logging.traceEnd('TenantStorage', 'getTenantByFilter', uniqueTimerID);
    return tenant;
  }

  static async saveTenant(tenantToSave) {
    const Tenant = require('../../entity/Tenant'); // Avoid fucking circular deps!!!
    // Debug
    const uniqueTimerID = uuid();
    Logging.traceStart('TenantStorage', 'saveTenant', uniqueTimerID);
    // Check
    if (!tenantToSave.id && !tenantToSave.name) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `Tenant has no ID and no Name`,
        550, "TenantStorage", "saveTenant");
    }
    const tenantFilter = {};
    // Build Request
    if (tenantToSave.id) {
      tenantFilter._id = Utils.convertToObjectID(tenantToSave.id);
    } else {
      tenantFilter._id = new ObjectID();
    }
    // Check Created By/On
    tenantToSave.createdBy = Utils.convertUserToObjectID(tenantToSave.createdBy);
    tenantToSave.lastChangedBy = Utils.convertUserToObjectID(tenantToSave.lastChangedBy);
    // Transfer
    const tenant = {};
    Database.updateTenant(tenantToSave, tenant, false);
    // Modify
    const result = await global.database.getCollection(Constants.DEFAULT_TENANT, 'tenants').findOneAndUpdate(
      tenantFilter, {
        $set: tenant
      }, {
        upsert: true,
        new: true,
        returnOriginal: false
      });
    // Debug
    Logging.traceEnd('TenantStorage', 'saveTenant', uniqueTimerID);
    // Create
    return new Tenant(result.value);
  }

  static async createTenantDB(tenantID) {
    // Debug
    const uniqueTimerID = uuid();
    Logging.traceStart('TenantStorage', 'createTenantDB', uniqueTimerID);
    // Create DB
    await global.database.createTenantDatabase(tenantID);
    // Debug
    Logging.traceEnd('TenantStorage', 'createTenantDB', uniqueTimerID);
  }

  // Delegate
  static async getTenants(params = {}, limit, skip, sort) {
    const Tenant = require('../../entity/Tenant'); // Avoid fucking circular deps!!!
    // Debug
    const uniqueTimerID = uuid();
    Logging.traceStart('TenantStorage', 'getTenants', uniqueTimerID);
    // Check Limit
    limit = Utils.checkRecordLimit(limit);
    // Check Skip
    skip = Utils.checkRecordSkip(skip);
    // Set the filters
    const filters = {};
    // Source?
    if (params.search) {
      // Build filter
      filters.$or = [{
        "name": {
          $regex: params.search,
          $options: 'i'
        }
      }];
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
    const tenantsCountMDB = await global.database.getCollection(Constants.DEFAULT_TENANT, 'tenants')
      .aggregate([...aggregation, {
        $count: "count"
      }])
      .toArray();
    // Add Created By / Last Changed By
    DatabaseUtils.pushCreatedLastChangedInAggregation('',aggregation);
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
    const tenantsMDB = await global.database.getCollection(Constants.DEFAULT_TENANT, 'tenants')
      .aggregate(aggregation, {
        collation: {
          locale: Constants.DEFAULT_LOCALE,
          strength: 2
        }
      })
      .toArray();

    const tenants = [];
    // Create
    for (const tenantMDB of tenantsMDB) {
      // Add
      tenants.push(new Tenant(tenantMDB));
    }
    // Debug
    Logging.traceEnd('TenantStorage', 'getTenants', uniqueTimerID);
    // Ok
    return {
      count: (tenantsCountMDB.length > 0 ? tenantsCountMDB[0].count : 0),
      result: tenants
    };
  }

  static async deleteTenant(id) {
    // Debug
    const uniqueTimerID = uuid();
    Logging.traceStart('TenantStorage', 'deleteTenant', uniqueTimerID);
    // Delete
    await global.database.getCollection(Constants.DEFAULT_TENANT, 'tenants')
      .findOneAndDelete({
        '_id': Utils.convertToObjectID(id)
      });
    // Debug
    Logging.traceEnd('TenantStorage', 'deleteTenant', uniqueTimerID);
  }

  static async deleteTenantDB(id) {
    // Debug
    const uniqueTimerID = uuid();
    Logging.traceStart('TenantStorage', 'deleteTenantDB', uniqueTimerID);
    // Delete
    await global.database.deleteTenantDatabase(id);
    // Debug
    Logging.traceEnd('TenantStorage', 'deleteTenantDB', uniqueTimerID);
  }
}

module.exports = TenantStorage;