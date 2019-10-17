import moment from 'moment';
import Logging from '../../utils/Logging';
import SchedulerTask from '../SchedulerTask';
import { TaskConfig } from '../TaskConfig';
import Tenant from '../../types/Tenant';
import UserStorage from '../../storage/mongodb/UserStorage';
import NotificationHandler from '../../notification/NotificationHandler';
import Utils from '../../utils/Utils';

const INACTIVITY_LIMIT = 5; // Threshold of nbr of months with no login

export default class NotifyUsersInactiveSinceTask extends SchedulerTask {
  async processTenant(tenant: Tenant, config: TaskConfig): Promise<void> {
    try {
      Logging.logInfo({
        tenantID: tenant.id,
        module: 'NotifyUsersInactiveSinceTask',
        method: 'run', action: 'InactiveUsersNotification',
        message: 'The task \'NotifyUsersInactiveSinceTask\' is being run'
      });
      // Compute the date some months ago
      const someMonthsAgo = moment().subtract(INACTIVITY_LIMIT, 'months').toDate().toISOString();
      const params= { 'statuses': ['A'], 'noLoginSince': someMonthsAgo };
      const users = await UserStorage.getUsersInactiveSince(tenant.id, params);
      for(const user of users){
        // Notification 
        moment.locale(user.locale);
        NotificationHandler.sendUserInactivityLimitReached(
          tenant.id,
          user,
          {
            'user': user,
            'lastLogin': moment(user.lastLogin).format('LL'),
            'evseDashboardURL': Utils.buildEvseURL(tenant.subdomain)
          },
          user.locale
        );
      }
    } catch (error) {
      // Log error
      Logging.logActionExceptionMessage(tenant.id, 'NotifyUsersInactiveSinceTask', error);
    }
  }
}

