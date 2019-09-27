import Configuration from '../utils/Configuration';
import Constants from '../utils/Constants';
import EMailNotificationTask from './email/EMailNotificationTask';
import Logging from '../utils/Logging';
import Notification from '../entity/Notification';
import NotificationStorage from '../storage/mongodb/NotificationStorage';
import User from '../types/User';
import UserStorage from '../storage/mongodb/UserStorage';

const _notificationConfig = Configuration.getNotificationConfig();
const _email = new EMailNotificationTask();

const CHANNEL_EMAIL = 'email';
const CHANNEL_SMTP_AUTH = 'smtpauth';
const SOURCE_CHARGING_STATION_STATUS_ERROR = 'NotifyChargingStationStatusError';
const SOURCE_CHARGING_STATION_REGISTERED = 'NotifyChargingStationRegistered';
const SOURCE_END_OF_CHARGE = 'NotifyEndOfCharge';
const SOURCE_OPTIMAL_CHARGE_REACHED = 'NotifyOptimalChargeReached';
const SOURCE_END_OF_SESSION = 'NotifyEndOfSession';
const SOURCE_NEW_PASSWORD = 'NotifyNewPassword';
const SOURCE_REQUEST_PASSWORD = 'NotifyRequestPassword';
const SOURCE_USER_ACCOUNT_STATUS_CHANGED = 'NotifyUserAccountStatusChanged';
const SOURCE_NEW_REGISTERED_USER = 'NotifyNewRegisteredUser';
const SOURCE_UNKNOWN_USER_BADGED = 'NotifyUnknownUserBadged';
const SOURCE_TRANSACTION_STARTED = 'NotifyTransactionStarted';
const SOURCE_VERIFICATION_EMAIL = 'NotifyVerificationEmail';
const SOURCE_AUTH_EMAIL_ERROR = 'NotifyAuthentificationErrorEmailServer';
export default class NotificationHandler {

  static async saveNotification(tenantID, channel, sourceId, sourceDescr, user: User, chargingStation, data = {}) {
    // Create the object
    const notification = new Notification(tenantID, {
      timestamp: new Date(),
      channel: channel,
      sourceId: sourceId,
      sourceDescr: sourceDescr,
      userID: (user ? user.id : null),
      chargeBoxID: (chargingStation ? chargingStation.id : null),
      data
    });
    // Save it
    await notification.save();
    // Success
    if (user) {
      // User
      Logging.logInfo({
        tenantID: tenantID,
        source: (chargingStation ? chargingStation.id : null),
        module: 'Notification', method: 'saveNotification',
        action: sourceDescr, actionOnUser: user,
        message: 'User is being notified'
      });
    } else {
      // Admin
      Logging.logInfo({
        tenantID: tenantID,
        source: (chargingStation ? chargingStation.id : null),
        module: 'Notification', method: 'saveNotification',
        action: sourceDescr, message: 'Admin users are being notified'
      });
    }
  }

  static async getAdminUsers(tenantID: string): Promise<User[]> {
    // Get admin users
    const adminUsers = await UserStorage.getUsers(tenantID, { roles: [Constants.ROLE_ADMIN], notificationsActive: true },
      Constants.DB_PARAMS_MAX_LIMIT);
    // Found
    if (adminUsers.count > 0) {
      // Check if notification is active
      // adminUsers.result = adminUsers.result.filter((adminUser) => adminUser.notificationsActive);
      return adminUsers.result;
    }
  }

  static async hasNotifiedSource(tenantID, channel, sourceId) {
    try {
      // Save it
      const notifications = await NotificationStorage.getNotifications(tenantID, { channel: channel, sourceId: sourceId });
      // Return
      return notifications.count > 0;
    } catch (error) {
      // Log error
      Logging.logActionExceptionMessage(tenantID, 'HasNotification', error);
    }
  }

  static async sendEndOfCharge(tenantID, sourceId, user: User, chargingStation, sourceData, locale, data) {
    try {
      // Enrich with admins
      sourceData.adminUsers = await NotificationHandler.getAdminUsers(tenantID);
      // Check notification
      const hasBeenNotified = await NotificationHandler.hasNotifiedSource(tenantID, CHANNEL_EMAIL, sourceId);
      // Notified?
      if (!hasBeenNotified) {
        // Email enabled?
        if (_notificationConfig.Email.enabled && user.notificationsActive) {
          // Save notif
          await NotificationHandler.saveNotification(tenantID, CHANNEL_EMAIL, sourceId,
            SOURCE_END_OF_CHARGE, user, chargingStation, data);
          // Send email
          const result = await _email.sendEndOfCharge(sourceData, locale, tenantID);
          // Return
          return result;
        }
      }
    } catch (error) {
      // Log error
      Logging.logActionExceptionMessage(tenantID, SOURCE_END_OF_CHARGE, error);
    }
  }

  static async sendOptimalChargeReached(tenantID, sourceId, user: User, chargingStation, sourceData, locale, data) {
    try {
      // Enrich with admins
      sourceData.adminUsers = await NotificationHandler.getAdminUsers(tenantID);
      // Check notification
      const hasBeenNotified = await NotificationHandler.hasNotifiedSource(tenantID, CHANNEL_EMAIL, sourceId);
      // Notified?
      if (!hasBeenNotified) {
        // Email enabled?
        if (_notificationConfig.Email.enabled && user.notificationsActive) {
          // Save notif
          await NotificationHandler.saveNotification(tenantID, CHANNEL_EMAIL, sourceId,
            SOURCE_OPTIMAL_CHARGE_REACHED, user, chargingStation, data);
          // Send email
          const result = await _email.sendOptimalChargeReached(sourceData, locale, tenantID);
          // Return
          return result;
        }
      }
    } catch (error) {
      // Log error
      Logging.logActionExceptionMessage(tenantID, SOURCE_OPTIMAL_CHARGE_REACHED, error);
    }
  }

  static async sendEndOfSession(tenantID, sourceId, user: User, chargingStation, sourceData, locale, data) {
    try {
      // Enrich with admins
      sourceData.adminUsers = await NotificationHandler.getAdminUsers(tenantID);
      // Check notification
      const hasBeenNotified = await NotificationHandler.hasNotifiedSource(tenantID, CHANNEL_EMAIL, sourceId);
      // Notified?
      if (!hasBeenNotified) {
        // Email enabled?
        if (_notificationConfig.Email.enabled && user.notificationsActive) {
          // Save notif
          await NotificationHandler.saveNotification(tenantID, CHANNEL_EMAIL, sourceId,
            SOURCE_END_OF_SESSION, user, chargingStation, data);
          // Send email
          const result = await _email.sendEndOfSession(sourceData, locale, tenantID);
          // Return
          return result;
        }
      }
    } catch (error) {
      // Log error
      Logging.logActionExceptionMessage(tenantID, SOURCE_END_OF_SESSION, error);
    }
  }

  static async sendEndOfSignedSession(tenantID, sourceId, user: User, chargingStation, sourceData, locale, data) {
    try {
      // Enrich with admins
      sourceData.adminUsers = await NotificationHandler.getAdminUsers(tenantID);
      // Check notification
      const hasBeenNotified = await NotificationHandler.hasNotifiedSource(tenantID, CHANNEL_EMAIL, sourceId);
      // Notified?
      if (!hasBeenNotified) {
        // Email enabled?
        if (_notificationConfig.Email.enabled) {
          // Save notif
          await NotificationHandler.saveNotification(tenantID, CHANNEL_EMAIL, sourceId,
            SOURCE_END_OF_SESSION, user, chargingStation, data);
          // Send email
          const result = await _email.sendEndOfSignedSession(sourceData, locale, tenantID);
          // Return
          return result;
        }
      }
    } catch (error) {
      // Log error
      Logging.logActionExceptionMessage(tenantID, SOURCE_END_OF_SESSION, error);
    }
  }

  static async sendRequestPassword(tenantID, sourceId, user: User, sourceData, locale) {
    try {
      // Enrich with admins
      sourceData.adminUsers = await NotificationHandler.getAdminUsers(tenantID);
      // Email enabled?
      if (_notificationConfig.Email.enabled) {
        // Save notif
        await NotificationHandler.saveNotification(tenantID,
          CHANNEL_EMAIL, sourceId, SOURCE_REQUEST_PASSWORD, user, null);
        // Send email
        const result = await _email.sendRequestPassword(sourceData, locale, tenantID);
        // Return
        return result;
      }
    } catch (error) {
      // Log error
      Logging.logActionExceptionMessage(tenantID, SOURCE_REQUEST_PASSWORD, error);
    }
  }

  static async sendNewPassword(tenantID, sourceId, user: User, sourceData, locale) {
    try {
      // Enrich with admins
      sourceData.adminUsers = await NotificationHandler.getAdminUsers(tenantID);
      // Email enabled?
      if (_notificationConfig.Email.enabled) {
        // Save notif
        await NotificationHandler.saveNotification(tenantID, CHANNEL_EMAIL, sourceId, SOURCE_NEW_PASSWORD, user, null);
        // Send email
        const result = await _email.sendNewPassword(sourceData, locale, tenantID);
        // Return
        return result;
      }
    } catch (error) {
      // Log error
      Logging.logActionExceptionMessage(tenantID, SOURCE_NEW_PASSWORD, error);
    }
  }

  static async sendUserAccountStatusChanged(tenantID, sourceId, user: User, sourceData, locale) {
    try {
      // Enrich with admins
      sourceData.adminUsers = await NotificationHandler.getAdminUsers(tenantID);
      // Email enabled?
      if (_notificationConfig.Email.enabled) {
        // Save notif
        await NotificationHandler.saveNotification(tenantID, CHANNEL_EMAIL, sourceId,
          SOURCE_USER_ACCOUNT_STATUS_CHANGED, user, null);
        // Send email
        const result = await _email.sendUserAccountStatusChanged(sourceData, locale, tenantID);
        // Return
        return result;
      }
    } catch (error) {
      // Log error
      Logging.logActionExceptionMessage(tenantID, SOURCE_USER_ACCOUNT_STATUS_CHANGED, error);
    }
  }

  static async sendNewRegisteredUser(tenantID, sourceId, user: User, sourceData, locale) {
    try {
      // Enrich with admins
      sourceData.adminUsers = await NotificationHandler.getAdminUsers(tenantID);
      // Email enabled?
      if (_notificationConfig.Email.enabled) {
        // Save notif
        await NotificationHandler.saveNotification(tenantID, CHANNEL_EMAIL, sourceId,
          SOURCE_NEW_REGISTERED_USER, user, null);
        // Send email
        const result = await _email.sendNewRegisteredUser(sourceData, locale, tenantID);
        // Return
        return result;
      }
    } catch (error) {
      // Log error
      Logging.logActionExceptionMessage(tenantID, SOURCE_NEW_REGISTERED_USER, error);
    }
  }

  static async sendVerificationEmail(tenantID, sourceId, user: User, sourceData, locale) {
    try {
      // Enrich with admins
      sourceData.adminUsers = await NotificationHandler.getAdminUsers(tenantID);
      // Email enabled?
      if (_notificationConfig.Email.enabled) {
        // Save notif
        await NotificationHandler.saveNotification(tenantID, CHANNEL_EMAIL, sourceId,
          SOURCE_VERIFICATION_EMAIL, user, null);
        // Send email
        const result = await _email.sendVerificationEmail(sourceData, locale, tenantID);
        // Return
        return result;
      }
    } catch (error) {
      // Log error
      Logging.logActionExceptionMessage(tenantID, SOURCE_VERIFICATION_EMAIL, error);
    }
  }

  static async sendChargingStationStatusError(tenantID, sourceId, chargingStation, sourceData, data) {
    try {
      // Enrich with admins
      sourceData.adminUsers = await NotificationHandler.getAdminUsers(tenantID);
      // Email enabled?
      if (_notificationConfig.Email.enabled) {
        // Save notif
        await NotificationHandler.saveNotification(tenantID, CHANNEL_EMAIL, sourceId,
          SOURCE_CHARGING_STATION_STATUS_ERROR, null, chargingStation, data);
        // Send email
        const result = await _email.sendChargingStationStatusError(sourceData, Constants.DEFAULT_LOCALE, tenantID);
        // Return
        return result;
      }
    } catch (error) {
      // Log error
      Logging.logActionExceptionMessage(tenantID, SOURCE_CHARGING_STATION_STATUS_ERROR, error);
    }
  }

  static async sendChargingStationRegistered(tenantID, sourceId, chargingStation, sourceData) {
    try {
      // Enrich with admins
      sourceData.adminUsers = await NotificationHandler.getAdminUsers(tenantID);
      // Email enabled?
      if (_notificationConfig.Email.enabled) {
        // Save notif
        await NotificationHandler.saveNotification(tenantID, CHANNEL_EMAIL, sourceId,
          SOURCE_CHARGING_STATION_REGISTERED, null, chargingStation);
        // Send email
        const result = await _email.sendChargingStationRegistered(sourceData, Constants.DEFAULT_LOCALE, tenantID);
        // Return
        return result;
      }
    } catch (error) {
      // Log error
      Logging.logActionExceptionMessage(tenantID, SOURCE_CHARGING_STATION_REGISTERED, error);
    }
  }

  static async sendUnknownUserBadged(tenantID, sourceId, chargingStation, sourceData) {
    try {
      // Enrich with admins
      sourceData.adminUsers = await NotificationHandler.getAdminUsers(tenantID);
      // Email enabled?
      if (_notificationConfig.Email.enabled) {
        // Save notif
        await NotificationHandler.saveNotification(tenantID, CHANNEL_EMAIL, sourceId,
          SOURCE_UNKNOWN_USER_BADGED, null, chargingStation);
        // Send email
        const result = await _email.sendUnknownUserBadged(sourceData, Constants.DEFAULT_LOCALE, tenantID);
        // Return
        return result;
      }
    } catch (error) {
      // Log error
      Logging.logActionExceptionMessage(tenantID, SOURCE_UNKNOWN_USER_BADGED, error);
    }
  }

  static async sendTransactionStarted(tenantID, sourceId, user: User, chargingStation, sourceData, locale, data) {
    try {
      // Enrich with admins
      sourceData.adminUsers = await NotificationHandler.getAdminUsers(tenantID);
      // Check notification
      const hasBeenNotified = await NotificationHandler.hasNotifiedSource(tenantID, CHANNEL_EMAIL, sourceId);
      // Notified?
      if (!hasBeenNotified) {
        // Email enabled?
        if (_notificationConfig.Email.enabled && user.notificationsActive) {
          // Save notif
          await NotificationHandler.saveNotification(tenantID,
            CHANNEL_EMAIL, sourceId, SOURCE_TRANSACTION_STARTED, user, chargingStation, data);
          // Send email
          const result = await _email.sendTransactionStarted(sourceData, locale, tenantID);
          // Return
          return result;
        }
      }
    } catch (error) {
      // Log error
      Logging.logActionExceptionMessage(tenantID, SOURCE_TRANSACTION_STARTED, error);
    }
  }

  static async sendAuthErrorEmailServer(tenantID, locale, data) {
    try {
      // Enrich with admins
      data.users = await NotificationHandler.getAdminUsers(tenantID);
      // Compute the id as day and hour so that just one of this email is sent per hour
      const sourceId = Math.floor(Date.now()/3600000);
      console.log(`*** sourceId:${JSON.stringify(sourceId)}`);
      // Check notification
      const hasBeenNotified = await NotificationHandler.hasNotifiedSource(tenantID, CHANNEL_SMTP_AUTH, sourceId);
      // Notified?
      if (!hasBeenNotified) {
        // Email enabled?
        if (_notificationConfig.Email.enabled) {
          // Save notif
          await NotificationHandler.saveNotification(tenantID, CHANNEL_SMTP_AUTH, sourceId, SOURCE_AUTH_EMAIL_ERROR, null, null, data);
          // Send email
          const result = await _email.sendAuthErrorEmailServer(data, locale, tenantID);
          // Return
          return result;
        }
      }
    } catch (error) {
        // Log error
        Logging.logActionExceptionMessage(tenantID, SOURCE_AUTH_EMAIL_ERROR, error);
    }
  }
}
