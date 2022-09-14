import { AccountVerificationNotification, AdminAccountVerificationNotification, BillingAccountActivationNotification, BillingAccountCreationLinkNotification, BillingInvoiceSynchronizationFailedNotification, BillingNewInvoiceNotification, BillingPeriodicOperationFailedNotification, BillingUserSynchronizationFailedNotification, CarCatalogSynchronizationFailedNotification, ChargingStationRegisteredNotification, ChargingStationStatusErrorNotification, ComputeAndApplyChargingProfilesFailedNotification, EndOfChargeNotification, EndOfSessionNotification, EndOfSignedSessionNotification, EndUserErrorNotification, NewRegisteredUserNotification, NotificationSeverity, OCPIPatchChargingStationsStatusesErrorNotification, OICPPatchChargingStationsErrorNotification, OICPPatchChargingStationsStatusesErrorNotification, OfflineChargingStationNotification, OptimalChargeReachedNotification, PreparingSessionNotStartedNotification, RequestPasswordNotification, SessionNotStartedNotification, TransactionStartedNotification, UnknownUserBadgedNotification, UserAccountInactivityNotification, UserAccountStatusChangedNotification, UserCreatePassword, VerificationEmailNotification } from '../../src/types/UserNotifications';

import ContextDefinition from './context/ContextDefinition';
import ContextProvider from './context/ContextProvider';
import EMailNotificationTask from '../../src/notification/email/EMailNotificationTask';
import I18nManager from '../../src/utils/I18nManager';
import MongoDBStorage from '../../src/storage/mongodb/MongoDBStorage';
import Tenant from '../../src/types/Tenant';
import User from '../../src/types/User';
import chai from 'chai';
import chaiSubset from 'chai-subset';
import config from '../config';
import global from '../../src/types/GlobalType';
import responseHelper from '../helpers/responseHelper';

chai.use(chaiSubset);
chai.use(responseHelper);

describe('Initialization', () => {
  jest.setTimeout(9990000);

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
    let user : User;
    let tenant : Tenant;
    const severity = 'INFO' as NotificationSeverity;

    let data: any;
    beforeAll(async () => {
      const tenantContext = await ContextProvider.defaultInstance.getTenantContext(ContextDefinition.TENANT_CONTEXTS.TENANT_WITH_ALL_COMPONENTS);
      user = tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN);
      tenant = tenantContext.getTenant();
    });
    it('new-registered-user', async () => {
      data = {
        tenant: tenant.subdomain,
        user,
        evseDashboardURL: 'some_url',
        evseDashboardVerifyEmailURL: 'some_url',
      } as NewRegisteredUserNotification;
      await emailNotificationTask.sendNewRegisteredUser(data,user,tenant,severity);
    });

    it('request-password', async () => {
      data = {
        user,
        evseDashboardResetPassURL:'some_url',
        evseDashboardURL:'some_url2'
      } as RequestPasswordNotification;
      await emailNotificationTask.sendRequestPassword(data,user,tenant,severity);
    });

    it('optimal-charge-reached', async () => {
      data = {
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
        evseDashboardURL: 'some_url',
      } as OptimalChargeReachedNotification;
      await emailNotificationTask.sendOptimalChargeReached(data,user,tenant,severity);
    });

    it('end-of-charge', async () => {
      data = {
        transactionId: 1,
        siteID: '',
        siteAreaID: 'site area id',
        companyID: 'company id',
        chargeBoxID: 'charging box id',
        connectorId: 'connector id',
        totalConsumption: '48.3',
        stateOfCharge: 1,
        totalDuration: '5h14',
        evseDashboardChargingStationURL: 'some_url',
        user,
        evseDashboardURL: 'some_url',
      } as EndOfChargeNotification;
      await emailNotificationTask.sendEndOfCharge(data,user,tenant,severity);
    });

    it('end-of-session', async () => {
      data = {
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
        tenant: tenant.subdomain,
        user,
        alternateUser: user,
        evseDashboardURL: 'some_url',
        evseDashboardChargingStationURL: 'charging station url',
      } as EndOfSessionNotification;
      await emailNotificationTask.sendEndOfSession(data,user,tenant,severity);
    });

    it('billing-new-invoice-paid', async () => {
      data = {
        evseDashboardURL: 'some_url',
        evseDashboardInvoiceURL: 'some_url',
        user,
        invoiceDownloadUrl: 'some_url',
        payInvoiceUrl: 'some_url',
        invoiceNumber: '123123123',
        invoiceAmount: '1200',
        invoiceStatus: 'paid',
      } as BillingNewInvoiceNotification;
      await emailNotificationTask.sendBillingNewInvoice(data,user,tenant,severity);
    });

    it('billing-new-invoice-unpaid', async () => {
      data = {
        evseDashboardURL: 'some_url',
        evseDashboardInvoiceURL: 'some_url',
        user,
        invoiceDownloadUrl: 'some_url',
        payInvoiceUrl: 'https://open-e-mobility.io/',
        invoiceNumber: '123123123',
        invoiceAmount: '1200',
        invoiceStatus: 'unpaid',
      } as BillingNewInvoiceNotification;
      await emailNotificationTask.sendBillingNewInvoice(data,user,tenant,severity);
    });

    it('charging-station-registered', async () => {
      data = {
        chargeBoxID: 'Charge Box A1',
        siteID: 'Site 134',
        siteAreaID: 'A3',
        companyID: 'SAP12',
        evseDashboardURL: 'some_url',
        evseDashboardChargingStationURL: 'some_url',
      } as ChargingStationRegisteredNotification;
      await emailNotificationTask.sendChargingStationRegistered(data,user,tenant,severity);
    });

    it('end-user-error-notification', async () => {
      data = {
        userID: 'some user id',
        email: 'email',
        name: 'name',
        errorTitle: 'error title',
        errorDescription: 'description',
        phone: '123123123',
        evseDashboardURL: 'some_url',
      } as EndUserErrorNotification;
      await emailNotificationTask.sendEndUserErrorNotification(data,user,tenant,severity);
    });

    it('offline-charging-station', async () => {
      data = {
        chargeBoxIDs: 'some box id',
        evseDashboardURL: 'some_url',
      } as OfflineChargingStationNotification;
      await emailNotificationTask.sendOfflineChargingStations(data,user,tenant,severity);
    });

    it('charging-station-status-error', async () => {
      data = {
        chargeBoxID: 'some box id',
        siteID: 'site id',
        siteAreaID: 'site area id',
        companyID: 'company id',
        connectorId: 'connector id',
        error: 'this is the error',
        evseDashboardURL: 'some_url',
        evseDashboardChargingStationURL: 'some_url',
      } as ChargingStationStatusErrorNotification;
      await emailNotificationTask.sendChargingStationStatusError(data,user,tenant,severity);
    });

    it('billing-account-created', async () => {
      data = {
        evseDashboardURL: 'some_url',
        user,
      } as BillingAccountCreationLinkNotification;
      await emailNotificationTask.sendBillingAccountCreationLink(data,user,tenant,severity);
    });

    // it('end-of-signed-session', async () => {
    //   data = {
    //     user,
    //     alternateUser: user,
    //     transactionId: 10,
    //     chargeBoxID: 'charge box id',
    //     connectorId: 'connector id',
    //     tagId: 'tag id',
    //     startDate: 'start date',
    //     endDate: 'end date',
    //     meterStart: 'meter date',
    //     meterStop: 'meter stop',
    //     totalConsumption: 'total consumption',
    //     price:10,
    //     relativeCost: 10,
    //     startSignedData: 'start signed date',
    //     endSignedData: 'end signed date',
    //     evseDashboardURL: 'some_url',
    //   } as EndOfSignedSessionNotification;
    //   await emailNotificationTask.sendEndOfSignedSession(data,user,tenant,severity);
    // });

    it('user-account-status-changed', async () => {
      data = {
        user,
        evseDashboardURL: 'some_url',
      } as UserAccountStatusChangedNotification;
      await emailNotificationTask.sendUserAccountStatusChanged(data,user,tenant,severity);
    });

    it('unknown-user-badged', async () => {
      data = {
        chargeBoxID: 'charge box id',
        siteID: 'site id',
        siteAreaID: 'site area id',
        companyID: 'company id',
        badgeID: 'badge id',
        evseDashboardURL: 'some_url',
      } as UnknownUserBadgedNotification;
      await emailNotificationTask.sendUnknownUserBadged(data,user,tenant,severity);
    });

    it('session-started', async () => {
      data = {
        user,
        transactionId: 14,
        siteID: 'site id',
        siteAreaID: 'site area id',
        companyID: 'company id',
        chargeBoxID: 'charge box id',
        connectorId: 'connector id',
        evseDashboardURL: 'some_url',
        evseDashboardChargingStationURL: 'some_url',
      } as TransactionStartedNotification;
      await emailNotificationTask.sendSessionStarted(data,user,tenant,severity);
    });

    it('verification-email', async () => {
      data = {
        user,
        tenantName: 'tenant name',
        evseDashboardURL: 'some_url',
        evseDashboardVerifyEmailURL: 'some_url',
      } as VerificationEmailNotification;
      await emailNotificationTask.sendVerificationEmail(data,user,tenant,severity);
    });

    it('verification-email-user-import', async () => {
      data = {
        user,
        tenantName: 'tenant name',
        evseDashboardURL: 'some_url',
        evseDashboardVerifyEmailURL: 'some_url',
      } as VerificationEmailNotification;
      await emailNotificationTask.sendVerificationEmailUserImport(data,user,tenant,severity);
    });

    it('ocpi-patch-status-error', async () => {
      data = {
        evseDashboardURL: 'some_url',
        location: 'location'
      } as OCPIPatchChargingStationsStatusesErrorNotification;
      await emailNotificationTask.sendOCPIPatchChargingStationsStatusesError(data,user,tenant,severity);
    });

    it('oicp-patch-status-error', async () => {
      data = {
        evseDashboardURL: 'some_url',
        location: 'location',
      } as OICPPatchChargingStationsStatusesErrorNotification;
      await emailNotificationTask.sendOICPPatchChargingStationsStatusesError(data,user,tenant,severity);
    });

    it('oicp-patch-evses-error', async () => {
      data = {
        evseDashboardURL: 'some_url',
      } as OICPPatchChargingStationsErrorNotification;
      await emailNotificationTask.sendOICPPatchChargingStationsError(data,user,tenant,severity);
    });

    it('user-account-inactivity', async () => {
      data = {
        user,
        lastLogin: 'last login',
        evseDashboardURL: 'some_url',
      } as UserAccountInactivityNotification;
      await emailNotificationTask.sendUserAccountInactivity(data,user,tenant,severity);
    });

    it('session-not-started', async () => {
      data = {
        user,
        chargeBoxID :'charge box id',
        siteID: 'site id',
        siteAreaID: 'site area id',
        companyID: 'company id',
        connectorId: 'connector id',
        startedOn: 'started on',
        evseDashboardURL: 'some_url',
        evseDashboardChargingStationURL: 'some_url',
      } as PreparingSessionNotStartedNotification;
      await emailNotificationTask.sendPreparingSessionNotStarted(data,user,tenant,severity);
    });

    it('session-not-started-after-authorize', async () => {
      data = {
        chargeBoxID: 'charge box id',
        siteID: 'site id',
        siteAreaID: 'site area id',
        companyID: 'company id',
        user,
        evseDashboardURL: 'some_url',
        evseDashboardChargingStationURL: 'some_url',
      } as SessionNotStartedNotification;
      await emailNotificationTask.sendSessionNotStarted(data,user,tenant,severity);
    });

    it('billing-user-synchronization-failed', async () => {
      data = {
        nbrUsersInError: 123,
        evseDashboardURL: 'some_url',
        evseDashboardBillingURL: 'some_url',
      } as BillingUserSynchronizationFailedNotification;
      await emailNotificationTask.sendBillingInvoiceSynchronizationFailed(data,user,tenant,severity);
    });

    it('billing-invoice-synchronization-failed', async () => {
      data = {
        nbrInvoicesInError: 123,
        evseDashboardURL: 'some_url',
        evseDashboardBillingURL: 'some_url',
      } as BillingInvoiceSynchronizationFailedNotification;
      await emailNotificationTask.sendBillingInvoiceSynchronizationFailed(data,user,tenant,severity);
    });

    it('billing-periodic-operation-failed', async () => {
      data = {
        nbrInvoicesInError: 123,
        evseDashboardURL: 'some_url',
        evseDashboardBillingURL: 'some_url',
      } as BillingPeriodicOperationFailedNotification;
      await emailNotificationTask.sendBillingPeriodicOperationFailed(data,user,tenant,severity);
    });

    it('billing-account-activated', async () => {
      data = {
        evseDashboardURL: 'some_url',
        user,
      } as BillingAccountActivationNotification;
      await emailNotificationTask.sendBillingAccountActivationNotification(data,user,tenant,severity);
    });

    it('car-synchronization-failed', async () => {
      data = {
        nbrCarsInError: 10,
        evseDashboardURL: 'some_url',
      } as CarCatalogSynchronizationFailedNotification;
      await emailNotificationTask.sendCarCatalogSynchronizationFailed(data,user,tenant,severity);
    });

    it('compute-and-apply-charging-profiles-failed', async () => {
      data = {
        siteAreaName: 'site area name',
        chargeBoxID: 'charge box id',
        siteID: 'site id',
        siteAreaID: 'site area id',
        companyID: 'company id',
        evseDashboardURL: 'some_url',
      } as ComputeAndApplyChargingProfilesFailedNotification;
      await emailNotificationTask.sendComputeAndApplyChargingProfilesFailed(data,user,tenant,severity);
    });

    it('account-verification-notification', async () => {
      data = {
        user,
        userStatus: 'A',
        evseDashboardURL: 'some_url',
      } as AccountVerificationNotification;
      await emailNotificationTask.sendAccountVerificationNotification(data,user,tenant,severity);
    });

    it('admin-account-verification-notification', async () => {
      data = {
        user,
        evseDashboardURL: 'some_url',
        evseUserToVerifyURL: 'some_url',
      } as AdminAccountVerificationNotification;
      await emailNotificationTask.sendAdminAccountVerificationNotification(data,user,tenant,severity);
    });

    it('user-create-password', async () => {
      data = {
        user,
        tenantName: 'tenant name',
        evseDashboardURL: 'some_url',
        evseDashboardCreatePasswordURL: 'some_url',
      } as UserCreatePassword;
      await emailNotificationTask.sendUserCreatePassword(data,user,tenant,severity);
    });
  });
});

