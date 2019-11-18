import NotificationStorage from '../storage/mongodb/NotificationStorage';
import UserStorage from '../storage/mongodb/UserStorage';
import ChargingStation from '../types/ChargingStation';
import User from '../types/User';
import UserNotifications, { NotificationSeverity, PreparingSessionsAreStartedNotification, UserAccountInactivityNotification, ChargingStationRegisteredNotification, ChargingStationStatusErrorNotification, EndOfChargeNotification, EndOfSessionNotification, EndOfSignedSessionNotification, NewRegisteredUserNotification, Notification, NotificationSource, OCPIPatchChargingStationsStatusesErrorNotification, OptimalChargeReachedNotification, RequestPasswordNotification, SmtpAuthErrorNotification, TransactionStartedNotification, UnknownUserBadgedNotification, UserAccountStatusChangedNotification, UserNotificationKeys, VerificationEmailNotification, OfflineChargingStationNotification } from '../types/UserNotifications';
import Configuration from '../utils/Configuration';
import Constants from '../utils/Constants';
import Logging from '../utils/Logging';
import Utils from '../utils/Utils';
import EMailNotificationTask from './email/EMailNotificationTask';
import RemotePushNotificationTask from './remote-push-notification/RemotePushNotificationTask';
import moment = require('moment');

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
    const params = { email:'jean.pierre.demessant@sap.com', roles: [Constants.ROLE_ADMIN], notificationsActive: true, notifications: {} as UserNotifications };
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
          if (diffMinutes <= interval.intervalMins) {
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
        Constants.DB_PARAMS_COUNT_ONLY
      );
      // Return
      return notifications.count > 0;
    } catch (error) {
      // Log error
      Logging.logActionExceptionMessage(tenantID, 'HasNotification', error);
    }
  }

  static async sendEndOfCharge(tenantID: string, notificationID: string, user: User, chargingStation: ChargingStation,
    sourceData: EndOfChargeNotification): Promise<void> {
    // For each Sources
    for (const notificationSource of NotificationHandler.notificationSources) {
      // Active?
      if (notificationSource.enabled) {
        try {
          // Get interval
          const intervalMins = Utils.getEndOfChargeNotificationIntervalMins(
            chargingStation, Utils.getConnectorIDFromConnectorLetter(sourceData.connectorId));
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
              await notificationSource.notificationTask.sendEndOfCharge(sourceData, user, tenantID, NotificationSeverity.INFO);
            }
          }
        } catch (error) {
          Logging.logActionExceptionMessage(tenantID, Constants.SOURCE_END_OF_CHARGE, error);
        }
      }
    }
  }

  static async sendOptimalChargeReached(tenantID: string, notificationID: string, user: User, chargingStation: ChargingStation,
    sourceData: OptimalChargeReachedNotification): Promise<void> {
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
              await notificationSource.notificationTask.sendOptimalChargeReached(sourceData, user, tenantID, NotificationSeverity.INFO);
            }
          }
        } catch (error) {
          Logging.logActionExceptionMessage(tenantID, Constants.SOURCE_OPTIMAL_CHARGE_REACHED, error);
        }
      }
    }
  }

  static async sendEndOfSession(tenantID: string, notificationID: string, user: User, chargingStation: ChargingStation,
    sourceData: EndOfSessionNotification): Promise<void> {
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
              await notificationSource.notificationTask.sendEndOfSession(sourceData, user, tenantID, NotificationSeverity.INFO);
            }
          }
        } catch (error) {
          Logging.logActionExceptionMessage(tenantID, Constants.SOURCE_END_OF_SESSION, error);
        }
      }
    }
  }

  static async sendEndOfSignedSession(tenantID: string, notificationID: string, user: User, chargingStation: ChargingStation,
    sourceData: EndOfSignedSessionNotification): Promise<void> {
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
              await notificationSource.notificationTask.sendEndOfSignedSession(sourceData, user, tenantID, NotificationSeverity.INFO);
            }
          }
        } catch (error) {
          Logging.logActionExceptionMessage(tenantID, Constants.SOURCE_END_OF_SESSION, error);
        }
      }
    }
  }

  static async sendRequestPassword(tenantID: string, notificationID: string, user: User,
    sourceData: RequestPasswordNotification): Promise<void> {
    // For each Sources
    for (const notificationSource of NotificationHandler.notificationSources) {
      // Active?
      if (notificationSource.enabled) {
        try {
          // Save notif
          await NotificationHandler.saveNotification(tenantID,
            notificationSource.channel, notificationID, Constants.SOURCE_REQUEST_PASSWORD, user);
          // Send
          await notificationSource.notificationTask.sendRequestPassword(sourceData, user, tenantID, NotificationSeverity.INFO);
        } catch (error) {
          Logging.logActionExceptionMessage(tenantID, Constants.SOURCE_REQUEST_PASSWORD, error);
        }
      }
    }
  }

  static async sendUserAccountStatusChanged(tenantID: string, notificationID: string, user: User,
    sourceData: UserAccountStatusChangedNotification): Promise<void> {
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
            await notificationSource.notificationTask.sendUserAccountStatusChanged(sourceData, user, tenantID, NotificationSeverity.WARNING);
          }
        } catch (error) {
          // Log error
          Logging.logActionExceptionMessage(tenantID, Constants.SOURCE_USER_ACCOUNT_STATUS_CHANGED, error);
        }
      }
    }
  }

  static async sendNewRegisteredUser(tenantID: string, notificationID: string, user: User,
    sourceData: NewRegisteredUserNotification): Promise<void> {
    // For each Sources
    for (const notificationSource of NotificationHandler.notificationSources) {
      // Active?
      if (notificationSource.enabled) {
        try {
          // Save
          await NotificationHandler.saveNotification(tenantID, notificationSource.channel, notificationID,
            Constants.SOURCE_NEW_REGISTERED_USER, user);
          // Send
          await notificationSource.notificationTask.sendNewRegisteredUser(sourceData, user, tenantID, NotificationSeverity.INFO);
        } catch (error) {
          Logging.logActionExceptionMessage(tenantID, Constants.SOURCE_NEW_REGISTERED_USER, error);
        }
      }
    }
  }

  static async sendVerificationEmail(tenantID: string, notificationID: string, user: User,
    sourceData: VerificationEmailNotification): Promise<void> {
    // For each Sources
    for (const notificationSource of NotificationHandler.notificationSources) {
      // Active?
      if (notificationSource.enabled) {
        try {
          // Save
          await NotificationHandler.saveNotification(tenantID, notificationSource.channel, notificationID,
            Constants.SOURCE_VERIFICATION_EMAIL, user);
          // Send
          await notificationSource.notificationTask.sendVerificationEmail(sourceData, user, tenantID, NotificationSeverity.INFO);
        } catch (error) {
          Logging.logActionExceptionMessage(tenantID, Constants.SOURCE_VERIFICATION_EMAIL, error);
        }
      }
    }
  }

  static async sendChargingStationStatusError(tenantID: string, notificationID: string, chargingStation: ChargingStation,
    sourceData: ChargingStationStatusErrorNotification): Promise<void> {
    // Enrich with admins
    const adminUsers = await NotificationHandler.getAdminUsers(tenantID, 'sendChargingStationStatusError');
    if (adminUsers && adminUsers.length > 0) {
      // For each Sources
      for (const notificationSource of NotificationHandler.notificationSources) {
        // Active?
        if (notificationSource.enabled) {
          try {
            // Save
            await NotificationHandler.saveNotification(tenantID, notificationSource.channel, notificationID,
              Constants.SOURCE_CHARGING_STATION_STATUS_ERROR, null, chargingStation, {
                'connectorId': sourceData.connectorId,
                'error': sourceData.error
              }
            );
            // Send
            for (const adminUser of adminUsers) {
              await notificationSource.notificationTask.sendChargingStationStatusError(sourceData, adminUser, tenantID, NotificationSeverity.ERROR);
            }
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
    const adminUsers = await NotificationHandler.getAdminUsers(tenantID, 'sendChargingStationRegistered');
    if (adminUsers && adminUsers.length > 0) {
      // For each Sources
      for (const notificationSource of NotificationHandler.notificationSources) {
        // Active?
        if (notificationSource.enabled) {
          try {
            // Save
            await NotificationHandler.saveNotification(tenantID, notificationSource.channel, notificationID,
              Constants.SOURCE_CHARGING_STATION_REGISTERED, null, chargingStation);
            // Send
            for (const adminUser of adminUsers) {
              await notificationSource.notificationTask.sendChargingStationRegistered(sourceData, adminUser, tenantID, NotificationSeverity.WARNING);
            }
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
    const adminUsers = await NotificationHandler.getAdminUsers(tenantID, 'sendUnknownUserBadged');
    if (adminUsers && adminUsers.length > 0) {
      // For each Sources
      for (const notificationSource of NotificationHandler.notificationSources) {
        // Active?
        if (notificationSource.enabled) {
          try {
            // Save
            await NotificationHandler.saveNotification(tenantID, notificationSource.channel, notificationID,
              Constants.SOURCE_UNKNOWN_USER_BADGED, null, chargingStation);
            // Send
            for (const adminUser of adminUsers) {
              await notificationSource.notificationTask.sendUnknownUserBadged(sourceData, adminUser, tenantID, NotificationSeverity.WARNING);
            }
          } catch (error) {
            // Log error
            Logging.logActionExceptionMessage(tenantID, Constants.SOURCE_UNKNOWN_USER_BADGED, error);
          }
        }
      }
    }
  }

  static async sendSessionStarted(tenantID: string, notificationID: string, user: User, chargingStation: ChargingStation,
    sourceData: TransactionStartedNotification): Promise<void> {
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
              await notificationSource.notificationTask.sendSessionStarted(sourceData, user, tenantID, NotificationSeverity.INFO);
            }
          }
        } catch (error) {
          Logging.logActionExceptionMessage(tenantID, Constants.SOURCE_TRANSACTION_STARTED, error);
        }
      }
    }
  }

  static async sendSmtpAuthError(tenantID: string, sourceData: SmtpAuthErrorNotification): Promise<void> {
    // Enrich with admins
    const adminUsers = await NotificationHandler.getAdminUsers(tenantID, 'sendSmtpAuthError');
    if (adminUsers && adminUsers.length > 0) {
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
                for (const adminUser of adminUsers) {
                  await notificationSource.notificationTask.sendSmtpAuthError(sourceData, adminUser, tenantID, NotificationSeverity.ERROR);
                }
              }
            }
          } catch (error) {
            Logging.logActionExceptionMessage(tenantID, Constants.SOURCE_AUTH_EMAIL_ERROR, error);
          }
        }
      }
    }
  }

  static async sendOCPIPatchChargingStationsStatusesError(tenantID: string, sourceData: OCPIPatchChargingStationsStatusesErrorNotification): Promise<void> {
    // Enrich with admins
    const adminUsers = await NotificationHandler.getAdminUsers(tenantID, 'sendOcpiPatchStatusError');
    if (adminUsers && adminUsers.length > 0) {
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
                for (const adminUser of adminUsers) {
                  await notificationSource.notificationTask.sendOCPIPatchChargingStationsStatusesError(sourceData, adminUser, tenantID, NotificationSeverity.ERROR);
                }
              }
            }
          } catch (error) {
            Logging.logActionExceptionMessage(tenantID, Constants.SOURCE_PATCH_EVSE_STATUS_ERROR, error);
          }
        }
      }
    }
  }

  static async sendUserAccountInactivity(tenantID: string, notificationID: string, user: User, data: UserAccountInactivityNotification): Promise<void> {
    // For each Sources
    for (const notificationSource of NotificationHandler.notificationSources) {
      // Active?
      if (notificationSource.enabled) {
        try {
          // Check notification
          const hasBeenNotified = await NotificationHandler.hasNotifiedSource(
            tenantID, notificationSource.channel, Constants.SOURCE_USER_ACCOUNT_INACTIVITY,
            notificationID, { intervalMins: 43200, intervalKey: null });
        if (!hasBeenNotified) {
            await NotificationHandler.saveNotification(tenantID, notificationSource.channel, notificationID, Constants.SOURCE_USER_ACCOUNT_INACTIVITY, user);
        // Send
            await notificationSource.notificationTask.sendUserAccountInactivity(data, user, tenantID, NotificationSeverity.INFO);
          }
        } catch (error) {
          Logging.logActionExceptionMessage(tenantID, Constants.SOURCE_USER_ACCOUNT_INACTIVITY, error);
        }
      }
    }
  }

  static async sendPreparingSessionsAreStartedNotification(tenantID: string, notificationID: string, user: User, data: PreparingSessionsAreStartedNotification): Promise<void> {
    // For each Sources
    for (const notificationSource of NotificationHandler.notificationSources) {
      // Active?
      if (notificationSource.enabled) {
        try {
          // Check notification
          const hasBeenNotified = await NotificationHandler.hasNotifiedSource(
            tenantID, notificationSource.channel, Constants.SOURCE_PREPARING_SESSION_STARTED,
            notificationID, { intervalMins: 15, intervalKey: null });
          if (!hasBeenNotified) {
            await NotificationHandler.saveNotification(tenantID, notificationSource.channel, notificationID, Constants.SOURCE_PREPARING_SESSION_STARTED, user);
            // Send
            await notificationSource.notificationTask.sendPreparingSessionsAreStarted(data, user, tenantID, NotificationSeverity.INFO);
          }
        } catch (error) {
          Logging.logActionExceptionMessage(tenantID, Constants.SOURCE_PREPARING_SESSION_STARTED, error);
        }
      }
    }
  }

  static async sendOfflineChargingStation(tenantID: string, chargingStation: ChargingStation, sourceData: OfflineChargingStationNotification): Promise<void> {
    // Enrich with admins
    const adminUsers = await NotificationHandler.getAdminUsers(tenantID);
    if (adminUsers && adminUsers.length > 0) {
      // For each Sources
      for (const notificationSource of NotificationHandler.notificationSources) {
        // Active?
        if (notificationSource.enabled) {
          try {
            // Compute the id as day and hour so that just one of this email is sent per hour
            const notificationID = chargingStation.id + new Date().toISOString();
            // Check notification
            const hasBeenNotified = await NotificationHandler.hasNotifiedSource(
              tenantID, notificationSource.channel, Constants.SOURCE_OFFLINE_CHARGING_STATION,
              notificationID, { intervalMins: 60, intervalKey: null });
            // Notified?
            if (!hasBeenNotified) {
              // Enabled?
              if (notificationSource.enabled) {
                // Save
                await NotificationHandler.saveNotification(tenantID, notificationSource.channel, notificationID, Constants.SOURCE_OFFLINE_CHARGING_STATION, null, chargingStation, null);
                // Send
                for (const adminUser of adminUsers) {
                  await notificationSource.notificationTask.sendOfflineChargingStation(sourceData, adminUser, tenantID, NotificationSeverity.INFO);
                }
              }
            }
          } catch (error) {
            Logging.logActionExceptionMessage(tenantID, Constants.SOURCE_OFFLINE_CHARGING_STATION, error);
          }
        }
      }
    }
  }
}
