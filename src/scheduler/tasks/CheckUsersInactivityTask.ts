import moment from 'moment';
import Logging from '../../utils/Logging';
import SchedulerTask from '../SchedulerTask';
import { TaskConfig } from '../TaskConfig';
import Tenant from '../../types/Tenant';
import ChargingStationStorage from '../../storage/mongodb/ChargingStationStorage';
import NotificationHandler from '../../notification/NotificationHandler';
import Utils from '../../utils/Utils';
import UserStorage from '../../storage/mongodb/UserStorage';
import _ from 'lodash';
import { Subtasks } from '../../types/configuration/SchedulerConfiguration';
import Constants from '../../utils/Constants';

export default class CheckUsersInactivityTask extends SchedulerTask {

  async processTenant(tenant: Tenant, config: TaskConfig, subtasks: Subtasks[]): Promise<void> {
    try {
      Logging.logInfo({
        tenantID: tenant.id,
        module: 'CheckUsersInactivityTask',
        method: 'run', action: 'InactiveUsersNotification',
        message: 'The task \'CheckUsersInactivityTask\' is being run'
      });
      // Compute the date some months ago
      const someMonthsAgo = moment().subtract(Constants.TASK_INACTIVITY_THRESHOLD, 'months').toDate().toISOString();
      const params= { 'statuses': ['A'], 'noLoginSince': someMonthsAgo };
      const users = await UserStorage.getUsersInactiveSince(tenant.id, params);
      for(const user of users){
        // Notification 
        moment.locale(user.locale);
        const notificationId = user.id + new Date().toString();
        NotificationHandler.sendUserInactivityLimitReached(
          tenant.id,
          notificationId,
          user,
          {
            'user': user,
            'lastLogin': moment(user.lastLogin).format('LL'),
            'evseDashboardURL': Utils.buildEvseURL(tenant.subdomain)
          }
        );
      }
    } catch (error) {
      // Log error
      Logging.logActionExceptionMessage(tenant.id, 'CheckUsersInactivityTask', error);
    }
  }
}

