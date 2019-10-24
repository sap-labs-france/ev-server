import { ForgetChargeNotification, UserInactivityLimitReachedNotification, ChargingStationRegisteredNotification, ChargingStationStatusErrorNotification, EndOfChargeNotification, EndOfSessionNotification, EndOfSignedSessionNotification, NewRegisteredUserNotification, OCPIPatchChargingStationsStatusesErrorNotification, OptimalChargeReachedNotification, RequestPasswordNotification, SmtpAuthErrorNotification, TransactionStartedNotification, UnknownUserBadgedNotification, UserAccountStatusChangedNotification, VerificationEmailNotification, NoHeartbeatNotification } from '../../types/UserNotifications';
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

  sendNewRegisteredUser(data: NewRegisteredUserNotification, user: User, tenantID: string): Promise<void> {
    // Nothing to send
    return Promise.resolve();
  }

  sendUserInactivityLimitReached(data: UserInactivityLimitReachedNotification, user: User, tenantID: string): Promise<void> {
    return Promise.resolve();
  }

  sendForgetCharge(data: ForgetChargeNotification, user: User, tenantID: string): Promise<void> {
    // Nothing to send
    return Promise.resolve();
  }

  sendRequestPassword(data: RequestPasswordNotification, user: User, tenantID: string): Promise<void> {
    // Nothing to send
    return Promise.resolve();
  }

  sendNoHeartbeat(data: NoHeartbeatNotification, user: User, tenantID: string): Promise<void>  {
    return Promise.resolve();
  }

  sendOptimalChargeReached(data: OptimalChargeReachedNotification, user: User, tenantID: string): Promise<void> {
    // Set the locale
    i18n.setLocale(Utils.getLocaleWith2Digits(user.locale));
    // Get Message Text
    const title = i18n.__('notifications.optimalChargeReached.title',
      { chargeBoxID: data.chargeBoxID, connectorId: data.connectorId });
    const body = i18n.__('notifications.optimalChargeReached.body',
      { chargeBoxID: data.chargeBoxID, connectorId: data.connectorId });
    // Send Notification
    return this.sendRemotePushNotificationToUser(tenantID, title, body, user, {
      transactionId: data.transactionId + '',
      chargeBoxID: data.chargeBoxID,
      connectorId: data.connectorId + ''
    });
  }

  sendEndOfCharge(data: EndOfChargeNotification, user: User, tenantID: string): Promise<void> {
    // Set the locale
    i18n.setLocale(Utils.getLocaleWith2Digits(user.locale));
    // Get Message Text
    const title = i18n.__('notifications.endOfCharge.title',
      { chargeBoxID: data.chargeBoxID, connectorId: data.connectorId });
    const body = i18n.__('notifications.endOfCharge.body',
      { chargeBoxID: data.chargeBoxID, connectorId: data.connectorId });
    // Send Notification
    return this.sendRemotePushNotificationToUser(tenantID, title, body, user, {
      transactionId: data.transactionId + '',
      chargeBoxID: data.chargeBoxID,
      connectorId: data.connectorId + ''
    });
  }

  sendEndOfSession(data: EndOfSessionNotification, user: User, tenantID: string): Promise<void> {
    // Set the locale
    i18n.setLocale(Utils.getLocaleWith2Digits(user.locale));
    // Get Message Text
    const title = i18n.__('notifications.endOfSession.title',
      { chargeBoxID: data.chargeBoxID, connectorId: data.connectorId });
    const body = i18n.__('notifications.endOfSession.body',
      { chargeBoxID: data.chargeBoxID, connectorId: data.connectorId });
    // Send Notification
    return this.sendRemotePushNotificationToUser(tenantID, title, body, user, {
      transactionId: data.transactionId + '',
      chargeBoxID: data.chargeBoxID,
      connectorId: data.connectorId + ''
    });
  }

  sendEndOfSignedSession(data: EndOfSignedSessionNotification, user: User, tenantID: string): Promise<void> {
    // Nothing to send
    return Promise.resolve();
  }

  sendChargingStationStatusError(data: ChargingStationStatusErrorNotification, user: User, tenantID: string): Promise<void> {
    // Set the locale
    i18n.setLocale(Utils.getLocaleWith2Digits(user.locale));
    // Get Message Text
    const title = i18n.__('notifications.chargingStationStatusError.title',
      { chargeBoxID: data.chargeBoxID, connectorId: data.connectorId, error: data.error });
    const body = i18n.__('notifications.chargingStationStatusError.body',
      { chargeBoxID: data.chargeBoxID, connectorId: data.connectorId, error: data.error });
    // Send Notification
    return this.sendRemotePushNotificationToUser(tenantID, title, body, user, {
      chargeBoxID: data.chargeBoxID,
      connectorId: data.connectorId + ''
    });      
  }

  sendChargingStationRegistered(data: ChargingStationRegisteredNotification, user: User, tenantID: string): Promise<void> {
    // Set the locale
    i18n.setLocale(Utils.getLocaleWith2Digits(user.locale));
    // Get Message Text
    const title = i18n.__('notifications.chargingStationRegistered.title', { chargeBoxID: data.chargeBoxID });
    const body = i18n.__('notifications.chargingStationRegistered.body', { chargeBoxID: data.chargeBoxID });
    // Send Notification
    return this.sendRemotePushNotificationToUser(tenantID, title, body, user, {
      chargeBoxID: data.chargeBoxID
    });
  }

  sendUserAccountStatusChanged(data: UserAccountStatusChangedNotification, user: User, tenantID: string): Promise<void> {
    // Set the locale
    i18n.setLocale(Utils.getLocaleWith2Digits(user.locale));
    const status = user.status === Constants.USER_STATUS_ACTIVE ?
      i18n.__('notifications.userAccountStatusChanged.activated') :
      i18n.__('notifications.userAccountStatusChanged.suspended');
    // Get Message Text
    const title = i18n.__('notifications.userAccountStatusChanged.title', { status: Utils.firstLetterInUpperCase(status) });
    const body = i18n.__('notifications.userAccountStatusChanged.body', { status });
    // Send Notification
    return this.sendRemotePushNotificationToUser(tenantID, title, body, user, {
      userID: user.id
    });
  }

  sendUnknownUserBadged(data: UnknownUserBadgedNotification, user: User, tenantID: string): Promise<void> {
    // Set the locale
    i18n.setLocale(Utils.getLocaleWith2Digits(user.locale));
    // Get Message Text
    const title = i18n.__('notifications.unknownUserBadged.title');
    const body = i18n.__('notifications.unknownUserBadged.body', { chargeBoxID: data.chargeBoxID, badgeID: data.badgeID });
    // Send Notification
    return this.sendRemotePushNotificationToUser(tenantID, title, body, user, {
      chargeBoxID: data.chargeBoxID,
      badgeID: data.badgeID
    });
  }

  sendSessionStarted(data: TransactionStartedNotification, user: User, tenantID: string): Promise<void> {
    // Set the locale
    i18n.setLocale(Utils.getLocaleWith2Digits(user.locale));
    // Get Message Text
    const title = i18n.__('notifications.sessionStarted.title');
    const body = i18n.__('notifications.sessionStarted.body', { chargeBoxID: data.chargeBoxID, connectorId: data.connectorId });
    // Send Notification
    return this.sendRemotePushNotificationToUser(tenantID, title, body, user, {
      'transactionId': data.transactionId + '',
      'chargeBoxID': data.chargeBoxID,
      'connectorId': data.connectorId + ''
    }
    );
  }

  sendVerificationEmail(data: VerificationEmailNotification, user: User, tenantID: string): Promise<void> {
    // Nothing to send
    return Promise.resolve();
  }

  sendSmtpAuthError(data: SmtpAuthErrorNotification, user: User, tenantID: string): Promise<void> {
    // Set the locale
    i18n.setLocale(Utils.getLocaleWith2Digits(user.locale));
    // Get Message Text
    const title = i18n.__('notifications.smtpAuthError.title');
    const body = i18n.__('notifications.smtpAuthError.body');
    // Send Notification
    return this.sendRemotePushNotificationToUser(tenantID, title, body, user);
  }

  sendOCPIPatchChargingStationsStatusesError(data: OCPIPatchChargingStationsStatusesErrorNotification, user: User, tenantID: string): Promise<void> {
    // Set the locale
    i18n.setLocale(Utils.getLocaleWith2Digits(user.locale));
    // Get Message Text
    const title = i18n.__('notifications.ocpiPatchChargingStationsStatusesError.title');
    const body = i18n.__('notifications.ocpiPatchChargingStationsStatusesError.body', { location: data.location });
    // Send Notification
    return this.sendRemotePushNotificationToUser(tenantID, title, body, user);
  }

  private sendRemotePushNotificationToUser(tenantID: string, title: string, body: string, user: User, data?: object) {
    // Checks
    if (!this.initialized) {
      // Bypass
      return Promise.resolve();
    }
    if (!user || !user.mobileToken || user.mobileToken.length === 0) {
      Logging.logWarning({
        tenantID: tenantID,
        source: (data.hasOwnProperty('chargeBoxID') ? data['chargeBoxID'] : undefined),
        module: 'RemotePushNotificationTask', method: 'sendRemotePushNotificationToUsers',
        message: `No mobile token found for this User`,
        actionOnUser: user.id,
        action: 'RemotePushNotification',
        detailedMessages: [title, body]
      });
      // Send nothing
      return Promise.resolve();
    }
    // Create message
    const message = this.createMessage(title, body, user, data);
    // Send message
    admin.messaging().send(message).then((response) => {
      // Response is a message ID string.
      Logging.logInfo({
        tenantID: tenantID,
        source: (data.hasOwnProperty('chargeBoxID') ? data['chargeBoxID'] : undefined),
        module: 'RemotePushNotificationTask', method: 'sendRemotePushNotificationToUsers',
        message: `Notification Sent: '${title}'`,
        actionOnUser: user.id,
        action: 'RemotePushNotification',
        detailedMessages: [title, body, response]
      });
    }).catch((error) => {
      Logging.logError({
        tenantID: tenantID,
        source: (data.hasOwnProperty('chargeBoxID') ? data['chargeBoxID'] : undefined),
        module: 'RemotePushNotificationTask', method: 'sendRemotePushNotificationToUsers',
        message: `Error when sending Notification: '${error.message}'`,
        actionOnUser: user.id,
        action: 'RemotePushNotification',
        detailedMessages: error
      });
    });
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
