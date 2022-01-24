import { BillingDataTransactionStop, BillingStatus } from '../../types/Billing';

import AbstractAsyncTask from '../AsyncTask';
import BillingFactory from '../../integration/billing/BillingFactory';
import LockingHelper from '../../locking/LockingHelper';
import LockingManager from '../../locking/LockingManager';
import Logging from '../../utils/Logging';
import { ServerAction } from '../../types/Server';
import { TenantComponents } from '../../types/Tenant';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import TransactionStorage from '../../storage/mongodb/TransactionStorage';
import Utils from '../../utils/Utils';

export default class BillTransactionAsyncTask extends AbstractAsyncTask {
  protected async executeAsyncTask(): Promise<void> {
    const tenant = await TenantStorage.getTenant(this.getAsyncTask().tenantID);
    // Check if OCPI component is active
    if (Utils.isTenantComponentActive(tenant, TenantComponents.BILLING)) {
      try {
        const billingImpl = await BillingFactory.getBillingImpl(tenant);
        if (billingImpl) {
          // Get the Transaction to bill
          const transactionID: string = this.getAsyncTask().parameters.transactionID;
          const userID: string = this.getAsyncTask().parameters.userID;
          const lock = await LockingHelper.acquireBillUserLock(tenant.id, userID);
          if (lock) {
            try {
              const transaction = await TransactionStorage.getTransaction(tenant, Number(transactionID), { withUser: true, withChargingStation: true });
              if (!transaction) {
                throw new Error(`Unknown Transaction ID '${this.getAsyncTask().parameters.transactionID}'`);
              }
              // Check consistency - async task should only bill transactions created while transaction billing was ON
              if (!transaction.billingData?.withBillingActive) {
                throw new Error(`Unexpected situation - billing should be active - transaction ID: '${this.getAsyncTask().parameters.transactionID}'`);
              }
              // Check status - async task should only bill transactions marked as PENDING
              if (transaction.billingData?.stop?.status !== BillingStatus.PENDING) {
                throw new Error(`Unexpected situation - billing status should be PENDING - transaction ID: '${this.getAsyncTask().parameters.transactionID}'`);
              }
              // Attempt to finalize and pay invoices
              const billingDataStop: BillingDataTransactionStop = await billingImpl.billTransaction(transaction);
              // Update
              transaction.billingData.stop = billingDataStop;
              transaction.billingData.lastUpdate = new Date();
              // Save
              await TransactionStorage.saveTransactionBillingData(tenant, transaction.id, transaction.billingData);
            } finally {
              // Release the lock
              await LockingManager.release(lock);
            }
          } else {
            throw new Error(`Unexpected situation - concurrent billing - transaction ID: '${this.getAsyncTask().parameters.transactionID}' - user: ${this.getAsyncTask().parameters.userID}`);
          }
        }
      } catch (error) {
        await Logging.logActionExceptionMessage(tenant.id, ServerAction.BILLING_TRANSACTION, error);
      }
    }
  }
}
