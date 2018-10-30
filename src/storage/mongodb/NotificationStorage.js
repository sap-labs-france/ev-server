const Database = require('../../utils/Database');
const Utils = require('../../utils/Utils');
const crypto = require('crypto');

class NotificationStorage {
  static async getNotification(tenantID, sourceId){
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
    // Ok
    return notifications;
  }

  static async saveNotification(tenantID, notificationToSave){
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
  }
}

module.exports = NotificationStorage;
