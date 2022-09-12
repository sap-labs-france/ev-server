import { BillingAccountActivationNotification, BillingAccountCreationLinkNotification, BillingNewInvoiceNotification, ChargingStationRegisteredNotification, ChargingStationStatusErrorNotification, EndOfChargeNotification, EndOfSessionNotification, EndOfSignedSessionNotification, EndUserErrorNotification, NewRegisteredUserNotification, NotificationSeverity, OfflineChargingStationNotification, OptimalChargeReachedNotification, RequestPasswordNotification } from '../../src/types/UserNotifications';

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

    it('billing-new-invoice', async () => {
      data = {
        evseDashboardURL: 'some_url',
        evseDashboardInvoiceURL: 'some_url',
        user,
        invoiceDownloadUrl: 'some_url',
        payInvoiceUrl: 'some_url',
        invoiceNumber: '123123123',
        invoiceAmount: '1200',
        invoiceStatus: 'active',
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

    it('charging-station-charging-error', async () => {
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
      } as BillingAccountActivationNotification;
      await emailNotificationTask.sendBillingAccountActivationNotification(data,user,tenant,severity);
    });
  });
});

