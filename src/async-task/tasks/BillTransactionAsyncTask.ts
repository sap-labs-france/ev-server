import AbstractAsyncTask from '../AsyncTask';
import { BillingDataTransactionStop } from '../../types/Billing';
import BillingFactory from '../../integration/billing/BillingFactory';
import LockingHelper from '../../locking/LockingHelper';
import LockingManager from '../../locking/LockingManager';
import Logging from '../../utils/Logging';
import { ServerAction } from '../../types/Server';
import TenantComponents from '../../types/TenantComponents';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import TransactionStorage from '../../storage/mongodb/TransactionStorage';
import Utils from '../../utils/Utils';

export default class BillTransactionAsyncTask extends AbstractAsyncTask {
  protected async executeAsyncTask(): Promise<void> {
    const tenant = await TenantStorage.getTenant(this.asyncTask.tenantID);
    // Check if OCPI component is active
    if (Utils.isTenantComponentActive(tenant, TenantComponents.BILLING)) {
      try {
        const billingImpl = await BillingFactory.getBillingImpl(tenant.id);
        if (billingImpl) {
          // Get the Transaction to bill
          const transactionID: string = this.asyncTask.parameters.transactionID;
          const transactionLock = await LockingHelper.createBillTransactionLock(tenant.id, Number(transactionID));
          if (transactionLock) {
            try {
              const transaction = await TransactionStorage.getTransaction(tenant.id, Number(transactionID));
              if (!transaction) {
                throw new Error(`Unknown Transaction ID '${this.asyncTask.parameters.transactionID}'`);
              }
              // Attempt to finalize and pay invoices
              const billingDataStop: BillingDataTransactionStop = await billingImpl.billTransaction(transaction);
              // Update
              if (transaction.billingData) {
                transaction.billingData.stop = billingDataStop;
                transaction.billingData.lastUpdate = new Date();
              }
              // Save
              await TransactionStorage.saveTransaction(tenant.id, transaction);
            } finally {
            // Release the lock
              await LockingManager.release(transactionLock);
            }
          }
        }
      } catch (error) {
        await Logging.logActionExceptionMessage(tenant.id, ServerAction.BILLING_TRANSACTION, error);
      }
    }
  }
}
