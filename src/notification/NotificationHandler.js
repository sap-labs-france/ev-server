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
const SOURCE_NEW_REGISTERED_USER = "NotifyNewRegisteredUser";
const SOURCE_UNKNOWN_USER_BADGED = "NotifyUnknownUserBadged";
const SOURCE_TRANSACTION_STARTED = "NotifyTransactionStarted";

class NotificationHandler {
  static saveNotification(channel, sourceId, sourceDescr, user, chargingStation, details) {
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
          userFullName: "System", source: "Central Server", module: "Notification", method: "saveNotification",
          action: sourceDescr, message: `User ${Utils.buildUserFullName(user)} has been notified successfully`,
          detailedMessages: details});
      } else {
        // Admin
        Logging.logInfo({
          userFullName: "System", source: "Central Server", module: "Notification", method: "saveNotification",
          action: sourceDescr, message: `Admin users have been notified successfully`,
          detailedMessages: details});
      }
    }).catch((error) => {
      // Log error
      Logging.logUnexpectedErrorMessage("SaveNotification", "NotificationHandler", "saveNotification", error);
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
      Logging.logUnexpectedErrorMessage("HasNotification", "NotificationHandler", "hasNotifiedSource", error);
    });
  }

  static sendBeforeEndOfCharge(sourceId, user, chargingStation, sourceData, locale) {
    // Check notification
    NotificationHandler.hasNotifiedSource(sourceId).then(hasBeenNotified => {
      // Notified?
      if (!hasBeenNotified) {
        // Email enabled?
        if (_notificationConfig.Email.enabled) {
          // Send email
          _email.sendBeforeEndOfCharge(sourceData, locale).then(message => {
            // Save notif
            NotificationHandler.saveNotification(CHANNEL_EMAIL, sourceId, SOURCE_BEFORE_END_OF_CHARGE, user, chargingStationId, message);
          }).catch(error => {
            // Log error
            Logging.logUnexpectedErrorMessage(SOURCE_BEFORE_END_OF_CHARGE, "NotificationHandler", "sendBeforeEndOfCharge", error);
          });
        }
      }
    }).catch((error) => {
      // Log error
      Logging.logUnexpectedErrorMessage(SOURCE_BEFORE_END_OF_CHARGE, "NotificationHandler", "sendBeforeEndOfCharge", error);
    });
  }

  static sendEndOfCharge(sourceId, user, chargingStation, sourceData, locale) {
    // Check notification
    NotificationHandler.hasNotifiedSource(sourceId).then(hasBeenNotified => {
      // Notified?
      if (!hasBeenNotified) {
        // Email enabled?
        if (_notificationConfig.Email.enabled) {
          // Send email
          _email.sendEndOfCharge(sourceData, locale).then(message => {
            // Save notif
            NotificationHandler.saveNotification(CHANNEL_EMAIL, sourceId, SOURCE_END_OF_CHARGE, user, chargingStation, message);
          }).catch(error => {
            // Log error
            Logging.logUnexpectedErrorMessage(SOURCE_END_OF_CHARGE, "NotificationHandler", "sendEndOfCharge", error);
          });
        }
      }
    }).catch((err) => {
      // Log error
      Logging.logUnexpectedErrorMessage(SOURCE_END_OF_CHARGE, "NotificationHandler", "sendEndOfCharge", error);
    });
  }

  static sendResetPassword(sourceId, user, sourceData, locale) {
    // Email enabled?
    if (_notificationConfig.Email.enabled) {
      // Send email
      _email.sendResetPassword(sourceData, locale).then(message => {
        // Save notif
        NotificationHandler.saveNotification(CHANNEL_EMAIL, sourceId, SOURCE_RESET_PASSWORD, user, null, message);
      }).catch(error => {
        // Log error
        Logging.logUnexpectedErrorMessage(SOURCE_RESET_PASSWORD, "NotificationHandler", "sendResetPassword", error);
      });
    }
  }

  static sendNewRegisteredUser(sourceId, user, sourceData, locale) {
    // Email enabled?
    if (_notificationConfig.Email.enabled) {
      // Send email
      _email.sendNewRegisteredUser(sourceData, locale).then(message => {
        // Save notif
        NotificationHandler.saveNotification(CHANNEL_EMAIL, sourceId, SOURCE_NEW_REGISTERED_USER, user, null, message);
      }).catch(error => {
        // Log error
        Logging.logUnexpectedErrorMessage(SOURCE_NEW_REGISTERED_USER, "NotificationHandler", "sendNewRegisteredUser", error);
      });
    }
  }

  static sendChargingStationStatusError(sourceId, chargingStation, sourceData) {
    // Email enabled?
    if (_notificationConfig.Email.enabled) {
      // Send email
      _email.sendChargingStationStatusError(sourceData, Utils.getDefaultLocale()).then(message => {
        // Save notif
        NotificationHandler.saveNotification(CHANNEL_EMAIL, sourceId, SOURCE_CHARGING_STATION_STATUS_ERROR, null, chargingStation, message);
      }).catch(error => {
        // Log error
        Logging.logUnexpectedErrorMessage(SOURCE_CHARGING_STATION_STATUS_ERROR, "NotificationHandler", "sendChargingStationStatusError", error);
      });
    }
  }

  static sendUnknownUserBadged(sourceId, chargingStation, sourceData) {
    // Email enabled?
    if (_notificationConfig.Email.enabled) {
      // Send email
      _email.sendUnknownUserBadged(sourceData, Utils.getDefaultLocale()).then(message => {
        // Save notif
        NotificationHandler.saveNotification(CHANNEL_EMAIL, sourceId, SOURCE_UNKNOWN_USER_BADGED, null, chargingStation, message);
      }).catch(error => {
        // Log error
        Logging.logUnexpectedErrorMessage(SOURCE_UNKNOWN_USER_BADGED, "NotificationHandler", "sendUnknownUserBadged", error);
      });
    }
  }

  static sendTransactionStarted(sourceId, user, chargingStation, sourceData, locale) {
    // Email enabled?
    if (_notificationConfig.Email.enabled) {
      // Send email
      _email.sendTransactionStarted(sourceData, locale).then(message => {
        // Save notif
        NotificationHandler.saveNotification(CHANNEL_EMAIL, sourceId, SOURCE_TRANSACTION_STARTED, user, chargingStation, message);
      }).catch(error => {
        // Log error
        Logging.logUnexpectedErrorMessage(SOURCE_TRANSACTION_STARTED, "NotificationHandler", "sendTransactionStarted", error);
      });
    }
  }
}

module.exports=NotificationHandler;
