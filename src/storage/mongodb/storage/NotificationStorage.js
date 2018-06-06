const Constants = require('../../../utils/Constants');
const Logging = require('../../../utils/Logging');
const Database = require('../../../utils/Database');
const Utils = require('../../../utils/Utils');
const crypto = require('crypto');

let _db;

class NotificationStorage {
	static setDatabase(db) {
		_db = db;
	}

	static async handleGetNotification(sourceId) {
		// Read DB
		let notificationsMDB = await _db.collection('notifications')
			.find({"sourceId": sourceId})
			.toArray();
		let notifications = [];
		// Check
		if (notificationsMDB && notificationsMDB.length > 0) {
			// Create
			notificationsMDB.forEach((notificationMDB) => {
				let notification = {};
				// Set values
				Database.updateNotification(notificationMDB, notification);
				// Add
				notifications.push(notification);
			});
		}
		// Ok
		return notifications;
	}

	static async handleSaveNotification(notificationToSave) {
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
		await _db.collection('notifications')
			.insertOne(notification);
	}
}

module.exports = NotificationStorage;
