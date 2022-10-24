import BillingFactory from '../../integration/billing/BillingFactory';
import { DispatchFundsTaskConfig } from '../../types/TaskConfig';
import LockingHelper from '../../locking/LockingHelper';
import LockingManager from '../../locking/LockingManager';
import Logging from '../../utils/Logging';
import { ServerAction } from '../../types/Server';
import Tenant from '../../types/Tenant';
import TenantSchedulerTask from '../TenantSchedulerTask';

export default class DispatchCollectedFundsTask extends TenantSchedulerTask {
  public async processTenant(tenant: Tenant, taskConfig: DispatchFundsTaskConfig): Promise<void> {
    // Get the lock
    const billingLock = await LockingHelper.acquireDispatchCollectedFundsLock(tenant.id);
    if (billingLock) {
      try {
        const billingImpl = await BillingFactory.getBillingImpl(tenant);
        if (billingImpl) {
          // Attempt to finalize and pay invoices
          const actionResults = await billingImpl.dispatchCollectedFunds(taskConfig);
          if (actionResults.inError > 0) {
            // TODO - send a notification to the ADMINS
            // void NotificationHandler.sendBillingPeriodicOperationFailed(
            //   tenant,
            //   {
            //     nbrInvoicesInError: actionResults.inError,
            //     evseDashboardURL: Utils.buildEvseURL(tenant.subdomain),
            //     evseDashboardBillingURL: Utils.buildEvseBillingSettingsURL(tenant.subdomain)
            //   }
            // );
          }
        }
      } catch (error) {
        // Log error
        await Logging.logActionExceptionMessage(tenant.id, ServerAction.BILLING_TRANSFER_DISPATCH_FUNDS, error as Error);
      } finally {
        // Release the lock
        await LockingManager.release(billingLock);
      }
    }
  }
}
