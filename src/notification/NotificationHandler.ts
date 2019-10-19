import NotificationStorage from '../storage/mongodb/NotificationStorage';
import UserStorage from '../storage/mongodb/UserStorage';
import ChargingStation from '../types/ChargingStation';
import User from '../types/User';
import UserNotifications, { ChargingStationRegisteredNotification, ChargingStationStatusErrorNotification, EndOfChargeNotification, EndOfSessionNotification, EndOfSignedSessionNotification, NewRegisteredUserNotification, Notification, NotificationSource, OCPIPatchChargingStationsStatusesErrorNotification, OptimalChargeReachedNotification, RequestPasswordNotification, SmtpAuthErrorNotification, TransactionStartedNotification, UnknownUserBadgedNotification, UserAccountStatusChangedNotification, UserNotificationKeys, VerificationEmailNotification } from '../types/UserNotifications';
import Configuration from '../utils/Configuration';
import Constants from '../utils/Constants';
import Logging from '../utils/Logging';
import EMailNotificationTask from './email/EMailNotificationTask';
import RemotePushNotificationTask from './remote-push-notification/RemotePushNotificationTask';
import moment = require('moment');
import { database } from 'firebase-admin';

export default class NotificationHandler {
  private static notificationConfig = Configuration.getNotificationConfig();
  private static notificationSources: NotificationSource[] = [
    {
      channel: 'email',
      notificationTask: new EMailNotificationTask(),
      enabled: NotificationHandler.notificationConfig.Email ? NotificationHandler.notificationConfig.Email.enabled : false
    },
    {
      channel: 'remote-push-notification',
      notificationTask: new RemotePushNotificationTask(),
      enabled: NotificationHandler.notificationConfig.RemotePushNotification ? NotificationHandler.notificationConfig.RemotePushNotification.enabled : false
    }
  ];

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
    const params = { roles: [Constants.ROLE_ADMIN], notificationsActive: true, notifications: {} as UserNotifications };
    if (notificationKey) {
      params.notifications[notificationKey] = true;
    }
    const adminUsers = await UserStorage.getUsers(tenantID, params, Constants.DB_PARAMS_MAX_LIMIT);
    // Found
    if (adminUsers.count > 0) {
      return adminUsers.result;
    }
  }

  static async hasNotifiedSource(tenantID: string, channel: string, sourceDescr: string, notificationID: string,
    interval?: { intervalMins?: number; intervalKey?: object }): Promise<boolean> {
    try {
      // Check
      if (interval && interval.intervalMins) {
        // Save it
        const notifications = await NotificationStorage.getNotifications(
          tenantID,
          {
            channel,
            sourceDescr,
            data: interval.intervalKey
          },
          Constants.DB_PARAMS_MAX_LIMIT
        );
        // Check
        if (notifications.count > 0) {
          // Get the first one (ordered desc)
          const notification: Notification = notifications.result[0];
          const diffMinutes = moment.duration(moment().diff(moment(notification.timestamp))).asMinutes();
          if (diffMinutes < interval.intervalMins) {
            return true;
          }
        }
        // Default
        return false;
      }
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
    // For each Sources
    for (const notificationSource of NotificationHandler.notificationSources) {
      // Active?
      if (notificationSource.enabled) {
        try {
          // Override notification ID
          const connector = chargingStation.connectors[sourceData.connectorId - 1];
          let intervalMins = 0;
          if (connector.power <= 7360) {
            // Notifify every 15 mins
            intervalMins = 15;
          } if (connector.power < 50000) {
            // Notifify every 30 mins
            intervalMins = 30;
          } if (connector.power >= 50000) {
            // Notifify every 60 mins
            intervalMins = 60;
          }
          // Check notification
          const hasBeenNotified = await NotificationHandler.hasNotifiedSource(tenantID, notificationSource.channel,
            Constants.SOURCE_END_OF_CHARGE, notificationID, { intervalMins, intervalKey: { transactionId: sourceData.transactionId } });
          if (!hasBeenNotified) {
            // Alter Notification ID
            notificationID = `${notificationID}-${new Date().toISOString()}`;
            // Enabled?
            if (user.notificationsActive && user.notifications.sendEndOfCharge) {
              // Save
              await NotificationHandler.saveNotification(tenantID, notificationSource.channel, notificationID,
                Constants.SOURCE_END_OF_CHARGE, user, chargingStation, {
                  'transactionId': sourceData.transactionId,
                  'connectorId': sourceData.connectorId
                }
              );
              // Send
              await notificationSource.notificationTask.sendEndOfCharge(sourceData, locale, tenantID);
            }
          }
        } catch (error) {
          Logging.logActionExceptionMessage(tenantID, Constants.SOURCE_END_OF_CHARGE, error);
        }
      }
    }
  }

  static async sendOptimalChargeReached(tenantID: string, notificationID: string, user: User, chargingStation: ChargingStation,
    sourceData: OptimalChargeReachedNotification, locale: string): Promise<void> {
    // For each Sources
    for (const notificationSource of NotificationHandler.notificationSources) {
      // Active?
      if (notificationSource.enabled) {
        try {
          // Check notification
          const hasBeenNotified = await NotificationHandler.hasNotifiedSource(
            tenantID, notificationSource.channel, Constants.SOURCE_OPTIMAL_CHARGE_REACHED, notificationID);
          if (!hasBeenNotified) {
            // Enabled?
            if (user.notificationsActive && user.notifications.sendOptimalChargeReached) {
              // Save
              await NotificationHandler.saveNotification(tenantID, notificationSource.channel, notificationID,
                Constants.SOURCE_OPTIMAL_CHARGE_REACHED, user, chargingStation, {
                  'transactionId': sourceData.transactionId,
                  'connectorId': sourceData.connectorId
                });
              // Send
              await notificationSource.notificationTask.sendOptimalChargeReached(sourceData, locale, tenantID);
            }
          }
        } catch (error) {
          Logging.logActionExceptionMessage(tenantID, Constants.SOURCE_OPTIMAL_CHARGE_REACHED, error);
        }
      }
    }
  }

  static async sendEndOfSession(tenantID: string, notificationID: string, user: User, chargingStation: ChargingStation,
    sourceData: EndOfSessionNotification, locale: string): Promise<void> {
    // For each Sources
    for (const notificationSource of NotificationHandler.notificationSources) {
      // Active?
      if (notificationSource.enabled) {
        try {
          // Check notification
          const hasBeenNotified = await NotificationHandler.hasNotifiedSource(
            tenantID, notificationSource.channel, Constants.SOURCE_END_OF_SESSION, notificationID);
          if (!hasBeenNotified) {
            // Enabled?
            if (user.notificationsActive && user.notifications.sendEndOfSession) {
              // Save
              await NotificationHandler.saveNotification(tenantID, notificationSource.channel, notificationID,
                Constants.SOURCE_END_OF_SESSION, user, chargingStation, {
                  'transactionId': sourceData.transactionId,
                  'connectorId': sourceData.connectorId
                });
              // Send
              await notificationSource.notificationTask.sendEndOfSession(sourceData, locale, tenantID);
            }
          }
        } catch (error) {
          Logging.logActionExceptionMessage(tenantID, Constants.SOURCE_END_OF_SESSION, error);
        }
      }
    }
  }

  static async sendEndOfSignedSession(tenantID: string, notificationID: string, user: User, chargingStation: ChargingStation,
    sourceData: EndOfSignedSessionNotification, locale: string): Promise<void> {
    // For each Sources
    for (const notificationSource of NotificationHandler.notificationSources) {
      // Active?
      if (notificationSource.enabled) {
        try {
          // Check notification
          const hasBeenNotified = await NotificationHandler.hasNotifiedSource(
            tenantID, notificationSource.channel, Constants.SOURCE_END_OF_SESSION, notificationID);
          if (!hasBeenNotified) {
            // Enabled?
            if (user.notificationsActive && user.notifications.sendEndOfSession) {
              // Save notif
              await NotificationHandler.saveNotification(tenantID, notificationSource.channel, notificationID,
                Constants.SOURCE_END_OF_SESSION, user, chargingStation, {
                  'transactionId': sourceData.transactionId,
                  'connectorId': sourceData.connectorId
                });
              // Send
              await notificationSource.notificationTask.sendEndOfSignedSession(sourceData, locale, tenantID);
            }
          }
        } catch (error) {
          Logging.logActionExceptionMessage(tenantID, Constants.SOURCE_END_OF_SESSION, error);
        }
      }
    }
  }

  static async sendRequestPassword(tenantID: string, notificationID: string, user: User,
    sourceData: RequestPasswordNotification, locale: string): Promise<void> {
    // For each Sources
    for (const notificationSource of NotificationHandler.notificationSources) {
      // Active?
      if (notificationSource.enabled) {
        try {
          // Save notif
          await NotificationHandler.saveNotification(tenantID,
            notificationSource.channel, notificationID, Constants.SOURCE_REQUEST_PASSWORD, user);
          // Send
          await notificationSource.notificationTask.sendRequestPassword(sourceData, locale, tenantID);
        } catch (error) {
          Logging.logActionExceptionMessage(tenantID, Constants.SOURCE_REQUEST_PASSWORD, error);
        }
      }
    }
  }

  static async sendUserAccountStatusChanged(tenantID: string, notificationID: string, user: User,
    sourceData: UserAccountStatusChangedNotification, locale: string): Promise<void> {
    // For each Sources
    for (const notificationSource of NotificationHandler.notificationSources) {
      // Active?
      if (notificationSource.enabled) {
        try {
          // Enabled?
          if (user.notificationsActive && user.notifications.sendUserAccountStatusChanged) {
            // Save
            await NotificationHandler.saveNotification(tenantID, notificationSource.channel, notificationID,
              Constants.SOURCE_USER_ACCOUNT_STATUS_CHANGED, user);
            // Send
            await notificationSource.notificationTask.sendUserAccountStatusChanged(sourceData, locale, tenantID);
          }
        } catch (error) {
          // Log error
          Logging.logActionExceptionMessage(tenantID, Constants.SOURCE_USER_ACCOUNT_STATUS_CHANGED, error);
        }
      }
    }
  }

  static async sendNewRegisteredUser(tenantID: string, notificationID: string, user: User,
    sourceData: NewRegisteredUserNotification, locale: string): Promise<void> {
    // For each Sources
    for (const notificationSource of NotificationHandler.notificationSources) {
      // Active?
      if (notificationSource.enabled) {
        try {
          // Save
          await NotificationHandler.saveNotification(tenantID, notificationSource.channel, notificationID,
            Constants.SOURCE_NEW_REGISTERED_USER, user);
          // Send
          await notificationSource.notificationTask.sendNewRegisteredUser(sourceData, locale, tenantID);
        } catch (error) {
          Logging.logActionExceptionMessage(tenantID, Constants.SOURCE_NEW_REGISTERED_USER, error);
        }
      }
    }
  }

  static async sendVerificationEmail(tenantID: string, notificationID: string, user: User,
    sourceData: VerificationEmailNotification, locale: string): Promise<void> {
    // For each Sources
    for (const notificationSource of NotificationHandler.notificationSources) {
      // Active?
      if (notificationSource.enabled) {
        try {
          // Save
          await NotificationHandler.saveNotification(tenantID, notificationSource.channel, notificationID,
            Constants.SOURCE_VERIFICATION_EMAIL, user);
          // Send
          await notificationSource.notificationTask.sendVerificationEmail(sourceData, locale, tenantID);
        } catch (error) {
          Logging.logActionExceptionMessage(tenantID, Constants.SOURCE_VERIFICATION_EMAIL, error);
        }
      }
    }
  }

  static async sendChargingStationStatusError(tenantID: string, notificationID: string, chargingStation: ChargingStation,
    sourceData: ChargingStationStatusErrorNotification, data): Promise<void> {
    // Enrich with admins
    sourceData.adminUsers = await NotificationHandler.getAdminUsers(tenantID, 'sendChargingStationStatusError');
    if (sourceData.adminUsers && sourceData.adminUsers.length > 0) {
      // For each Sources
      for (const notificationSource of NotificationHandler.notificationSources) {
        // Active?
        if (notificationSource.enabled) {
          try {
            // Save
            await NotificationHandler.saveNotification(tenantID, notificationSource.channel, notificationID,
              Constants.SOURCE_CHARGING_STATION_STATUS_ERROR, null, chargingStation, data);
            // Send
            await notificationSource.notificationTask.sendChargingStationStatusError(sourceData, Constants.DEFAULT_LOCALE, tenantID);
          } catch (error) {
            Logging.logActionExceptionMessage(tenantID, Constants.SOURCE_CHARGING_STATION_STATUS_ERROR, error);
          }
        }
      }
    }
  }

  static async sendChargingStationRegistered(tenantID: string, notificationID: string, chargingStation: ChargingStation,
    sourceData: ChargingStationRegisteredNotification): Promise<void> {
    // Enrich with admins
    sourceData.adminUsers = await NotificationHandler.getAdminUsers(tenantID, 'sendChargingStationRegistered');
    if (sourceData.adminUsers && sourceData.adminUsers.length > 0) {
      // For each Sources
      for (const notificationSource of NotificationHandler.notificationSources) {
        // Active?
        if (notificationSource.enabled) {
          try {
            // Save
            await NotificationHandler.saveNotification(tenantID, notificationSource.channel, notificationID,
              Constants.SOURCE_CHARGING_STATION_REGISTERED, null, chargingStation);
            // Send
            await notificationSource.notificationTask.sendChargingStationRegistered(sourceData, Constants.DEFAULT_LOCALE, tenantID);
          } catch (error) {
            Logging.logActionExceptionMessage(tenantID, Constants.SOURCE_CHARGING_STATION_REGISTERED, error);
          }
        }
      }
    }
  }

  static async sendUnknownUserBadged(tenantID: string, notificationID: string, chargingStation: ChargingStation,
    sourceData: UnknownUserBadgedNotification): Promise<void> {
    // Enrich with admins
    sourceData.adminUsers = await NotificationHandler.getAdminUsers(tenantID, 'sendUnknownUserBadged');
    if (sourceData.adminUsers && sourceData.adminUsers.length > 0) {
      // For each Sources
      for (const notificationSource of NotificationHandler.notificationSources) {
        // Active?
        if (notificationSource.enabled) {
          try {
            // Save
            await NotificationHandler.saveNotification(tenantID, notificationSource.channel, notificationID,
              Constants.SOURCE_UNKNOWN_USER_BADGED, null, chargingStation);
            // Send
            await notificationSource.notificationTask.sendUnknownUserBadged(sourceData, Constants.DEFAULT_LOCALE, tenantID);
          } catch (error) {
            // Log error
            Logging.logActionExceptionMessage(tenantID, Constants.SOURCE_UNKNOWN_USER_BADGED, error);
          }
        }
      }
    }
  }

  static async sendSessionStarted(tenantID: string, notificationID: string, user: User, chargingStation: ChargingStation,
    sourceData: TransactionStartedNotification, locale: string): Promise<void> {
    // For each Sources
    for (const notificationSource of NotificationHandler.notificationSources) {
      // Active?
      if (notificationSource.enabled) {
        try {
          // Check notification
          const hasBeenNotified = await NotificationHandler.hasNotifiedSource(
            tenantID, notificationSource.channel, Constants.SOURCE_TRANSACTION_STARTED, notificationID);
          if (!hasBeenNotified) {
            // Enabled?
            if (user.notificationsActive && user.notifications.sendSessionStarted) {
              // Save
              await NotificationHandler.saveNotification(tenantID,
                notificationSource.channel, notificationID, Constants.SOURCE_TRANSACTION_STARTED, user, chargingStation, {
                  'transactionId': sourceData.transactionId,
                  'connectorId': sourceData.connectorId
                }
              );
              // Send
              await notificationSource.notificationTask.sendSessionStarted(sourceData, locale, tenantID);
            }
          }
        } catch (error) {
          Logging.logActionExceptionMessage(tenantID, Constants.SOURCE_TRANSACTION_STARTED, error);
        }
      }
    }
  }

  static async sendSmtpAuthError(tenantID: string, locale: string, sourceData: SmtpAuthErrorNotification): Promise<void> {
    // Enrich with admins
    sourceData.adminUsers = await NotificationHandler.getAdminUsers(tenantID, 'sendSmtpAuthError');
    if (sourceData.adminUsers && sourceData.adminUsers.length > 0) {
      // For each Sources
      for (const notificationSource of NotificationHandler.notificationSources) {
        // Active?
        if (notificationSource.enabled) {
          try {
            // Compute the id as day and hour so that just one of this email is sent per hour
            const notificationID = new Date().toISOString();
            // Check notification
            const hasBeenNotified = await NotificationHandler.hasNotifiedSource(
              tenantID, notificationSource.channel, Constants.SOURCE_AUTH_EMAIL_ERROR,
              notificationID, { intervalMins: 60, intervalKey: null });
            if (!hasBeenNotified) {
              // Email enabled?
              if (NotificationHandler.notificationConfig.Email.enabled) {
                // Save
                await NotificationHandler.saveNotification(tenantID, notificationSource.channel, notificationID, Constants.SOURCE_AUTH_EMAIL_ERROR);
                // Send
                await notificationSource.notificationTask.sendSmtpAuthError(sourceData, locale, tenantID);
              }
            }
          } catch (error) {
            Logging.logActionExceptionMessage(tenantID, Constants.SOURCE_AUTH_EMAIL_ERROR, error);
          }
        }
      }
    }
  }

  static async sendOCPIPatchChargingStationsStatusesError(tenantID: string, locale: string, sourceData: OCPIPatchChargingStationsStatusesErrorNotification): Promise<void> {
    // Enrich with admins
    sourceData.adminUsers = await NotificationHandler.getAdminUsers(tenantID, 'sendOcpiPatchStatusError');
    if (sourceData.adminUsers && sourceData.adminUsers.length > 0) {
      // For each Sources
      for (const notificationSource of NotificationHandler.notificationSources) {
        // Active?
        if (notificationSource.enabled) {
          try {
            // Compute the id as day and hour so that just one of this email is sent per hour
            const notificationID = new Date().toISOString();
            // Check notification
            const hasBeenNotified = await NotificationHandler.hasNotifiedSource(
              tenantID, notificationSource.channel, Constants.SOURCE_PATCH_EVSE_STATUS_ERROR,
              notificationID, { intervalMins: 60, intervalKey: null });
            // Notified?
            if (!hasBeenNotified) {
              // Enabled?
              if (notificationSource.enabled) {
                // Save
                await NotificationHandler.saveNotification(tenantID, notificationSource.channel, notificationID, Constants.SOURCE_PATCH_EVSE_STATUS_ERROR, null, null, {
                  location: sourceData.location
                });
                // Send
                await notificationSource.notificationTask.sendOCPIPatchChargingStationsStatusesError(sourceData, locale, tenantID);
              }
            }
          } catch (error) {
            Logging.logActionExceptionMessage(tenantID, Constants.SOURCE_PATCH_EVSE_STATUS_ERROR, error);
          }
        }
      }
    }
  }
}
