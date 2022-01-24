import BillingFactory from '../../integration/billing/BillingFactory';
import LockingHelper from '../../locking/LockingHelper';
import LockingManager from '../../locking/LockingManager';
import Logging from '../../utils/Logging';
import NotificationHandler from '../../notification/NotificationHandler';
import { ServerAction } from '../../types/Server';
import { TaskConfig } from '../../types/TaskConfig';
import Tenant from '../../types/Tenant';
import TenantSchedulerTask from '../TenantSchedulerTask';
import Utils from '../../utils/Utils';

export default class SynchronizeBillingUsersTask extends TenantSchedulerTask {
  public async processTenant(tenant: Tenant, config: TaskConfig): Promise<void> {
    // Get the lock
    const billingLock = await LockingHelper.acquireBillingSyncUsersLock(tenant.id);
    if (billingLock) {
      try {
        const billingImpl = await BillingFactory.getBillingImpl(tenant);
        if (billingImpl) {
          const synchronizeAction = await billingImpl.synchronizeUsers();
          if (synchronizeAction.inError > 0) {
            void NotificationHandler.sendBillingSynchronizationFailed(
              tenant,
              {
                nbrUsersInError: synchronizeAction.inError,
                evseDashboardURL: Utils.buildEvseURL(tenant.subdomain),
                evseDashboardBillingURL: Utils.buildEvseBillingSettingsURL(tenant.subdomain)
              }
            );
          }
        }
      } catch (error) {
        // Log error
        await Logging.logActionExceptionMessage(tenant.id, ServerAction.BILLING_SYNCHRONIZE_USERS, error);
      } finally {
        // Release the lock
        await LockingManager.release(billingLock);
      }
    }
  }
}
