import { CheckUserAccountInactivityTaskConfig } from '../../types/TaskConfig';
import Constants from '../../utils/Constants';
import { LockEntity } from '../../types/Locking';
import LockingManager from '../../locking/LockingManager';
import Logging from '../../utils/Logging';
import NotificationHandler from '../../notification/NotificationHandler';
import { ServerAction } from '../../types/Server';
import Tenant from '../../types/Tenant';
import TenantSchedulerTask from '../TenantSchedulerTask';
import UserStorage from '../../storage/mongodb/UserStorage';
import Utils from '../../utils/Utils';
import moment from 'moment';

export default class CheckUserAccountInactivityTask extends TenantSchedulerTask {
  public async processTenant(tenant: Tenant, config: CheckUserAccountInactivityTaskConfig): Promise<void> {
    // Get the lock
    const accountInactivityLock = LockingManager.createExclusiveLock(tenant.id, LockEntity.USER, 'check-account-inactivity');
    if (await LockingManager.acquire(accountInactivityLock)) {
      try {
        // Compute the date some months ago
        const someMonthsAgo = moment().subtract(config.userAccountInactivityMonths, 'months').toDate();
        const params = {
          issuer: true,
          statuses: ['A'],
          noLoginSince: someMonthsAgo
        };
        // Get Users
        const users = await UserStorage.getUsers(tenant, params, Constants.DB_PARAMS_MAX_LIMIT);
        for (const user of users.result) {
          // Notification
          NotificationHandler.sendUserAccountInactivity(
            tenant,
            user,
            {
              user,
              lastLogin: moment(user.eulaAcceptedOn).locale(user.locale).format('LL'),
              evseDashboardURL: Utils.buildEvseURL(tenant.subdomain)
            }
          ).catch((error) => {
            Logging.logPromiseError(error, tenant?.id);
          });
        }
      } catch (error) {
        // Log error
        await Logging.logActionExceptionMessage(tenant.id, ServerAction.USER_ACCOUNT_INACTIVITY, error);
      } finally {
        // Release the lock
        await LockingManager.release(accountInactivityLock);
      }
    }
  }
}
