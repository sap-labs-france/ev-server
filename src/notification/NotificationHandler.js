const Configuration = require('../utils/Configuration');
const EMailNotificationTask = require('./email/EMailNotificationTask');
const Utils = require('../utils/Utils');
const Logging = require('../utils/Logging');
require('source-map-support').install();

_notificationConfig = Configuration.getNotificationConfig();
_email = new EMailNotificationTask();

const CHANNEL_EMAIL = "email";
const SOURCE_BEFORE_END_OF_CHARGE = "NotifyBeforeEndOfCharge";
const SOURCE_CHARGING_STATION_STATUS_ERROR = "NotifyChargingStationStatusError";
const SOURCE_END_OF_CHARGE = "NotifyEndOfCharge";
const SOURCE_RESET_PASSWORD = "NotifyResetPassword";
const SOURCE_USER_ACCOUNT_STATUS_CHANGED = "NotifyUserAccountStatusChanged";
const SOURCE_NEW_REGISTERED_USER = "NotifyNewRegisteredUser";
const SOURCE_UNKNOWN_USER_BADGED = "NotifyUnknownUserBadged";
const SOURCE_TRANSACTION_STARTED = "NotifyTransactionStarted";

class NotificationHandler {
	static saveNotification(channel, sourceId, sourceDescr, user, chargingStation, details="") {
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
					action: sourceDescr, message: `User ${Utils.buildUserFullName(user)} has been notified successfully`,
					detailedMessages: details});
			} else {
				// Admin
				Logging.logInfo({
					module: "Notification", method: "saveNotification",
					action: sourceDescr, message: `Admin users have been notified successfully`,
					detailedMessages: details});
			}
		}).catch((error) => {
			// Log error
			Logging.logUnexpectedErrorMessage("SaveNotification", "NotificationHandler",
				"saveNotification", error);
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
			Logging.logUnexpectedErrorMessage("HasNotification", "NotificationHandler",
				"hasNotifiedSource", error);
		});
	}

	static sendBeforeEndOfCharge(sourceId, user, chargingStation, sourceData, locale) {
		// Check notification
		return NotificationHandler.hasNotifiedSource(sourceId).then(hasBeenNotified => {
			// Notified?
			if (!hasBeenNotified) {
				// Email enabled?
				if (_notificationConfig.Email.enabled) {
					// Save notif
					NotificationHandler.saveNotification(CHANNEL_EMAIL, sourceId, SOURCE_BEFORE_END_OF_CHARGE,
							user, chargingStationId).then(() => {
						// Send email
						_email.sendBeforeEndOfCharge(sourceData, locale);
					}).catch(error => {
						// Log error
						Logging.logUnexpectedErrorMessage(SOURCE_BEFORE_END_OF_CHARGE,
							"NotificationHandler", "sendBeforeEndOfCharge", error);
					});
				}
			}
		}).catch((error) => {
			// Log error
			Logging.logUnexpectedErrorMessage(SOURCE_BEFORE_END_OF_CHARGE,
				"NotificationHandler", "sendBeforeEndOfCharge", error);
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
					NotificationHandler.saveNotification(CHANNEL_EMAIL, sourceId, SOURCE_END_OF_CHARGE,
							user, chargingStation).then(() => {
						// Send email
						_email.sendEndOfCharge(sourceData, locale);
					}).catch(error => {
						// Log error
						Logging.logUnexpectedErrorMessage(SOURCE_END_OF_CHARGE, "NotificationHandler",
							"sendEndOfCharge", error);
					});
				}
			}
		}).catch((err) => {
			// Log error
			Logging.logUnexpectedErrorMessage(SOURCE_END_OF_CHARGE, "NotificationHandler",
				"sendEndOfCharge", error);
		});
	}

	static sendResetPassword(sourceId, user, sourceData, locale) {
		// Email enabled?
		if (_notificationConfig.Email.enabled) {
			// Save notif
			NotificationHandler.saveNotification(CHANNEL_EMAIL, sourceId, SOURCE_RESET_PASSWORD,
					user, null).then(() => {
				// Send email
				_email.sendResetPassword(sourceData, locale);
			}).catch(error => {
				// Log error
				Logging.logUnexpectedErrorMessage(SOURCE_RESET_PASSWORD, "NotificationHandler",
					"sendResetPassword", error);
			});
			return Promise.resolve();
		} else {
			return Promise.resolve();
		}
	}

	static sendUserAccountStatusChanged(sourceId, user, sourceData, locale) {
		// Email enabled?
		if (_notificationConfig.Email.enabled) {
			// Save notif
			NotificationHandler.saveNotification(CHANNEL_EMAIL, sourceId,
					SOURCE_USER_ACCOUNT_STATUS_CHANGED, user, null).then(() => {
				// Send email
				_email.sendUserAccountStatusChanged(sourceData, locale);
			}).catch(error => {
				// Log error
				Logging.logUnexpectedErrorMessage(SOURCE_USER_ACCOUNT_STATUS_CHANGED,
					"NotificationHandler", "sendUserAccountStatusChanged", error);
			});
			return Promise.resolve();
		} else {
			return Promise.resolve();
		}
	}

	static sendNewRegisteredUser(sourceId, user, sourceData, locale) {
		// Email enabled?
		if (_notificationConfig.Email.enabled) {
			// Save notif
			NotificationHandler.saveNotification(CHANNEL_EMAIL, sourceId,
					SOURCE_NEW_REGISTERED_USER, user, null).then(() => {
				// Send email
				_email.sendNewRegisteredUser(sourceData, locale);
			}).catch(error => {
				// Log error
				Logging.logUnexpectedErrorMessage(SOURCE_NEW_REGISTERED_USER,
					"NotificationHandler", "sendNewRegisteredUser", error);
			});
			return Promise.resolve();
		} else {
			return Promise.resolve();
		}
	}

	static sendChargingStationStatusError(sourceId, chargingStation, sourceData) {
		// Email enabled?
		if (_notificationConfig.Email.enabled) {
			// Save notif
			NotificationHandler.saveNotification(CHANNEL_EMAIL, sourceId,
					SOURCE_CHARGING_STATION_STATUS_ERROR, null, chargingStation).then(() => {
				// Send email
				_email.sendChargingStationStatusError(sourceData, Utils.getDefaultLocale());
			}).catch(error => {
				// Log error
				Logging.logUnexpectedErrorMessage(SOURCE_CHARGING_STATION_STATUS_ERROR,
					"NotificationHandler", "sendChargingStationStatusError", error);
			});
			return Promise.resolve();
		} else {
			return Promise.resolve();
		}
	}

	static sendUnknownUserBadged(sourceId, chargingStation, sourceData) {
		// Email enabled?
		if (_notificationConfig.Email.enabled) {
			// Save notif
			NotificationHandler.saveNotification(CHANNEL_EMAIL, sourceId,
					SOURCE_UNKNOWN_USER_BADGED, null, chargingStation).then(() => {
				// Send email
				_email.sendUnknownUserBadged(sourceData, Utils.getDefaultLocale());
			}).catch(error => {
				// Log error
				Logging.logUnexpectedErrorMessage(SOURCE_UNKNOWN_USER_BADGED,
					"NotificationHandler", "sendUnknownUserBadged", error);
			});
			return Promise.resolve();
		} else {
			return Promise.resolve();
		}
	}

	static sendTransactionStarted(sourceId, user, chargingStation, sourceData, locale) {
		// Email enabled?
		if (_notificationConfig.Email.enabled) {
			// Save notif
			NotificationHandler.saveNotification(CHANNEL_EMAIL, sourceId,
					SOURCE_TRANSACTION_STARTED, user, chargingStation).then(() => {
				// Send email
				_email.sendTransactionStarted(sourceData, locale);
			}).catch(error => {
				// Log error
				Logging.logUnexpectedErrorMessage(SOURCE_TRANSACTION_STARTED,
					"NotificationHandler", "sendTransactionStarted", error);
			});
			return Promise.resolve();
		} else {
			return Promise.resolve();
		}
	}
}

module.exports=NotificationHandler;
