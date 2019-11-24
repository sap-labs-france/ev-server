import moment from 'moment';
import NotificationHandler from '../../notification/NotificationHandler';
import UserStorage from '../../storage/mongodb/UserStorage';
import { CheckUserAccountInactivityTaskConfig } from '../../types/TaskConfig';
import Tenant from '../../types/Tenant';
import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import Utils from '../../utils/Utils';
import SchedulerTask from '../SchedulerTask';

export default class CheckUserAccountInactivityTask extends SchedulerTask {

  async processTenant(tenant: Tenant, config: CheckUserAccountInactivityTaskConfig): Promise<void> {
    try {
      // Compute the date some months ago
      const someMonthsAgo = moment().subtract(config.userAccountInactivityMonths, 'months').toDate();
      const params = { 'statuses': ['A'], 'noLoginSince': someMonthsAgo };
      // Get Users
      const users = await UserStorage.getUsers(tenant.id, params, Constants.DB_PARAMS_MAX_LIMIT);
      for (const user of users.result) {
        // Notification 
        moment.locale(user.locale);
        await NotificationHandler.sendUserAccountInactivity(
          tenant.id,
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
