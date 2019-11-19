import moment from 'moment';
import Logging from '../../utils/Logging';
import SchedulerTask from '../SchedulerTask';
import { TaskConfig } from '../TaskConfig';
import Tenant from '../../types/Tenant';
import NotificationHandler from '../../notification/NotificationHandler';
import Utils from '../../utils/Utils';
import UserStorage from '../../storage/mongodb/UserStorage';
import _ from 'lodash';
import Constants from '../../utils/Constants';

export default class CheckUserAccountInactivityTask extends SchedulerTask {

  async processTenant(tenant: Tenant, config: TaskConfig): Promise<void> {
    try {
      Logging.logInfo({
        tenantID: tenant.id,
        module: 'CheckUserAccountInactivityTask',
        method: 'run', action: 'InactiveUsersNotification',
        message: 'The task \'CheckUserAccountInactivityTask\' is being run'
      });
      // Compute the date some months ago
      const someMonthsAgo = moment().subtract(config.userAccountInactivityMonths - 1, 'months').toDate().toISOString();
      const params= { 'statuses': ['A'], 'noLoginSince': someMonthsAgo };
      const users = await UserStorage.getUsers(tenant.id, params, Constants.DB_PARAMS_MAX_LIMIT);
      for(const user of users.result){
        // Notification 
        moment.locale(user.locale);
        const notificationId = user.id + new Date().toString();
        NotificationHandler.sendUserAccountInactivity(
          tenant.id,
          notificationId,
          user,
          {
            'user': user,
            'lastLogin': moment(user.eulaAcceptedOn).format('LL'),
            'evseDashboardURL': Utils.buildEvseURL(tenant.subdomain)
          }
        );
      }
    } catch (error) {
      // Log error
      Logging.logActionExceptionMessage(tenant.id, 'CheckUserAccountInactivityTask', error);
    }
  }
}

