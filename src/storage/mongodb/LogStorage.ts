import { DataResult, DeletedResult } from '../../types/DataResult';
import global, { DatabaseCount, FilterParams } from '../../types/GlobalType';

import Constants from '../../utils/Constants';
import DatabaseUtils from './DatabaseUtils';
import DbParams from '../../types/database/DbParams';
import { Log } from '../../types/Log';
import { ServerType } from '../../types/Server';
import Tenant from '../../types/Tenant';
import Utils from '../../utils/Utils';

export default class LogStorage {
  public static async deleteLogs(tenant: Tenant, deleteUpToDate: Date): Promise<DeletedResult> {
    DatabaseUtils.checkTenantObject(tenant);
    // Build filter
    const filters: FilterParams = {};
    // Date provided?
    if (deleteUpToDate) {
      filters.timestamp = {};
      filters.timestamp.$lte = Utils.convertToDate(deleteUpToDate);
    } else {
      return;
    }
    // Delete Logs
    const result = await global.database.getCollection<any>(tenant.id, 'logs')
      .deleteMany(filters);
    // Return the result
    return { acknowledged: result.acknowledged, deletedCount: result.deletedCount };
  }

  public static async saveLog(tenantID: string, logToSave: Log): Promise<string> {
    // Set
    const logMDB: any = {
      userID: logToSave.user ? DatabaseUtils.convertUserToObjectID(logToSave.user) : null,
      actionOnUserID: DatabaseUtils.convertUserToObjectID(logToSave.actionOnUser),
      level: logToSave.level,
      chargingStationID: logToSave.chargingStationID,
      companyID: DatabaseUtils.convertToObjectID(logToSave.companyID),
      siteID: DatabaseUtils.convertToObjectID(logToSave.siteID),
      siteAreaID: DatabaseUtils.convertToObjectID(logToSave.siteAreaID),
      source: global.serverType ?? ServerType.CENTRAL_SERVER,
      host: logToSave.host ? logToSave.host : Utils.getHostName(),
      timestamp: Utils.convertToDate(logToSave.timestamp),
      module: logToSave.module,
      method: logToSave.method,
      action: logToSave.action,
      message: logToSave.message,
      detailedMessages: logToSave.detailedMessages
    };
    // Insert
    if (global.database) {
      await global.database.getCollection<any>(tenantID, 'logs').insertOne(logMDB);
      return logMDB._id.toString();
    }
  }

  public static async getLog(tenant: Tenant, id: string = Constants.UNKNOWN_OBJECT_ID,
      params: { siteIDs?: string[]; } = {}, projectFields: string[]): Promise<Log> {
    const logsMDB = await LogStorage.getLogs(tenant, {
      logIDs: [id],
      siteIDs: params.siteIDs,
    }, Constants.DB_PARAMS_SINGLE_RECORD, projectFields);
    return logsMDB.count === 1 ? logsMDB.result[0] : null;
  }

  public static async getLogs(tenant: Tenant, params: {
    startDateTime?: Date; endDateTime?: Date; levels?: string[]; sources?: string[]; type?: string; actions?: string[];
    hosts?: string[]; userIDs?: string[]; siteIDs?: string[]; chargingStationIDs?: string[]; search?: string; logIDs?: string[];
  } = {}, dbParams: DbParams, projectFields: string[]): Promise<DataResult<Log>> {
    DatabaseUtils.checkTenantObject(tenant);
    // Clone before updating the values
    dbParams = Utils.cloneObject(dbParams);
    // Check Limit
    dbParams.limit = Utils.checkRecordLimit(dbParams.limit);
    // Check Skip
    dbParams.skip = Utils.checkRecordSkip(dbParams.skip);
    // Set the filters
    const filters: FilterParams = {};
    // Search
    if (params.search) {
      filters.$text = { $search: `"${params.search}"` };
    }
    // Date provided?
    if (params.startDateTime || params.endDateTime) {
      filters.timestamp = {};
      // Start date
      if (params.startDateTime) {
        filters.timestamp.$gte = Utils.convertToDate(params.startDateTime);
      }
      // End date
      if (params.endDateTime) {
        filters.timestamp.$lte = Utils.convertToDate(params.endDateTime);
      }
    }
    // ID
    if (!Utils.isEmptyArray(params.logIDs)) {
      filters._id = {
        $in: params.logIDs.map((logID) => DatabaseUtils.convertToObjectID(logID))
      };
    }
    // Level
    if (params.levels && params.levels.length > 0) {
      filters.level = { $in: params.levels };
    }
    // Source
    if (params.sources && params.sources.length > 0) {
      filters.source = { $in: params.sources };
    }
    // Type
    if (params.type) {
      filters.type = params.type;
    }
    // Action
    if (params.actions && params.actions.length > 0) {
      filters.action = { $in: params.actions };
    }
    // Host
    if (params.hosts && params.hosts.length > 0) {
      filters.host = { $in: params.hosts };
    }
    // Site
    if (!Utils.isEmptyArray(params.siteIDs)) {
      filters.siteID = {
        $in: params.siteIDs.map((siteID) => DatabaseUtils.convertToObjectID(siteID))
      };
    }
    // User
    if (!Utils.isEmptyArray(params.userIDs)) {
      filters.$or = [
        { userID: { $in: params.userIDs.map((userID) => DatabaseUtils.convertToObjectID(userID)) } },
        { actionOnUserID: { $in: params.userIDs.map((userID) => DatabaseUtils.convertToObjectID(userID)) } }
      ];
    }
    // Charging Station
    if (!Utils.isEmptyArray(params.chargingStationIDs)) {
      filters.chargingStationID = {
        $in: params.chargingStationIDs
      };
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
    if (!dbParams.onlyRecordCount) {
      // Always limit the nbr of record to avoid perfs issues
      aggregation.push({ $limit: Constants.DB_RECORD_COUNT_CEIL });
    }
    const logsCountMDB = await global.database.getCollection<any>(tenant.id, 'logs')
      .aggregate([...aggregation, { $count: 'count' }])
      .toArray() as DatabaseCount[];
    // Check if only the total count is requested
    if (dbParams.onlyRecordCount) {
      return {
        count: (logsCountMDB.length > 0 ? logsCountMDB[0].count : 0),
        result: []
      };
    }
    // Remove the limit
    aggregation.pop();
    // Sort
    if (!dbParams.sort) {
      dbParams.sort = { timestamp: -1 };
    }
    aggregation.push({
      $sort: dbParams.sort
    });
    // Skip
    aggregation.push({
      $skip: dbParams.skip
    });
    // Limit
    aggregation.push({
      $limit: dbParams.limit
    });
    // Add Users
    DatabaseUtils.pushUserLookupInAggregation({
      tenantID: tenant.id,
      aggregation: aggregation,
      asField: 'user',
      localField: 'userID',
      foreignField: '_id',
      oneToOneCardinality: true,
      oneToOneCardinalityNotNull: false
    }, [
      { $project: { name: 1, firstName: 1 } }
    ]);
    DatabaseUtils.pushUserLookupInAggregation({
      tenantID: tenant.id,
      aggregation: aggregation,
      asField: 'actionOnUser',
      localField: 'actionOnUserID',
      foreignField: '_id',
      oneToOneCardinality: true,
      oneToOneCardinalityNotNull: false
    }, [
      { $project: { name: 1, firstName: 1 } }
    ]);
    // Check if it has detailed messages
    aggregation.push({
      $addFields: {
        'hasDetailedMessages': { $gt: ['$detailedMessages', null] }
      }
    });
    // Change ID
    DatabaseUtils.pushRenameDatabaseID(aggregation);
    // Project
    DatabaseUtils.projectFields(aggregation, projectFields);
    // Read DB
    const logsMDB = await global.database.getCollection<any>(tenant.id, 'logs')
      .aggregate<any>(aggregation, DatabaseUtils.buildAggregateOptions())
      .toArray() as Log[];
    return {
      count: DatabaseUtils.getCountFromDatabaseCount(logsCountMDB[0]),
      result: logsMDB
    };
  }
}
