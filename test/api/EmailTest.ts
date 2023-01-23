import { AccountVerificationNotification, AdminAccountVerificationNotification, BillingAccountActivationNotification, BillingAccountCreationLinkNotification, BillingInvoiceSynchronizationFailedNotification, BillingNewInvoiceNotification, BillingPeriodicOperationFailedNotification, BillingUserSynchronizationFailedNotification, CarCatalogSynchronizationFailedNotification, ChargingStationRegisteredNotification, ChargingStationStatusErrorNotification, ComputeAndApplyChargingProfilesFailedNotification, EndOfChargeNotification, EndOfSessionNotification, EndOfSignedSessionNotification, EndUserErrorNotification, NewRegisteredUserNotification, NotificationSeverity, OCPIPatchChargingStationsStatusesErrorNotification, OICPPatchChargingStationsErrorNotification, OICPPatchChargingStationsStatusesErrorNotification, OfflineChargingStationNotification, OptimalChargeReachedNotification, PreparingSessionNotStartedNotification, RequestPasswordNotification, SessionNotStartedNotification, TransactionStartedNotification, UnknownUserBadgedNotification, UserAccountInactivityNotification, UserAccountStatusChangedNotification, UserCreatePassword, VerificationEmailNotification } from '../../src/types/UserNotifications';
import User, { UserStatus } from '../../src/types/User';
import chai, { assert } from 'chai';

import BrandingConstants from '../../src/utils/BrandingConstants';
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
  jest.setTimeout(60000);

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
    const transactionId = 123456789;
    const connectorId = 'A';
    const companyID = ContextDefinition.TENANT_COMPANY_LIST[0].id;
    const siteID = ContextDefinition.TENANT_SITE_LIST[0].id;
    const siteAreaID = ContextDefinition.TENANT_SITEAREA_LIST[0].id;
    const chargeBoxID = 'BORNE-1234';
    const badgeID = 'AB123456';
    const severity = 'INFO' as NotificationSeverity;

    beforeAll(async () => {
      const tenantContext = await ContextProvider.defaultInstance.getTenantContext(ContextDefinition.TENANT_CONTEXTS.TENANT_WITH_ALL_COMPONENTS);
      // Set the recipient
      recipient = Utils.cloneObject(tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN));
      recipient.firstName = 'Kaito (怪盗)';
      recipient.name = '(怪盗) Kaito';
      recipient.locale = 'fr_FR';
      // Set the user mentioned in the body of the mail
      user = Utils.cloneObject(tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.BASIC_USER));
      user.phone = '+33 6 12 34 56 78';
      user.locale = 'fr_FR';
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
        transactionId,
        companyID,
        siteID,
        siteAreaID,
        chargeBoxID,
        connectorId,
        totalConsumption: '16.32',
        stateOfCharge: 89,
        evseDashboardChargingStationURL: BrandingConstants.OPEN_EMOBILITY_WEBSITE_URL,
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
        siteID,
        siteAreaID,
        companyID,
        chargeBoxID,
        connectorId,
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
        siteID,
        siteAreaID,
        companyID,
        chargeBoxID,
        connectorId,
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

    it('end-of-signed-session', async () => {
      const data: EndOfSignedSessionNotification = {
        transactionId: 1112233445566,
        chargeBoxID,
        connectorId,
        user,
        alternateUser: user,
        evseDashboardURL: BrandingConstants.OPEN_EMOBILITY_WEBSITE_URL,
        evseDashboardChargingStationURL: BrandingConstants.OPEN_EMOBILITY_WEBSITE_URL,
        tagId: '1234567890ABCDE',
        startDate: new Date().toString(),
        endDate: new Date().toString(),
        meterStart: '5437080',
        meterStop: '5447190',
        totalConsumption: '10110',
        price: 0,
        relativeCost: 0,
        startSignedData: 'OCMF|{"FV": "1.0", "GI": "ChargeX Messkapsel 1.0", "GS": "ESVFL915WH52", "GV": "1.2", "PG": "T53", "MV": "ChargeX", "IS": "true", "IT": "ISO14443", "ID": "8421A3EE", "CT": "CBIDC", "CI": "72ABHJLHYY568SEJ 2", "RD": [{"TM": "2022-07-25T08:37:19.962+00:00 S", "TX": "B", "RV": 543.708, "RI": "1-b:1.8.e", "RU": "kWh", "EF": "", "ST": "G"}]}|{"SA": "ECDSA-secp192k1-SHA256", "SD": "MDUCGH0gEwvhKU8n0x36wWszmForuqEP7EcBHQIZAJ70dXSN732qKgEikBNp/5fcQyuk/uzGZQ==", "SE": "base64"}',
        endSignedData: 'OCMF|{"FV": "1.0", "GI": "ChargeX Messkapsel 1.0", "GS": "ESVFL915WH52", "GV": "1.2", "PG": "T54", "MV": "ChargeX", "IS": "true", "IT": "ISO14443", "ID": "8421A3EE", "CT": "CBIDC", "CI": "72ABHJLHYY568SEJ 2", "RD": [{"TM": "2022-07-25T08:45:38.425+00:00 S", "TX": "E", "RV": 544.719, "RI": "1-b:1.8.e", "RU": "kWh", "EF": "", "ST": "G"}]}|{"SA": "ECDSA-secp192k1-SHA256", "SD": "MDQCGFR9euJ/yXiVmefh6pzRX2avXxlrUT63kAIYY/OVK4Z/myHHHeAzbz7/U5Uy/FuZpMf8", "SE": "base64"}',
      };
      const notificationResult = await emailNotificationTask.sendEndOfSignedSession(data, recipient, tenant, severity);
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
        chargeBoxID,
        siteID,
        siteAreaID,
        companyID,
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

    it('end-user-js-injection', async () => {
      const data: EndUserErrorNotification = {
        userID: user.id,
        email: user.email,
        name: user.firstName + ' ' + user.name,
        errorTitle: 'Check Javascript Injection',
        errorDescription: 'javascript:alert("this is an injection");',
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
        chargeBoxID,
        siteID,
        siteAreaID,
        companyID,
        connectorId,
        error: 'This is the text from the end user',
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
        chargeBoxID,
        siteID,
        siteAreaID,
        companyID,
        badgeID,
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
        siteID,
        siteAreaID,
        companyID,
        chargeBoxID,
        connectorId,
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
        chargeBoxID,
        siteID,
        siteAreaID,
        companyID,
        connectorId,
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
        chargeBoxID,
        siteID,
        siteAreaID,
        companyID,
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
        siteAreaName: 'Parking North',
        chargeBoxID,
        siteID,
        siteAreaID,
        companyID,
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

