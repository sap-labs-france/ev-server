import { AccountVerificationNotification, AdminAccountVerificationNotification, BillingAccountActivationNotification, BillingAccountCreationLinkNotification, BillingInvoiceSynchronizationFailedNotification, BillingNewInvoiceNotification, BillingPeriodicOperationFailedNotification, BillingUserSynchronizationFailedNotification, CarCatalogSynchronizationFailedNotification, ChargingStationRegisteredNotification, ChargingStationStatusErrorNotification, ComputeAndApplyChargingProfilesFailedNotification, EndOfChargeNotification, EndOfSessionNotification, EndOfSignedSessionNotification, EndUserErrorNotification, NewRegisteredUserNotification, NotificationSeverity, OCPIPatchChargingStationsStatusesErrorNotification, OICPPatchChargingStationsErrorNotification, OICPPatchChargingStationsStatusesErrorNotification, OfflineChargingStationNotification, OptimalChargeReachedNotification, PreparingSessionNotStartedNotification, RequestPasswordNotification, SessionNotStartedNotification, TransactionStartedNotification, UnknownUserBadgedNotification, UserAccountInactivityNotification, UserAccountStatusChangedNotification, UserCreatePassword, VerificationEmailNotification } from '../../src/types/UserNotifications';
import User, { UserStatus } from '../../src/types/User';

import ContextDefinition from './context/ContextDefinition';
import ContextProvider from './context/ContextProvider';
import EMailNotificationTask from '../../src/notification/email/EMailNotificationTask';
import I18nManager from '../../src/utils/I18nManager';
import MongoDBStorage from '../../src/storage/mongodb/MongoDBStorage';
import Tenant from '../../src/types/Tenant';
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

    beforeAll(async () => {
      const tenantContext = await ContextProvider.defaultInstance.getTenantContext(ContextDefinition.TENANT_CONTEXTS.TENANT_WITH_ALL_COMPONENTS);
      user = tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN);
      tenant = tenantContext.getTenant();
    });
    it('new-registered-user', async () => {
      const data = {
        tenant: tenant.subdomain,
        user,
        evseDashboardURL: 'some_url',
        evseDashboardVerifyEmailURL: 'some_url',
      } as NewRegisteredUserNotification;
      await emailNotificationTask.sendNewRegisteredUser(data,user,tenant,severity);
    });

    it('request-password', async () => {
      const data = {
        user,
        evseDashboardResetPassURL:'some_url',
        evseDashboardURL:'some_url2'
      } as RequestPasswordNotification;
      await emailNotificationTask.sendRequestPassword(data,user,tenant,severity);
    });

    it('optimal-charge-reached', async () => {
      const data = {
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
      const data = {
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
      const data = {
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
      const data = {
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
      const data = {
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
      const data = {
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
      const data = {
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
      const data = {
        chargeBoxIDs: 'some box id',
        evseDashboardURL: 'some_url',
      } as OfflineChargingStationNotification;
      await emailNotificationTask.sendOfflineChargingStations(data,user,tenant,severity);
    });

    it('charging-station-status-error', async () => {
      const data = {
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
      const data: BillingAccountCreationLinkNotification = {
        evseDashboardURL: 'some_url',
        user,
        onboardingLink:  'some_url',
      };
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
      const data: UserAccountStatusChangedNotification = {
        user,
        evseDashboardURL: 'some_url',
      };
      await emailNotificationTask.sendUserAccountStatusChanged(data,user,tenant,severity);
    });

    it('unknown-user-badged', async () => {
      const data: UnknownUserBadgedNotification = {
        chargeBoxID: 'charge box id',
        siteID: 'site id',
        siteAreaID: 'site area id',
        companyID: 'company id',
        badgeID: 'badge id',
        evseDashboardURL: 'some_url',
      };
      await emailNotificationTask.sendUnknownUserBadged(data,user,tenant,severity);
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
        evseDashboardURL: 'some_url',
        evseDashboardChargingStationURL: 'some_url',
      };
      await emailNotificationTask.sendSessionStarted(data,user,tenant,severity);
    });

    it('verification-email', async () => {
      const data: VerificationEmailNotification = {
        user,
        tenantName: 'tenant name',
        evseDashboardURL: 'some_url',
        evseDashboardVerifyEmailURL: 'some_url',
      };
      await emailNotificationTask.sendVerificationEmail(data,user,tenant,severity);
    });

    it('verification-email-user-import', async () => {
      const data: VerificationEmailNotification = {
        user,
        tenantName: 'tenant name',
        evseDashboardURL: 'some_url',
        evseDashboardVerifyEmailURL: 'some_url',
      };
      await emailNotificationTask.sendVerificationEmailUserImport(data,user,tenant,severity);
    });

    it('ocpi-patch-status-error', async () => {
      const data: OCPIPatchChargingStationsStatusesErrorNotification = {
        evseDashboardURL: 'some_url',
        location: 'location'
      };
      await emailNotificationTask.sendOCPIPatchChargingStationsStatusesError(data,user,tenant,severity);
    });

    it('oicp-patch-status-error', async () => {
      const data: OICPPatchChargingStationsStatusesErrorNotification = {
        evseDashboardURL: 'some_url',
      };
      await emailNotificationTask.sendOICPPatchChargingStationsStatusesError(data,user,tenant,severity);
    });

    it('oicp-patch-evses-error', async () => {
      const data: OICPPatchChargingStationsErrorNotification = {
        evseDashboardURL: 'some_url',
      };
      await emailNotificationTask.sendOICPPatchChargingStationsError(data,user,tenant,severity);
    });

    it('user-account-inactivity', async () => {
      const data: UserAccountInactivityNotification = {
        user,
        lastLogin: 'last login',
        evseDashboardURL: 'some_url',
      };
      await emailNotificationTask.sendUserAccountInactivity(data,user,tenant,severity);
    });

    it('session-not-started', async () => {
      const data = {
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
      const data = {
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
      const data: BillingUserSynchronizationFailedNotification = {
        nbrUsersInError: 123,
        evseDashboardURL: 'some_url',
        evseDashboardBillingURL: 'some_url',
      };
      await emailNotificationTask.sendBillingSynchronizationFailed(data,user,tenant,severity);
    });

    it('billing-invoice-synchronization-failed', async () => {
      const data: BillingInvoiceSynchronizationFailedNotification = {
        nbrInvoicesInError: 123,
        evseDashboardURL: 'some_url',
        evseDashboardBillingURL: 'some_url',
      } ;
      await emailNotificationTask.sendBillingInvoiceSynchronizationFailed(data,user,tenant,severity);
    });

    it('billing-periodic-operation-failed', async () => {
      const data: BillingPeriodicOperationFailedNotification = {
        nbrInvoicesInError: 123,
        evseDashboardURL: 'some_url',
        evseDashboardBillingURL: 'some_url',
      };
      await emailNotificationTask.sendBillingPeriodicOperationFailed(data,user,tenant,severity);
    });

    it('billing-account-activated', async () => {
      const data: BillingAccountActivationNotification = {
        evseDashboardURL: 'some_url',
        user,
      };
      await emailNotificationTask.sendBillingAccountActivationNotification(data,user,tenant,severity);
    });

    it('car-synchronization-failed', async () => {
      const data : CarCatalogSynchronizationFailedNotification = {
        nbrCarsInError: 10,
        evseDashboardURL: 'some_url',
      };
      await emailNotificationTask.sendCarCatalogSynchronizationFailed(data,user,tenant,severity);
    });

    it('compute-and-apply-charging-profiles-failed', async () => {
      const data: ComputeAndApplyChargingProfilesFailedNotification = {
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
      const data: AccountVerificationNotification = {
        user,
        userStatus: UserStatus.ACTIVE,
        evseDashboardURL: 'some_url',
      };
      await emailNotificationTask.sendAccountVerificationNotification(data,user,tenant,severity);
    });

    it('admin-account-verification-notification', async () => {
      const data: AdminAccountVerificationNotification = {
        user,
        evseDashboardURL: 'some_url',
        evseUserToVerifyURL: 'some_url',
      };
      await emailNotificationTask.sendAdminAccountVerificationNotification(data,user,tenant,severity);
    });

    it('user-create-password', async () => {
      const data: UserCreatePassword = {
        user,
        tenantName: 'tenant name',
        evseDashboardURL: 'some_url',
        evseDashboardCreatePasswordURL: 'some_url',
      };
      await emailNotificationTask.sendUserCreatePassword(data,user,tenant,severity);
    });
  });
});

