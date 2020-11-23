import global, { FilterParams } from './../../types/GlobalType';

import Configuration from '../../utils/Configuration';
import Constants from '../../utils/Constants';
import { DataResult } from '../../types/DataResult';
import DatabaseUtils from './DatabaseUtils';
import DbParams from '../../types/database/DbParams';
import { Log } from '../../types/Log';
import Logging from '../../utils/Logging';
import Utils from '../../utils/Utils';
import cfenv from 'cfenv';
import cluster from 'cluster';
import os from 'os';

const MODULE_NAME = 'LoggingStorage';

export default class LoggingStorage {
  public static async deleteLogs(tenantID: string, deleteUpToDate: Date): Promise<{ ok?: number; n?: number; }> {
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Build filter
    const filters: FilterParams = {};
    // Do Not Delete Security Logs
    filters.type = {};
    filters.type.$ne = 'S';
    // Date provided?
    if (deleteUpToDate) {
      filters.timestamp = {};
      filters.timestamp.$lte = Utils.convertToDate(deleteUpToDate);
    } else {
      return;
    }
    // Delete Logs
    const result = await global.database.getCollection<Log>(tenantID, 'logs')
      .deleteMany(filters);
    // Return the result
    return result.result;
  }

  public static async deleteSecurityLogs(tenantID: string, deleteUpToDate: Date): Promise<{ ok?: number; n?: number; }> {
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Build filter
    const filters: FilterParams = {};
    // Delete Only Security Logs
    filters.type = {};
    filters.type.$eq = 'S';
    // Date provided?
    if (deleteUpToDate) {
      filters.timestamp = {};
      filters.timestamp.$lte = Utils.convertToDate(deleteUpToDate);
    } else {
      return;
    }
    // Delete Logs
    const result = await global.database.getCollection<Log>(tenantID, 'logs')
      .deleteMany(filters);
    // Return the result
    return result.result;
  }

  public static async saveLog(tenantID: string, logToSave: Log): Promise<void> {
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Set
    const logMDB: any = {
      userID: logToSave.user ? Utils.convertUserToObjectID(logToSave.user) : null,
      actionOnUserID: Utils.convertUserToObjectID(logToSave.actionOnUser),
      level: logToSave.level,
      source: logToSave.source,
      host: logToSave.host ? logToSave.host : (Configuration.isCloudFoundry() ? cfenv.getAppEnv().name : os.hostname()),
      process: logToSave.process ? logToSave.process : (cluster.isWorker ? 'worker ' + cluster.worker.id.toString() : 'master'),
      type: logToSave.type,
      timestamp: Utils.convertToDate(logToSave.timestamp),
      module: logToSave.module,
      method: logToSave.method,
      action: logToSave.action,
      message: logToSave.message,
      detailedMessages: logToSave.detailedMessages
    };
    // Insert
    if (global.database) {
      await global.database.getCollection<Log>(tenantID, 'logs').insertOne(logMDB);
    }
  }

  public static async getLog(tenantID: string, id: string = Constants.UNKNOWN_OBJECT_ID, projectFields: string[]): Promise<Log> {
    const logsMDB = await LoggingStorage.getLogs(tenantID, {
      logIDs: [id]
    }, Constants.DB_PARAMS_SINGLE_RECORD, projectFields);
    return logsMDB.count === 1 ? logsMDB.result[0] : null;
  }

  public static async getLogs(tenantID: string, params: {
    startDateTime?: Date; endDateTime?: Date; levels?: string[]; sources?: string[]; type?: string; actions?: string[];
    hosts?: string[]; userIDs?: string[]; search?: string; logIDs?: string[];
  } = {}, dbParams: DbParams, projectFields: string[]): Promise<DataResult<Log>> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'getLogs');
    // Check Tenant
    await Utils.checkTenant(tenantID);
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
      filters.$text = { $search: params.search };
    }
    // Date provided?
    if (params.startDateTime || params.endDateTime) {
      filters.timestamp = {};
    }
    // Start date
    if (params.startDateTime) {
      filters.timestamp.$gte = Utils.convertToDate(params.startDateTime);
    }
    // End date
    if (params.endDateTime) {
      filters.timestamp.$lte = Utils.convertToDate(params.endDateTime);
    }
    // Filter on log levels
    if (params.levels && params.levels.length > 0) {
      filters.level = { $in: params.levels };
    }
    // Filter on charging Stations
    if (params.sources && params.sources.length > 0) {
      filters.source = { $in: params.sources };
    }
    // Type
    if (params.type) {
      filters.type = params.type;
    }
    // Filter on actions
    if (params.actions && params.actions.length > 0) {
      filters.action = { $in: params.actions };
    }
    // Filter on host
    if (params.hosts && params.hosts.length > 0) {
      filters.host = { $in: params.hosts };
    }
    // Filter on users
    if (!Utils.isEmptyArray(params.userIDs)) {
      filters.$or = [
        { userID: { $in: params.userIDs.map((userID) => Utils.convertToObjectID(userID)) } },
        { actionOnUserID: { $in: params.userIDs.map((userID) => Utils.convertToObjectID(userID)) } }
      ];
    }
    // Log ID
    if (!Utils.isEmptyArray(params.logIDs)) {
      filters._id = {
        $in: params.logIDs.map((logID) => Utils.convertToObjectID(logID))
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
    const loggingsCountMDB = await global.database.getCollection<any>(tenantID, 'logs')
      .aggregate([...aggregation, { $count: 'count' }], {
        collation: {
          locale: Constants.DEFAULT_LOCALE,
          strength: 2
        }
      })
      .toArray();
    // Check if only the total count is requested
    if (dbParams.onlyRecordCount) {
      Logging.traceEnd(tenantID, MODULE_NAME, 'getLogs', uniqueTimerID, loggingsCountMDB);
      return {
        count: (loggingsCountMDB.length > 0 ? loggingsCountMDB[0].count : 0),
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
      tenantID,
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
      tenantID,
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
    const loggingsMDB = await global.database.getCollection<Log>(tenantID, 'logs')
      .aggregate(aggregation, { allowDiskUse: true })
      .toArray();
    // Debug
    Logging.traceEnd(tenantID, MODULE_NAME, 'getLogs', uniqueTimerID, loggingsMDB);
    // Ok
    return {
      count: (loggingsCountMDB.length > 0 ?
        (loggingsCountMDB[0].count === Constants.DB_RECORD_COUNT_CEIL ? -1 : loggingsCountMDB[0].count) : 0),
      result: loggingsMDB
    };
  }
}
