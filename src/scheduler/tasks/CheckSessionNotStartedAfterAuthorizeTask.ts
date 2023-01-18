import { CheckSessionNotStartedAfterAuthorizeTaskConfig } from '../../types/TaskConfig';
import { LockEntity } from '../../types/Locking';
import LockingManager from '../../locking/LockingManager';
import Logging from '../../utils/Logging';
import NotificationHandler from '../../notification/NotificationHandler';
import { ServerAction } from '../../types/Server';
import Tenant from '../../types/Tenant';
import TenantSchedulerTask from '../TenantSchedulerTask';
import TransactionStorage from '../../storage/mongodb/TransactionStorage';
import Utils from '../../utils/Utils';

export default class CheckSessionNotStartedAfterAuthorizeTask extends TenantSchedulerTask {
  public async processTenant(tenant: Tenant, config: CheckSessionNotStartedAfterAuthorizeTaskConfig): Promise<void> {
    // Get the lock
    const sessionNotStartedLock = LockingManager.createExclusiveLock(tenant.id, LockEntity.CHARGING_STATION, 'session-not-started-after-authorize');
    if (await LockingManager.acquire(sessionNotStartedLock)) {
      try {
        // Get notification
        const notificationTransactionNotStarted = await TransactionStorage.getNotStartedTransactions(tenant, {
          'checkPastAuthorizeMins': config.checkPastAuthorizeMins,
          'sessionShouldBeStartedAfterMins': config.sessionShouldBeStartedAfterMins
        });
        if (notificationTransactionNotStarted.result && notificationTransactionNotStarted.result.length > 0) {
          for (const notification of notificationTransactionNotStarted.result) {
            NotificationHandler.sendTransactionNotStarted(tenant,
              `${notification.tagID}-${notification.authDate.toString()}`,
              notification.chargingStation, {
                user: notification.user,
                chargeBoxID: notification.chargingStation.id,
                siteID: notification.chargingStation.siteID,
                siteAreaID: notification.chargingStation.siteAreaID,
                companyID: notification.chargingStation.companyID,
                evseDashboardChargingStationURL: Utils.buildEvseChargingStationURL(tenant.subdomain, notification.chargingStation, '#all'),
                evseDashboardURL: Utils.buildEvseURL(tenant.subdomain)
              }).catch((error) => {
              Logging.logPromiseError(error, tenant?.id);
            });
          }
        }
      } catch (error) {
        // Log error
        await Logging.logActionExceptionMessage(tenant.id, ServerAction.PREPARING_SESSION_NOT_STARTED, error);
      } finally {
        // Release the lock
        await LockingManager.release(sessionNotStartedLock);
      }
    }
  }
}
