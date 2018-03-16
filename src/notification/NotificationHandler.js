const Configuration = require('../utils/Configuration');
const EMailNotificationTask = require('./email/EMailNotificationTask');
const Users = require('../utils/Users');
const Utils = require('../utils/Utils');
const Logging = require('../utils/Logging');
require('source-map-support').install();

_notificationConfig = Configuration.getNotificationConfig();
_email = new EMailNotificationTask();

const CHANNEL_EMAIL = "email";
const SOURCE_CHARGING_STATION_STATUS_ERROR = "NotifyChargingStationStatusError";
const SOURCE_CHARGING_STATION_REGISTERED = "NotifyChargingStationRegistered";
const SOURCE_END_OF_CHARGE = "NotifyEndOfCharge";
const SOURCE_NEW_PASSWORD = "NotifyNewPassword";
const SOURCE_REQUEST_PASSWORD = "NotifyRequestPassword";
const SOURCE_USER_ACCOUNT_STATUS_CHANGED = "NotifyUserAccountStatusChanged";
const SOURCE_NEW_REGISTERED_USER = "NotifyNewRegisteredUser";
const SOURCE_UNKNOWN_USER_BADGED = "NotifyUnknownUserBadged";
const SOURCE_TRANSACTION_STARTED = "NotifyTransactionStarted";

class NotificationHandler {
	static saveNotification(channel, sourceId, sourceDescr, user, chargingStation) {
		// Save it
		return global.storage.saveNotification({
			timestamp: new Date(),
			channel: channel,
			sourceId: sourceId,
			sourceDescr: sourceDescr,
			userID: (user?user.id:null),
			chargeBoxID: (chargingStation?chargingStation.id:null)
		}).then(() => {
			// Success
			if (user) {
				// User
				Logging.logInfo({
					module: "Notification", method: "saveNotification",
					action: sourceDescr, actionOnUser: user,
					message: `User is being notified`
				});
			} else {
				// Admin
				Logging.logInfo({
					module: "Notification", method: "saveNotification",
					action: sourceDescr, message: `Admin users is being notified`
				});
			}
		});
	}

	static hasNotifiedSource(sourceId) {
		// Save it
		return global.storage.getNotifications(sourceId).then((notifications) => {
			// Filter by source id
			let notificationsFiltered = notifications.filter(notification => {
				return (notification.sourceId === sourceId);
			});
			// return
			return notificationsFiltered.length > 0;
		}).catch((error) => {
			// Log error
			Logging.logActionExceptionMessage("HasNotification", error);
		});
	}

	static sendEndOfCharge(sourceId, user, chargingStation, sourceData, locale) {
		// Check notification
		return NotificationHandler.hasNotifiedSource(sourceId).then(hasBeenNotified => {
			// Notified?
			if (!hasBeenNotified) {
				// Email enabled?
				if (_notificationConfig.Email.enabled) {
					// Save notif
					return NotificationHandler.saveNotification(CHANNEL_EMAIL, sourceId,
							SOURCE_END_OF_CHARGE,
							user, chargingStation).then(() => {
						// Send email
						return _email.sendEndOfCharge(sourceData, locale);
					}).catch((error) => {
						// Log error
						Logging.logActionExceptionMessage(SOURCE_END_OF_CHARGE, error);
					});
				} else {
					return Promise.resolve();
				}
			} else {
				return Promise.resolve();
			}
		}).catch((err) => {
			// Log error
			Logging.logActionExceptionMessage(SOURCE_END_OF_CHARGE, error);
		});
	}

	static sendRequestPassword(sourceId, user, sourceData, locale) {
		// Email enabled?
		if (_notificationConfig.Email.enabled) {
			// Save notif
			return NotificationHandler.saveNotification(CHANNEL_EMAIL, sourceId, SOURCE_REQUEST_PASSWORD,
					user, null).then(() => {
				// Send email
				return _email.sendRequestPassword(sourceData, locale);
			}).catch((error) => {
				// Log error
				Logging.logActionExceptionMessage(SOURCE_REQUEST_PASSWORD, error);
			});
		} else {
			return Promise.resolve();
		}
	}

	static sendNewPassword(sourceId, user, sourceData, locale) {
		// Email enabled?
		if (_notificationConfig.Email.enabled) {
			// Save notif
			return NotificationHandler.saveNotification(CHANNEL_EMAIL, sourceId, SOURCE_NEW_PASSWORD,
					user, null).then(() => {
				// Send email
				return _email.sendNewPassword(sourceData, locale);
			}).catch((error) => {
				// Log error
				Logging.logActionExceptionMessage(SOURCE_NEW_PASSWORD, error);
			});
		} else {
			return Promise.resolve();
		}
	}

	static sendUserAccountStatusChanged(sourceId, user, sourceData, locale) {
		// Email enabled?
		if (_notificationConfig.Email.enabled) {
			// Save notif
			return NotificationHandler.saveNotification(CHANNEL_EMAIL, sourceId,
					SOURCE_USER_ACCOUNT_STATUS_CHANGED, user, null).then(() => {
				// Send email
				return _email.sendUserAccountStatusChanged(sourceData, locale);
			}).catch((error) => {
				// Log error
				Logging.logActionExceptionMessage(
					SOURCE_USER_ACCOUNT_STATUS_CHANGED, error);
			});
		} else {
			return Promise.resolve();
		}
	}

	static sendNewRegisteredUser(sourceId, user, sourceData, locale) {
		// Email enabled?
		if (_notificationConfig.Email.enabled) {
			// Save notif
			return NotificationHandler.saveNotification(CHANNEL_EMAIL, sourceId,
					SOURCE_NEW_REGISTERED_USER, user, null).then(() => {
				// Send email
				return _email.sendNewRegisteredUser(sourceData, locale);
			}).catch((error) => {
				// Log error
				Logging.logActionExceptionMessage(SOURCE_NEW_REGISTERED_USER, error);
			});
		} else {
			return Promise.resolve();
		}
	}

	static sendChargingStationStatusError(sourceId, chargingStation, sourceData) {
		// Email enabled?
		if (_notificationConfig.Email.enabled) {
			// Save notif
			return NotificationHandler.saveNotification(CHANNEL_EMAIL, sourceId,
					SOURCE_CHARGING_STATION_STATUS_ERROR, null, chargingStation).then(() => {
				// Send email
				return _email.sendChargingStationStatusError(sourceData, Users.DEFAULT_LOCALE);
			}).catch((error) => {
				// Log error
				Logging.logActionExceptionMessage(SOURCE_CHARGING_STATION_STATUS_ERROR, error);
			});
		} else {
			return Promise.resolve();
		}
	}

	static sendChargingStationRegistered(sourceId, chargingStation, sourceData) {
		// Email enabled?
		if (_notificationConfig.Email.enabled) {
			// Save notif
			return NotificationHandler.saveNotification(CHANNEL_EMAIL, sourceId,
					SOURCE_CHARGING_STATION_REGISTERED, null, chargingStation).then(() => {
				// Send email
				return _email.sendChargingStationRegistered(sourceData, Users.DEFAULT_LOCALE);
			}).catch((error) => {
				// Log error
				Logging.logActionExceptionMessage(SOURCE_CHARGING_STATION_REGISTERED, error);
			});
		} else {
			return Promise.resolve();
		}
	}

	static sendUnknownUserBadged(sourceId, chargingStation, sourceData) {
		// Email enabled?
		if (_notificationConfig.Email.enabled) {
			// Save notif
			return NotificationHandler.saveNotification(CHANNEL_EMAIL, sourceId,
					SOURCE_UNKNOWN_USER_BADGED, null, chargingStation).then(() => {
				// Send email
				return _email.sendUnknownUserBadged(sourceData, Users.DEFAULT_LOCALE);
			}).catch((error) => {
				// Log error
				Logging.logActionExceptionMessage(SOURCE_UNKNOWN_USER_BADGED, error);
			});
		} else {
			return Promise.resolve();
		}
	}

	static sendTransactionStarted(sourceId, user, chargingStation, sourceData, locale) {
		// Email enabled?
		if (_notificationConfig.Email.enabled) {
			// Save notif
			return NotificationHandler.saveNotification(
					CHANNEL_EMAIL, sourceId,
					SOURCE_TRANSACTION_STARTED, user, chargingStation).then(() => {
				// Send email
				return _email.sendTransactionStarted(sourceData, locale);
			}).catch((error) => {
				// Log error
				Logging.logActionExceptionMessage(SOURCE_TRANSACTION_STARTED, error);
			});
		} else {
			return Promise.resolve();
		}
	}
}

module.exports=NotificationHandler;
