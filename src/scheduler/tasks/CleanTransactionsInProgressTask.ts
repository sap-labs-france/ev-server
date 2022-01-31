import { ActionsResponse } from '../../types/GlobalType';
import Constants from '../../utils/Constants';
import LockingHelper from '../../locking/LockingHelper';
import LockingManager from '../../locking/LockingManager';
import Logging from '../../utils/Logging';
import OCPPUtils from '../../server/ocpp/utils/OCPPUtils';
import { ServerAction } from '../../types/Server';
import Tenant from '../../types/Tenant';
import TenantSchedulerTask from '../TenantSchedulerTask';
import { TransactionDataResult } from '../../types/DataResult';
import TransactionStorage from '../../storage/mongodb/TransactionStorage';
import Utils from '../../utils/Utils';

const MODULE_NAME = 'CleanTransactionsInProgressTask';

export default class CleanTransactionsInProgressTask extends TenantSchedulerTask {
  public async processTenant(tenant: Tenant): Promise<void> {
    const cleanTransactionsLock = await LockingHelper.acquireTransactionsCleanLock(tenant.id);
    if (cleanTransactionsLock) {
      try {
        const result: ActionsResponse = {
          inError: 0,
          inSuccess: 0,
        };
        const startTime = new Date().getTime();
        let transactionsToClean: TransactionDataResult;
        do {
          // Get Transactions to clean
          transactionsToClean = await TransactionStorage.getTransactions(tenant, { stop: { $exists: false }, transactionsToClean: true }, Constants.DB_PARAMS_MAX_LIMIT,
            ['id', 'chargeBoxID', 'tagID', 'lastConsumption.timestamp', 'timestamp', 'lastConsumption.value', 'meterStart']);
          for (const transactionToClean of transactionsToClean.result) {
            try {
              // Soft stop transaction
              await OCPPUtils.softStopTransaction(tenant, transactionToClean) ? result.inSuccess++ : result.inError++;
            } catch (error) {
              result.inError++;
              await Logging.logError({
                tenantID: tenant.id,
                action: ServerAction.TRANSACTION_SOFT_STOP,
                module: MODULE_NAME, method: 'processTenant',
                message: `Cannot soft stop Transaction ID '${transactionToClean.id}': ${error.message}`,
                detailedMessages: { transactionToClean, error: error.stack }
              });
            }
          }
          if (!Utils.isEmptyArray(transactionsToClean.result) && (result.inError + result.inSuccess) > 0) {
            const intermediateDurationSecs = Math.round((new Date().getTime() - startTime) / 1000);
            await Logging.logDebug({
              tenantID: tenant.id,
              action: ServerAction.TAGS_IMPORT,
              module: MODULE_NAME, method: 'processTenant',
              message: `${result.inError + result.inSuccess}/${transactionsToClean.count} Transaction(s) have been processed in ${intermediateDurationSecs}s...`
            });
          }
        } while (!Utils.isEmptyArray(transactionsToClean?.result));
        // Log final results
        const executionDurationSecs = Math.round((new Date().getTime() - startTime) / 1000);
        await Logging.logActionsResponse(tenant.id, ServerAction.TAGS_IMPORT, MODULE_NAME, 'processTenant', result,
          `{{inSuccess}} Transaction(s) have been stopped successfully in ${executionDurationSecs}s in Tenant ${Utils.buildTenantName(tenant)}`,
          `{{inError}} Transaction(s) failed to be stopped in ${executionDurationSecs}s in Tenant ${Utils.buildTenantName(tenant)}`,
          `{{inSuccess}} Transaction(s) have been stopped successfully but {{inError}} failed in ${executionDurationSecs}s in Tenant ${Utils.buildTenantName(tenant)}`,
          `Not Transaction has been stopped in ${executionDurationSecs}s in Tenant ${Utils.buildTenantName(tenant)}`
        );
      } catch (error) {
        // Log error
        await Logging.logActionExceptionMessage(tenant.id, ServerAction.TRANSACTION_SOFT_STOP, error);
      } finally {
        // Release the lock
        await LockingManager.release(cleanTransactionsLock);
      }
    }
  }
}
