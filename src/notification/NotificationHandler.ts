import NotificationStorage from '../storage/mongodb/NotificationStorage';
import TenantStorage from '../storage/mongodb/TenantStorage';
import UserStorage from '../storage/mongodb/UserStorage';
import ChargingStation from '../types/ChargingStation';
import { Source } from '../types/Notification';
import User, { UserRole } from '../types/User';
import UserNotifications, { BillingUserSynchronizationFailedNotification, ChargingStationRegisteredNotification, ChargingStationStatusErrorNotification, EndOfChargeNotification, EndOfSessionNotification, EndOfSignedSessionNotification, NewRegisteredUserNotification, Notification, NotificationSeverity, NotificationSource, OCPIPatchChargingStationsStatusesErrorNotification, OfflineChargingStationNotification, OptimalChargeReachedNotification, PreparingSessionNotStartedNotification, RequestPasswordNotification, SessionNotStartedNotification, SmtpAuthErrorNotification, TransactionStartedNotification, UnknownUserBadgedNotification, UserAccountInactivityNotification, UserAccountStatusChangedNotification, UserNotificationKeys, VerificationEmailNotification } from '../types/UserNotifications';
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
      sourceId: notificationID ? notificationID : new Date().toISOString(),
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
        message: `User is being notified (${channel})`
      });
    } else {
      // Admin
      Logging.logInfo({
        tenantID: tenantID,
        source: (chargingStation ? chargingStation.id : null),
        module: 'NotificationHandler', method: 'saveNotification',
        action: sourceDescr,
        message: `Admin users are being notified (${channel})`
      });
    }
  }

  static async getAdminUsers(tenantID: string, notificationKey?: UserNotificationKeys): Promise<User[]> {
    // Get admin users
    const params = { roles: [UserRole.ADMIN], notificationsActive: true, notifications: {} as UserNotifications };
    if (notificationKey) {
      params.notifications[notificationKey] = true;
    }
    const adminUsers = await UserStorage.getUsers(tenantID, params, Constants.DB_PARAMS_MAX_LIMIT);
    // Found
    if (adminUsers.count > 0) {
      return adminUsers.result;
    }
  }

  static async hasNotifiedSource(tenantID: string, channel: string, sourceDescr: string, chargeBoxID: string, userID: string,
    interval?: { intervalMins?: number; intervalKey?: object }): Promise<boolean> {
    try {
      // Check
      if (interval && interval.intervalMins) {
        const params: any = {
          channel,
          sourceDescr
        };
        if (interval.intervalKey) {
          params.data = interval.intervalKey;
        }
        if (chargeBoxID) {
          params.chargeBoxID = chargeBoxID;
        }
        if (userID) {
          params.userID = userID;
        }
        // Save it
        const notifications = await NotificationStorage.getNotifications(
          tenantID,
          params,
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
      }
      // Default
      return false;
    } catch (error) {
      // Log error
      Logging.logActionExceptionMessage(tenantID, 'HasNotification', error);
    }
  }

  static async hasNotifiedSourceByID(tenantID: string, channel: string, notificationID: string): Promise<boolean> {
    try {
      // Get Notif
      const notifications = await NotificationStorage.getNotifications(
        tenantID,
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

  static async sendEndOfCharge(tenantID: string, user: User, chargingStation: ChargingStation,
    sourceData: EndOfChargeNotification): Promise<void> {
    if (tenantID !== Constants.DEFAULT_TENANT) {
      // Get the Tenant
      const tenant = await TenantStorage.getTenant(tenantID);
      // For each Sources
      for (const notificationSource of NotificationHandler.notificationSources) {
        // Active?
        if (notificationSource.enabled) {
          try {
            // Get interval
            const intervalMins = Utils.getEndOfChargeNotificationIntervalMins(
              chargingStation, Utils.getConnectorIDFromConnectorLetter(sourceData.connectorId));
            // Check notification
            const hasBeenNotified = await NotificationHandler.hasNotifiedSource(
              tenantID, notificationSource.channel, Source.END_OF_CHARGE,
              chargingStation.id, user.id, { intervalMins, intervalKey: { transactionId: sourceData.transactionId } });
            if (!hasBeenNotified) {
              // Enabled?
              if (user.notificationsActive && user.notifications.sendEndOfCharge) {
                // Save
                await NotificationHandler.saveNotification(
                  tenantID, notificationSource.channel, null,
                  Source.END_OF_CHARGE, user, chargingStation, {
                    'transactionId': sourceData.transactionId,
                    'connectorId': sourceData.connectorId
                  }
                );
                // Send
                await notificationSource.notificationTask.sendEndOfCharge(sourceData, user, tenant, NotificationSeverity.INFO);
              }
            }
          } catch (error) {
            Logging.logActionExceptionMessage(tenantID, Source.END_OF_CHARGE, error);
          }
        }
      }
    }
  }

  static async sendOptimalChargeReached(tenantID: string, notificationID: string, user: User, chargingStation: ChargingStation,
    sourceData: OptimalChargeReachedNotification): Promise<void> {
    if (tenantID !== Constants.DEFAULT_TENANT) {
      // Get the Tenant
      const tenant = await TenantStorage.getTenant(tenantID);
      // For each Sources
      for (const notificationSource of NotificationHandler.notificationSources) {
        // Active?
        if (notificationSource.enabled) {
          try {
            // Check notification
            const hasBeenNotified = await NotificationHandler.hasNotifiedSourceByID(
              tenantID, notificationSource.channel, notificationID);
            if (!hasBeenNotified) {
              // Enabled?
              if (user.notificationsActive && user.notifications.sendOptimalChargeReached) {
                // Save
                await NotificationHandler.saveNotification(
                  tenantID, notificationSource.channel, notificationID,
                  Source.OPTIMAL_CHARGE_REACHED, user, chargingStation, {
                    'transactionId': sourceData.transactionId,
                    'connectorId': sourceData.connectorId
                  });
                // Send
                await notificationSource.notificationTask.sendOptimalChargeReached(sourceData, user, tenant, NotificationSeverity.INFO);
              }
            }
          } catch (error) {
            Logging.logActionExceptionMessage(tenantID, Source.OPTIMAL_CHARGE_REACHED, error);
          }
        }
      }
    }
  }

  static async sendEndOfSession(tenantID: string, notificationID: string, user: User, chargingStation: ChargingStation,
    sourceData: EndOfSessionNotification): Promise<void> {
    if (tenantID !== Constants.DEFAULT_TENANT) {
      // Get the Tenant
      const tenant = await TenantStorage.getTenant(tenantID);
      // For each Sources
      for (const notificationSource of NotificationHandler.notificationSources) {
        // Active?
        if (notificationSource.enabled) {
          try {
            // Check notification
            const hasBeenNotified = await NotificationHandler.hasNotifiedSourceByID(
              tenantID, notificationSource.channel, notificationID);
            if (!hasBeenNotified) {
              // Enabled?
              if (user.notificationsActive && user.notifications.sendEndOfSession) {
                // Save
                await NotificationHandler.saveNotification(
                  tenantID, notificationSource.channel, notificationID,
                  Source.END_OF_SESSION, user, chargingStation, {
                    'transactionId': sourceData.transactionId,
                    'connectorId': sourceData.connectorId
                  });
                // Send
                await notificationSource.notificationTask.sendEndOfSession(sourceData, user, tenant, NotificationSeverity.INFO);
              }
            }
          } catch (error) {
            Logging.logActionExceptionMessage(tenantID, Source.END_OF_SESSION, error);
          }
        }
      }
    }
  }

  static async sendEndOfSignedSession(tenantID: string, notificationID: string, user: User, chargingStation: ChargingStation,
    sourceData: EndOfSignedSessionNotification): Promise<void> {
    if (tenantID !== Constants.DEFAULT_TENANT) {
      // Get the Tenant
      const tenant = await TenantStorage.getTenant(tenantID);
      // For each Sources
      for (const notificationSource of NotificationHandler.notificationSources) {
        // Active?
        if (notificationSource.enabled) {
          try {
            // Check notification
            const hasBeenNotified = await NotificationHandler.hasNotifiedSourceByID(
              tenantID, notificationSource.channel, notificationID);
            if (!hasBeenNotified) {
              // Enabled?
              if (user.notificationsActive && user.notifications.sendEndOfSession) {
                // Save notif
                await NotificationHandler.saveNotification(
                  tenantID, notificationSource.channel, notificationID,
                  Source.END_OF_SESSION, user, chargingStation, {
                    'transactionId': sourceData.transactionId,
                    'connectorId': sourceData.connectorId
                  });
                // Send
                await notificationSource.notificationTask.sendEndOfSignedSession(sourceData, user, tenant, NotificationSeverity.INFO);
              }
            }
          } catch (error) {
            Logging.logActionExceptionMessage(tenantID, Source.END_OF_SESSION, error);
          }
        }
      }
    }
  }

  static async sendRequestPassword(tenantID: string, notificationID: string, user: User,
    sourceData: RequestPasswordNotification): Promise<void> {
    if (tenantID !== Constants.DEFAULT_TENANT) {
      // Get the Tenant
      const tenant = await TenantStorage.getTenant(tenantID);
      // For each Sources
      for (const notificationSource of NotificationHandler.notificationSources) {
        // Active?
        if (notificationSource.enabled) {
          try {
            // Save notif
            await NotificationHandler.saveNotification(
              tenantID, notificationSource.channel, notificationID, Source.REQUEST_PASSWORD, user);
            // Send
            await notificationSource.notificationTask.sendRequestPassword(
              sourceData, user, tenant, NotificationSeverity.INFO);
          } catch (error) {
            Logging.logActionExceptionMessage(tenantID, Source.REQUEST_PASSWORD, error);
          }
        }
      }
    }
  }

  static async sendUserAccountStatusChanged(tenantID: string, notificationID: string, user: User,
    sourceData: UserAccountStatusChangedNotification): Promise<void> {
    if (tenantID !== Constants.DEFAULT_TENANT) {
      // Get the Tenant
      const tenant = await TenantStorage.getTenant(tenantID);
      // For each Sources
      for (const notificationSource of NotificationHandler.notificationSources) {
        // Active?
        if (notificationSource.enabled) {
          try {
            // Enabled?
            if (user.notificationsActive && user.notifications.sendUserAccountStatusChanged) {
              // Save
              await NotificationHandler.saveNotification(
                tenantID, notificationSource.channel, notificationID,
                Source.USER_ACCOUNT_STATUS_CHANGED, user);
              // Send
              await notificationSource.notificationTask.sendUserAccountStatusChanged(
                sourceData, user, tenant, NotificationSeverity.WARNING);
            }
          } catch (error) {
            // Log error
            Logging.logActionExceptionMessage(tenantID, Source.USER_ACCOUNT_STATUS_CHANGED, error);
          }
        }
      }
    }
  }

  static async sendNewRegisteredUser(tenantID: string, notificationID: string, user: User,
    sourceData: NewRegisteredUserNotification): Promise<void> {
    if (tenantID !== Constants.DEFAULT_TENANT) {
      // Get the Tenant
      const tenant = await TenantStorage.getTenant(tenantID);
      // For each Sources
      for (const notificationSource of NotificationHandler.notificationSources) {
        // Active?
        if (notificationSource.enabled) {
          try {
            // Save
            await NotificationHandler.saveNotification(
              tenantID, notificationSource.channel, notificationID,
              Source.NEW_REGISTERED_USER, user);
            // Send
            await notificationSource.notificationTask.sendNewRegisteredUser(
              sourceData, user, tenant, NotificationSeverity.INFO);
          } catch (error) {
            Logging.logActionExceptionMessage(tenantID, Source.NEW_REGISTERED_USER, error);
          }
        }
      }
    }
  }

  static async sendVerificationEmail(tenantID: string, notificationID: string, user: User,
    sourceData: VerificationEmailNotification): Promise<void> {
    if (tenantID !== Constants.DEFAULT_TENANT) {
      // Get the Tenant
      const tenant = await TenantStorage.getTenant(tenantID);
      // For each Sources
      for (const notificationSource of NotificationHandler.notificationSources) {
        // Active?
        if (notificationSource.enabled) {
          try {
            // Save
            await NotificationHandler.saveNotification(
              tenantID, notificationSource.channel, notificationID,
              Source.VERIFICATION_EMAIL, user);
            // Send
            await notificationSource.notificationTask.sendVerificationEmail(
              sourceData, user, tenant, NotificationSeverity.INFO);
          } catch (error) {
            Logging.logActionExceptionMessage(tenantID, Source.VERIFICATION_EMAIL, error);
          }
        }
      }
    }
  }

  static async sendChargingStationStatusError(tenantID: string, notificationID: string, chargingStation: ChargingStation,
    sourceData: ChargingStationStatusErrorNotification): Promise<void> {
    if (tenantID !== Constants.DEFAULT_TENANT) {
      // Get the Tenant
      const tenant = await TenantStorage.getTenant(tenantID);
      // Enrich with admins
      const adminUsers = await NotificationHandler.getAdminUsers(tenantID, 'sendChargingStationStatusError');
      if (adminUsers && adminUsers.length > 0) {
        // For each Sources
        for (const notificationSource of NotificationHandler.notificationSources) {
          // Active?
          if (notificationSource.enabled) {
            try {
              // Save
              await NotificationHandler.saveNotification(
                tenantID, notificationSource.channel, notificationID,
                Source.CHARGING_STATION_STATUS_ERROR, null, chargingStation, {
                  'connectorId': sourceData.connectorId,
                  'error': sourceData.error
                }
              );
              // Send
              for (const adminUser of adminUsers) {
                await notificationSource.notificationTask.sendChargingStationStatusError(
                  sourceData, adminUser, tenant, NotificationSeverity.ERROR);
              }
            } catch (error) {
              Logging.logActionExceptionMessage(tenantID, Source.CHARGING_STATION_STATUS_ERROR, error);
            }
          }
        }
      }
    }
  }

  static async sendChargingStationRegistered(tenantID: string, notificationID: string, chargingStation: ChargingStation,
    sourceData: ChargingStationRegisteredNotification): Promise<void> {
    if (tenantID !== Constants.DEFAULT_TENANT) {
      // Get the Tenant
      const tenant = await TenantStorage.getTenant(tenantID);
      // Enrich with admins
      const adminUsers = await NotificationHandler.getAdminUsers(tenantID, 'sendChargingStationRegistered');
      if (adminUsers && adminUsers.length > 0) {
        // For each Sources
        for (const notificationSource of NotificationHandler.notificationSources) {
          // Active?
          if (notificationSource.enabled) {
            try {
              // Save
              await NotificationHandler.saveNotification(
                tenantID, notificationSource.channel, notificationID,
                Source.CHARGING_STATION_REGISTERED, null, chargingStation);
              // Send
              for (const adminUser of adminUsers) {
                await notificationSource.notificationTask.sendChargingStationRegistered(
                  sourceData, adminUser, tenant, NotificationSeverity.WARNING);
              }
            } catch (error) {
              Logging.logActionExceptionMessage(tenantID, Source.CHARGING_STATION_REGISTERED, error);
            }
          }
        }
      }
    }
  }

  static async sendUnknownUserBadged(tenantID: string, notificationID: string, chargingStation: ChargingStation,
    sourceData: UnknownUserBadgedNotification): Promise<void> {
    if (tenantID !== Constants.DEFAULT_TENANT) {
      // Get the Tenant
      const tenant = await TenantStorage.getTenant(tenantID);
      // Enrich with admins
      const adminUsers = await NotificationHandler.getAdminUsers(tenantID, 'sendUnknownUserBadged');
      if (adminUsers && adminUsers.length > 0) {
        // For each Sources
        for (const notificationSource of NotificationHandler.notificationSources) {
          // Active?
          if (notificationSource.enabled) {
            try {
              // Save
              await NotificationHandler.saveNotification(
                tenantID, notificationSource.channel, notificationID,
                Source.UNKNOWN_USER_BADGED, null, chargingStation);
              // Send
              for (const adminUser of adminUsers) {
                await notificationSource.notificationTask.sendUnknownUserBadged(
                  sourceData, adminUser, tenant, NotificationSeverity.WARNING);
              }
            } catch (error) {
              // Log error
              Logging.logActionExceptionMessage(tenantID, Source.UNKNOWN_USER_BADGED, error);
            }
          }
        }
      }
    }
  }

  static async sendSessionStarted(tenantID: string, notificationID: string, user: User, chargingStation: ChargingStation,
    sourceData: TransactionStartedNotification): Promise<void> {
    if (tenantID !== Constants.DEFAULT_TENANT) {
      // Get the Tenant
      const tenant = await TenantStorage.getTenant(tenantID);
      // For each Sources
      for (const notificationSource of NotificationHandler.notificationSources) {
        // Active?
        if (notificationSource.enabled) {
          try {
            // Check notification
            const hasBeenNotified = await NotificationHandler.hasNotifiedSourceByID(
              tenantID, notificationSource.channel, notificationID);
            if (!hasBeenNotified) {
              // Enabled?
              if (user.notificationsActive && user.notifications.sendSessionStarted) {
                // Save
                await NotificationHandler.saveNotification(
                  tenantID, notificationSource.channel, notificationID, Source.TRANSACTION_STARTED,
                  user, chargingStation, {
                    'transactionId': sourceData.transactionId,
                    'connectorId': sourceData.connectorId
                  }
                );
                // Send
                await notificationSource.notificationTask.sendSessionStarted(
                  sourceData, user, tenant, NotificationSeverity.INFO);
              }
            }
          } catch (error) {
            Logging.logActionExceptionMessage(tenantID, Source.TRANSACTION_STARTED, error);
          }
        }
      }
    }
  }

  static async sendSmtpAuthError(tenantID: string, sourceData: SmtpAuthErrorNotification): Promise<void> {
    if (tenantID !== Constants.DEFAULT_TENANT) {
      // Get the Tenant
      const tenant = await TenantStorage.getTenant(tenantID);
      // Enrich with admins
      const adminUsers = await NotificationHandler.getAdminUsers(tenantID, 'sendSmtpAuthError');
      if (adminUsers && adminUsers.length > 0) {
        // For each Sources
        for (const notificationSource of NotificationHandler.notificationSources) {
          // Active?
          if (notificationSource.enabled) {
            try {
              // Check notification
              const hasBeenNotified = await NotificationHandler.hasNotifiedSource(
                tenantID, notificationSource.channel, Source.AUTH_EMAIL_ERROR,
                null, null, { intervalMins: 60 });
              if (!hasBeenNotified) {
                // Email enabled?
                if (NotificationHandler.notificationConfig.Email.enabled) {
                  // Save
                  await NotificationHandler.saveNotification(
                    tenantID, notificationSource.channel, null, Source.AUTH_EMAIL_ERROR);
                  // Send
                  for (const adminUser of adminUsers) {
                    await notificationSource.notificationTask.sendSmtpAuthError(
                      sourceData, adminUser, tenant, NotificationSeverity.ERROR);
                  }
                }
              }
            } catch (error) {
              Logging.logActionExceptionMessage(tenantID, Source.AUTH_EMAIL_ERROR, error);
            }
          }
        }
      }
    }
  }

  static async sendOCPIPatchChargingStationsStatusesError(tenantID: string, sourceData: OCPIPatchChargingStationsStatusesErrorNotification): Promise<void> {
    if (tenantID !== Constants.DEFAULT_TENANT) {
      // Get the Tenant
      const tenant = await TenantStorage.getTenant(tenantID);
      // Enrich with admins
      const adminUsers = await NotificationHandler.getAdminUsers(tenantID, 'sendOcpiPatchStatusError');
      if (adminUsers && adminUsers.length > 0) {
        // For each Sources
        for (const notificationSource of NotificationHandler.notificationSources) {
          // Active?
          if (notificationSource.enabled) {
            try {
              // Check notification
              const hasBeenNotified = await NotificationHandler.hasNotifiedSource(
                tenantID, notificationSource.channel, Source.PATCH_EVSE_STATUS_ERROR,
                null, null, { intervalMins: 60 });
              // Notified?
              if (!hasBeenNotified) {
                // Enabled?
                if (notificationSource.enabled) {
                  // Save
                  await NotificationHandler.saveNotification(
                    tenantID, notificationSource.channel,
                    null, Source.PATCH_EVSE_STATUS_ERROR, null, null, {
                      location: sourceData.location
                    }
                  );
                  // Send
                  for (const adminUser of adminUsers) {
                    await notificationSource.notificationTask.sendOCPIPatchChargingStationsStatusesError(
                      sourceData, adminUser, tenant, NotificationSeverity.ERROR);
                  }
                }
              }
            } catch (error) {
              Logging.logActionExceptionMessage(tenantID, Source.PATCH_EVSE_STATUS_ERROR, error);
            }
          }
        }
      }
    }
  }

  static async sendUserAccountInactivity(tenantID: string, user: User, sourceData: UserAccountInactivityNotification): Promise<void> {
    if (tenantID !== Constants.DEFAULT_TENANT) {
      // Get the Tenant
      const tenant = await TenantStorage.getTenant(tenantID);
      // For each Sources
      for (const notificationSource of NotificationHandler.notificationSources) {
        // Active?
        if (notificationSource.enabled) {
          try {
            // Check notification
            const hasBeenNotified = await NotificationHandler.hasNotifiedSource(
              tenantID, notificationSource.channel, Source.USER_ACCOUNT_INACTIVITY,
              null, user.id, { intervalMins: 60 * 24 * 30 });
            if (!hasBeenNotified) {
              await NotificationHandler.saveNotification(
                tenantID, notificationSource.channel, null, Source.USER_ACCOUNT_INACTIVITY, user);
              // Send
              await notificationSource.notificationTask.sendUserAccountInactivity(
                sourceData, user, tenant, NotificationSeverity.INFO);
            }
          } catch (error) {
            Logging.logActionExceptionMessage(tenantID, Source.USER_ACCOUNT_INACTIVITY, error);
          }
        }
      }
    }
  }

  static async sendPreparingSessionNotStarted(tenantID: string, chargingStation: ChargingStation, user: User, sourceData: PreparingSessionNotStartedNotification): Promise<void> {
    if (tenantID !== Constants.DEFAULT_TENANT) {
      // Get the Tenant
      const tenant = await TenantStorage.getTenant(tenantID);
      // For each Sources
      for (const notificationSource of NotificationHandler.notificationSources) {
        // Active?
        if (notificationSource.enabled) {
          try {
            // Check notification
            const hasBeenNotified = await NotificationHandler.hasNotifiedSource(
              tenantID, notificationSource.channel, Source.PREPARING_SESSION_NOT_STARTED,
              chargingStation.id, user.id, { intervalMins: 15 });
            if (!hasBeenNotified) {
              // Enabled?
              if (user.notificationsActive && user.notifications.sendPreparingSessionNotStarted) {
                // Save
                await NotificationHandler.saveNotification(
                  tenantID, notificationSource.channel, null,
                  Source.PREPARING_SESSION_NOT_STARTED, user, chargingStation, {
                    'connectorId': sourceData.connectorId
                  }
                );
                // Send
                await notificationSource.notificationTask.sendPreparingSessionNotStarted(sourceData, user, tenant, NotificationSeverity.INFO);
              }
            }
          } catch (error) {
            Logging.logActionExceptionMessage(tenantID, Source.PREPARING_SESSION_NOT_STARTED, error);
          }
        }
      }
    }
  }

  static async sendOfflineChargingStations(tenantID: string, sourceData: OfflineChargingStationNotification): Promise<void> {
    if (tenantID !== Constants.DEFAULT_TENANT) {
      // Get the Tenant
      const tenant = await TenantStorage.getTenant(tenantID);
      // Enrich with admins
      const adminUsers = await NotificationHandler.getAdminUsers(tenantID);
      if (adminUsers && adminUsers.length > 0) {
        // For each Sources
        for (const notificationSource of NotificationHandler.notificationSources) {
          // Active?
          if (notificationSource.enabled) {
            try {
              // Check notification
              const hasBeenNotified = await NotificationHandler.hasNotifiedSource(
                tenantID, notificationSource.channel, Source.OFFLINE_CHARGING_STATIONS,
                null, null, { intervalMins: 60 * 24 });
              // Notified?
              if (!hasBeenNotified) {
                // Save
                await NotificationHandler.saveNotification(
                  tenantID, notificationSource.channel, null, Source.OFFLINE_CHARGING_STATIONS);
                // Send
                for (const adminUser of adminUsers) {
                  // Enabled?
                  if (adminUser.notificationsActive && adminUser.notifications.sendOfflineChargingStations) {
                    await notificationSource.notificationTask.sendOfflineChargingStations(
                      sourceData, adminUser, tenant, NotificationSeverity.INFO);
                  }
                }
              }
            } catch (error) {
              Logging.logActionExceptionMessage(tenantID, Source.OFFLINE_CHARGING_STATIONS, error);
            }
          }
        }
      }
    }
  }

  static async sendBillingUserSynchronizationFailed(tenantID: string, sourceData: BillingUserSynchronizationFailedNotification): Promise<void> {
    if (tenantID !== Constants.DEFAULT_TENANT) {
      // Get the Tenant
      const tenant = await TenantStorage.getTenant(tenantID);
      // Enrich with admins
      const adminUsers = await NotificationHandler.getAdminUsers(tenantID);
      if (adminUsers && adminUsers.length > 0) {
        // For each Sources
        for (const notificationSource of NotificationHandler.notificationSources) {
          // Active?
          if (notificationSource.enabled) {
            try {
              // Check notification
              const hasBeenNotified = await NotificationHandler.hasNotifiedSourceByID(
                tenantID, notificationSource.channel, Source.BILLING_USER_SYNCHRONIZATION_FAILED);
              // Notified?
              if (!hasBeenNotified) {
                // Save
                await NotificationHandler.saveNotification(
                  tenantID, notificationSource.channel, null, Source.BILLING_USER_SYNCHRONIZATION_FAILED);
                // Send
                for (const adminUser of adminUsers) {
                  // Enabled?
                  if (adminUser.notificationsActive && adminUser.notifications.sendBillingUserSynchronizationFailed) {
                    await notificationSource.notificationTask.sendBillingUserSynchronizationFailed(
                      sourceData, adminUser, tenant, NotificationSeverity.ERROR);
                  }
                }
              }
            } catch (error) {
              Logging.logActionExceptionMessage(tenantID, Source.BILLING_USER_SYNCHRONIZATION_FAILED, error);
            }
          }
        }
      }
    }
  }

  static async sendSessionNotStarted(tenantID: string, notificationID: string, chargingStation: ChargingStation,
    sourceData: SessionNotStartedNotification): Promise<void> {
    if (tenantID !== Constants.DEFAULT_TENANT) {
      // Get the Tenant
      const tenant = await TenantStorage.getTenant(tenantID);
      // For each Sources
      for (const notificationSource of NotificationHandler.notificationSources) {
        // Active?
        if (notificationSource.enabled) {
          try {
            // Check notification
            const hasBeenNotified = await NotificationHandler.hasNotifiedSourceByID(
              tenantID, notificationSource.channel, notificationID);
            if (!hasBeenNotified) {
              // Enabled?
              if (sourceData.user.notificationsActive && sourceData.user.notifications.sendSessionNotStarted) {
                // Save
                await NotificationHandler.saveNotification(
                  tenantID, notificationSource.channel, notificationID,
                  Source.SESSION_NOT_STARTED_AFTER_AUTHORIZE, sourceData.user, chargingStation);
                // Send
                await notificationSource.notificationTask.sendSessionNotStarted(sourceData, sourceData.user, tenant, NotificationSeverity.INFO);
              }
            }
          } catch (error) {
            Logging.logActionExceptionMessage(tenantID, Source.OPTIMAL_CHARGE_REACHED, error);
          }
        }
      }
    }
  }
}
