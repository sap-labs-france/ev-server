import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import SchedulerTask from '../SchedulerTask';
import { TaskConfig } from '../../types/TaskConfig';
import Tenant from '../../types/Tenant';
import Utils from '../../utils/Utils';
import SmartChargingFactory from '../../integration/smartCharging/SmartChargingFactory';

export default class SynchronizeRefundTransactionsTask extends SchedulerTask {
  async processTenant(tenant: Tenant, config: TaskConfig): Promise<void> {
    if (!Utils.isTenantComponentActive(tenant, Constants.COMPONENTS.SMART_CHARGING)) {
      Logging.logDebug({
        tenantID: tenant.id,
        module: 'SynchronizeSmartChargingProfilesTask',
        method: 'run', action: 'ChargingProfileSynchronize',
        message: 'Smart Charging not active in this Tenant'
      });
      return;
    }
    // Get Concur Settings
    const smartChargingConnector = await SmartChargingFactory.getSmartChargingConnector(tenant.id);
    if (!smartChargingConnector) {
      Logging.logDebug({
        tenantID: tenant.id,
        module: 'SynchronizeSmartChargingProfilesTask',
        method: 'run', action: 'ChargingProfileSynchronize',
        message: 'Smart Charging settings are not configured'
      });
    }
    smartChargingConnector.callOptimizer();

  }
}
