const Database = require('../../utils/Database');
const Utils = require('../../utils/Utils');
const crypto = require('crypto');
const Logging = require('../../utils/Logging');

class NotificationStorage {
  static async getNotification(tenantID, sourceId) {
    // Debug
    Logging.traceStart('NotificationStorage', 'getNotification');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Read DB
    const notificationsMDB = await global.database.getCollection(tenantID, 'notifications')
      .find({"sourceId": sourceId})
      .toArray();
    const notifications = [];
    // Check
    if (notificationsMDB && notificationsMDB.length > 0) {
      // Create
      for (const notificationMDB of notificationsMDB) {
        const notification = {};
        // Set values
        Database.updateNotification(notificationMDB, notification);
        // Add
        notifications.push(notification);
      }
    }
    // Debug
    Logging.traceEnd('NotificationStorage', 'getNotification');
    // Ok
    return notifications;
  }

  static async saveNotification(tenantID, notificationToSave) {
    // Debug
    Logging.traceStart('NotificationStorage', 'saveNotification');
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
    Logging.traceEnd('NotificationStorage', 'saveNotification');
  }
}

module.exports = NotificationStorage;
