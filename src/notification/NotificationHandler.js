const Configuration = require('../utils/Configuration');
const EMailNotificationTask = require('./email/EMailNotificationTask');
const Logging = require('../utils/Logging');
const Constants = require('../utils/Constants');
const NotificationStorage = require('../storage/mongodb/NotificationStorage');
require('source-map-support').install();

let _notificationConfig = Configuration.getNotificationConfig();
let _email = new EMailNotificationTask();

const CHANNEL_EMAIL = "email";
const SOURCE_CHARGING_STATION_STATUS_ERROR = "NotifyChargingStationStatusError";
const SOURCE_CHARGING_STATION_REGISTERED = "NotifyChargingStationRegistered";
const SOURCE_END_OF_CHARGE = "NotifyEndOfCharge";
const SOURCE_END_OF_SESSION = "NotifyEndOfSession";
const SOURCE_NEW_PASSWORD = "NotifyNewPassword";
const SOURCE_REQUEST_PASSWORD = "NotifyRequestPassword";
const SOURCE_USER_ACCOUNT_STATUS_CHANGED = "NotifyUserAccountStatusChanged";
const SOURCE_NEW_REGISTERED_USER = "NotifyNewRegisteredUser";
const SOURCE_UNKNOWN_USER_BADGED = "NotifyUnknownUserBadged";
const SOURCE_TRANSACTION_STARTED = "NotifyTransactionStarted";
const SOURCE_VERIFICATION_EMAIL = "NotifyVerificationEmail";

class NotificationHandler {
  static async saveNotification(tenantID, channel, sourceId, sourceDescr, user, chargingStation) {
    // Save it
    await NotificationStorage.saveNotification(tenantID, {
      timestamp: new Date(),
      channel: channel,
      sourceId: sourceId,
      sourceDescr: sourceDescr,
      userID: (user ? user.id : null),
      chargeBoxID: (chargingStation ? chargingStation.id : null)
    });
    // Success
    if (user) {
      // User
      Logging.logInfo({
        tenantID: tenantID,
        module: "Notification", method: "saveNotification",
        action: sourceDescr, actionOnUser: user,
        message: `User is being notified`
      });
    } else {
      // Admin
      Logging.logInfo({
        tenantID: tenantID,
        module: "Notification", method: "saveNotification",
        action: sourceDescr, message: `Admin users is being notified`
      });
    }
  }

  static async hasNotifiedSource(tenantID, sourceId) {
    try {
      // Save it
      let notifications = await NotificationStorage.getNotification(tenantID, sourceId);
      // Filter by source id
      let notificationsFiltered = notifications.filter(notification => {
        return (notification.sourceId === sourceId);
      });
      // return
      return notificationsFiltered.length > 0;
    } catch (error) {
      // Log error
      Logging.logActionExceptionMessage(tenantID, "HasNotification", error);
    }
  }

  static async sendEndOfCharge(tenantID, sourceId, user, chargingStation, sourceData, locale) {
    try {
      // Check notification
      let hasBeenNotified = await NotificationHandler.hasNotifiedSource(tenantID, sourceId);
      // Notified?
      if (!hasBeenNotified) {
        // Email enabled?
        if (_notificationConfig.Email.enabled) {
          // Save notif
          await NotificationHandler.saveNotification(tenantID, CHANNEL_EMAIL, sourceId,
            SOURCE_END_OF_CHARGE, user, chargingStation);
          // Send email
          return _email.sendEndOfCharge(sourceData, locale, tenantID);
        }
      }
    } catch (error) {
      // Log error
      Logging.logActionExceptionMessage(tenantID, SOURCE_END_OF_CHARGE, error);
    }
  }

  static async sendEndOfSession(tenantID, sourceId, user, chargingStation, sourceData, locale) {
    try {
      // Check notification
      let hasBeenNotified = await NotificationHandler.hasNotifiedSource(tenantID, sourceId);
      // Notified?
      if (!hasBeenNotified) {
        // Email enabled?
        if (_notificationConfig.Email.enabled) {
          // Save notif
          await NotificationHandler.saveNotification(tenantID, CHANNEL_EMAIL, sourceId,
            SOURCE_END_OF_SESSION, user, chargingStation);
          // Send email
          return _email.sendEndOfSession(sourceData, locale, tenantID);
        }
      }
    } catch (error) {
      // Log error
      Logging.logActionExceptionMessage(tenantID, SOURCE_END_OF_SESSION, error);
    }
  }

  static async sendRequestPassword(tenantID, sourceId, user, sourceData, locale) {
    try {
      // Email enabled?
      if (_notificationConfig.Email.enabled) {
        // Save notif
        await NotificationHandler.saveNotification(tenantID,
          CHANNEL_EMAIL, sourceId, SOURCE_REQUEST_PASSWORD, user, null);
        // Send email
        return _email.sendRequestPassword(sourceData, locale, tenantID);
      }
    } catch (error) {
      // Log error
      Logging.logActionExceptionMessage(tenantID, SOURCE_REQUEST_PASSWORD, error);
    }
  }

  static async sendNewPassword(tenantID, sourceId, user, sourceData, locale) {
    try {
      // Email enabled?
      if (_notificationConfig.Email.enabled) {
        // Save notif
        await NotificationHandler.saveNotification(tenantID, CHANNEL_EMAIL, sourceId, SOURCE_NEW_PASSWORD, user, null);
        // Send email
        return _email.sendNewPassword(sourceData, locale, tenantID);
      }
    } catch (error) {
      // Log error
      Logging.logActionExceptionMessage(tenantID, SOURCE_NEW_PASSWORD, error);
    }
  }

  static async sendUserAccountStatusChanged(tenantID, sourceId, user, sourceData, locale) {
    try {
      // Email enabled?
      if (_notificationConfig.Email.enabled) {
        // Save notif
        await NotificationHandler.saveNotification(tenantID, CHANNEL_EMAIL, sourceId,
          SOURCE_USER_ACCOUNT_STATUS_CHANGED, user, null);
        // Send email
        return _email.sendUserAccountStatusChanged(sourceData, locale, tenantID);
      }
    } catch (error) {
      // Log error
      Logging.logActionExceptionMessage(tenantID, SOURCE_USER_ACCOUNT_STATUS_CHANGED, error);
    }
  }

  static async sendNewRegisteredUser(tenantID, sourceId, user, sourceData, locale) {
    try {
      // Email enabled?
      if (_notificationConfig.Email.enabled) {
        // Save notif
        await NotificationHandler.saveNotification(tenantID, CHANNEL_EMAIL, sourceId,
          SOURCE_NEW_REGISTERED_USER, user, null);
        // Send email
        return _email.sendNewRegisteredUser(sourceData, locale, tenantID);
      }
    } catch (error) {
      // Log error
      Logging.logActionExceptionMessage(tenantID, SOURCE_NEW_REGISTERED_USER, error);
    }
  }

  static async sendVerificationEmail(tenantID, sourceId, user, sourceData, locale) {
    try {
      // Email enabled?
      if (_notificationConfig.Email.enabled) {
        // Save notif
        await NotificationHandler.saveNotification(tenantID, CHANNEL_EMAIL, sourceId,
          SOURCE_VERIFICATION_EMAIL, user, null);
        // Send email
        return _email.sendVerificationEmail(sourceData, locale, tenantID);
      }
    } catch (error) {
      // Log error
      Logging.logActionExceptionMessage(tenantID, SOURCE_VERIFICATION_EMAIL, error);
    }
  }

  static async sendChargingStationStatusError(tenantID, sourceId, chargingStation, sourceData) {
    try {
      // Email enabled?
      if (_notificationConfig.Email.enabled) {
        // Save notif
        await NotificationHandler.saveNotification(tenantID, CHANNEL_EMAIL, sourceId,
          SOURCE_CHARGING_STATION_STATUS_ERROR, null, chargingStation);
        // Send email
        return _email.sendChargingStationStatusError(sourceData, Constants.DEFAULT_LOCALE, tenantID);
      }
    } catch (error) {
      // Log error
      Logging.logActionExceptionMessage(tenantID, SOURCE_CHARGING_STATION_STATUS_ERROR, error);
    }
  }

  static async sendChargingStationRegistered(tenantID, sourceId, chargingStation, sourceData) {
    try {
      // Email enabled?
      if (_notificationConfig.Email.enabled) {
        // Save notif
        await NotificationHandler.saveNotification(tenantID, CHANNEL_EMAIL, sourceId,
          SOURCE_CHARGING_STATION_REGISTERED, null, chargingStation);
        // Send email
        return _email.sendChargingStationRegistered(sourceData, Constants.DEFAULT_LOCALE, tenantID);
      }
    } catch (error) {
      // Log error
      Logging.logActionExceptionMessage(tenantID, SOURCE_CHARGING_STATION_REGISTERED, error);
    }
  }

  static async sendUnknownUserBadged(tenantID, sourceId, chargingStation, sourceData) {
    try {
      // Email enabled?
      if (_notificationConfig.Email.enabled) {
        // Save notif
        await NotificationHandler.saveNotification(tenantID, CHANNEL_EMAIL, sourceId,
          SOURCE_UNKNOWN_USER_BADGED, null, chargingStation);
        // Send email
        return _email.sendUnknownUserBadged(sourceData, Constants.DEFAULT_LOCALE, tenantID);
      }
    } catch (error) {
      // Log error
      Logging.logActionExceptionMessage(tenantID, SOURCE_UNKNOWN_USER_BADGED, error);
    }
  }

  static async sendTransactionStarted(tenantID, sourceId, user, chargingStation, sourceData, locale) {
    try {
      // Check notification
      let hasBeenNotified = await NotificationHandler.hasNotifiedSource(tenantID, sourceId);
      // Notified?
      if (!hasBeenNotified) {
        // Email enabled?
        if (_notificationConfig.Email.enabled) {
          // Save notif
          await NotificationHandler.saveNotification(tenantID,
            CHANNEL_EMAIL, sourceId, SOURCE_TRANSACTION_STARTED, user, chargingStation);
          // Send email
          return _email.sendTransactionStarted(sourceData, locale, tenantID);
        }
      }
    } catch (error) {
      // Log error
      Logging.logActionExceptionMessage(tenantID, SOURCE_TRANSACTION_STARTED, error);
    }
  }
}

module.exports = NotificationHandler;
