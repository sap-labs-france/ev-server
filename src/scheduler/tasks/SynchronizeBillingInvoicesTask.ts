import BillingFactory from '../../integration/billing/BillingFactory';
import { BillingInvoiceSynchonizationTaskConfig } from '../../types/TaskConfig';
import LockingHelper from '../../locking/LockingHelper';
import LockingManager from '../../locking/LockingManager';
import Logging from '../../utils/Logging';
import NotificationHandler from '../../notification/NotificationHandler';
import SchedulerTask from '../SchedulerTask';
import { ServerAction } from '../../types/Server';
import Tenant from '../../types/Tenant';
import Utils from '../../utils/Utils';

export default class SynchronizeBillingInvoicesTask extends SchedulerTask {
  async processTenant(tenant: Tenant, taskConfig: BillingInvoiceSynchonizationTaskConfig): Promise<void> {
    // Get the lock
    const billingLock = await LockingHelper.createBillingSyncInvoicesLock(tenant.id);
    if (billingLock) {
      try {
        const billingImpl = await BillingFactory.getBillingImpl(tenant.id);
        if (billingImpl) {
          // Synchronize new Invoices and Invoices changes
          const synchronizeActionResults = await billingImpl.synchronizeInvoices();
          if (synchronizeActionResults.inError > 0) {
            await NotificationHandler.sendBillingInvoicesSynchronizationFailed(
              tenant.id,
              {
                nbrInvoicesInError: synchronizeActionResults.inError,
                evseDashboardURL: Utils.buildEvseURL(tenant.subdomain),
                evseDashboardBillingURL: Utils.buildEvseBillingSettingsURL(tenant.subdomain)
              }
            );
          }
          // Attempt payment - once a month! - A second task with a dedicated configuration to trigger the payment attempts
          if (taskConfig?.attemptPayment) {
            // Attempt to pay invoices with status OPEN
            const chargeActionResults = await billingImpl.chargeInvoices();
            if (chargeActionResults.inError > 0) {
              // TODO - dedicated notification type is required here!!!
              await NotificationHandler.sendBillingInvoicesSynchronizationFailed(
                tenant.id,
                {
                  nbrInvoicesInError: chargeActionResults.inError,
                  evseDashboardURL: Utils.buildEvseURL(tenant.subdomain),
                  evseDashboardBillingURL: Utils.buildEvseBillingSettingsURL(tenant.subdomain)
                }
              );
            }
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
