/* eslint-disable max-len */
import { AccountVerificationNotification, BillingAccountActivationNotification, BillingAccountCreationLinkNotification, BillingInvoiceSynchronizationFailedNotification, BillingNewInvoiceNotification, BillingPeriodicOperationFailedNotification, BillingUserSynchronizationFailedNotification, CarCatalogSynchronizationFailedNotification, ChargingStationRegisteredNotification, ChargingStationStatusErrorNotification, ComputeAndApplyChargingProfilesFailedNotification, EndOfChargeNotification, EndOfSessionNotification, EndOfSignedSessionNotification, EndUserErrorNotification, NewRegisteredUserNotification, NotificationResult, NotificationSeverity, OCPIPatchChargingStationsStatusesErrorNotification, OICPPatchChargingStationsErrorNotification, OICPPatchChargingStationsStatusesErrorNotification, OfflineChargingStationNotification, OptimalChargeReachedNotification, PreparingSessionNotStartedNotification, RequestPasswordNotification, SessionNotStartedNotification, TransactionStartedNotification, UnknownUserBadgedNotification, UserAccountInactivityNotification, UserAccountStatusChangedNotification, UserNotificationType, VerificationEmailNotification } from '../../types/UserNotifications';
import User, { UserStatus } from '../../types/User';

import Configuration from '../../utils/Configuration';
import Constants from '../../utils/Constants';
import I18nManager from '../../utils/I18nManager';
import Logging from '../../utils/Logging';
import NotificationTask from '../NotificationTask';
import { Promise } from 'bluebird';
import { ServerAction } from '../../types/Server';
import Tenant from '../../types/Tenant';
import Utils from '../../utils/Utils';
import admin from 'firebase-admin';

const MODULE_NAME = 'RemotePushNotificationTask';

export default class RemotePushNotificationTask implements NotificationTask {
  private static firebaseConfig = Configuration.getFirebaseConfig();
  private static defaultApp: admin.app.App;
  private static alternativeApp: admin.app.App;
  private static tenantFirebaseApps: Map<string, admin.app.App> = new Map();
  private static initialized = false;

  public constructor() {
    if (!RemotePushNotificationTask.initialized) {
      RemotePushNotificationTask.initialize();
    }
  }

  private static initialize() {
    if (RemotePushNotificationTask.firebaseConfig?.type?.length > 0) {
      try {
        // Init default conf
        RemotePushNotificationTask.defaultApp = admin.initializeApp({
          credential: admin.credential.cert({
            projectId: RemotePushNotificationTask.firebaseConfig.projectID,
            clientEmail: RemotePushNotificationTask.firebaseConfig.clientEmail,
            privateKey: RemotePushNotificationTask.firebaseConfig.privateKey
          })
        });
        // Init alternative conf
        if (RemotePushNotificationTask.firebaseConfig.alternativeConfiguration) {
          RemotePushNotificationTask.alternativeApp = admin.initializeApp({
            credential: admin.credential.cert({
              projectId: RemotePushNotificationTask.firebaseConfig.alternativeConfiguration.projectID,
              clientEmail: RemotePushNotificationTask.firebaseConfig.alternativeConfiguration.clientEmail,
              privateKey: RemotePushNotificationTask.firebaseConfig.alternativeConfiguration.privateKey
            })
          }, 'alternativeApp');
        }
        // Init tenant conf
        if (!Utils.isEmptyArray(RemotePushNotificationTask.firebaseConfig.tenants)) {
          for (const tenantConfig of RemotePushNotificationTask.firebaseConfig.tenants) {
            // Create the app
            const app = admin.initializeApp({
              credential: admin.credential.cert({
                projectId: tenantConfig.configuration.projectID,
                clientEmail: tenantConfig.configuration.clientEmail,
                privateKey: tenantConfig.configuration.privateKey
              })
            }, tenantConfig.tenantID);
            // Keep it per Tenant
            this.tenantFirebaseApps.set(tenantConfig.tenantID, app);
          }
        }
        RemotePushNotificationTask.initialized = true;
      } catch (error) {
        void Logging.logError({
          tenantID: Constants.DEFAULT_TENANT_ID,
          action: ServerAction.REMOTE_PUSH_NOTIFICATION,
          module: MODULE_NAME, method: 'constructor',
          message: `Error initializing Firebase: '${error.message as string}'`,
          detailedMessages: { error: error.stack }
        });
      }
    }
  }

  public async sendUserAccountInactivity(data: UserAccountInactivityNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<NotificationResult> {
    // Set the locale
    const i18nManager = I18nManager.getInstanceForLocale(user.locale);
    // Get Message Text
    const title = i18nManager.translate('notifications.userAccountInactivity.title');
    const body = i18nManager.translate('notifications.userAccountInactivity.body',
      { lastLogin: data.lastLogin, tenantName: tenant.name });
    // Send Notification
    await this.sendRemotePushNotificationToUser(tenant, UserNotificationType.USER_ACCOUNT_INACTIVITY, title, body, user, {
      lastLogin: data.lastLogin
    }, severity);
    return {};
  }

  public async sendPreparingSessionNotStarted(data: PreparingSessionNotStartedNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<NotificationResult> {
    // Set the locale
    const i18nManager = I18nManager.getInstanceForLocale(user.locale);
    // Get Message Text
    const title = i18nManager.translate('notifications.preparingSessionNotStarted.title');
    const body = i18nManager.translate('notifications.preparingSessionNotStarted.body',
      { chargeBoxID: data.chargeBoxID, connectorId: data.connectorId, tenantName: tenant.name });
    // Send Notification
    await this.sendRemotePushNotificationToUser(tenant, UserNotificationType.PREPARING_SESSION_NOT_STARTED, title, body, user, {
      chargeBoxID: data.chargeBoxID,
      connectorId: data.connectorId,
      deepLink: data.evseDashboardChargingStationURL
    }, severity);
    return {};
  }

  public async sendSessionNotStarted(data: SessionNotStartedNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<NotificationResult> {
    // Set the locale
    const i18nManager = I18nManager.getInstanceForLocale(user.locale);
    // Get Message Text
    const title = i18nManager.translate('notifications.sessionNotStarted.title');
    const body = i18nManager.translate('notifications.sessionNotStarted.body',
      { chargeBoxID: data.chargeBoxID });
    // Send Notification
    await this.sendRemotePushNotificationToUser(tenant, UserNotificationType.SESSION_NOT_STARTED_AFTER_AUTHORIZE, title, body, user, {
      chargeBoxID: data.chargeBoxID,
      deepLink: data.evseDashboardChargingStationURL
    }, severity);
    return {};
  }

  public async sendOfflineChargingStations(data: OfflineChargingStationNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<NotificationResult> {
    // Set the locale
    const i18nManager = I18nManager.getInstanceForLocale(user.locale);
    // TODO - old stuff - to be removed asap
    data.chargeBoxIDs = data.chargingStationIDs.join(', ');
    // Populate the context to have a human-readable message
    data.nbChargingStationIDs = data.chargingStationIDs?.length || 0;
    // Show only the ten first charging stations
    data.tenFirstChargingStationIDs = data.chargingStationIDs.slice(0, 10).join(', ') + '...';
    // Get Message Text
    const title = i18nManager.translate('notifications.offlineChargingStation.title');
    const body = i18nManager.translate('notifications.offlineChargingStation.body',
      { chargeBoxIDs: data.chargeBoxIDs, tenantName: tenant.name });
    // Send Notification
    await this.sendRemotePushNotificationToUser(tenant, UserNotificationType.OFFLINE_CHARGING_STATION, title, body, user, null, severity);
    return {};
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async sendNewRegisteredUser(data: NewRegisteredUserNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<NotificationResult> {
    return Promise.resolve({});
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async sendRequestPassword(data: RequestPasswordNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<NotificationResult> {
    return Promise.resolve({});
  }

  public async sendOptimalChargeReached(data: OptimalChargeReachedNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<NotificationResult> {
    // Set the locale
    const i18nManager = I18nManager.getInstanceForLocale(user.locale);
    // Get Message Text
    const title = i18nManager.translate('notifications.optimalChargeReached.title');
    const body = i18nManager.translate('notifications.optimalChargeReached.body',
      { chargeBoxID: data.chargeBoxID, connectorId: data.connectorId, tenantName: tenant.name });
    // Send Notification
    await this.sendRemotePushNotificationToUser(tenant, UserNotificationType.OPTIMAL_CHARGE_REACHED, title, body, user, {
      transactionId: data.transactionId.toString(),
      chargeBoxID: data.chargeBoxID,
      connectorId: data.connectorId,
      deepLink: data.evseDashboardChargingStationURL
    }, severity);
    return {};
  }

  public async sendEndOfCharge(data: EndOfChargeNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<NotificationResult> {
    // Set the locale
    const i18nManager = I18nManager.getInstanceForLocale(user.locale);
    // Get Message Text
    const title = i18nManager.translate('notifications.endOfCharge.title');
    const body = i18nManager.translate('notifications.endOfCharge.body',
      { chargeBoxID: data.chargeBoxID, connectorId: data.connectorId, tenantName: tenant.name });
    // Send Notification
    await this.sendRemotePushNotificationToUser(tenant, UserNotificationType.END_OF_CHARGE, title, body, user, {
      transactionId: data.transactionId.toString(),
      chargeBoxID: data.chargeBoxID,
      connectorId: data.connectorId,
      deepLink: data.evseDashboardChargingStationURL
    }, severity);
    return {};
  }

  public async sendEndOfSession(data: EndOfSessionNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<NotificationResult> {
    // Set the locale
    const i18nManager = I18nManager.getInstanceForLocale(user.locale);
    // Get Message Text
    const title = i18nManager.translate('notifications.endOfSession.title');
    const body = i18nManager.translate('notifications.endOfSession.body',
      { chargeBoxID: data.chargeBoxID, connectorId: data.connectorId, tenantName: tenant.name });
    // Send Notification
    await this.sendRemotePushNotificationToUser(tenant, UserNotificationType.END_OF_SESSION, title, body, user, {
      transactionId: data.transactionId.toString(),
      chargeBoxID: data.chargeBoxID,
      connectorId: data.connectorId,
      deepLink: data.evseDashboardChargingStationURL
    }, severity);
    return {};
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async sendEndOfSignedSession(data: EndOfSignedSessionNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<NotificationResult> {
    return Promise.resolve({});
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async sendCarCatalogSynchronizationFailed(data: CarCatalogSynchronizationFailedNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<NotificationResult> {
    return Promise.resolve({});
  }

  public async sendEndUserErrorNotification(data: EndUserErrorNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<NotificationResult> {
    // Set the locale
    const i18nManager = I18nManager.getInstanceForLocale(user.locale);
    // Get Message Text
    const title = i18nManager.translate('notifications.endUserErrorNotification.title');
    const body = i18nManager.translate('notifications.endUserErrorNotification.body',
      { userName: data.name, errorTitle: data.errorTitle, errorDescription: data.errorDescription ,tenantName: tenant.name });
    // Send Notification
    await this.sendRemotePushNotificationToUser(tenant, UserNotificationType.END_USER_ERROR_NOTIFICATION, title, body, user, null, severity);
    return {};
  }

  public async sendChargingStationStatusError(data: ChargingStationStatusErrorNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<NotificationResult> {
    // Set the locale
    const i18nManager = I18nManager.getInstanceForLocale(user.locale);
    // Get Message Text
    const title = i18nManager.translate('notifications.chargingStationStatusError.title');
    const body = i18nManager.translate('notifications.chargingStationStatusError.body',
      { chargeBoxID: data.chargeBoxID, connectorId: data.connectorId, error: data.error, tenantName: tenant.name });
    // Send Notification
    await this.sendRemotePushNotificationToUser(tenant, UserNotificationType.CHARGING_STATION_STATUS_ERROR, title, body, user, {
      chargeBoxID: data.chargeBoxID,
      connectorId: data.connectorId,
      deepLink: data.evseDashboardChargingStationURL
    }, severity);
    return {};
  }

  public async sendChargingStationRegistered(data: ChargingStationRegisteredNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<NotificationResult> {
    // Set the locale
    const i18nManager = I18nManager.getInstanceForLocale(user.locale);
    // Get Message Text
    const title = i18nManager.translate('notifications.chargingStationRegistered.title');
    const body = i18nManager.translate('notifications.chargingStationRegistered.body',
      { chargeBoxID: data.chargeBoxID, tenantName: tenant.name });
    // Send Notification
    await this.sendRemotePushNotificationToUser(tenant, UserNotificationType.CHARGING_STATION_REGISTERED, title, body, user, {
      chargeBoxID: data.chargeBoxID,
      deepLink: data.evseDashboardChargingStationURL
    }, severity);
    return {};
  }

  public async sendUserAccountStatusChanged(data: UserAccountStatusChangedNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<NotificationResult> {
    // Set the locale
    const i18nManager = I18nManager.getInstanceForLocale(user.locale);
    const status = user.status === UserStatus.ACTIVE ?
      i18nManager.translate('notifications.userAccountStatusChanged.activated') :
      i18nManager.translate('notifications.userAccountStatusChanged.suspended');
    // Get Message Text
    const title = i18nManager.translate('notifications.userAccountStatusChanged.title',
      { status: Utils.firstLetterInUpperCase(status) });
    const body = i18nManager.translate('notifications.userAccountStatusChanged.body',
      { status, tenantName: tenant.name });
    // Send Notification
    await this.sendRemotePushNotificationToUser(tenant, UserNotificationType.USER_ACCOUNT_STATUS_CHANGED, title, body, user, {
      userID: user.id
    }, severity);
    return {};
  }

  public async sendUnknownUserBadged(data: UnknownUserBadgedNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<NotificationResult> {
    // Set the locale
    const i18nManager = I18nManager.getInstanceForLocale(user.locale);
    // Get Message Text
    const title = i18nManager.translate('notifications.unknownUserBadged.title');
    const body = i18nManager.translate('notifications.unknownUserBadged.body',
      { chargeBoxID: data.chargeBoxID, badgeID: data.badgeID, tenantName: tenant.name });
    // Send Notification
    await this.sendRemotePushNotificationToUser(tenant, UserNotificationType.UNKNOWN_USER_BADGED, title, body, user, {
      chargeBoxID: data.chargeBoxID,
      badgeID: data.badgeID
    }, severity);
    return {};
  }

  public async sendSessionStarted(data: TransactionStartedNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<NotificationResult> {
    // Set the locale
    const i18nManager = I18nManager.getInstanceForLocale(user.locale);
    // Get Message Text
    const title = i18nManager.translate('notifications.sessionStarted.title');
    const body = i18nManager.translate('notifications.sessionStarted.body',
      { chargeBoxID: data.chargeBoxID, connectorId: data.connectorId, tenantName: tenant.name });
    // Send Notification
    await this.sendRemotePushNotificationToUser(tenant, UserNotificationType.SESSION_STARTED, title, body, user, {
      'transactionId': data.transactionId.toString(),
      'chargeBoxID': data.chargeBoxID,
      'connectorId': data.connectorId,
      deepLink: data.evseDashboardChargingStationURL
    }, severity);
    return {};
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async sendVerificationEmail(data: VerificationEmailNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<NotificationResult> {
    return Promise.resolve({});
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async sendVerificationEmailUserImport(data: VerificationEmailNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<NotificationResult> {
    return Promise.resolve({});
  }

  public async sendOCPIPatchChargingStationsStatusesError(data: OCPIPatchChargingStationsStatusesErrorNotification,
      user: User, tenant: Tenant, severity: NotificationSeverity): Promise<NotificationResult> {
    // Set the locale
    const i18nManager = I18nManager.getInstanceForLocale(user.locale);
    // Get Message Text
    const title = i18nManager.translate('notifications.ocpiPatchChargingStationsStatusesError.title');
    const body = i18nManager.translate('notifications.ocpiPatchChargingStationsStatusesError.body',
      { location: data.location, tenantName: tenant.name });
    // Send Notification
    await this.sendRemotePushNotificationToUser(tenant, UserNotificationType.OCPI_PATCH_STATUS_ERROR, title, body, user, null, severity);
    return {};
  }

  public async sendOICPPatchChargingStationsStatusesError(data: OICPPatchChargingStationsStatusesErrorNotification,
      user: User, tenant: Tenant, severity: NotificationSeverity): Promise<NotificationResult> {
    // Set the locale
    const i18nManager = I18nManager.getInstanceForLocale(user.locale);
    // Get Message Text
    const title = i18nManager.translate('notifications.oicpPatchChargingStationsStatusesError.title');
    const body = i18nManager.translate('notifications.oicpPatchChargingStationsStatusesError.body',
      { tenantName: tenant.name });
    // Send Notification
    await this.sendRemotePushNotificationToUser(tenant, UserNotificationType.OICP_PATCH_STATUS_ERROR, title, body, user, null, severity);
    return {};
  }

  public async sendOICPPatchChargingStationsError(data: OICPPatchChargingStationsErrorNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<NotificationResult> {
    // Set the locale
    const i18nManager = I18nManager.getInstanceForLocale(user.locale);
    // Get Message Text
    const title = i18nManager.translate('notifications.oicpPatchChargingStationsError.title');
    const body = i18nManager.translate('notifications.oicpPatchChargingStationsError.body',
      { tenantName: tenant.name });
    // Send Notification
    await this.sendRemotePushNotificationToUser(tenant, UserNotificationType.OICP_PATCH_EVSE_ERROR, title, body, user, null, severity);
    return {};
  }

  public async sendBillingSynchronizationFailed(data: BillingUserSynchronizationFailedNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<NotificationResult> {
    // Set the locale
    const i18nManager = I18nManager.getInstanceForLocale(user.locale);
    // Get Message Text
    const title = i18nManager.translate('notifications.billingUserSynchronizationFailed.title');
    const body = i18nManager.translate('notifications.billingUserSynchronizationFailed.body',
      { nbrUsersInError: data.nbrUsersInError, tenantName: tenant.name });
    // Send Notification
    await this.sendRemotePushNotificationToUser(tenant, UserNotificationType.BILLING_USER_SYNCHRONIZATION_FAILED,
      title, body, user, { 'error': data.nbrUsersInError.toString() }, severity);
    return {};
  }

  public async sendBillingInvoiceSynchronizationFailed(data: BillingInvoiceSynchronizationFailedNotification,
      user: User, tenant: Tenant, severity: NotificationSeverity): Promise<NotificationResult> {
    // Set the locale
    const i18nManager = I18nManager.getInstanceForLocale(user.locale);
    // Get Message Text
    const title = i18nManager.translate('notifications.billingInvoiceSynchronizationFailed.title');
    const body = i18nManager.translate('notifications.billingInvoiceSynchronizationFailed.body',
      { nbrInvoicesInError: data.nbrInvoicesInError, tenantName: tenant.name });
    // Send Notification
    await this.sendRemotePushNotificationToUser(tenant, UserNotificationType.BILLING_INVOICE_SYNCHRONIZATION_FAILED,
      title, body, user, { 'error': data.nbrInvoicesInError.toString() }, severity);
    return {};
  }

  public async sendBillingPeriodicOperationFailed(data: BillingPeriodicOperationFailedNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<NotificationResult> {
    // Set the locale
    const i18nManager = I18nManager.getInstanceForLocale(user.locale);
    // Get Message Text
    const title = i18nManager.translate('notifications.billingPeriodicOperationFailed.title');
    const body = i18nManager.translate('notifications.billingPeriodicOperationFailed.body',
      { nbrInvoicesInError: data.nbrInvoicesInError, tenantName: tenant.name });
    // Send Notification
    await this.sendRemotePushNotificationToUser(tenant, UserNotificationType.BILLING_PERIODIC_OPERATION_FAILED,
      title, body, user, { 'error': data.nbrInvoicesInError.toString() }, severity);
    return {};
  }

  public async sendBillingAccountCreationLink(data: BillingAccountCreationLinkNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<NotificationResult> {
    // Set the locale
    const i18nManager = I18nManager.getInstanceForLocale(user.locale);
    // Get Message Text
    const title = i18nManager.translate('notifications.billingAccountCreationLink.title');
    const body = i18nManager.translate('notifications.billingAccountCreationLink.body',
      { onboardingLink: data.onboardingLink, tenantName: tenant.name });
    // Send Notification
    await this.sendRemotePushNotificationToUser(tenant, UserNotificationType.BILLING_CREATE_ACCOUNT,
      title, body, user, { 'onboardingLink': data.onboardingLink }, severity);
    return {};
  }

  public async sendBillingAccountActivationNotification(data: BillingAccountActivationNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<NotificationResult> {
    // Set the locale
    const i18nManager = I18nManager.getInstanceForLocale(user.locale);
    // Get Message Text
    const title = i18nManager.translate('notifications.billingAccountActivated.title');
    const body = i18nManager.translate('notifications.billingAccountActivated.body',
      { tenantName: tenant.name });
    // Send Notification
    await this.sendRemotePushNotificationToUser(tenant, UserNotificationType.BILLING_ACCOUNT_ACTIVATED,
      title, body, user, {}, severity);
    return {};
  }

  public async sendComputeAndApplyChargingProfilesFailed(data: ComputeAndApplyChargingProfilesFailedNotification,
      user: User, tenant: Tenant, severity: NotificationSeverity): Promise<NotificationResult> {
    // Set the locale
    const i18nManager = I18nManager.getInstanceForLocale(user.locale);
    // Get Message Text
    const title = i18nManager.translate('notifications.computeAndApplyChargingProfilesFailed.title');
    const body = i18nManager.translate('notifications.computeAndApplyChargingProfilesFailed.body',
      { chargeBoxID: data.chargeBoxID, siteAreaName: data.siteAreaName, tenantName: tenant.name });
    // Send Notification
    await this.sendRemotePushNotificationToUser(tenant, UserNotificationType.CHECK_AND_APPLY_SMART_CHARGING_FAILED,
      title, body, user, null, severity);
    return {};

  }

  public async sendBillingNewInvoice(data: BillingNewInvoiceNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<NotificationResult> {
    // Set the locale
    const i18nManager = I18nManager.getInstanceForLocale(user.locale);
    // Get Message Text
    let title: string;
    let body: string;
    if (data.invoiceStatus === 'paid') {
      title = i18nManager.translate('notifications.billingNewInvoicePaid.title');
      body = i18nManager.translate('notifications.billingNewInvoicePaid.body',
        { invoiceNumber: data.invoiceNumber, amount: data.invoiceAmount });
    } else {
      // if status is 'open'
      title = i18nManager.translate('notifications.billingNewInvoiceOpen.title');
      body = i18nManager.translate('notifications.billingNewInvoiceOpen.body',
        { invoiceNumber: data.invoiceNumber, amount: data.invoiceAmount });
    }
    // Send Notification
    await this.sendRemotePushNotificationToUser(tenant, UserNotificationType.BILLING_NEW_INVOICE,
      title, body, user, { 'invoiceNumber': data.invoiceNumber, deepLink: data.evseDashboardInvoiceURL }, severity);
    return {};
  }

  public async sendAccountVerificationNotification(data: AccountVerificationNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<NotificationResult> {
    // Set the locale
    const i18nManager = I18nManager.getInstanceForLocale(user.locale);
    // Get Message Text
    const title = i18nManager.translate('notifications.accountVerificationNotification.title');
    let body: string;
    if (data.userStatus === UserStatus.ACTIVE) {
      body = i18nManager.translate('notifications.accountVerificationNotification.bodyVerifiedAndActivated');
    } else {
      body = i18nManager.translate('notifications.accountVerificationNotification.bodyVerified');
    }
    // Send Notification
    await this.sendRemotePushNotificationToUser(tenant, UserNotificationType.ACCOUNT_VERIFICATION_NOTIFICATION, title, body, user, null, severity);
    return {};
  }

  public async sendAdminAccountVerificationNotification(): Promise<NotificationResult> {
    return Promise.resolve({});
  }

  public async sendUserCreatePassword(): Promise<NotificationResult> {
    return Promise.resolve({});
  }

  private async sendRemotePushNotificationToUser(tenant: Tenant, notificationType: UserNotificationType,
      title: string, body: string, user: User, data?: Record<string, string>, severity?: NotificationSeverity): Promise<void> {
    let startTime: number;
    let message = {} as admin.messaging.MessagingPayload;
    try {
      // Checks consistency
      if (!RemotePushNotificationTask.initialized) {
        return Promise.resolve();
      }
      // Do it
      startTime = Logging.traceNotificationStart();
      if (!user?.mobileData?.mobileToken) {
        await Logging.logDebug({
          tenantID: tenant.id,
          siteID: data?.siteID,
          siteAreaID: data?.siteAreaID,
          companyID: data?.companyID,
          chargingStationID: data?.chargeBoxID,
          action: ServerAction.REMOTE_PUSH_NOTIFICATION,
          module: MODULE_NAME, method: 'sendRemotePushNotificationToUsers',
          message: `'${notificationType}': No mobile token found for this User`,
          actionOnUser: user.id,
        });
        // Send nothing
        return Promise.resolve();
      }
      // Create message
      message = this.createMessage(tenant, notificationType, title, body, data, severity);
      // Get the right firebase apps
      const apps = this.getFirebaseAppsFromTenant(tenant);
      // Send notification only once in case of multiple configurations
      let notificationSent = false;
      for (const app of apps) {
        if (notificationSent) {
          break;
        }
        try {
          // Send message
          const response = await admin.messaging(app).sendToDevice(
            user.mobileData.mobileToken,
            message,
            { priority: 'high', timeToLive: 60 * 60 * 24 }
          );
          // Error
          if (response.failureCount > 0) {
            void Logging.logError({
              tenantID: tenant.id,
              siteID: data?.siteID,
              siteAreaID: data?.siteAreaID,
              companyID: data?.companyID,
              chargingStationID: data?.chargeBoxID,
              action: ServerAction.REMOTE_PUSH_NOTIFICATION,
              module: MODULE_NAME, method: 'sendRemotePushNotificationToUsers',
              message: `Error when sending Notification: '${notificationType}' - Error code: '${response.results[0]?.error?.code}'`,
              actionOnUser: user.id,
              detailedMessages: { response }
            });
          // Success
          } else {
            // Stop sending notification
            notificationSent = true;
            void Logging.logDebug({
              tenantID: tenant.id,
              siteID: data?.siteID,
              siteAreaID: data?.siteAreaID,
              companyID: data?.companyID,
              chargingStationID: data?.chargeBoxID,
              action: ServerAction.REMOTE_PUSH_NOTIFICATION,
              module: MODULE_NAME, method: 'sendRemotePushNotificationToUsers',
              message: `Notification Sent: '${notificationType}' - '${title}'`,
              actionOnUser: user.id,
            });
          }
        } catch (error) {
          void Logging.logError({
            tenantID: tenant.id,
            siteID: data?.siteID,
            siteAreaID: data?.siteAreaID,
            companyID: data?.companyID,
            chargingStationID: data?.chargeBoxID,
            action: ServerAction.REMOTE_PUSH_NOTIFICATION,
            module: MODULE_NAME, method: 'sendRemotePushNotificationToUsers',
            message: `Error when sending Notification: '${notificationType}' - '${error.message as string}'`,
            actionOnUser: user.id,
            detailedMessages: { error: error.stack }
          });
        }
      }
    } finally {
      await Logging.traceNotificationEnd(tenant, MODULE_NAME, 'sendRemotePushNotificationToUser', startTime, notificationType, message, user.id);
    }
  }

  private createMessage(tenant: Tenant, notificationType: UserNotificationType, title: string, body: string,
      data: Record<string, unknown>, severity: NotificationSeverity): admin.messaging.MessagingPayload {
    // Build message
    const message: admin.messaging.MessagingPayload = {
      notification: {
        title,
        body,
        icon: '@drawable/ic_stat_ic_notification',
        sound: 'default',
        badge: '0',
        color: severity ? severity : NotificationSeverity.INFO,
        android_channel_id: 'e-Mobility'
      },
      data: {
        tenantID: tenant.id,
        tenantSubdomain: tenant.subdomain,
        notificationType,
        ...(data || {})
      }
    };
    return message;
  }

  private getFirebaseAppsFromTenant(tenant: Tenant): Array<admin.app.App> {
    const apps = [RemotePushNotificationTask.defaultApp];
    const tenantApp = RemotePushNotificationTask.tenantFirebaseApps.get(tenant.id);
    if (tenantApp) {
      return [tenantApp];
    }
    if (RemotePushNotificationTask.alternativeApp) {
      apps.push(RemotePushNotificationTask.alternativeApp);
    }
    return apps;
  }
}
