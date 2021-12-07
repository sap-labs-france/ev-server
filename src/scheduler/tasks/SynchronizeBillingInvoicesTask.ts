import BillingFactory from '../../integration/billing/BillingFactory';
import { BillingInvoiceSynchronizationTaskConfig } from '../../types/TaskConfig';
import LockingHelper from '../../locking/LockingHelper';
import LockingManager from '../../locking/LockingManager';
import Logging from '../../utils/Logging';
import NotificationHandler from '../../notification/NotificationHandler';
import SchedulerTask from '../SchedulerTask';
import { ServerAction } from '../../types/Server';
import Tenant from '../../types/Tenant';
import Utils from '../../utils/Utils';

export default class SynchronizeBillingInvoicesTask extends SchedulerTask {
  public async processTenant(tenant: Tenant, taskConfig: BillingInvoiceSynchronizationTaskConfig): Promise<void> {
    // Get the lock
    const billingLock = await LockingHelper.acquireBillingSyncInvoicesLock(tenant.id);
    if (billingLock) {
      try {
        const billingImpl = await BillingFactory.getBillingImpl(tenant);
        if (billingImpl) {
          // Synchronize new Invoices and Invoices changes
          const synchronizeActionResults = await billingImpl.synchronizeInvoices();
          if (synchronizeActionResults.inError > 0) {
            await NotificationHandler.sendBillingInvoicesSynchronizationFailed(
              tenant,
              {
                nbrInvoicesInError: synchronizeActionResults.inError,
                evseDashboardURL: Utils.buildEvseURL(tenant.subdomain),
                evseDashboardBillingURL: Utils.buildEvseBillingSettingsURL(tenant.subdomain)
              }
            );
          }
        }
      } catch (error) {
        // Log error
        await Logging.logActionExceptionMessage(tenant.id, ServerAction.BILLING_SYNCHRONIZE_INVOICES, error);
      } finally {
        // Release the lock
        await LockingManager.release(billingLock);
      }
    }
  }
}
