import global, { FilterParams } from '../../types/GlobalType';

import Constants from '../../utils/Constants';
import Cypher from '../../utils/Cypher';
import { DataResult } from '../../types/DataResult';
import DatabaseUtils from './DatabaseUtils';
import DbParams from '../../types/database/DbParams';
import Logging from '../../utils/Logging';
import { Notification } from '../../types/UserNotifications';
import Utils from '../../utils/Utils';

const MODULE_NAME = 'NotificationStorage';

export default class NotificationStorage {

  static async getNotifications(tenantID: string,
    params: { userID?: string; dateFrom?: Date; channel?: string; sourceId?: string;
      sourceDescr?: string; additionalFilters?: any; chargeBoxID?: string },
    dbParams: DbParams, projectFields?: string[]): Promise<DataResult<Notification>> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'getNotifications');
    // Check Tenant
    await Utils.checkTenant(tenantID);
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
    // Set Channel?
    if (params.channel) {
      filters.channel = params.channel;
    }
    // Set Source?
    if (params.sourceDescr) {
      filters.sourceDescr = params.sourceDescr;
    }
    // Set ChargeBox?
    if (params.chargeBoxID) {
      filters.chargeBoxID = params.chargeBoxID;
    }
    // Set User ID?
    if (params.userID) {
      filters.userID = Utils.convertToObjectID(params.userID);
    }
    // Set Data
    if (params.additionalFilters) {
      for (const key in params.additionalFilters) {
        filters[`data.${key}`] = params.additionalFilters[key];
      }
    }
    // Set SourceId?
    if (params.sourceId) {
      filters.sourceId = params.sourceId;
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
    const notificationsCountMDB = await global.database.getCollection<any>(tenantID, 'notifications')
      .aggregate([...aggregation, { $count: 'count' }], { allowDiskUse: true })
      .toArray();
    // Check if only the total count is requested
    if (dbParams.onlyRecordCount) {
      return {
        count: (notificationsCountMDB.length > 0 ? notificationsCountMDB[0].count : 0),
        result: []
      };
    }
    // Remove the limit
    aggregation.pop();
    // Charge Box
    DatabaseUtils.pushChargingStationLookupInAggregation({
      tenantID, aggregation: aggregation, localField: 'chargeBoxID', foreignField: '_id',
      asField: 'chargeBox', oneToOneCardinality: true, oneToOneCardinalityNotNull: false
    });
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'chargeBox.siteAreaID');
    // Users
    DatabaseUtils.pushUserLookupInAggregation({
      tenantID, aggregation: aggregation, asField: 'user', localField: 'userID',
      foreignField: '_id', oneToOneCardinality: true, oneToOneCardinalityNotNull: false
    });
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
    // Project
    DatabaseUtils.projectFields(aggregation, projectFields);
    // Read DB
    const notificationsMDB = await global.database.getCollection<any>(tenantID, 'notifications')
      .aggregate(aggregation, { collation: { locale: Constants.DEFAULT_LOCALE, strength: 2 }, allowDiskUse: true })
      .toArray();
    // Debug
    Logging.traceEnd(tenantID, MODULE_NAME, 'getNotifications', uniqueTimerID, notificationsMDB);
    // Ok
    return {
      count: (notificationsCountMDB.length > 0 ? notificationsCountMDB[0].count : 0),
      result: notificationsMDB
    };
  }

  static async saveNotification(tenantID: string, notificationToSave: Partial<Notification>): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'saveNotification');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    const ocpiEndpointMDB: any = {
      _id: Cypher.hash(`${notificationToSave.sourceId}~${notificationToSave.channel}`),
      userID: Utils.convertToObjectID(notificationToSave.userID),
      timestamp: Utils.convertToDate(notificationToSave.timestamp),
      channel: notificationToSave.channel,
      sourceId: notificationToSave.sourceId,
      sourceDescr: notificationToSave.sourceDescr,
      data: notificationToSave.data,
      chargeBoxID: notificationToSave.chargeBoxID
    };
    // Create
    await global.database.getCollection<Notification>(tenantID, 'notifications')
      .insertOne(ocpiEndpointMDB);
    // Debug
    Logging.traceEnd(tenantID, MODULE_NAME, 'saveNotification', uniqueTimerID, ocpiEndpointMDB);
  }
}
