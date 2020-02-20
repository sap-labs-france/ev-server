import SchedulerTask from '../SchedulerTask';
import { CheckSessionNotStartedAfterAuthorizeTaskConfig } from '../../types/TaskConfig';
import Tenant from '../../types/Tenant';
import moment = require('moment');
import Logging from '../../utils/Logging';
import NotificationHandler from '../../notification/NotificationHandler';
import Utils from '../../utils/Utils';
import TransactionStorage from '../../storage/mongodb/TransactionStorage';

export default class CheckSessionNotStartedAfterAuthorizeTask extends SchedulerTask {

  async processTenant(tenant: Tenant, config: CheckSessionNotStartedAfterAuthorizeTaskConfig): Promise<void> {
    try {
      // Compute the date some minutes ago
      const someMinutesAgo = moment().subtract(config.checkPastAuthorizeMins, 'minutes').toDate();
      const params = { 'authorizeDate': someMinutesAgo, 'sessionShouldBeStartedAfterMins': config.sessionShouldBeStartedAfterMins };
      // Get notification
      const notificationTransactionNotStarted = await TransactionStorage.getNotStartedTransactions(tenant.id, params);
      if (notificationTransactionNotStarted.result && notificationTransactionNotStarted.result.length > 0) {
        for (const notification of notificationTransactionNotStarted.result) {
          await NotificationHandler.sendSessionNotStarted(tenant.id, notification.tagID + '-' + notification.authDate.toString(), notification.chargingStation, {
            user: notification.user,
            chargeBoxID: notification.chargingStation.id,
            evseDashboardChargingStationURL: await Utils.buildEvseChargingStationURL(tenant.id, notification.chargingStation, '#all'),
            evseDashboardURL: Utils.buildEvseURL(tenant.subdomain)
          });
        }
      }
    } catch (error) {
      // Log error
      Logging.logActionExceptionMessage(tenant.id, 'CheckPreparingSessionNotStartedTask', error);
    }
  }
}
