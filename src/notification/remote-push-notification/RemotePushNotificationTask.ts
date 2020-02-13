import * as admin from 'firebase-admin';
import { BillingUserSynchronizationFailedNotification, ChargingStationRegisteredNotification, ChargingStationStatusErrorNotification, EndOfChargeNotification, EndOfSessionNotification, EndOfSignedSessionNotification, NewRegisteredUserNotification, NotificationSeverity, OCPIPatchChargingStationsStatusesErrorNotification, OfflineChargingStationNotification, OptimalChargeReachedNotification, PreparingSessionNotStartedNotification, RequestPasswordNotification, SmtpAuthErrorNotification, TransactionStartedNotification, UnknownUserBadgedNotification, UserAccountInactivityNotification, UserAccountStatusChangedNotification, UserNotificationType, VerificationEmailNotification, SessionNotStartedNotification } from '../../types/UserNotifications';
import User, { Status } from '../../types/User';
import Configuration from '../../utils/Configuration';
import Constants from '../../utils/Constants';
import I18nManager from '../../utils/I18nManager';
import Logging from '../../utils/Logging';
import NotificationTask from '../NotificationTask';
import Tenant from '../../types/Tenant';
import Utils from '../../utils/Utils';
import i18n from 'i18n-js';

export default class RemotePushNotificationTask implements NotificationTask {
  private firebaseConfig = Configuration.getFirebaseConfig();
  private initialized = false;

  constructor() {
    // Init
    if (this.firebaseConfig && this.firebaseConfig.type && this.firebaseConfig.type.length > 0) {
      try {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId: this.firebaseConfig.projectID,
            clientEmail: this.firebaseConfig.clientEmail,
            privateKey: this.firebaseConfig.privateKey
          }),
          databaseURL: this.firebaseConfig.databaseURL
        });
        // Ok
        this.initialized = true;
      } catch (error) {
        Logging.logError({
          tenantID: Constants.DEFAULT_TENANT,
          module: 'RemotePushNotificationTask', method: 'constructor',
          message: `Error initializing Firebase: '${error.message}'`,
          action: 'RemotePushNotification',
          detailedMessages: error
        });
      }
    }
  }

  public sendUserAccountInactivity(data: UserAccountInactivityNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void> {
    // Set the locale
    I18nManager.switchLocale(user.locale);
    // Get Message Text
    const title = i18n.t('notifications.userAccountInactivity.title');
    const body = i18n.t('notifications.userAccountInactivity.body',
      { lastLogin: data.lastLogin, tenantName: tenant.name });
    // Send Notification
    return this.sendRemotePushNotificationToUser(tenant, UserNotificationType.USER_ACCOUNT_INACTIVITY, title, body, user, {
      lastLogin: data.lastLogin
    },
    severity
    );
  }

  public sendPreparingSessionNotStarted(data: PreparingSessionNotStartedNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void> {
    // Set the locale
    I18nManager.switchLocale(user.locale);
    // Get Message Text
    const title = i18n.t('notifications.preparingSessionNotStarted.title');
    const body = i18n.t('notifications.preparingSessionNotStarted.body',
      { chargeBoxID: data.chargeBoxID, connectorId: data.connectorId, tenantName: tenant.name });
    // Send Notification
    return this.sendRemotePushNotificationToUser(tenant, UserNotificationType.PREPARING_SESSION_NOT_STARTED, title, body, user, {
      chargeBoxID: data.chargeBoxID,
      connectorId: data.connectorId
    },
    severity
    );
  }

  public sendSessionNotStarted(data: SessionNotStartedNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void> {
    // Set the locale
    I18nManager.switchLocale(user.locale);
    // Get Message Text
    const title = i18n.t('notifications.sessionNotStarted.title');
    const body = i18n.t('notifications.sessionNotStarted.body',
      { chargeBoxID: data.chargeBoxID });
    // Send Notification
    return this.sendRemotePushNotificationToUser(tenant, UserNotificationType.SESSION_NOT_STARTED_AFTER_AUTHORIZE, title, body, user, {
      chargeBoxID: data.chargeBoxID,
    },
    severity
    );
  }

  public sendOfflineChargingStations(data: OfflineChargingStationNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void> {
    // Set the locale
    I18nManager.switchLocale(user.locale);
    // Get Message Text
    const title = i18n.t('notifications.offlineChargingStation.title');
    const body = i18n.t('notifications.offlineChargingStation.body',
      { chargeBoxIDs: data.chargeBoxIDs, tenantName: tenant.name });
    // Send Notification
    return this.sendRemotePushNotificationToUser(tenant, UserNotificationType.OFFLINE_CHARGING_STATION, title, body, user, null,
      severity
    );
  }

  public sendNewRegisteredUser(data: NewRegisteredUserNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void> {
    // Nothing to send
    return Promise.resolve();
  }

  public sendRequestPassword(data: RequestPasswordNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void> {
    // Nothing to send
    return Promise.resolve();
  }

  public sendOptimalChargeReached(data: OptimalChargeReachedNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void> {
    // Set the locale
    I18nManager.switchLocale(user.locale);
    // Get Message Text
    const title = i18n.t('notifications.optimalChargeReached.title');
    const body = i18n.t('notifications.optimalChargeReached.body',
      { chargeBoxID: data.chargeBoxID, connectorId: data.connectorId, tenantName: tenant.name });
    // Send Notification
    return this.sendRemotePushNotificationToUser(tenant, UserNotificationType.OPTIMAL_CHARGE_REACHED, title, body, user, {
      transactionId: data.transactionId + '',
      chargeBoxID: data.chargeBoxID,
      connectorId: data.connectorId + ''
    },
    severity
    );
  }

  public sendEndOfCharge(data: EndOfChargeNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void> {
    // Set the locale
    I18nManager.switchLocale(user.locale);
    // Get Message Text
    const title = i18n.t('notifications.endOfCharge.title');
    const body = i18n.t('notifications.endOfCharge.body',
      { chargeBoxID: data.chargeBoxID, connectorId: data.connectorId, tenantName: tenant.name });
    // Send Notification
    return this.sendRemotePushNotificationToUser(tenant, UserNotificationType.END_OF_CHARGE, title, body, user, {
      transactionId: data.transactionId + '',
      chargeBoxID: data.chargeBoxID,
      connectorId: data.connectorId + ''
    },
    severity
    );
  }

  public sendEndOfSession(data: EndOfSessionNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void> {
    // Set the locale
    I18nManager.switchLocale(user.locale);
    // Get Message Text
    const title = i18n.t('notifications.endOfSession.title');
    const body = i18n.t('notifications.endOfSession.body',
      { chargeBoxID: data.chargeBoxID, connectorId: data.connectorId, tenantName: tenant.name });
    // Send Notification
    return this.sendRemotePushNotificationToUser(tenant, UserNotificationType.END_OF_SESSION, title, body, user, {
      transactionId: data.transactionId + '',
      chargeBoxID: data.chargeBoxID,
      connectorId: data.connectorId + ''
    },
    severity
    );
  }

  public sendEndOfSignedSession(data: EndOfSignedSessionNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void> {
    // Nothing to send
    return Promise.resolve();
  }

  public sendChargingStationStatusError(data: ChargingStationStatusErrorNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void> {
    // Set the locale
    I18nManager.switchLocale(user.locale);
    // Get Message Text
    const title = i18n.t('notifications.chargingStationStatusError.title');
    const body = i18n.t('notifications.chargingStationStatusError.body',
      { chargeBoxID: data.chargeBoxID, connectorId: data.connectorId, error: data.error, tenantName: tenant.name });
    // Send Notification
    return this.sendRemotePushNotificationToUser(tenant, UserNotificationType.CHARGING_STATION_STATUS_ERROR, title, body, user, {
      chargeBoxID: data.chargeBoxID,
      connectorId: data.connectorId + ''
    },
    severity
    );
  }

  public sendChargingStationRegistered(data: ChargingStationRegisteredNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void> {
    // Set the locale
    I18nManager.switchLocale(user.locale);
    // Get Message Text
    const title = i18n.t('notifications.chargingStationRegistered.title');
    const body = i18n.t('notifications.chargingStationRegistered.body',
      { chargeBoxID: data.chargeBoxID, tenantName: tenant.name });
    // Send Notification
    return this.sendRemotePushNotificationToUser(tenant, UserNotificationType.CHARGING_STATION_REGISTERED, title, body, user, {
      chargeBoxID: data.chargeBoxID
    },
    severity
    );
  }

  public sendUserAccountStatusChanged(data: UserAccountStatusChangedNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void> {
    // Set the locale
    I18nManager.switchLocale(user.locale);
    const status = user.status === Status.ACTIVE ?
      i18n.t('notifications.userAccountStatusChanged.activated') :
      i18n.t('notifications.userAccountStatusChanged.suspended');
    // Get Message Text
    const title = i18n.t('notifications.userAccountStatusChanged.title',
      { status: Utils.firstLetterInUpperCase(status) });
    const body = i18n.t('notifications.userAccountStatusChanged.body',
      { status, tenantName: tenant.name });
    // Send Notification
    return this.sendRemotePushNotificationToUser(tenant, UserNotificationType.USER_ACCOUNT_STATUS_CHANGED, title, body, user, {
      userID: user.id
    },
    severity
    );
  }

  public sendUnknownUserBadged(data: UnknownUserBadgedNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void> {
    // Set the locale
    I18nManager.switchLocale(user.locale);
    // Get Message Text
    const title = i18n.t('notifications.unknownUserBadged.title');
    const body = i18n.t('notifications.unknownUserBadged.body',
      { chargeBoxID: data.chargeBoxID, badgeID: data.badgeID, tenantName: tenant.name });
    // Send Notification
    return this.sendRemotePushNotificationToUser(tenant, UserNotificationType.UNKNOWN_USER_BADGED, title, body, user, {
      chargeBoxID: data.chargeBoxID,
      badgeID: data.badgeID
    },
    severity
    );
  }

  public sendSessionStarted(data: TransactionStartedNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void> {
    // Set the locale
    I18nManager.switchLocale(user.locale);
    // Get Message Text
    const title = i18n.t('notifications.sessionStarted.title');
    const body = i18n.t('notifications.sessionStarted.body',
      { chargeBoxID: data.chargeBoxID, connectorId: data.connectorId, tenantName: tenant.name });
    // Send Notification
    return this.sendRemotePushNotificationToUser(tenant, UserNotificationType.SESSION_STARTED, title, body, user, {
      'transactionId': data.transactionId + '',
      'chargeBoxID': data.chargeBoxID,
      'connectorId': data.connectorId + ''
    },
    severity
    );
  }

  public sendVerificationEmail(data: VerificationEmailNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void> {
    // Nothing to send
    return Promise.resolve();
  }

  public sendSmtpAuthError(data: SmtpAuthErrorNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void> {
    // Set the locale
    I18nManager.switchLocale(user.locale);
    // Get Message Text
    const title = i18n.t('notifications.smtpAuthError.title');
    const body = i18n.t('notifications.smtpAuthError.body', { tenantName: tenant.name });
    // Send Notification
    return this.sendRemotePushNotificationToUser(tenant, UserNotificationType.SMTP_AUTH_ERROR, title, body, user, null, severity);
  }

  public sendOCPIPatchChargingStationsStatusesError(data: OCPIPatchChargingStationsStatusesErrorNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void> {
    // Set the locale
    I18nManager.switchLocale(user.locale);
    // Get Message Text
    const title = i18n.t('notifications.ocpiPatchChargingStationsStatusesError.title');
    const body = i18n.t('notifications.ocpiPatchChargingStationsStatusesError.body',
      { location: data.location, tenantName: tenant.name });
    // Send Notification
    return this.sendRemotePushNotificationToUser(tenant, UserNotificationType.OCPI_PATCH_STATUS_ERROR, title, body, user, null, severity);
  }

  public sendBillingUserSynchronizationFailed(data: BillingUserSynchronizationFailedNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void> {
    // Set the locale
    I18nManager.switchLocale(user.locale);
    // Get Message Text
    const title = i18n.t('notifications.billingUserSynchronizationFailed.title');
    const body = i18n.t('notifications.billingUserSynchronizationFailed.body',
      { nbUsers: data.nbrUsersInError, tenantName: tenant.name });
    // Send Notification
    return this.sendRemotePushNotificationToUser(tenant, UserNotificationType.BILLING_USER_SYNCHRONIZATION_FAILED, title, body, user, {
      'error': data.nbrUsersInError + '',
    },
    severity
    );
  }

  private async sendRemotePushNotificationToUser(tenant: Tenant, notificationType: UserNotificationType, title: string, body: string, user: User, data?: object, severity?: NotificationSeverity) {
    // Checks
    if (!this.initialized) {
      return Promise.resolve();
    }
    if (!user || !user.mobileToken || user.mobileToken.length === 0) {
      Logging.logWarning({
        tenantID: tenant.id,
        source: (data && data.hasOwnProperty('chargeBoxID') ? data['chargeBoxID'] : null),
        module: 'RemotePushNotificationTask', method: 'sendRemotePushNotificationToUsers',
        message: `'${notificationType}': No mobile token found for this User`,
        actionOnUser: user.id,
        action: 'RemotePushNotification',
        detailedMessages: [title, body]
      });
      // Send nothing
      return Promise.resolve();
    }
    // Create message
    const message = this.createMessage(tenant, notificationType, title, body, data, severity);
    // Send message
    admin.messaging().sendToDevice(
      user.mobileToken,
      message,
      { priority: 'high', timeToLive: 60 * 60 * 24 }
    ).then((response) => {
      // Response is a message ID string.
      Logging.logInfo({
        tenantID: tenant.id,
        source: (data && data.hasOwnProperty('chargeBoxID') ? data['chargeBoxID'] : null),
        module: 'RemotePushNotificationTask', method: 'sendRemotePushNotificationToUsers',
        message: `Notification Sent: '${notificationType}' - '${title}'`,
        actionOnUser: user.id,
        action: 'RemotePushNotification',
        detailedMessages: [title, body, data, response]
      });
    }).catch((error) => {
      Logging.logError({
        tenantID: tenant.id,
        source: (data && data.hasOwnProperty('chargeBoxID') ? data['chargeBoxID'] : null),
        module: 'RemotePushNotificationTask', method: 'sendRemotePushNotificationToUsers',
        message: `Error when sending Notification: '${notificationType}' - '${error.message}'`,
        actionOnUser: user.id,
        action: 'RemotePushNotification',
        detailedMessages: error
      });
    });
  }

  private createMessage(tenant: Tenant, notificationType: UserNotificationType, title: string, body: string, data: object, severity: NotificationSeverity): admin.messaging.MessagingPayload {
    // Build message
    const message: admin.messaging.MessagingPayload = {
      notification: {
        title,
        body,
        icon: '@drawable/ic_stat_ic_notification',
        sound: 'default',
        badge: '0',
        color: severity ? severity : NotificationSeverity.INFO,
        channelId: 'e-Mobility'
      }
    };
    // Extra data
    message.data = { tenantID: tenant.id, notificationType, ...data };
    return message;
  }
}
