import { TaskConfig } from '../../types/TaskConfig';
import Tenant from '../../types/Tenant';
import SchedulerTask from '../SchedulerTask';
import Utils from '../../utils/Utils';
import TenantComponents from '../../types/TenantComponents';
import Logging from '../../utils/Logging';
import { ServerAction } from '../../types/Server';
import LockingHelper from '../../locking/LockingHelper';

const MODULE_NAME = 'AssetGetConsumptionTask';

export default class AssetGetConsumptionTask extends SchedulerTask {
  async processTenant(tenant: Tenant, config: TaskConfig): Promise<void> {
    // Check if Asset component is active
    if (!Utils.isTenantComponentActive(tenant, TenantComponents.ASSET)) {
      Logging.logDebug({
        tenantID: tenant.id,
        module: MODULE_NAME,
        method: 'processTenant',
        action: ServerAction.RETRIEVE_ASSET_CONSUMPTION,
        message: 'Asset Inactive for this tenant. The task \'AssetGetConsumptionTask\' is skipped.'
      });
      // Skip execution
      return;
    }
    const assetLock = await LockingHelper.createAssetLock(tenant.id);
  }
}
