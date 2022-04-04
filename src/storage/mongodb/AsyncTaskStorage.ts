import AsyncTask, { AsyncTaskStatus } from '../../types/AsyncTask';
import global, { DatabaseCount, FilterParams } from '../../types/GlobalType';

import Constants from '../../utils/Constants';
import { DataResult } from '../../types/DataResult';
import DatabaseUtils from './DatabaseUtils';
import DbParams from '../../types/database/DbParams';
import Logging from '../../utils/Logging';
import { ObjectId } from 'mongodb';
import Utils from '../../utils/Utils';

const MODULE_NAME = 'AsyncTaskStorage';

export default class AsyncTaskStorage {
  public static async getAsyncTask(id: string = Constants.UNKNOWN_OBJECT_ID,
      params = {}, projectFields?: string[]): Promise<AsyncTask> {
    const asyncTasksMDB = await AsyncTaskStorage.getAsyncTasks({
      asyncTaskIDs: [id],
    }, Constants.DB_PARAMS_SINGLE_RECORD, projectFields);
    return asyncTasksMDB.count === 1 ? asyncTasksMDB.result[0] : null;
  }

  public static async saveAsyncTask(asyncTaskToSave: AsyncTask): Promise<string> {
    const startTime = Logging.traceDatabaseRequestStart();
    // Set
    const asyncTaskMDB: any = {
      _id: asyncTaskToSave.id ? DatabaseUtils.convertToObjectID(asyncTaskToSave.id) : new ObjectId(),
      name: asyncTaskToSave.name,
      action: asyncTaskToSave.action,
      type: asyncTaskToSave.type,
      tenantID: DatabaseUtils.convertToObjectID(asyncTaskToSave.tenantID),
      status: asyncTaskToSave.status,
      parent: asyncTaskToSave.parent,
      execHost: asyncTaskToSave.execHost,
      execTimestamp: Utils.convertToDate(asyncTaskToSave.execTimestamp),
      execDurationSecs: Utils.convertToFloat(asyncTaskToSave.execDurationSecs),
      module: asyncTaskToSave.module,
      method: asyncTaskToSave.method,
      message: asyncTaskToSave.message,
      parameters: asyncTaskToSave.parameters,
    };
    // Add Last Changed/Created props
    DatabaseUtils.addLastChangedCreatedProps(asyncTaskMDB, asyncTaskToSave);
    // Modify
    await global.database.getCollection<any>(Constants.DEFAULT_TENANT_ID, 'asynctasks').findOneAndUpdate(
      { _id: asyncTaskMDB._id },
      { $set: asyncTaskMDB },
      { upsert: true }
    );
    await Logging.traceDatabaseRequestEnd(Constants.DEFAULT_TENANT_OBJECT, MODULE_NAME, 'saveAsyncTask', startTime, asyncTaskMDB);
    return asyncTaskMDB._id;
  }

  public static async getAsyncTasks(params: { status?: AsyncTaskStatus, asyncTaskIDs?: string[] } = {},
      dbParams?: DbParams, projectFields?: string[]): Promise<DataResult<AsyncTask>> {
    const startTime = Logging.traceDatabaseRequestStart();
    // Clone before updating the values
    dbParams = Utils.cloneObject(dbParams);
    // Check Limit
    dbParams.limit = Utils.checkRecordLimit(dbParams.limit);
    // Check Skip
    dbParams.skip = Utils.checkRecordSkip(dbParams.skip);
    // Create Aggregation
    const aggregation = [];
    // Set the filters
    const filters: FilterParams = {};
    // Async task IDs
    if (!Utils.isEmptyArray(params.asyncTaskIDs)) {
      filters._id = {
        $in: params.asyncTaskIDs
      };
    }
    // Status
    if (params.status) {
      filters.status = params.status;
    }
    // Add filters
    aggregation.push({
      $match: filters
    });
    // Limit records?
    if (!dbParams.onlyRecordCount) {
      // Always limit the nbr of record to avoid perfs issues
      aggregation.push({ $limit: Constants.DB_RECORD_COUNT_CEIL });
    }
    // Count Records
    const asyncTasksCountMDB = await global.database.getCollection<any>(Constants.DEFAULT_TENANT_ID, 'asynctasks')
      .aggregate([...aggregation, { $count: 'count' }], DatabaseUtils.buildAggregateOptions())
      .toArray() as DatabaseCount[];
    // Check if only the total count is requested
    if (dbParams.onlyRecordCount) {
      // Return only the count
      await Logging.traceDatabaseRequestEnd(Constants.DEFAULT_TENANT_OBJECT, MODULE_NAME, 'getAsyncTasks', startTime, aggregation, asyncTasksCountMDB);
      return {
        count: (asyncTasksCountMDB.length > 0 ? asyncTasksCountMDB[0].count : 0),
        result: []
      };
    }
    // Remove the limit
    aggregation.pop();
    // Sort
    if (!dbParams.sort) {
      dbParams.sort = { createdOn: -1 };
    }
    aggregation.push({
      $sort: dbParams.sort
    });
    // Skip
    if (dbParams.skip > 0) {
      aggregation.push({ $skip: dbParams.skip });
    }
    // Limit
    aggregation.push({
      $limit: dbParams.limit
    });
    // Handle the ID
    DatabaseUtils.pushRenameDatabaseID(aggregation);
    // Add Created By / Last Changed By
    DatabaseUtils.pushCreatedLastChangedInAggregation(Constants.DEFAULT_TENANT_ID, aggregation);
    // Project
    DatabaseUtils.projectFields(aggregation, projectFields);
    // Read DB
    const asyncTasksMDB = await global.database.getCollection<any>(Constants.DEFAULT_TENANT_ID, 'asynctasks')
      .aggregate<any>(aggregation, DatabaseUtils.buildAggregateOptions())
      .toArray() as AsyncTask[];
    await Logging.traceDatabaseRequestEnd(Constants.DEFAULT_TENANT_OBJECT, MODULE_NAME, 'getAsyncTasks', startTime, aggregation, asyncTasksMDB);
    return {
      count: DatabaseUtils.getCountFromDatabaseCount(asyncTasksCountMDB[0]),
      result: asyncTasksMDB
    };
  }

  public static async updateRunningAsyncTaskToPending(): Promise<number> {
    const startTime = Logging.traceDatabaseRequestStart();
    // Delete the AsyncTask
    const result = await global.database.getCollection<any>(Constants.DEFAULT_TENANT_ID, 'asynctasks').updateMany(
      { 'status': AsyncTaskStatus.RUNNING },
      { '$set': { 'status': AsyncTaskStatus.PENDING } }
    );
    await Logging.traceDatabaseRequestEnd(Constants.DEFAULT_TENANT_OBJECT, MODULE_NAME, 'updateRunningAsyncTaskToPending', startTime, { 'status': AsyncTaskStatus.PENDING });
    return result.modifiedCount;
  }

  public static async deleteAsyncTask(id: string): Promise<void> {
    const startTime = Logging.traceDatabaseRequestStart();
    // Delete the AsyncTask
    await global.database.getCollection<any>(Constants.DEFAULT_TENANT_ID, 'asynctasks')
      .findOneAndDelete({ '_id': id });
    await Logging.traceDatabaseRequestEnd(Constants.DEFAULT_TENANT_OBJECT, MODULE_NAME, 'deleteAsyncTask', startTime, { id });
  }
}
