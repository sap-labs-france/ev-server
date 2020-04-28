import RefundFactory from '../../integration/refund/RefundFactory';
import TransactionStorage from '../../storage/mongodb/TransactionStorage';
import { ServerAction } from '../../types/Server';
import { RefundStatus } from '../../types/Refund';
import { TaskConfig } from '../../types/TaskConfig';
import Tenant from '../../types/Tenant';
import TenantComponents from '../../types/TenantComponents';
import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import Utils from '../../utils/Utils';
import SchedulerTask from '../SchedulerTask';

const MODULE_NAME = 'SynchronizeRefundTransactionsTask';

export default class SynchronizeRefundTransactionsTask extends SchedulerTask {
  async processTenant(tenant: Tenant, config: TaskConfig): Promise<void> {
    if (!Utils.isTenantComponentActive(tenant, TenantComponents.REFUND)) {
      Logging.logDebug({
        tenantID: tenant.id,
        action: ServerAction.SYNCHRONIZE_REFUND,
        module: MODULE_NAME, method: 'run',
        message: 'Refund not active in this Tenant'
      });
      return;
    }
    // Get Concur Settings
    const refundConnector = await RefundFactory.getRefundImpl(tenant.id);
    if (!refundConnector) {
      Logging.logDebug({
        tenantID: tenant.id,
        action: ServerAction.SYNCHRONIZE_REFUND,
        module: MODULE_NAME, method: 'run',
        message: 'Refund settings are not configured'
      });
      return;
    }
    // Get the 'Submitted' transactions
    const transactions = await TransactionStorage.getTransactions(tenant.id, {
      'refundStatus': [RefundStatus.SUBMITTED]
    }, { ...Constants.DB_PARAMS_MAX_LIMIT, sort: { 'userID' : 1, 'refundData.reportId' : 1 } });
    // Check
    if (transactions.count > 0) {
      // Process them
      Logging.logInfo({
        tenantID: tenant.id,
        action: ServerAction.SYNCHRONIZE_REFUND,
        module: MODULE_NAME, method: 'run',
        message: `${transactions.count} Refunded Transaction(s) are going to be synchronized`
      });
      const actionsDone = {
        approved: 0,
        cancelled: 0,
        notUpdated: 0,
        error: 0
      };
      for (const transaction of transactions.result) {
        try {
          // Update Transaction
          const updatedAction = await refundConnector.updateRefundStatus(tenant.id, transaction);
          switch (updatedAction) {
            case RefundStatus.CANCELLED:
              actionsDone.cancelled++;
              break;
            case RefundStatus.APPROVED:
              actionsDone.approved++;
              break;
            default:
              actionsDone.notUpdated++;
          }
        } catch (error) {
          actionsDone.error++;
          Logging.logActionExceptionMessage(tenant.id, ServerAction.SYNCHRONIZE_REFUND, error);
        }
      }
      // Log result
      Logging.logInfo({
        tenantID: tenant.id,
        action: ServerAction.SYNCHRONIZE_REFUND,
        module: MODULE_NAME, method: 'run',
        message: `Synchronized: ${actionsDone.approved} Approved, ${actionsDone.cancelled} Cancelled, ${actionsDone.notUpdated} Not updated, ${actionsDone.error} In Error`
      });
    } else {
      // Process them
      Logging.logInfo({
        tenantID: tenant.id,
        action: ServerAction.SYNCHRONIZE_REFUND,
        module: MODULE_NAME, method: 'run',
        message: 'No Refunded Transaction found to synchronize'
      });
    }
  }
}
