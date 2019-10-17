import { ChargingStationRegisteredNotification, ChargingStationStatusErrorNotification, EndOfChargeNotification, EndOfSessionNotification, EndOfSignedSessionNotification, NewRegisteredUserNotification, OCPIPatchChargingStationsStatusesErrorNotification, OptimalChargeReachedNotification, RequestPasswordNotification, SmtpAuthErrorNotification, TransactionStartedNotification, UnknownUserBadgedNotification, UserAccountStatusChangedNotification, VerificationEmailNotification } from '../../types/UserNotifications';
import Configuration from '../../utils/Configuration';
import NotificationTask from '../NotificationTask';
import * as admin from 'firebase-admin';
import User from '../../types/User';
import Logging from '../../utils/Logging';
import Constants from '../../utils/Constants';
import i18n from 'i18n';
import Utils from '../../utils/Utils';

export default class RemotePushNotificationTask implements NotificationTask {
  private firebaseConfig = Configuration.getFirebaseConfig();
  private initialized = false;

  constructor() {
    if (this.firebaseConfig) {
      // Init
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

  sendNewRegisteredUser(data: NewRegisteredUserNotification, locale: string, tenantID: string): Promise<void> {
    // Nothing to send
    return Promise.resolve();
  }

  sendRequestPassword(data: RequestPasswordNotification, locale: string, tenantID: string): Promise<void> {
    // Nothing to send
    return Promise.resolve();
  }

  sendOptimalChargeReached(data: OptimalChargeReachedNotification, locale: string, tenantID: string): Promise<void> {
    // Set the locale
    i18n.setLocale(Utils.getLocaleWith2Digits(locale));
    // Get Message Text
    const title = i18n.__('notifications.optimalChargeReached.title',
      { chargeBoxID: data.chargeBoxID, connectorId: data.connectorId });
    const body = i18n.__('notifications.optimalChargeReached.body',
      { chargeBoxID: data.chargeBoxID, connectorId: data.connectorId });
    // Send Notification
    return this.sendRemotePushNotificationToUsers(tenantID, title, body, [data.user]);
  }

  sendEndOfCharge(data: EndOfChargeNotification, locale: string, tenantID: string): Promise<void> {
    // Set the locale
    i18n.setLocale(Utils.getLocaleWith2Digits(locale));
    // Get Message Text
    const title = i18n.__('notifications.endOfCharge.title',
      { chargeBoxID: data.chargeBoxID, connectorId: data.connectorId });
    const body = i18n.__('notifications.endOfCharge.body',
      { chargeBoxID: data.chargeBoxID, connectorId: data.connectorId });
    // Send Notification
    return this.sendRemotePushNotificationToUsers(tenantID, title, body, [data.user]);
  }

  sendEndOfSession(data: EndOfSessionNotification, locale: string, tenantID: string): Promise<void> {
    // Set the locale
    i18n.setLocale(Utils.getLocaleWith2Digits(locale));
    // Get Message Text
    const title = i18n.__('notifications.endOfSession.title',
      { chargeBoxID: data.chargeBoxID, connectorId: data.connectorId });
    const body = i18n.__('notifications.endOfSession.body',
      { chargeBoxID: data.chargeBoxID, connectorId: data.connectorId });
    // Send Notification
    return this.sendRemotePushNotificationToUsers(tenantID, title, body, [data.user]);
  }

  sendEndOfSignedSession(data: EndOfSignedSessionNotification, locale: string, tenantID: string): Promise<void> {
    // Nothing to send
    return Promise.resolve();
  }

  sendChargingStationStatusError(data: ChargingStationStatusErrorNotification, locale: string, tenantID: string): Promise<void> {
    // Set the locale
    i18n.setLocale(Utils.getLocaleWith2Digits(locale));
    // Get Message Text
    const title = i18n.__('notifications.chargingStationStatusError.title',
      { chargeBoxID: data.chargeBoxID, connectorId: data.connectorId, error: data.error });
    const body = i18n.__('notifications.chargingStationStatusError.body',
      { chargeBoxID: data.chargeBoxID, connectorId: data.connectorId, error: data.error });
    // Send Notification
    return this.sendRemotePushNotificationToUsers(tenantID, title, body, data.adminUsers);
  }

  sendChargingStationRegistered(data: ChargingStationRegisteredNotification, locale: string, tenantID: string): Promise<void> {
    // Set the locale
    i18n.setLocale(Utils.getLocaleWith2Digits(locale));
    // Get Message Text
    const title = i18n.__('notifications.chargingStationRegistered.title', { chargeBoxID: data.chargeBoxID });
    const body = i18n.__('notifications.chargingStationRegistered.body', { chargeBoxID: data.chargeBoxID });
    // Send Notification
    return this.sendRemotePushNotificationToUsers(tenantID, title, body, data.adminUsers);
  }

  sendUserAccountStatusChanged(data: UserAccountStatusChangedNotification, locale: string, tenantID: string): Promise<void> {
    // Set the locale
    i18n.setLocale(Utils.getLocaleWith2Digits(locale));
    // Get Message Text
    const title = i18n.__('notifications.userAccountStatusChanged.title');
    const body = i18n.__('notifications.userAccountStatusChanged.body',
      { status: (data.user.status === Constants.USER_STATUS_ACTIVE ?
        i18n.__('notifications.userAccountStatusChanged.activated') :
        i18n.__('notifications.userAccountStatusChanged.suspended')) });
    // Send Notification
    return this.sendRemotePushNotificationToUsers(tenantID, title, body, [data.user]);
  }

  sendUnknownUserBadged(data: UnknownUserBadgedNotification, locale: string, tenantID: string): Promise<void> {
    // Set the locale
    i18n.setLocale(Utils.getLocaleWith2Digits(locale));
    // Get Message Text
    const title = i18n.__('notifications.unknownUserBadged.title');
    const body = i18n.__('notifications.unknownUserBadged.body', { chargeBoxID: data.chargeBoxID, connectorId: data.badgeId });
    // Send Notification
    return this.sendRemotePushNotificationToUsers(tenantID, title, body, data.adminUsers);
  }

  sendSessionStarted(data: TransactionStartedNotification, locale: string, tenantID: string): Promise<void> {
    // Set the locale
    i18n.setLocale(Utils.getLocaleWith2Digits(locale));
    // Get Message Text
    const title = i18n.__('notifications.sessionStarted.title');
    const body = i18n.__('notifications.sessionStarted.body', { chargeBoxID: data.chargeBoxID, connectorId: data.connectorId });
    // Send Notification
    return this.sendRemotePushNotificationToUsers(tenantID, title, body, [data.user]);
  }

  sendVerificationEmail(data: VerificationEmailNotification, locale: string, tenantID: string): Promise<void> {
    // Nothing to send
    return Promise.resolve();
  }

  sendSmtpAuthError(data: SmtpAuthErrorNotification, locale: string, tenantID: string): Promise<void> {
    // Set the locale
    i18n.setLocale(Utils.getLocaleWith2Digits(locale));
    // Get Message Text
    const title = i18n.__('notifications.smtpAuthError.title');
    const body = i18n.__('notifications.smtpAuthError.body');
    // Send Notification
    return this.sendRemotePushNotificationToUsers(tenantID, title, body, data.adminUsers);
  }

  sendOCPIPatchChargingStationsStatusesError(data: OCPIPatchChargingStationsStatusesErrorNotification, locale: string, tenantID: string): Promise<void> {
    // Set the locale
    i18n.setLocale(Utils.getLocaleWith2Digits(locale));
    // Get Message Text
    const title = i18n.__('notifications.ocpiPatchChargingStationsStatusesError.title');
    const body = i18n.__('notifications.ocpiPatchChargingStationsStatusesError.body', { locationID: data.locationID });
    // Send Notification
    return this.sendRemotePushNotificationToUsers(tenantID, title, body, data.adminUsers);
  }

  private sendRemotePushNotificationToUsers(tenantID: string, title: string, body: string, users: User[], data?: object) {
    // Checks
    if (!this.initialized) {
      return Promise.resolve();
    }
    if (!users || users.length <= 0) {
      return Promise.resolve();
    }
    // Get users with mobile
    const usersWithMobile = this.filterUsersWithMobileToken(users);
    for (const userWithMobile of usersWithMobile) {
      // Create message
      const message = this.createMessage(title, body, userWithMobile, data);
      // Send message
      admin.messaging().send(message).then((response) => {
        // Response is a message ID string.
        Logging.logInfo({
          tenantID: tenantID,
          module: 'RemotePushNotificationTask', method: 'sendRemotePushNotificationToUsers',
          message: `Notification Sent: '${title}'`,
          user: userWithMobile.id,
          action: 'RemotePushNotification',
          detailedMessages: [title, body, response]
        });
      }).catch((error) => {
        Logging.logError({
          tenantID: tenantID,
          module: 'RemotePushNotificationTask', method: 'sendRemotePushNotificationToUsers',
          message: `Error when sending Notification: '${error.message}'`,
          user: userWithMobile.id,
          action: 'RemotePushNotification',
          detailedMessages: error
        });
      });
    }
  }

  private filterUsersWithMobileToken(users: User[]): User[] {
    return users.filter((user) => !!user.mobileToken && (user.mobileToken.length > 0));
  }

  private createMessage(title: string, body: string, user: User, data?: object): admin.messaging.Message {
    const message: admin.messaging.Message = {
      notification: {
        title,
        body
      },
      token: user.mobileToken
    };
    // Android?
    if (user.mobileOs === Constants.MOBILE_OS_ANDROID) {
      message.android = {
        ttl: 3600 * 1000,
        notification: {
          icon: '@drawable/ic_stat_ic_notification',
          color: '#00376C',
          sound: 'default',
          channelId: 'e-Mobility'
        },
        priority: 'high'
      };
    }
    // Extra data
    if (data) {
      message.data = { ...data };
    }
    return message;
  }
}
