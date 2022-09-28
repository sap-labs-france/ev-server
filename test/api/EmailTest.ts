import { AccountVerificationNotification, AdminAccountVerificationNotification, BillingAccountActivationNotification, BillingAccountCreationLinkNotification, BillingInvoiceSynchronizationFailedNotification, BillingNewInvoiceNotification, BillingPeriodicOperationFailedNotification, BillingUserSynchronizationFailedNotification, CarCatalogSynchronizationFailedNotification, ChargingStationRegisteredNotification, ChargingStationStatusErrorNotification, ComputeAndApplyChargingProfilesFailedNotification, EndOfChargeNotification, EndOfSessionNotification, EndUserErrorNotification, NewRegisteredUserNotification, NotificationSeverity, OCPIPatchChargingStationsStatusesErrorNotification, OICPPatchChargingStationsErrorNotification, OICPPatchChargingStationsStatusesErrorNotification, OfflineChargingStationNotification, OptimalChargeReachedNotification, PreparingSessionNotStartedNotification, RequestPasswordNotification, SessionNotStartedNotification, TransactionStartedNotification, UnknownUserBadgedNotification, UserAccountInactivityNotification, UserAccountStatusChangedNotification, UserCreatePassword, VerificationEmailNotification } from '../../src/types/UserNotifications';
import User, { UserStatus } from '../../src/types/User';
import chai, { assert } from 'chai';

import BrandingConstants from '../../src/utils/BrandingConstants';
import Constants from '../../src/utils/Constants';
import ContextDefinition from './context/ContextDefinition';
import ContextProvider from './context/ContextProvider';
import EMailNotificationTask from '../../src/notification/email/EMailNotificationTask';
import I18nManager from '../../src/utils/I18nManager';
import MongoDBStorage from '../../src/storage/mongodb/MongoDBStorage';
import Tenant from '../../src/types/Tenant';
import Utils from '../../src/utils/Utils';
import chaiSubset from 'chai-subset';
import config from '../config';
import global from '../../src/types/GlobalType';
import responseHelper from '../helpers/responseHelper';

chai.use(chaiSubset);
chai.use(responseHelper);

function checkForMissing(html: string): string | null {
  const regex = new RegExp(/\[missing .* value\]|\[missing .* translation\]/g);
  const value = regex.exec(html);
  if (value) {
    return value[0];
  }
  return null;
}

describe('Initialization', () => {
  jest.setTimeout(600000);

  beforeAll(async () => {
    global.database = new MongoDBStorage(config.get('storage'));
    await global.database.start();
    I18nManager.initialize();
  });

  afterAll(async () => {
    // Close DB connection
    await global.database.stop();
  });

  describe('Email', () => {
    const emailNotificationTask = new EMailNotificationTask();
    let recipient: User;
    let user: User;
    let tenant: Tenant;
    const severity = 'INFO' as NotificationSeverity;

    beforeAll(async () => {
      const tenantContext = await ContextProvider.defaultInstance.getTenantContext(ContextDefinition.TENANT_CONTEXTS.TENANT_WITH_ALL_COMPONENTS);
      // Set the recipient
      recipient = Utils.cloneObject(tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN));
      recipient.firstName = 'Kaito (怪盗)';
      recipient.name = '(怪盗) Kaito';
      recipient.locale = "fr_FR";
      // Set the user mentioned in the body of the mail
      user = Utils.cloneObject(tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.BASIC_USER));
      user.phone = '+33 6 12 34 56 78';
      user.locale = "fr_FR";
      tenant = tenantContext.getTenant();
    });
    it('new-registered-user', async () => {
      const data: NewRegisteredUserNotification = {
        tenant: tenant.subdomain,
        user,
        evseDashboardURL: BrandingConstants.OPEN_EMOBILITY_WEBSITE_URL,
        evseDashboardVerifyEmailURL: BrandingConstants.OPEN_EMOBILITY_WEBSITE_URL,
      };
      const notificationResult = await emailNotificationTask.sendNewRegisteredUser(data, recipient, tenant, severity);
      const isMissing = checkForMissing(notificationResult.html);
      assert.equal(isMissing, null, isMissing);
      assert.equal(notificationResult.error, null, notificationResult.error as string);
    });

    it('request-password', async () => {
      const data: RequestPasswordNotification = {
        user,
        evseDashboardResetPassURL: BrandingConstants.OPEN_EMOBILITY_WEBSITE_URL,
        evseDashboardURL: BrandingConstants.OPEN_EMOBILITY_WEBSITE_URL
      };
      const notificationResult = await emailNotificationTask.sendRequestPassword(data, recipient, tenant, severity);
      const isMissing = checkForMissing(notificationResult.html);
      assert.equal(isMissing, null, isMissing);
      assert.equal(notificationResult.error, null, notificationResult.error as string);
    });

    it('optimal-charge-reached', async () => {
      const data: OptimalChargeReachedNotification = {
        transactionId: 1,
        siteID: 'site_id',
        siteAreaID: 'site area id',
        companyID: 'company id',
        chargeBoxID: 'Charging Station 19 SAP',
        connectorId: 'A',
        totalConsumption: 'total consumption',
        stateOfCharge: 89,
        evseDashboardChargingStationURL: 'charging station url',
        user,
        evseDashboardURL: BrandingConstants.OPEN_EMOBILITY_WEBSITE_URL,
      };
      const notificationResult = await emailNotificationTask.sendOptimalChargeReached(data, recipient, tenant, severity);
      const isMissing = checkForMissing(notificationResult.html);
      assert.equal(isMissing, null, isMissing);
      assert.equal(notificationResult.error, null, notificationResult.error as string);
    });

    it('end-of-charge', async () => {
      const data: EndOfChargeNotification = {
        transactionId: 1,
        siteID: 'site iD',
        siteAreaID: 'site area id',
        companyID: 'company id',
        chargeBoxID: 'charging box id',
        connectorId: 'connector id',
        totalConsumption: '48.3',
        stateOfCharge: 78,
        totalDuration: '5h14',
        evseDashboardChargingStationURL: BrandingConstants.OPEN_EMOBILITY_WEBSITE_URL,
        user,
        evseDashboardURL: BrandingConstants.OPEN_EMOBILITY_WEBSITE_URL,
      };
      const notificationResult = await emailNotificationTask.sendEndOfCharge(data, recipient, tenant, severity);
      const isMissing = checkForMissing(notificationResult.html);
      assert.equal(isMissing, null, isMissing);
      assert.equal(notificationResult.error, null, notificationResult.error as string);
    });

    it('end-of-session', async () => {
      const data: EndOfSessionNotification = {
        transactionId: 1,
        siteID: 'site id',
        siteAreaID: 'site area id',
        companyID: 'company id',
        chargeBoxID: 'SAP Moujins 19 A',
        connectorId: 'A',
        totalConsumption: '52,3',
        totalInactivity: '0h13',
        stateOfCharge: 1,
        totalDuration: '5h41',
        user,
        alternateUser: user,
        evseDashboardURL: BrandingConstants.OPEN_EMOBILITY_WEBSITE_URL,
        evseDashboardChargingStationURL: 'charging station url',
      };
      const notificationResult = await emailNotificationTask.sendEndOfSession(data, recipient, tenant, severity);
      const isMissing = checkForMissing(notificationResult.html);
      assert.equal(isMissing, null, isMissing);
      assert.equal(notificationResult.error, null, notificationResult.error as string);
    });

    it('billing-new-invoice-paid', async () => {
      const data: BillingNewInvoiceNotification = {
        evseDashboardURL: BrandingConstants.OPEN_EMOBILITY_WEBSITE_URL,
        evseDashboardInvoiceURL: BrandingConstants.OPEN_EMOBILITY_WEBSITE_URL,
        user,
        invoiceDownloadUrl: BrandingConstants.OPEN_EMOBILITY_WEBSITE_URL,
        payInvoiceUrl: BrandingConstants.OPEN_EMOBILITY_WEBSITE_URL,
        invoiceNumber: 'I-2002-001',
        invoiceAmount: '$12.50',
        invoiceStatus: 'paid',
      };
      const notificationResult = await emailNotificationTask.sendBillingNewInvoice(data, recipient, tenant, severity);
      const isMissing = checkForMissing(notificationResult.html);
      assert.equal(isMissing, null, isMissing);
      assert.equal(notificationResult.error, null, notificationResult.error as string);
    });

    it('billing-new-invoice-unpaid', async () => {
      const data: BillingNewInvoiceNotification = {
        evseDashboardURL: BrandingConstants.OPEN_EMOBILITY_WEBSITE_URL,
        evseDashboardInvoiceURL: BrandingConstants.OPEN_EMOBILITY_WEBSITE_URL,
        user,
        invoiceDownloadUrl: BrandingConstants.OPEN_EMOBILITY_WEBSITE_URL,
        payInvoiceUrl: BrandingConstants.OPEN_EMOBILITY_WEBSITE_URL,
        invoiceNumber: 'I-2002-001',
        invoiceAmount: '$12.50',
        invoiceStatus: 'unpaid',
      };
      const notificationResult = await emailNotificationTask.sendBillingNewInvoice(data, recipient, tenant, severity);
      const isMissing = checkForMissing(notificationResult.html);
      assert.equal(isMissing, null, isMissing);
      assert.equal(notificationResult.error, null, notificationResult.error as string);
    });

    it('charging-station-registered', async () => {
      const data: ChargingStationRegisteredNotification = {
        chargeBoxID: 'Charge Box A1',
        siteID: 'Site 134',
        siteAreaID: 'A3',
        companyID: 'SAP12',
        evseDashboardURL: BrandingConstants.OPEN_EMOBILITY_WEBSITE_URL,
        evseDashboardChargingStationURL: BrandingConstants.OPEN_EMOBILITY_WEBSITE_URL,
      };
      const notificationResult = await emailNotificationTask.sendChargingStationRegistered(data, recipient, tenant, severity);
      const isMissing = checkForMissing(notificationResult.html);
      assert.equal(isMissing, null, isMissing);
      assert.equal(notificationResult.error, null, notificationResult.error as string);
    });

    it('end-user-error-notification', async () => {
      const data: EndUserErrorNotification = {
        userID: user.id,
        email: user.email,
        name: user.firstName + ' ' + user.name,
        errorTitle: 'Session does not start',
        errorDescription: 'I have not been able to start a session from my mobile phone',
        phone: user.phone,
        evseDashboardURL: BrandingConstants.OPEN_EMOBILITY_WEBSITE_URL,
      };
      const notificationResult = await emailNotificationTask.sendEndUserErrorNotification(data, recipient, tenant, severity);
      const isMissing = checkForMissing(notificationResult.html);
      assert.equal(isMissing, null, isMissing);
      assert.equal(notificationResult.error, null, notificationResult.error as string);
    });

    it('offline-charging-station', async () => {
      const data: OfflineChargingStationNotification = {
        chargingStationIDs: [ 'CS1', 'CS2', 'CS3', 'CS4', 'CS5', 'CS6', 'CS7', 'CS8', 'CS9', 'CS10', 'CS11', 'CS12' ],
        evseDashboardURL: BrandingConstants.OPEN_EMOBILITY_WEBSITE_URL,
      };
      const notificationResult = await emailNotificationTask.sendOfflineChargingStations(data, recipient, tenant, severity);
      const isMissing = checkForMissing(notificationResult.html);
      assert.equal(isMissing, null, isMissing);
      assert.equal(notificationResult.error, null, notificationResult.error as string);
    });

    it('charging-station-status-error', async () => {
      const data: ChargingStationStatusErrorNotification = {
        chargeBoxID: 'some box id',
        siteID: 'site id',
        siteAreaID: 'site area id',
        companyID: 'company id',
        connectorId: 'connector id',
        error: 'this is the error',
        evseDashboardURL: BrandingConstants.OPEN_EMOBILITY_WEBSITE_URL,
        evseDashboardChargingStationURL: BrandingConstants.OPEN_EMOBILITY_WEBSITE_URL,
      };
      const notificationResult = await emailNotificationTask.sendChargingStationStatusError(data, recipient, tenant, severity);
      const isMissing = checkForMissing(notificationResult.html);
      assert.equal(isMissing, null, isMissing);
      assert.equal(notificationResult.error, null, notificationResult.error as string);
    });

    it('billing-account-created', async () => {
      const data: BillingAccountCreationLinkNotification = {
        evseDashboardURL: BrandingConstants.OPEN_EMOBILITY_WEBSITE_URL,
        user,
        onboardingLink: BrandingConstants.OPEN_EMOBILITY_WEBSITE_URL,
      };
      const notificationResult = await emailNotificationTask.sendBillingAccountCreationLink(data, recipient, tenant, severity);
      const isMissing = checkForMissing(notificationResult.html);
      assert.equal(isMissing, null, isMissing);
      assert.equal(notificationResult.error, null, notificationResult.error as string);
    });

    it('user-account-status-changed', async () => {
      const data: UserAccountStatusChangedNotification = {
        user,
        evseDashboardURL: BrandingConstants.OPEN_EMOBILITY_WEBSITE_URL,
      };
      const notificationResult = await emailNotificationTask.sendUserAccountStatusChanged(data, recipient, tenant, severity);
      const isMissing = checkForMissing(notificationResult.html);
      assert.equal(isMissing, null, isMissing);
      assert.equal(notificationResult.error, null, notificationResult.error as string);
    });

    it('unknown-user-badged', async () => {
      const data: UnknownUserBadgedNotification = {
        chargeBoxID: 'charge box id',
        siteID: 'site id',
        siteAreaID: 'site area id',
        companyID: 'company id',
        badgeID: 'badge id',
        evseDashboardURL: BrandingConstants.OPEN_EMOBILITY_WEBSITE_URL,
      };
      const notificationResult = await emailNotificationTask.sendUnknownUserBadged(data, recipient, tenant, severity);
      const isMissing = checkForMissing(notificationResult.html);
      assert.equal(isMissing, null, isMissing);
      assert.equal(notificationResult.error, null, notificationResult.error as string);
    });

    it('session-started', async () => {
      const data: TransactionStartedNotification = {
        user,
        transactionId: 14,
        siteID: 'site id',
        siteAreaID: 'site area id',
        companyID: 'company id',
        chargeBoxID: 'charge box id',
        connectorId: 'connector id',
        evseDashboardURL: BrandingConstants.OPEN_EMOBILITY_WEBSITE_URL,
        evseDashboardChargingStationURL: BrandingConstants.OPEN_EMOBILITY_WEBSITE_URL,
      };
      const notificationResult = await emailNotificationTask.sendSessionStarted(data, recipient, tenant, severity);
      const isMissing = checkForMissing(notificationResult.html);
      assert.equal(isMissing, null, isMissing);
      assert.equal(notificationResult.error, null, notificationResult.error as string);
    });

    it('verification-email', async () => {
      const data: VerificationEmailNotification = {
        user,
        evseDashboardURL: BrandingConstants.OPEN_EMOBILITY_WEBSITE_URL,
        evseDashboardVerifyEmailURL: BrandingConstants.OPEN_EMOBILITY_WEBSITE_URL,
      };
      const notificationResult = await emailNotificationTask.sendVerificationEmail(data, recipient, tenant, severity);
      const isMissing = checkForMissing(notificationResult.html);
      assert.equal(isMissing, null, isMissing);
      assert.equal(notificationResult.error, null, notificationResult.error as string);
    });

    it('verification-email-user-import', async () => {
      const data: VerificationEmailNotification = {
        user,
        evseDashboardURL: BrandingConstants.OPEN_EMOBILITY_WEBSITE_URL,
        evseDashboardVerifyEmailURL: BrandingConstants.OPEN_EMOBILITY_WEBSITE_URL,
      };
      const notificationResult = await emailNotificationTask.sendVerificationEmailUserImport(data, recipient, tenant, severity);
      const isMissing = checkForMissing(notificationResult.html);
      assert.equal(isMissing, null, isMissing);
      assert.equal(notificationResult.error, null, notificationResult.error as string);
    });

    it('ocpi-patch-status-error', async () => {
      const data: OCPIPatchChargingStationsStatusesErrorNotification = {
        evseDashboardURL: BrandingConstants.OPEN_EMOBILITY_WEBSITE_URL,
        location: 'location'
      };
      const notificationResult = await emailNotificationTask.sendOCPIPatchChargingStationsStatusesError(data, recipient, tenant, severity);
      const isMissing = checkForMissing(notificationResult.html);
      assert.equal(isMissing, null, isMissing);
      assert.equal(notificationResult.error, null, notificationResult.error as string);
    });

    it('oicp-patch-status-error', async () => {
      const data: OICPPatchChargingStationsStatusesErrorNotification = {
        evseDashboardURL: BrandingConstants.OPEN_EMOBILITY_WEBSITE_URL
      };
      const notificationResult = await emailNotificationTask.sendOICPPatchChargingStationsStatusesError(data, recipient, tenant, severity);
      const isMissing = checkForMissing(notificationResult.html);
      assert.equal(isMissing, null, isMissing);
      assert.equal(notificationResult.error, null, notificationResult.error as string);
    });

    it('oicp-patch-evses-error', async () => {
      const data: OICPPatchChargingStationsErrorNotification = {
        evseDashboardURL: BrandingConstants.OPEN_EMOBILITY_WEBSITE_URL,
      };
      const notificationResult = await emailNotificationTask.sendOICPPatchChargingStationsError(data, recipient, tenant, severity);
      const isMissing = checkForMissing(notificationResult.html);
      assert.equal(isMissing, null, isMissing);
      assert.equal(notificationResult.error, null, notificationResult.error as string);
    });

    it('user-account-inactivity', async () => {
      const data: UserAccountInactivityNotification = {
        user,
        lastLogin: new Date().toDateString(),
        evseDashboardURL: BrandingConstants.OPEN_EMOBILITY_WEBSITE_URL,
      };
      const notificationResult = await emailNotificationTask.sendUserAccountInactivity(data, recipient, tenant, severity);
      const isMissing = checkForMissing(notificationResult.html);
      assert.equal(isMissing, null, isMissing);
      assert.equal(notificationResult.error, null, notificationResult.error as string);
    });

    it('session-not-started', async () => {
      const data: PreparingSessionNotStartedNotification = {
        user,
        chargeBoxID: 'charge box id',
        siteID: 'site id',
        siteAreaID: 'site area id',
        companyID: 'company id',
        connectorId: 'connector id',
        startedOn: 'started on',
        evseDashboardURL: BrandingConstants.OPEN_EMOBILITY_WEBSITE_URL,
        evseDashboardChargingStationURL: BrandingConstants.OPEN_EMOBILITY_WEBSITE_URL,
      };
      const notificationResult = await emailNotificationTask.sendPreparingSessionNotStarted(data, recipient, tenant, severity);
      const isMissing = checkForMissing(notificationResult.html);
      assert.equal(isMissing, null, isMissing);
      assert.equal(notificationResult.error, null, notificationResult.error as string);
    });

    it('session-not-started-after-authorize', async () => {
      const data: SessionNotStartedNotification = {
        chargeBoxID: 'charge box id',
        siteID: 'site id',
        siteAreaID: 'site area id',
        companyID: 'company id',
        user,
        evseDashboardURL: BrandingConstants.OPEN_EMOBILITY_WEBSITE_URL,
        evseDashboardChargingStationURL: BrandingConstants.OPEN_EMOBILITY_WEBSITE_URL,
      };
      const notificationResult = await emailNotificationTask.sendSessionNotStarted(data, recipient, tenant, severity);
      const isMissing = checkForMissing(notificationResult.html);
      assert.equal(isMissing, null, isMissing);
      assert.equal(notificationResult.error, null, notificationResult.error as string);
    });

    it('billing-user-synchronization-failed', async () => {
      const data: BillingUserSynchronizationFailedNotification = {
        nbrUsersInError: 123,
        evseDashboardURL: BrandingConstants.OPEN_EMOBILITY_WEBSITE_URL,
        evseDashboardBillingURL: BrandingConstants.OPEN_EMOBILITY_WEBSITE_URL,
      };
      const notificationResult = await emailNotificationTask.sendBillingSynchronizationFailed(data, recipient, tenant, severity);
      const isMissing = checkForMissing(notificationResult.html);
      assert.equal(isMissing, null, isMissing);
      assert.equal(notificationResult.error, null, notificationResult.error as string);
    });

    it('billing-invoice-synchronization-failed', async () => {
      const data: BillingInvoiceSynchronizationFailedNotification = {
        nbrInvoicesInError: 123,
        evseDashboardURL: BrandingConstants.OPEN_EMOBILITY_WEBSITE_URL,
        evseDashboardBillingURL: BrandingConstants.OPEN_EMOBILITY_WEBSITE_URL,
      };
      const notificationResult = await emailNotificationTask.sendBillingInvoiceSynchronizationFailed(data, recipient, tenant, severity);
      const isMissing = checkForMissing(notificationResult.html);
      assert.equal(isMissing, null, isMissing);
      assert.equal(notificationResult.error, null, notificationResult.error as string);
    });

    it('billing-periodic-operation-failed', async () => {
      const data: BillingPeriodicOperationFailedNotification = {
        nbrInvoicesInError: 123,
        evseDashboardURL: BrandingConstants.OPEN_EMOBILITY_WEBSITE_URL,
        evseDashboardBillingURL: BrandingConstants.OPEN_EMOBILITY_WEBSITE_URL,
      };
      const notificationResult = await emailNotificationTask.sendBillingPeriodicOperationFailed(data, recipient, tenant, severity);
      const isMissing = checkForMissing(notificationResult.html);
      assert.equal(isMissing, null, isMissing);
      assert.equal(notificationResult.error, null, notificationResult.error as string);
    });

    it('billing-account-activated', async () => {
      const data: BillingAccountActivationNotification = {
        evseDashboardURL: BrandingConstants.OPEN_EMOBILITY_WEBSITE_URL,
        user,
      };
      const notificationResult = await emailNotificationTask.sendBillingAccountActivationNotification(data, recipient, tenant, severity);
      const isMissing = checkForMissing(notificationResult.html);
      assert.equal(isMissing, null, isMissing);
      assert.equal(notificationResult.error, null, notificationResult.error as string);
    });

    it('car-synchronization-failed', async () => {
      const data: CarCatalogSynchronizationFailedNotification = {
        nbrCarsInError: 10,
        evseDashboardURL: BrandingConstants.OPEN_EMOBILITY_WEBSITE_URL,
      };
      const notificationResult = await emailNotificationTask.sendCarCatalogSynchronizationFailed(data, recipient, tenant, severity);
      const isMissing = checkForMissing(notificationResult.html);
      assert.equal(isMissing, null, isMissing);
      assert.equal(notificationResult.error, null, notificationResult.error as string);
    });

    it('compute-and-apply-charging-profiles-failed', async () => {
      const data: ComputeAndApplyChargingProfilesFailedNotification = {
        siteAreaName: 'site area name',
        chargeBoxID: 'charge box id',
        siteID: 'site id',
        siteAreaID: 'site area id',
        companyID: 'company id',
        evseDashboardURL: BrandingConstants.OPEN_EMOBILITY_WEBSITE_URL,
      };
      const notificationResult = await emailNotificationTask.sendComputeAndApplyChargingProfilesFailed(data, recipient, tenant, severity);
      const isMissing = checkForMissing(notificationResult.html);
      assert.equal(isMissing, null, isMissing);
      assert.equal(notificationResult.error, null, notificationResult.error as string);
    });

    it('account-verification-notification-active', async () => {
      const data: AccountVerificationNotification = {
        user,
        userStatus: UserStatus.ACTIVE,
        evseDashboardURL: BrandingConstants.OPEN_EMOBILITY_WEBSITE_URL,
      };
      const notificationResult = await emailNotificationTask.sendAccountVerificationNotification(data, recipient, tenant, severity);
      const isMissing = checkForMissing(notificationResult.html);
      assert.equal(isMissing, null, isMissing);
      assert.equal(notificationResult.error, null, notificationResult.error as string);
    });

    it('account-verification-notification-inactive', async () => {
      const data: AccountVerificationNotification = {
        user,
        userStatus: UserStatus.INACTIVE,
        evseDashboardURL: BrandingConstants.OPEN_EMOBILITY_WEBSITE_URL,
      };
      const notificationResult = await emailNotificationTask.sendAccountVerificationNotification(data, recipient, tenant, severity);
      const isMissing = checkForMissing(notificationResult.html);
      assert.equal(isMissing, null, isMissing);
      assert.equal(notificationResult.error, null, notificationResult.error as string);
    });

    it('admin-account-verification-notification', async () => {
      const data: AdminAccountVerificationNotification = {
        user,
        evseDashboardURL: BrandingConstants.OPEN_EMOBILITY_WEBSITE_URL,
        evseUserToVerifyURL: BrandingConstants.OPEN_EMOBILITY_WEBSITE_URL,
      };
      const notificationResult = await emailNotificationTask.sendAdminAccountVerificationNotification(data, recipient, tenant, severity);
      const isMissing = checkForMissing(notificationResult.html);
      assert.equal(isMissing, null, isMissing);
      assert.equal(notificationResult.error, null, notificationResult.error as string);
    });

    it('user-create-password', async () => {
      const data: UserCreatePassword = {
        user,
        tenantName: tenant.name,
        evseDashboardURL: BrandingConstants.OPEN_EMOBILITY_WEBSITE_URL,
        evseDashboardCreatePasswordURL: BrandingConstants.OPEN_EMOBILITY_WEBSITE_URL,
      };
      const notificationResult = await emailNotificationTask.sendUserCreatePassword(data, recipient, tenant, severity);
      const isMissing = checkForMissing(notificationResult.html);
      assert.equal(isMissing, null, isMissing);
      assert.equal(notificationResult.error, null, notificationResult.error as string);
    });
  });
});

