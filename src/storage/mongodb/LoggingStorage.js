const Utils = require('../../utils/Utils');
const Database = require('../../utils/Database');
const Constants = require('../../utils/Constants');
const DatabaseUtils = require('./DatabaseUtils');

class LoggingStorage {
  static async deleteLogs(tenantID, deleteUpToDate) {
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Build filter
    const filters = {};
    // Do Not Delete Security Logs
    filters.type = {};
    filters.type.$ne = 'S';
    // Date provided?
    if (deleteUpToDate) {
      filters.timestamp = {};
      filters.timestamp.$lte = new Date(deleteUpToDate);
    } else {
      return;
    }
    // Delete Logs
    const result = await global.database.getCollection(tenantID, 'logs')
      .deleteMany(filters);
    // Return the result
    return result.result;
  }

  static async deleteSecurityLogs(tenantID, deleteUpToDate) {
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Build filter
    const filters = {};
    // Delete Only Security Logs
    filters.type = {};
    filters.type.$eq = 'S';
    // Date provided?
    if (deleteUpToDate) {
      filters.timestamp = {};
      filters.timestamp.$lte = new Date(deleteUpToDate);
    } else {
      return;
    }
    // Delete Logs
    const result = await global.database.getCollection(tenantID, 'logs')
      .deleteMany(filters);
    // Return the result
    return result.result;
  }

  static async saveLog(tenantID, logToSave) {
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Check User
    logToSave.userID = Utils.convertUserToObjectID(logToSave.user);
    logToSave.actionOnUserID = Utils.convertUserToObjectID(logToSave.actionOnUser);
    // Transfer
    const log = {};
    Database.updateLogging(logToSave, log, false);
    // Insert
    await global.database.getCollection(tenantID, 'logs').insertOne(log);
  }

  static async getLog(tenantID, id) {
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Read DB
    const loggingMDB = await global.database.getCollection(tenantID, 'logs')
      .find({_id: Utils.convertToObjectID(id)})
      .limit(1)
      .toArray();
    let logging = null;
    // Set
    if (loggingMDB && loggingMDB.length > 0) {
      // Set
      logging = {};
      Database.updateLogging(loggingMDB[0], logging);
    }
    return logging;
  }

  static async getLogs(tenantID, params = {}, limit, skip, sort) {
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Check Limit
    limit = Utils.checkRecordLimit(limit);
    // Check Skip
    skip = Utils.checkRecordSkip(skip);
    // Set the filters
    const filters = {};
    // Date provided?
    if (params.dateFrom || params.dateUntil) {
      filters.timestamp = {};
    }
    // Start date
    if (params.dateFrom) {
      filters.timestamp.$gte = new Date(params.dateFrom);
    }
    // End date
    if (params.dateUntil) {
      filters.timestamp.$lte = new Date(params.dateUntil);
    }

    // Log level
    switch (params.level) {
      // Error
      case 'E':
        // Build filter
        filters.level = 'E';
        break;
      // Warning
      case 'W':
        filters.level = {$in: ['E', 'W']};
        break;
      // Info
      case 'I':
        filters.level = {$in: ['E', 'W', 'I']};
        break;
    }
    // Charging Station
    if (params.source) {
      // Yes, add in filter
      filters.source = params.source;
    }
    // Type
    if (params.type) {
      // Yes, add in filter
      filters.type = params.type;
    }
    // Action
    if (params.action) {
      // Yes, add in filter
      filters.action = params.action;
    }
    // User ID
    if (params.userID) {
      // Yes, add in filter
      filters.$or = [
        {'userID': Utils.convertToObjectID(params.userID)},
        {'actionOnUserID': Utils.convertToObjectID(params.userID)}
      ];
    }
    // Source?
    if (params.search) {
      // Set
      const searchArray = [
        {'message': {$regex: params.search, $options: 'i'}},
        {'action': {$regex: params.search, $options: 'i'}}
      ];
      // Already exists?
      if (filters.$or) {
        // Add them all
        filters.$and = [
          {$or: [...filters.$or]},
          {$or: [...searchArray]},
        ];
      } else {
        // Only one
        filters.$or = searchArray;
      }
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
    const loggingsCountMDB = await global.database.getCollection(tenantID, 'logs')
      .aggregate([...aggregation, {$count: 'count'}], {collation: {locale: Constants.DEFAULT_LOCALE, strength: 2}})
      .toArray();
    // Sort
    if (sort) {
      // Sort
      aggregation.push({
        $sort: sort
      });
    } else {
      // Default
      aggregation.push({
        $sort: {timestamp: -1}
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
    // User
    aggregation.push({
      $lookup: {
        from: DatabaseUtils.getCollectionName(tenantID, 'users'),
        localField: 'userID',
        foreignField: '_id',
        as: 'user'
      }
    });
    // Single Record
    aggregation.push({
      $unwind: {'path': '$user', 'preserveNullAndEmptyArrays': true}
    });
    // Action on User
    aggregation.push({
      $lookup: {
        from: DatabaseUtils.getCollectionName(tenantID, 'users'),
        localField: 'actionOnUserID',
        foreignField: '_id',
        as: 'actionOnUser'
      }
    });
    // Single Record
    aggregation.push({
      $unwind: {'path': '$actionOnUser', 'preserveNullAndEmptyArrays': true}
    });
    // Read DB
    const loggingsMDB = await global.database.getCollection(tenantID, 'logs')
      .aggregate(aggregation)
      .toArray();
    const loggings = [];
    for (const loggingMDB of loggingsMDB) {
      const logging = {};
      // Set
      Database.updateLogging(loggingMDB, logging);
      // Set the model
      loggings.push(logging);
    }
    // Ok
    return {
      count: (loggingsCountMDB.length > 0 ? loggingsCountMDB[0].count : 0),
      result: loggings
    };
  }
}

module.exports = LoggingStorage;
