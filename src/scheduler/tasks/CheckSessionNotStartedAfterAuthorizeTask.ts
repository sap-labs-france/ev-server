import NotificationHandler from '../../notification/NotificationHandler';
import TransactionStorage from '../../storage/mongodb/TransactionStorage';
import { CheckSessionNotStartedAfterAuthorizeTaskConfig } from '../../types/TaskConfig';
import Tenant from '../../types/Tenant';
import Logging from '../../utils/Logging';
import Utils from '../../utils/Utils';
import SchedulerTask from '../SchedulerTask';

export default class CheckSessionNotStartedAfterAuthorizeTask extends SchedulerTask {

  async processTenant(tenant: Tenant, config: CheckSessionNotStartedAfterAuthorizeTaskConfig): Promise<void> {
    try {
      // Get notification
      const notificationTransactionNotStarted = await TransactionStorage.getNotStartedTransactions(tenant.id, {
        'checkPastAuthorizeMins': config.checkPastAuthorizeMins,
        'sessionShouldBeStartedAfterMins': config.sessionShouldBeStartedAfterMins
      });
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
