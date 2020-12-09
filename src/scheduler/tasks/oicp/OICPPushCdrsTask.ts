import SchedulerTask from '../../SchedulerTask';
import { TaskConfig } from '../../../types/TaskConfig';
import Tenant from '../../../types/Tenant';

const MODULE_NAME = 'OICPPushCdrsTask';

export default class OICPPushCdrsTask extends SchedulerTask {

  async processTenant(tenant: Tenant, config: TaskConfig): Promise<void> {
    // Tbd: In which cases is it necessary to push all CDRs again?
    // Hubject allows only one CDR per session

    // Post CDR
    // await OCPPUtils.processOICPTransaction(tenant.id, transaction, chargingStation, TransactionAction.END);
  }
}
