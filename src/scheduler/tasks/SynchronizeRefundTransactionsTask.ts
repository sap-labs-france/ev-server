import ConcurConnector from '../../integration/refund/ConcurConnector';
import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import SchedulerTask from '../SchedulerTask';
import SettingStorage from '../../storage/mongodb/SettingStorage';
import { TaskConfig } from '../TaskConfig';
import Tenant from '../../types/Tenant';
import TransactionStorage from '../../storage/mongodb/TransactionStorage';
import Utils from '../../utils/Utils';

export default class SynchronizeRefundTransactionsTask extends SchedulerTask {
  async processTenant(tenant: Tenant, config: TaskConfig): Promise<void> {
    if (!Utils.isTenantComponentActive(tenant, Constants.COMPONENTS.REFUND)) {
      Logging.logDebug({
        tenantID: tenant.id,
        module: 'SynchronizeRefundTransactionsTask',
        method: 'run', action: 'RefundSynchronize',
        message: 'Refund not active in this Tenant'
      });
      return;
    }
    // Get Concur Settings
    const setting = await SettingStorage.getSettingByIdentifier(tenant.id, Constants.COMPONENTS.REFUND);
    if (!setting || !setting.content[Constants.SETTING_REFUND_CONTENT_TYPE_CONCUR]) {
      Logging.logDebug({
        tenantID: tenant.id,
        module: 'SynchronizeRefundTransactionsTask',
        method: 'run', action: 'RefundSynchronize',
        message: 'Refund settings are not configured'
      });
      return;
    }
    // Create the Concur Connector
    const connector = new ConcurConnector(
      tenant.id, setting.content[Constants.SETTING_REFUND_CONTENT_TYPE_CONCUR]);
    // Get the 'Submitted' transactions
    const transactions = await TransactionStorage.getTransactions(tenant.id, {
      'refundStatus': [Constants.REFUND_STATUS_SUBMITTED]
    }, { ...Constants.DB_PARAMS_MAX_LIMIT, sort: { 'userID' : 1, 'refundData.reportId' : 1 } });
    // Check
    if (transactions.count > 0) {
      // Process them
      Logging.logInfo({
        tenantID: tenant.id,
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
          const updatedAction = await connector.updateRefundStatus(tenant.id, transaction);
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
          Logging.logActionExceptionMessage(tenant.id, 'RefundSynchronize', error);
        }
      }
      // Log result
      Logging.logInfo({
        tenantID: tenant.id,
        module: 'SynchronizeRefundTransactionsTask',
        method: 'run', action: 'RefundSynchronize',
        message: `Synchronized: ${actionsDone.approved} Approved, ${actionsDone.cancelled} Cancelled, ${actionsDone.notUpdated} Not updated, ${actionsDone.error} In Error`
      });
    } else {
      // Process them
      Logging.logInfo({
        tenantID: tenant.id,
        module: 'SynchronizeRefundTransactionsTask',
        method: 'run', action: 'RefundSynchronize',
        message: 'No Refunded Transaction found to synchronize'
      });
    }
  }
}
