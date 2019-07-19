import SchedulerTask from '../SchedulerTask';
import { TaskConfig } from '../TaskConfig';
import Tenant from '../../entity/Tenant';
import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import SettingStorage from '../../storage/mongodb/SettingStorage';
import ConcurConnector from '../../integration/refund/ConcurConnector';
import TransactionStorage from '../../storage/mongodb/TransactionStorage';

export default class SynchronizeRefundTransactionsTask extends SchedulerTask {
  async processTenant(tenant: Tenant, config: TaskConfig): Promise<void> {
    if (!tenant.isComponentActive(Constants.COMPONENTS.REFUND)) {
      Logging.logDebug({
        tenantID: tenant.getID(),
        module: 'SynchronizeRefundTransactionsTask',
        method: 'run', action: 'RefundSynchronize',
        message: 'Refund not active in this Tenant'
      });
      return;
    }
    // Get Concur Settings
    const setting = await SettingStorage.getSettingByIdentifier(tenant.getID(), Constants.COMPONENTS.REFUND);
    if (!setting || !setting.getContent()[Constants.SETTING_REFUND_CONTENT_TYPE_CONCUR]) {
      Logging.logDebug({
        tenantID: tenant.getID(),
        module: 'SynchronizeRefundTransactionsTask',
        method: 'run', action: 'RefundSynchronize',
        message: 'Refund settings are not configured'
      });
      return;
    }
    // Create the Concur Connector
    const connector = new ConcurConnector(
      tenant.getID(), setting.getContent()[Constants.SETTING_REFUND_CONTENT_TYPE_CONCUR]);
    // Get the 'Submitted' transactions
    const transactions = await TransactionStorage.getTransactions(tenant.getID(), {
      'refundType': Constants.REFUND_TYPE_REFUNDED,
      'refundStatus': Constants.REFUND_STATUS_SUBMITTED
    }, Constants.DB_PARAMS_MAX_LIMIT, [ 'userID', 'refundData.reportId' ]);
    // Check
    if (transactions.count > 0) {
      // Process them
      Logging.logInfo({
        tenantID: tenant.getID(),
        module: 'SynchronizeRefundTransactionsTask',
        method: 'run', action: 'RefundSynchronize',
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
          const updatedAction = await connector.updateRefundStatus(transaction);
          switch (updatedAction) {
            case Constants.REFUND_STATUS_CANCELLED:
              actionsDone.cancelled++;
              break;
            case Constants.REFUND_STATUS_APPROVED:
              actionsDone.approved++;
              break;
            default:
              actionsDone.notUpdated++;
          }
        } catch (error) {
          actionsDone.error++;
          Logging.logActionExceptionMessage(tenant.getID(), 'RefundSynchronize', error);
        }
      }
      // Log result
      Logging.logInfo({
        tenantID: tenant.getID(),
        module: 'SynchronizeRefundTransactionsTask',
        method: 'run', action: 'RefundSynchronize',
        message: `Synchronized: ${actionsDone.approved} Approved, ${actionsDone.cancelled} Cancelled, ${actionsDone.notUpdated} Not updated, ${actionsDone.error} In Error`
      });
    } else {
      // Process them
      Logging.logInfo({
        tenantID: tenant.getID(),
        module: 'SynchronizeRefundTransactionsTask',
        method: 'run', action: 'RefundSynchronize',
        message: `No Refunded Transaction found to synchronize`
      });
    }
  }
}
