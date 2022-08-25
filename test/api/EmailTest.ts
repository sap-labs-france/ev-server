import { NewRegisteredUserNotification, NotificationSeverity, RequestPasswordNotification } from '../../src/types/UserNotifications';

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

    it('request-password', async () => {
      data = {
        user,
        evseDashboardResetPassURL:'some_url',
        evseDashboardURL:'some_url2'
      } as RequestPasswordNotification;
      await emailNotificationTask.sendRequestPassword(data,user,tenant,severity);
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
  });
});

