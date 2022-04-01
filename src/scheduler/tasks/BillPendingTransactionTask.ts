import Tenant, { TenantComponents } from '../../types/Tenant';

import BillingFacade from '../../integration/billing/BillingFacade';
import BillingFactory from '../../integration/billing/BillingFactory';
import { BillingStatus } from '../../types/Billing';
import { ChargePointStatus } from '../../types/ocpp/OCPPServer';
import LockingHelper from '../../locking/LockingHelper';
import LockingManager from '../../locking/LockingManager';
import Logging from '../../utils/Logging';
import { ServerAction } from '../../types/Server';
import TenantSchedulerTask from '../TenantSchedulerTask';
import TransactionStorage from '../../storage/mongodb/TransactionStorage';
import Utils from '../../utils/Utils';
import global from '../../types/GlobalType';

const MODULE_NAME = 'BillPendingTransactionTask';

export default class BillPendingTransactionTask extends TenantSchedulerTask {
  public async processTenant(tenant: Tenant, /* config: TaskConfig */): Promise<void> {
    try {
      // Check if OCPI component is active
      if (Utils.isTenantComponentActive(tenant, TenantComponents.BILLING)) {
        const billingImpl = await BillingFactory.getBillingImpl(tenant);
        if (billingImpl) {
          // Get the lock
          const lock = await LockingHelper.acquireBillPendingTransactionsLock(tenant.id);
          if (lock) {
            try {
            // Get all finished Transaction with no CDR
              const transactionsMDB: {_id: number}[] = await global.database.getCollection<{_id: number}>(tenant.id, 'transactions')
                .aggregate<{_id: number}>(
                [
                  {
                    // Sessions with a PENDING billing status and with a unknown extra inactivity
                    $match: {
                      'stop': { $exists: true },
                      'stop.extraInactivityComputed': false,
                      'billingData.stop.status': BillingStatus.PENDING
                    }
                  },
                  {
                    $project: { '_id': 1 }
                  }
                ]).toArray();
              if (!Utils.isEmptyArray(transactionsMDB)) {
                await Logging.logInfo({
                  tenantID: tenant.id,
                  action: ServerAction.BILLING_BILL_PENDING_TRANSACTION,
                  module: MODULE_NAME, method: 'processTenant',
                  message: `The billing of ${transactionsMDB.length} transactions is pending`,
                });
                for (const transactionMDB of transactionsMDB) {
                  const transactionLock = await LockingHelper.acquireBillPendingTransactionLock(tenant.id, transactionMDB._id);
                  if (transactionLock) {
                    try {
                    // Get Transaction
                      const transaction = await TransactionStorage.getTransaction(tenant, transactionMDB._id, { withUser: true, withChargingStation: true });
                      if (!transaction) {
                        await Logging.logError({
                          tenantID: tenant.id,
                          action: ServerAction.BILLING_BILL_PENDING_TRANSACTION,
                          module: MODULE_NAME, method: 'processTenant',
                          message: `Transaction '${transactionMDB._id}' not found`,
                        });
                        continue;
                      }
                      // Get Charging Station
                      const chargingStation = transaction.chargeBox;
                      if (!chargingStation) {
                        await Logging.logError({
                          tenantID: tenant.id,
                          action: ServerAction.BILLING_BILL_PENDING_TRANSACTION,
                          module: MODULE_NAME, method: 'processTenant',
                          message: `Charging Station '${transaction.chargeBoxID}' not found`,
                        });
                        continue;
                      }
                      // Check for the last transaction
                      const lastTransaction = await TransactionStorage.getLastTransactionFromChargingStation(tenant, transaction.chargeBoxID, transaction.connectorId);
                      if (transaction.id === lastTransaction?.id) {
                        // Avoid conflict with a session which is still in progress
                        const connector = Utils.getConnectorFromID(chargingStation, transaction.connectorId);
                        if (connector.status !== ChargePointStatus.AVAILABLE) {
                          // Do nothing - connector is being used
                          continue;
                        }
                      }
                      // Check for the billing status
                      if (transaction.billingData?.stop?.status !== BillingStatus.PENDING) {
                        await Logging.logWarning({
                          tenantID: tenant.id,
                          action: ServerAction.BILLING_BILL_PENDING_TRANSACTION,
                          module: MODULE_NAME, method: 'processTenant',
                          message: `Transaction '${transaction.id}' is not pending anymore`,
                        });
                        continue;
                      }
                      // Avoid billing again!
                      if (transaction.billingData?.stop?.invoiceID) {
                        await Logging.logWarning({
                          tenantID: tenant.id,
                          action: ServerAction.BILLING_BILL_PENDING_TRANSACTION,
                          module: MODULE_NAME, method: 'processTenant',
                          message: `Unexpected situation - Transaction '${transaction.id}' has already been billed`,
                        });
                        continue;
                      }
                      // Pricing - Nothing to do - no extra activity has been added
                      transaction.stop.extraInactivityComputed = true;
                      transaction.stop.extraInactivitySecs = 0;
                      // Billing - This starts the billing async task - the BillingStatus will remain PENDING for a while!
                      await BillingFacade.processEndTransaction(tenant, transaction, transaction.user);
                      // Save
                      await TransactionStorage.saveTransaction(tenant, transaction);
                      await Logging.logInfo({
                        tenantID: tenant.id,
                        action: ServerAction.BILLING_BILL_PENDING_TRANSACTION,
                        actionOnUser: transaction.user,
                        module: MODULE_NAME, method: 'processTenant',
                        message: `The billing process has been started for transaction '${transaction.id}'`,
                      });
                    } catch (error) {
                      await Logging.logError({
                        tenantID: tenant.id,
                        action: ServerAction.BILLING_BILL_PENDING_TRANSACTION,
                        module: MODULE_NAME, method: 'processTenant',
                        message: `Failed to bill pending transaction '${transactionMDB._id}'`,
                        detailedMessages: { error: error.stack, transaction: transactionMDB }
                      });
                    } finally {
                      // Release the lock
                      await LockingManager.release(transactionLock);
                    }
                  }
                }
              }
            } finally {
              // Release the lock
              await LockingManager.release(lock);
            }
          }
        }
      }
    } catch (error) {
      await Logging.logActionExceptionMessage(tenant.id, ServerAction.BILLING_BILL_PENDING_TRANSACTION, error);
    }
  }
}

