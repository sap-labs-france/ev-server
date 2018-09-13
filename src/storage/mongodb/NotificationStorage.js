const Database = require('../../utils/Database');
const Utils = require('../../utils/Utils');
const crypto = require('crypto');

class NotificationStorage {
	static async getNotification(sourceId) {
		// Read DB
		let notificationsMDB = await global.db.collection('notifications')
			.find({"sourceId": sourceId})
			.toArray();
		let notifications = [];
		// Check
		if (notificationsMDB && notificationsMDB.length > 0) {
			// Create
			for (const notificationMDB of notificationsMDB) {
				let notification = {};
				// Set values
				Database.updateNotification(notificationMDB, notification);
				// Add
				notifications.push(notification);
			}
		}
		// Ok
		return notifications;
	}

	static async saveNotification(notificationToSave) {
		// Ensure Date
		notificationToSave.timestamp = Utils.convertToDate(notificationToSave.timestamp);
		// Transfer
		let notification = {};
		Database.updateNotification(notificationToSave, notification, false);
		// Set the ID
		notification._id = crypto.createHash('sha256')
			.update(`${notificationToSave.sourceId}~${notificationToSave.channel}`)
			.digest("hex");
		// Create
		await global.db.collection('notifications')
			.insertOne(notification);
	}
}

module.exports = NotificationStorage;
