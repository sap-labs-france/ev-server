
const Database = require('../../utils/Database');
const Utils = require('../../utils/Utils');
const crypto = require('crypto');
const Logging = require('../../utils/Logging');
const Constants = require('../../utils/Constants');
const DatabaseUtils = require('./DatabaseUtils');

class NotificationStorage {
  static async getNotifications(tenantID, params = {}, limit, skip, sort) {
    const Notification = require('../../entity/Notification'); // Avoid fucking circular deps!!!
    // Debug
    const uniqueTimerID = Logging.traceStart('NotificationStorage', 'getNotifications');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Check Limit
    limit = Utils.checkRecordLimit(limit);
    // Check Skip
    skip = Utils.checkRecordSkip(skip);
    // Set the filters
    const filters = {};
    // Set Site?
    if (params.userID) {
      // Set User ID
      filters["$or"] = [
        { userID: Utils.convertToObjectID(params.userID) },
        { userID: null }
      ];
    }
    // Set Date From?
    if (params.dateFrom) {
      filters.timestamp = {};
      filters.timestamp.$gte = Utils.convertToDate(params.dateFrom);
    }
    // Set Channel?
    if (params.channel) {
      filters.channel = params.channel;
    }
    // Set SourceId?
    if (params.sourceId) {
      filters.sourceId = params.sourceId;
    }
    // Create Aggregation
    const aggregation = [];
    // Filters
    aggregation.push({
      $match: filters
    });
    // Count Records
    const notificationsCountMDB = await global.database.getCollection(tenantID, 'notifications')
      .aggregate([...aggregation, {$count: "count"}])
      .toArray();
    // Add Charge Box
    aggregation.push({
      $lookup: {
        from: DatabaseUtils.getCollectionName(tenantID, 'chargingstations'),
        localField: 'chargeBoxID',
        foreignField: '_id',
        as: 'chargeBox'
      }
    });
    // Single Record
    aggregation.push({
      $unwind: {"path": "$chargeBox", "preserveNullAndEmptyArrays": true}
    });
    // Add User
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
      $unwind: {"path": "$user", "preserveNullAndEmptyArrays": true}
    });
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
    // Read DB
    const notificationsMDB = await global.database.getCollection(tenantID, 'notifications')
      .aggregate(aggregation, {collation: {locale: Constants.DEFAULT_LOCALE, strength: 2}})
      .toArray();
    const notifications = [];
    // Check
    if (notificationsMDB && notificationsMDB.length > 0) {
      // Create
      for (const notificationMDB of notificationsMDB) {
        // Create
        const notification = new Notification(tenantID, notificationMDB);
        // Add
        notifications.push(notification);
      }
    }
    // Debug
    Logging.traceEnd('NotificationStorage', 'getNotifications', uniqueTimerID, params);
    // Ok
    return {
      count: (notificationsCountMDB.length > 0 ? notificationsCountMDB[0].count : 0),
      result: notifications
    };
  }

  static async saveNotification(tenantID, notificationToSave) {
    // Debug
    const uniqueTimerID = Logging.traceStart('NotificationStorage', 'saveNotification');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Ensure Date
    notificationToSave.timestamp = Utils.convertToDate(notificationToSave.timestamp);
    // Transfer
    const notification = {};
    Database.updateNotification(notificationToSave, notification, false);
    // Set the ID
    notification._id = crypto.createHash('sha256')
      .update(`${notificationToSave.sourceId}~${notificationToSave.channel}`)
      .digest("hex");
    // Create
    await global.database.getCollection(tenantID, 'notifications')
      .insertOne(notification);
    // Debug
    Logging.traceEnd('NotificationStorage', 'saveNotification', uniqueTimerID, {notificationToSave});
  }
}

module.exports = NotificationStorage;
