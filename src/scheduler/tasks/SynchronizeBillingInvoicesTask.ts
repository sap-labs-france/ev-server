import BillingFactory from '../../integration/billing/BillingFactory';
import LockingHelper from '../../locking/LockingHelper';
import LockingManager from '../../locking/LockingManager';
import Logging from '../../utils/Logging';
import NotificationHandler from '../../notification/NotificationHandler';
import SchedulerTask from '../SchedulerTask';
import { ServerAction } from '../../types/Server';
import { TaskConfig } from '../../types/TaskConfig';
import Tenant from '../../types/Tenant';
import Utils from '../../utils/Utils';

export default class SynchronizeBillingInvoicesTask extends SchedulerTask {
  async processTenant(tenant: Tenant, config: TaskConfig): Promise<void> {
    // Get the lock
    const billingLock = await LockingHelper.createBillingSyncInvoicesLock(tenant.id);
    if (billingLock) {
      try {
        const billingImpl = await BillingFactory.getBillingImpl(tenant.id);
        if (billingImpl) {
          const synchronizeAction = await billingImpl.synchronizeInvoices(tenant.id);
          if (synchronizeAction.inError === 0) {
            await NotificationHandler.sendBillingInvoicesSynchronizationFailed(
              tenant.id,
              {
                nbrInvoicesInError: synchronizeAction.inError,
                evseDashboardURL: Utils.buildEvseURL(tenant.subdomain),
                evseDashboardBillingURL: await Utils.buildEvseBillingSettingsURL(tenant.id)
              }
            );
          }
        }
      } catch (error) {
        // Log error
        Logging.logActionExceptionMessage(tenant.id, ServerAction.BILLING_SYNCHRONIZE_INVOICES, error);
      } finally {
        // Release the lock
        await LockingManager.release(billingLock);
      }
    }
  }
}
