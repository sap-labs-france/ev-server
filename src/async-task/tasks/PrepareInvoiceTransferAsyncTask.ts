import AbstractAsyncTask from '../AsyncTask';
import BillingFactory from '../../integration/billing/BillingFactory';
import { BillingInvoiceStatus } from '../../types/Billing';
import BillingStorage from '../../storage/mongodb/BillingStorage';
import LockingHelper from '../../locking/LockingHelper';
import LockingManager from '../../locking/LockingManager';
import Logging from '../../utils/Logging';
import { ServerAction } from '../../types/Server';
import { TenantComponents } from '../../types/Tenant';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import Utils from '../../utils/Utils';

export default class PrepareInvoiceTransferAsyncTask extends AbstractAsyncTask {
  protected async executeAsyncTask(): Promise<void> {
    const tenant = await TenantStorage.getTenant(this.getAsyncTask().tenantID);
    // Check if Billing Platform component is active
    if (Utils.isTenantComponentActive(tenant, TenantComponents.BILLING_PLATFORM)) {
      try {
        const billingImpl = await BillingFactory.getBillingImpl(tenant);
        if (billingImpl) {
          // Get the Transaction to bill
          const invoiceID: string = this.getAsyncTask().parameters.invoiceID;
          if (!invoiceID) {
            throw new Error('Unexpected situation - some required parameters are missing');
          }
          const lock = await LockingHelper.acquireBillingPrepareInvoiceTransferLock(tenant.id, invoiceID);
          if (lock) {
            try {
              const invoice = await BillingStorage.getInvoice(tenant, invoiceID);
              if (!invoice) {
                throw new Error(`Unknown Invoice ID '${invoiceID}'`);
              }
              if (invoice.status !== BillingInvoiceStatus.PAID) {
                throw new Error(`Unexpected situation - invoice '${invoiceID}' is not yet PAID`);
              }
              // Prepare a transfer per CPO
              await billingImpl.prepareInvoiceTransfer(invoice);
            } finally {
              // Release the lock
              await LockingManager.release(lock);
            }
          } else {
            throw new Error(`Unexpected situation - concurrent invoice transfer - invoice ID: '${invoiceID}'`);
          }
        }
      } catch (error) {
        await Logging.logActionExceptionMessage(tenant.id, ServerAction.BILLING_PREPARE_TRANSFER, error);
      }
    }
  }
}
