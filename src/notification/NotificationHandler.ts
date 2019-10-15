import NotificationStorage from '../storage/mongodb/NotificationStorage';
import UserStorage from '../storage/mongodb/UserStorage';
import ChargingStation from '../types/ChargingStation';
import User from '../types/User';
import { EndOfChargeNotification, EndOfSessionNotification, EndOfSignedSessionNotification, OptimalChargeReachedNotification, RequestPasswordNotification, UserAccountStatusChangedNotification, UserNotificationKeys, NewRegisteredUserNotification, VerificationEmailNotification, ChargingStationStatusErrorNotification, ChargingStationRegisteredNotification, UnknownUserBadgedNotification, TransactionStartedNotification, SmtpAuthErrorNotification, OCPIPatchChargingStationsStatusesErrorNotification } from '../types/UserNotifications';
import Configuration from '../utils/Configuration';
import Constants from '../utils/Constants';
import Logging from '../utils/Logging';
import EMailNotificationTask from './email/EMailNotificationTask';

const _notificationConfig = Configuration.getNotificationConfig();
const _email = new EMailNotificationTask();

const CHANNEL_EMAIL = 'email';
const CHANNEL_SMTP_AUTH = 'smtpauth';
const CHANNEL_PATCH_EVSE_STATUS = 'evsestatus';
const SOURCE_CHARGING_STATION_STATUS_ERROR = 'NotifyChargingStationStatusError';
const SOURCE_CHARGING_STATION_REGISTERED = 'NotifyChargingStationRegistered';
const SOURCE_END_OF_CHARGE = 'NotifyEndOfCharge';
const SOURCE_OPTIMAL_CHARGE_REACHED = 'NotifyOptimalChargeReached';
const SOURCE_END_OF_SESSION = 'NotifyEndOfSession';
const SOURCE_REQUEST_PASSWORD = 'NotifyRequestPassword';
const SOURCE_USER_ACCOUNT_STATUS_CHANGED = 'NotifyUserAccountStatusChanged';
const SOURCE_NEW_REGISTERED_USER = 'NotifyNewRegisteredUser';
const SOURCE_UNKNOWN_USER_BADGED = 'NotifyUnknownUserBadged';
const SOURCE_TRANSACTION_STARTED = 'NotifyTransactionStarted';
const SOURCE_VERIFICATION_EMAIL = 'NotifyVerificationEmail';
const SOURCE_AUTH_EMAIL_ERROR = 'NotifyAuthentificationErrorEmailServer';
const SOURCE_PATCH_EVSE_STATUS_ERROR = 'NotifyPatchEVSEStatusError';

export default class NotificationHandler {

  static async saveNotification(tenantID: string, channel: string, notificationID: string,
      sourceDescr: string, user?: User, chargingStation?: ChargingStation, notificationData?: object): Promise<void> {
    // Save it
    await NotificationStorage.saveNotification(tenantID, {
      timestamp: new Date(),
      channel: channel,
      sourceId: notificationID,
      sourceDescr: sourceDescr,
      userID: (user ? user.id : null),
      chargeBoxID: (chargingStation ? chargingStation.id : null),
      data: notificationData
    });
    // Success
    if (user) {
      // User
      Logging.logInfo({
        tenantID: tenantID,
        source: (chargingStation ? chargingStation.id : null),
        module: 'NotificationHandler', method: 'saveNotification',
        action: sourceDescr, actionOnUser: user,
        message: 'User is being notified'
      });
    } else {
      // Admin
      Logging.logInfo({
        tenantID: tenantID,
        source: (chargingStation ? chargingStation.id : null),
        module: 'NotificationHandler', method: 'saveNotification',
        action: sourceDescr,
        message: 'Admin users are being notified'
      });
    }
  }

  static async getAdminUsers(tenantID: string, notificationKey?: UserNotificationKeys): Promise<User[]> {
    // Get admin users
    const params = { roles: [Constants.ROLE_ADMIN], notificationsActive: true, notifications: {} };
    if (notificationKey) {
      params.notifications[notificationKey] = true;
    }
    const adminUsers = await UserStorage.getUsers(tenantID, params, Constants.DB_PARAMS_MAX_LIMIT);
    // Found
    if (adminUsers.count > 0) {
      return adminUsers.result;
    }
  }

  static async hasNotifiedSource(tenantID: string, channel: string, notificationID: string): Promise<boolean> {
    try {
      // Save it
      const notifications = await NotificationStorage.getNotifications(tenantID,
        {
          channel: channel,
          sourceId: notificationID
        },
        Constants.DB_PARAMS_COUNT_ONLY);
      // Return
      return notifications.count > 0;
    } catch (error) {
      // Log error
      Logging.logActionExceptionMessage(tenantID, 'HasNotification', error);
    }
  }

  static async sendEndOfCharge(tenantID: string, notificationID: string, user: User, chargingStation: ChargingStation,
      sourceData: EndOfChargeNotification, locale: string): Promise<void> {
    try {
      // Check notification
      const hasBeenNotified = await NotificationHandler.hasNotifiedSource(tenantID, CHANNEL_EMAIL, notificationID);
      // Notified?
      if (!hasBeenNotified) {
        // Email enabled?
        if (_notificationConfig.Email.enabled && user.notificationsActive && user.notifications.sendEndOfCharge) {
          // Save notif
          await NotificationHandler.saveNotification(tenantID, CHANNEL_EMAIL, notificationID,
            SOURCE_END_OF_CHARGE, user, chargingStation, {
              'transactionId': sourceData.transactionId,
              'connectorId': sourceData.connectorId
            }
          );
          // Send email
          await _email.sendEndOfCharge(sourceData, locale, tenantID);
        }
      }
    } catch (error) {
      // Log error
      Logging.logActionExceptionMessage(tenantID, SOURCE_END_OF_CHARGE, error);
    }
  }

  static async sendOptimalChargeReached(tenantID: string, notificationID: string, user: User, chargingStation: ChargingStation,
      sourceData: OptimalChargeReachedNotification, locale: string): Promise<void> {
    try {
      // Check notification
      const hasBeenNotified = await NotificationHandler.hasNotifiedSource(tenantID, CHANNEL_EMAIL, notificationID);
      // Notified?
      if (!hasBeenNotified) {
        // Email enabled?
        if (_notificationConfig.Email.enabled && user.notificationsActive && user.notifications.sendOptimalChargeReached) {
          // Save notif
          await NotificationHandler.saveNotification(tenantID, CHANNEL_EMAIL, notificationID,
            SOURCE_OPTIMAL_CHARGE_REACHED, user, chargingStation, {
              'transactionId': sourceData.transactionId,
              'connectorId': sourceData.connectorId
            });
          // Send email
          await _email.sendOptimalChargeReached(sourceData, locale, tenantID);
        }
      }
    } catch (error) {
      // Log error
      Logging.logActionExceptionMessage(tenantID, SOURCE_OPTIMAL_CHARGE_REACHED, error);
    }
  }

  static async sendEndOfSession(tenantID: string, notificationID: string, user: User, chargingStation: ChargingStation,
      sourceData: EndOfSessionNotification, locale: string): Promise<void> {
    try {
      // Check notification
      const hasBeenNotified = await NotificationHandler.hasNotifiedSource(tenantID, CHANNEL_EMAIL, notificationID);
      // Notified?
      if (!hasBeenNotified) {
        // Email enabled?
        if (_notificationConfig.Email.enabled && user.notificationsActive && user.notifications.sendEndOfSession) {
          // Save notif
          await NotificationHandler.saveNotification(tenantID, CHANNEL_EMAIL, notificationID,
            SOURCE_END_OF_SESSION, user, chargingStation, {
              'transactionId': sourceData.transactionId,
              'connectorId': sourceData.connectorId
            });
          // Send email
          await _email.sendEndOfSession(sourceData, locale, tenantID);
        }
      }
    } catch (error) {
      // Log error
      Logging.logActionExceptionMessage(tenantID, SOURCE_END_OF_SESSION, error);
    }
  }

  static async sendEndOfSignedSession(tenantID: string, notificationID: string, user: User, chargingStation: ChargingStation,
      sourceData: EndOfSignedSessionNotification, locale: string): Promise<void> {
    try {
      // Check notification
      const hasBeenNotified = await NotificationHandler.hasNotifiedSource(tenantID, CHANNEL_EMAIL, notificationID);
      // Notified?
      if (!hasBeenNotified) {
        // Email enabled?
        if (_notificationConfig.Email.enabled) {
          // Save notif
          await NotificationHandler.saveNotification(tenantID, CHANNEL_EMAIL, notificationID,
            SOURCE_END_OF_SESSION, user, chargingStation, {
              'transactionId': sourceData.transactionId,
              'connectorId': sourceData.connectorId
            });
          // Send email
          await _email.sendEndOfSignedSession(sourceData, locale, tenantID);
        }
      }
    } catch (error) {
      // Log error
      Logging.logActionExceptionMessage(tenantID, SOURCE_END_OF_SESSION, error);
    }
  }

  static async sendRequestPassword(tenantID: string, notificationID: string, user: User,
      sourceData: RequestPasswordNotification, locale: string): Promise<void> {
    try {
      // Email enabled?
      if (_notificationConfig.Email.enabled) {
        // Save notif
        await NotificationHandler.saveNotification(tenantID,
          CHANNEL_EMAIL, notificationID, SOURCE_REQUEST_PASSWORD, user);
        // Send email
        await _email.sendRequestPassword(sourceData, locale, tenantID);
      }
    } catch (error) {
      // Log error
      Logging.logActionExceptionMessage(tenantID, SOURCE_REQUEST_PASSWORD, error);
    }
  }

  static async sendUserAccountStatusChanged(tenantID: string, notificationID: string, user: User,
      sourceData: UserAccountStatusChangedNotification, locale: string): Promise<void> {
    try {
      // Email enabled?
      if (_notificationConfig.Email.enabled && user.notificationsActive && user.notifications.sendUserAccountStatusChanged) {
        // Save notif
        await NotificationHandler.saveNotification(tenantID, CHANNEL_EMAIL, notificationID,
          SOURCE_USER_ACCOUNT_STATUS_CHANGED, user);
        // Send email
        await _email.sendUserAccountStatusChanged(sourceData, locale, tenantID);
      }
    } catch (error) {
      // Log error
      Logging.logActionExceptionMessage(tenantID, SOURCE_USER_ACCOUNT_STATUS_CHANGED, error);
    }
  }

  static async sendNewRegisteredUser(tenantID: string, notificationID: string, user: User,
      sourceData: NewRegisteredUserNotification, locale: string): Promise<void> {
    try {
      // Email enabled?
      if (_notificationConfig.Email.enabled && user.notificationsActive && user.notifications.sendNewRegisteredUser) {
        // Save notif
        await NotificationHandler.saveNotification(tenantID, CHANNEL_EMAIL, notificationID,
          SOURCE_NEW_REGISTERED_USER, user);
        // Send email
        await _email.sendNewRegisteredUser(sourceData, locale, tenantID);
      }
    } catch (error) {
      // Log error
      Logging.logActionExceptionMessage(tenantID, SOURCE_NEW_REGISTERED_USER, error);
    }
  }

  static async sendVerificationEmail(tenantID: string, notificationID: string, user: User,
      sourceData: VerificationEmailNotification, locale: string): Promise<void> {
    try {
      // Email enabled?
      if (_notificationConfig.Email.enabled) {
        // Save notif
        await NotificationHandler.saveNotification(tenantID, CHANNEL_EMAIL, notificationID,
          SOURCE_VERIFICATION_EMAIL, user);
        // Send email
        await _email.sendVerificationEmail(sourceData, locale, tenantID);
      }
    } catch (error) {
      // Log error
      Logging.logActionExceptionMessage(tenantID, SOURCE_VERIFICATION_EMAIL, error);
    }
  }

  static async sendChargingStationStatusError(tenantID: string, notificationID: string, chargingStation: ChargingStation,
      sourceData: ChargingStationStatusErrorNotification, data): Promise<void> {
    try {
      // Enrich with admins
      sourceData.adminUsers = await NotificationHandler.getAdminUsers(tenantID, "sendChargingStationStatusError");
      // Email enabled?
      if (_notificationConfig.Email.enabled) {
        // Save notif
        await NotificationHandler.saveNotification(tenantID, CHANNEL_EMAIL, notificationID,
          SOURCE_CHARGING_STATION_STATUS_ERROR, null, chargingStation, data);
        // Send email
        await _email.sendChargingStationStatusError(sourceData, Constants.DEFAULT_LOCALE, tenantID);
      }
    } catch (error) {
      // Log error
      Logging.logActionExceptionMessage(tenantID, SOURCE_CHARGING_STATION_STATUS_ERROR, error);
    }
  }

  static async sendChargingStationRegistered(tenantID: string, notificationID: string, chargingStation: ChargingStation,
      sourceData: ChargingStationRegisteredNotification): Promise<void> {
    try {
      // Enrich with admins
      sourceData.adminUsers = await NotificationHandler.getAdminUsers(tenantID, "sendChargingStationRegistered");
      // Email enabled?
      if (_notificationConfig.Email.enabled) {
        // Save notif
        await NotificationHandler.saveNotification(tenantID, CHANNEL_EMAIL, notificationID,
          SOURCE_CHARGING_STATION_REGISTERED, null, chargingStation);
        // Send email
        await _email.sendChargingStationRegistered(sourceData, Constants.DEFAULT_LOCALE, tenantID);
      }
    } catch (error) {
      // Log error
      Logging.logActionExceptionMessage(tenantID, SOURCE_CHARGING_STATION_REGISTERED, error);
    }
  }

  static async sendUnknownUserBadged(tenantID: string, notificationID: string, chargingStation: ChargingStation,
      sourceData: UnknownUserBadgedNotification): Promise<void> {
    try {
      // Enrich with admins
      sourceData.adminUsers = await NotificationHandler.getAdminUsers(tenantID, "sendUnknownUserBadged");
      // Email enabled?
      if (_notificationConfig.Email.enabled) {
        // Save notif
        await NotificationHandler.saveNotification(tenantID, CHANNEL_EMAIL, notificationID,
          SOURCE_UNKNOWN_USER_BADGED, null, chargingStation);
        // Send email
        await _email.sendUnknownUserBadged(sourceData, Constants.DEFAULT_LOCALE, tenantID);
      }
    } catch (error) {
      // Log error
      Logging.logActionExceptionMessage(tenantID, SOURCE_UNKNOWN_USER_BADGED, error);
    }
  }

  static async sendTransactionStarted(tenantID: string, notificationID: string, user: User, chargingStation: ChargingStation,
      sourceData: TransactionStartedNotification, locale: string): Promise<void> {
    try {
      // Check notification
      const hasBeenNotified = await NotificationHandler.hasNotifiedSource(tenantID, CHANNEL_EMAIL, notificationID);
      // Notified?
      if (!hasBeenNotified) {
        // Email enabled?
        if (_notificationConfig.Email.enabled && user.notificationsActive && user.notifications.sendSessionStarted) {
          // Save notif
          await NotificationHandler.saveNotification(tenantID,
            CHANNEL_EMAIL, notificationID, SOURCE_TRANSACTION_STARTED, user, chargingStation, {
              'transactionId': sourceData.transactionId,
              'connectorId': sourceData.connectorId
            }
          );
          // Send email
          await _email.sendTransactionStarted(sourceData, locale, tenantID);
        }
      }
    } catch (error) {
      // Log error
      Logging.logActionExceptionMessage(tenantID, SOURCE_TRANSACTION_STARTED, error);
    }
  }

  static async sendSmtpAuthError(tenantID: string, locale: string, data: SmtpAuthErrorNotification): Promise<void> {
    try {
      // Enrich with admins
      data.adminUsers = await NotificationHandler.getAdminUsers(tenantID, "sendSmtpAuthError");
      // Compute the id as day and hour so that just one of this email is sent per hour
      const notificationID: string = Math.floor(Date.now() / 3600000) + '';
      // Check notification
      const hasBeenNotified = await NotificationHandler.hasNotifiedSource(tenantID, CHANNEL_SMTP_AUTH, notificationID);
      // Notified?
      if (!hasBeenNotified) {
        // Email enabled?
        if (_notificationConfig.Email.enabled) {
          // Save notif
          await NotificationHandler.saveNotification(tenantID, CHANNEL_SMTP_AUTH, notificationID, SOURCE_AUTH_EMAIL_ERROR);
          // Send email
          await _email.sendSmtpAuthError(data, locale, tenantID);
        }
      }
    } catch (error) {
      // Log error
      Logging.logActionExceptionMessage(tenantID, SOURCE_AUTH_EMAIL_ERROR, error);
    }
  }

  static async sendOCPIPatchChargingStationsStatusesError(tenantID: string, data: OCPIPatchChargingStationsStatusesErrorNotification): Promise<void> {
    try {
      // Enrich with admins
      data.adminUsers = await NotificationHandler.getAdminUsers(tenantID, "sendOcpiPatchStatusError");
      // Compute the id as day and hour so that just one of this email is sent per hour
      const notificationID: string = Math.floor(Date.now() / 3600000) + '';
      // Check notification
      const hasBeenNotified = await NotificationHandler.hasNotifiedSource(tenantID, CHANNEL_PATCH_EVSE_STATUS, notificationID);
      // Notified?
      if (!hasBeenNotified) {
        // Email enabled?
        if (_notificationConfig.Email.enabled) {
          // Save notif
          await NotificationHandler.saveNotification(tenantID, CHANNEL_PATCH_EVSE_STATUS, notificationID, SOURCE_PATCH_EVSE_STATUS_ERROR, null, null, {
            locationID: data.locationID,
            chargeBoxID: data.chargeBoxID
          });
          // Send email
          await _email.sendOCPIPatchChargingStationsStatusesError(data, tenantID);
        }
      }
    } catch (error) {
      // Log error
      Logging.logActionExceptionMessage(tenantID, SOURCE_PATCH_EVSE_STATUS_ERROR, error);
    }
  }
}
