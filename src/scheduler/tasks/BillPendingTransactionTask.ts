import Tenant, { TenantComponents } from '../../types/Tenant';

import BillingFactory from '../../integration/billing/BillingFactory';
import { BillingStatus } from '../../types/Billing';
import ChargingStationStorage from '../../storage/mongodb/ChargingStationStorage';
import LockingHelper from '../../locking/LockingHelper';
import LockingManager from '../../locking/LockingManager';
import Logging from '../../utils/Logging';
import OCPPUtils from '../../server/ocpp/utils/OCPPUtils';
import SchedulerTask from '../SchedulerTask';
import { ServerAction } from '../../types/Server';
import { TransactionAction } from '../../types/Transaction';
import TransactionStorage from '../../storage/mongodb/TransactionStorage';
import Utils from '../../utils/Utils';
import global from '../../types/GlobalType';

const MODULE_NAME = 'BillPendingTransactionTask';

export default class BillPendingTransactionTask extends SchedulerTask {
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
                  // TODO - How to avoid conflict with regular billing process
                  const transactionLock = await LockingHelper.acquireBillPendingTransactionLock(tenant.id, transactionMDB._id);
                  if (transactionLock) {
                    try {
                    // Get Transaction
                      const transaction = await TransactionStorage.getTransaction(tenant, transactionMDB._id, { withUser: true });
                      if (!transaction) {
                        await Logging.logError({
                          tenantID: tenant.id,
                          action: ServerAction.BILLING_BILL_PENDING_TRANSACTION,
                          module: MODULE_NAME, method: 'processTenant',
                          message: `Transaction ID '${transactionMDB._id}' not found`,
                        });
                        continue;
                      }
                      if (transaction.billingData?.stop?.status !== BillingStatus.PENDING) {
                        await Logging.logInfo({
                          tenantID: tenant.id,
                          action: ServerAction.BILLING_BILL_PENDING_TRANSACTION,
                          module: MODULE_NAME, method: 'processTenant',
                          message: `Transaction ID '${transactionMDB._id}' is not pending anymore`,
                        });
                        continue;
                      }
                      // Get Charging Station
                      const chargingStation = await ChargingStationStorage.getChargingStation(tenant, transaction.chargeBoxID);
                      if (!chargingStation) {
                        await Logging.logError({
                          tenantID: tenant.id,
                          action: ServerAction.BILLING_BILL_PENDING_TRANSACTION,
                          module: MODULE_NAME, method: 'processTenant',
                          message: `Charging Station ID '${transaction.chargeBoxID}' not found`,
                        });
                        continue;
                      }
                      // TODO - the transaction is stopped - Is there a need to check connector status???
                      // const connector = Utils.getConnectorFromID(chargingStation, transaction.connectorId);
                      // if (connector?.status === ChargePointStatus.FINISHING) {
                      //   continue;
                      // }
                      // Pricing - Nothing to do - no extra activity has been added
                      transaction.stop.extraInactivityComputed = true;
                      transaction.stop.extraInactivitySecs = 0;
                      // Billing - This starts the billing async task - the BillingStatus will remain PENDING for a while!
                      await OCPPUtils.processTransactionBilling(tenant, transaction, TransactionAction.END);
                      // Save
                      await TransactionStorage.saveTransaction(tenant, transaction);
                      await Logging.logInfo({
                        tenantID: tenant.id,
                        action: ServerAction.BILLING_BILL_PENDING_TRANSACTION,
                        actionOnUser: (transaction.user ? transaction.user : null),
                        module: MODULE_NAME, method: 'processTenant',
                        message: `The billing process has been started for transaction '${transaction.id}'`,
                        detailedMessages: { cdr: transaction.ocpiData.cdr }
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

