const Configuration = require('../utils/Configuration');
const EMailNotification = require('./email/EMailNotification');
const Utils = require('../utils/Utils');
const Logging = require('../utils/Logging');
require('source-map-support').install();

_notificationConfig = Configuration.getNotificationConfig();
_email = new EMailNotification();

const CHANNEL_EMAIL = "email";
const SOURCE_BEFORE_END_OF_CHARGE = "NotifyBeforeEndOfCharge";
const SOURCE_END_OF_CHARGE = "NotifyEndOfCharge";
const SOURCE_RESET_PASSWORD = "NotifyResetPassword";
const SOURCE_NEW_REGISTERED_USER = "NotifyNewRegisteredUser";

class NotificationHandler {
  static saveNotification(channel, sourceId, sourceDescr, user, chargingStation, details) {
    // Save it
    return global.storage.saveNotification({
      timestamp: new Date(),
      channel: channel,
      sourceId: sourceId,
      sourceDescr: sourceDescr,
      userID: user.id,
      chargeBoxID: (chargingStation?chargingStation.id:null)
    }).then(() => {
      // Success
      Logging.logInfo({
        userFullName: "System", source: "Central Server", module: "Notification", method: "saveNotification",
        action: sourceDescr, message: `User ${Utils.buildUserFullName(user)} has been notified successfully`,
        detailedMessages: details});
    }).catch((err) => {
      // Log error
      Logging.logUnexpectedErrorMessage("SaveNotification", "NotificationHandler", "saveNotification", err);
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
    }).catch((err) => {
      // Log error
      Logging.logUnexpectedErrorMessage("HasNotification", "NotificationHandler", "hasNotifiedSource", err);
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
            Logging.logUnexpectedErrorMessage(SOURCE_BEFORE_END_OF_CHARGE, "NotificationHandler", "sendBeforeEndOfCharge", err);
          });
        }
      }
    }).catch((err) => {
      // Log error
      Logging.logUnexpectedErrorMessage(SOURCE_BEFORE_END_OF_CHARGE, "NotificationHandler", "sendBeforeEndOfCharge", err);
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
            Logging.logUnexpectedErrorMessage(SOURCE_END_OF_CHARGE, "NotificationHandler", "sendEndOfCharge", err);
          });
        }
      }
    }).catch((err) => {
      // Log error
      Logging.logUnexpectedErrorMessage(SOURCE_END_OF_CHARGE, "NotificationHandler", "sendEndOfCharge", err);
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
        Logging.logUnexpectedErrorMessage(SOURCE_RESET_PASSWORD, "NotificationHandler", "sendResetPassword", err);
      });
    }
  }

  static sendNewRegisteredUser() {
    // Email enabled?
    if (_notificationConfig.Email.enabled) {
      // Send email
      _email.sendNewRegisteredUser(sourceData, locale).then(message => {
        // Save notif
        NotificationHandler.saveNotification(CHANNEL_EMAIL, sourceId, SOURCE_NEW_REGISTERED_USER, user, null, message);
      }).catch(error => {
        // Log error
        Logging.logUnexpectedErrorMessage(SOURCE_NEW_REGISTERED_USER, "NotificationHandler", "sendNewRegisteredUser", err);
      });
    }
  }
}

module.exports=NotificationHandler;
