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
        method: 'run', action: 'SynchronizeRefundTransactions',
        message: 'The refund component is inactive for this tenant. The task \'SynchronizeRefundTransactionsTask\' is skipped.'
      });
      return;
    }
    const setting = await SettingStorage.getSettingByIdentifier(tenant.getID(), 'refund');
    if (!setting || !setting.getContent()['concur']) {
      Logging.logDebug({
        tenantID: tenant.getID(),
        module: 'SynchronizeRefundTransactionsTask',
        method: 'run', action: 'SynchronizeRefundTransactions',
        message: 'The refund settings are not configured. The task \'SynchronizeRefundTransactionsTask\' is skipped.'
      });
    }
    Logging.logInfo({
      tenantID: tenant.getID(),
      module: 'SynchronizeRefundTransactionsTask',
      method: 'run', action: 'SynchronizeRefundTransactions',
      message: 'The task \'SynchronizeRefundTransactionsTask\' is started'
    });

    const connector = new ConcurConnector(tenant.getID(), setting.getContent()['concur']);
    const transactions = await TransactionStorage.getTransactions(tenant.getID(), {
      'type': 'refunded',
      'refundStatus': Constants.REFUND_TRANSACTION_SUBMITTED
    }, Constants.NO_LIMIT, 0, {
      'userID': 1,
      'refundData.reportId': 1
    });

    Logging.logDebug({
      tenantID: tenant.getID(),
      module: 'SynchronizeRefundTransactionsTask',
      method: 'run', action: 'SynchronizeRefundTransactions',
      message: `${transactions.count} refunded transaction(s) to be synchronized`
    });

    for (const transaction of transactions.result) {
      try {
        await connector.updateRefundStatus(transaction);
      } catch (error) {
        Logging.logActionExceptionMessage(tenant.getID(), 'SynchronizeRefundTransactions', error);
      }
    }

    Logging.logInfo({
      tenantID: tenant.getID(),
      module: 'SynchronizeRefundTransactionsTask',
      method: 'run', action: 'SynchronizeRefundTransactions',
      message: 'The task \'SynchronizeRefundTransactionsTask\' is successfully completed'
    });

  }
}
