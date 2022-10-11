import { ActionsResponse } from '../../types/GlobalType';
import Configuration from '../../utils/Configuration';
import Constants from '../../utils/Constants';
import LockingHelper from '../../locking/LockingHelper';
import LockingManager from '../../locking/LockingManager';
import Logging from '../../utils/Logging';
import LoggingHelper from '../../utils/LoggingHelper';
import OCPPService from '../../server/ocpp/services/OCPPService';
import { ServerAction } from '../../types/Server';
import Tenant from '../../types/Tenant';
import TenantSchedulerTask from '../TenantSchedulerTask';
import TransactionStorage from '../../storage/mongodb/TransactionStorage';
import Utils from '../../utils/Utils';

const MODULE_NAME = 'CleanTransactionsInProgressTask';

export default class CloseTransactionsInProgressTask extends TenantSchedulerTask {
  public async processTenant(tenant: Tenant): Promise<void> {
    const transactionsCloseLock = await LockingHelper.acquireCloseTransactionsInProgressLock(tenant.id);
    if (transactionsCloseLock) {
      try {
        const result: ActionsResponse = {
          inError: 0,
          inSuccess: 0,
        };
        const startTime = new Date().getTime();
        // Instantiate the OCPPService
        const ocppService = new OCPPService(Configuration.getChargingStationConfig());
        // Get opened transactions to close
        const transactions = await TransactionStorage.getTransactions(
          tenant, { transactionsToStop: true, issuer: true }, Constants.DB_PARAMS_MAX_LIMIT);
        for (const transaction of transactions.result) {
          try {
            // Soft stop transaction
            await ocppService.softStopTransaction(tenant, transaction, transaction.chargeBox, transaction.siteArea);
            result.inSuccess++;
            await Logging.logInfo({
              ...LoggingHelper.getTransactionProperties(transaction),
              tenantID: tenant.id,
              actionOnUser: transaction.userID,
              module: MODULE_NAME, method: 'processTenant',
              message: `${Utils.buildConnectorInfo(transaction.connectorId, transaction.id)} Transaction has been soft stopped successfully`,
              action: ServerAction.TRANSACTION_SOFT_STOP,
              detailedMessages: { transaction }
            });
          } catch (error) {
            result.inError++;
            await Logging.logError({
              ...LoggingHelper.getTransactionProperties(transaction),
              tenantID: tenant.id,
              action: ServerAction.TRANSACTION_SOFT_STOP,
              module: MODULE_NAME, method: 'processTenant',
              message: `Cannot soft stop Transaction ID '${transaction.id}': ${error.message as string}`,
              detailedMessages: { transaction, error: error.stack }
            });
          }
        }
        // Log final results
        const executionDurationSecs = Math.round((new Date().getTime() - startTime) / 1000);
        await Logging.logActionsResponse(tenant.id, ServerAction.TRANSACTION_SOFT_STOP, MODULE_NAME, 'processTenant', result,
          `{{inSuccess}} Transaction(s) have been soft stopped successfully in ${executionDurationSecs}s in Tenant ${Utils.buildTenantName(tenant)}`,
          `{{inError}} Transaction(s) failed to be soft stopped in ${executionDurationSecs}s in Tenant ${Utils.buildTenantName(tenant)}`,
          `{{inSuccess}} Transaction(s) have been soft stopped successfully but {{inError}} failed in ${executionDurationSecs}s in Tenant ${Utils.buildTenantName(tenant)}`,
          `No Transaction have been soft stopped in ${executionDurationSecs}s in Tenant ${Utils.buildTenantName(tenant)}`
        );
      } catch (error) {
        await Logging.logActionExceptionMessage(tenant.id, ServerAction.TRANSACTION_SOFT_STOP, error);
      } finally {
        // Release the lock
        await LockingManager.release(transactionsCloseLock);
      }
    }
  }
}
