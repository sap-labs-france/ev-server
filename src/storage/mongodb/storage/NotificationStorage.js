const Constants = require('../../../utils/Constants');
const Logging = require('../../../utils/Logging');
const Database = require('../../../utils/Database');
const MDBNotification = require('../model/MDBNotification');
const crypto = require('crypto');

class NotificationStorage {
	static handleGetNotification(sourceId) {
		// Exec request
		return MDBNotification.find({"sourceId": sourceId}).exec().then((notificationsMDB) => {
			let notifications = [];
			// Create
			notificationsMDB.forEach((notificationMDB) => {
				let notification = {};
				// Set values
				Database.updateNotification(notificationMDB, notification);
				// Add
				notifications.push(notification);
			});
			// Ok
			return notifications;
		});
	}

	static handleSaveNotification(notification) {
		// Create model
		let notificationMDB = new MDBNotification(notification);
		// Set the ID
		notificationMDB._id = crypto.createHash('sha256')
			.update(`${notification.sourceId}~${notification.channel}`)
			.digest("hex");
		// Create new
		return notificationMDB.save().then(() => {
			// Nothing
		});
	}
}

module.exports = NotificationStorage;
