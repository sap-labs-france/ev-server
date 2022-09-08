import { ChargingStationStatusErrorNotification, EndOfChargeNotification, EndOfSessionNotification, EndOfSignedSessionNotification, NewRegisteredUserNotification, NotificationSeverity, OptimalChargeReachedNotification, RequestPasswordNotification } from '../../src/types/UserNotifications';

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

    it('Optimal Charge Reached', async () => {
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

    it('End of Charge', async () => {
      data = {
        transactionId: 1,
        siteID: '',
        siteAreaID: 'site area id',
        companyID: 'company id',
        chargeBoxID: 'charing box id',
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

    it('End of Session', async () => {
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

    // it('End Of Signed Session', async () => {
    //   data = {
    //     user,
    //     alternateUser: user,
    //     transactionId: 1,
    //     chargeBoxID: 'charging box id',
    //     connectorId: 'connector id',
    //     tagId: 'tag id',
    //     startDate: 'start date',
    //     endDate: 'end date',
    //     meterStart: 'meter start',
    //     meterStop: 'meter stop',
    //     totalConsumption: 'total consumption',
    //     price: 1,
    //     relativeCost: 1,
    //     startSignedData: 'start signed data',
    //     endSignedData: 'end signed data',
    //     evseDashboardURL: 'some_url',
    //   } as EndOfSignedSessionNotification;
    //   await emailNotificationTask.sendEndOfSession(data,user,tenant,severity);
    // });
  });
});

