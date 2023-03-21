import global, { DatabaseCount, FilterParams } from '../../types/GlobalType';

import Constants from '../../utils/Constants';
import { DataResult } from '../../types/DataResult';
import DatabaseUtils from './DatabaseUtils';
import DbParams from '../../types/database/DbParams';
import Logging from '../../utils/Logging';
import { ObjectId } from 'mongodb';
import { RawNotification } from '../../types/UserNotifications';
import Tenant from '../../types/Tenant';
import Utils from '../../utils/Utils';

const MODULE_NAME = 'RawNotificationStorage';

export default class RawNotificationStorage {

  public static async getRawNotification(tenant: Tenant, params: { discriminator: string; serverAction: string }, projectFields: string[] = ['_id']): Promise<RawNotification> {
    const notificationsMDB = await RawNotificationStorage.getRawNotifications(tenant, {
      discriminator: params.discriminator,
      serverAction: params.serverAction
    }, Constants.DB_PARAMS_SINGLE_RECORD, projectFields);
    return notificationsMDB.count === 1 ? notificationsMDB.result[0] : null;
  }

  public static async getRawNotifications(tenant: Tenant,
      params: { dateFrom?: Date; discriminator?: string; serverAction?: string; },
      dbParams: DbParams, projectFields?: string[]): Promise<DataResult<RawNotification>> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Clone before updating the values
    dbParams = Utils.cloneObject(dbParams);
    // Check Limit
    dbParams.limit = Utils.checkRecordLimit(dbParams.limit);
    // Check Skip
    dbParams.skip = Utils.checkRecordSkip(dbParams.skip);
    // Create Aggregation
    const aggregation: any[] = [];
    // Set the filters
    const filters: FilterParams = {};
    // Set Date From?
    if (params.dateFrom) {
      filters.timestamp = {};
      filters.timestamp.$gte = Utils.convertToDate(params.dateFrom);
    }
    // Filter on the action?
    if (params.serverAction) {
      filters.serverAction = params.serverAction;
    }
    // Filter on the discriminator?
    if (params.discriminator) {
      filters.discriminator = params.discriminator;
    }
    // Filters
    aggregation.push({
      $match: filters
    });
    // Limit records?
    if (!dbParams.onlyRecordCount) {
      aggregation.push({ $limit: Constants.DB_RECORD_COUNT_CEIL });
    }
    // Count Records
    const notificationsCountMDB = await global.database.getCollection<any>(tenant.id, 'rawnotifications')
      .aggregate([...aggregation, { $count: 'count' }], DatabaseUtils.buildAggregateOptions())
      .toArray() as DatabaseCount[];
    // Check if only the total count is requested
    if (dbParams.onlyRecordCount) {
      return {
        count: (notificationsCountMDB.length > 0 ? notificationsCountMDB[0].count : 0),
        result: []
      };
    }
    // Remove the limit
    aggregation.pop();
    // Sort
    if (dbParams.sort) {
      aggregation.push({
        $sort: dbParams.sort
      });
    }
    // Skip
    aggregation.push({
      $skip: dbParams.skip
    });
    // Limit
    aggregation.push({
      $limit: dbParams.limit
    });
    // Project
    DatabaseUtils.projectFields(aggregation, projectFields);
    // Read DB
    const notificationsMDB = await global.database.getCollection<any>(tenant.id, 'rawnotifications')
      .aggregate<any>(aggregation, DatabaseUtils.buildAggregateOptions())
      .toArray() as RawNotification[];
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'getRawNotifications', startTime, aggregation, notificationsMDB);
    return {
      count: (notificationsCountMDB.length > 0 ? notificationsCountMDB[0].count : 0),
      result: notificationsMDB
    };
  }

  public static async saveRawNotification(tenant: Tenant, notificationToSave: Partial<RawNotification>): Promise<void> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    const notificationsMDB: any = {
      _id: notificationToSave.id ? DatabaseUtils.convertToObjectID(notificationToSave.id) : new ObjectId(),
      timestamp: Utils.convertToDate(notificationToSave.timestamp),
      discriminator: notificationToSave.discriminator,
      serverAction: notificationToSave.serverAction,
      data: notificationToSave.data,
    };
    // Create
    await global.database.getCollection<any>(tenant.id, 'rawnotifications')
      .insertOne(notificationsMDB);
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'saveRawNotification', startTime, notificationsMDB);
  }
}
