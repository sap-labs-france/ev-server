import { Action } from '../../types/Authorization';
import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import SchedulerTask from '../SchedulerTask';
import SiteAreaStorage from '../../storage/mongodb/SiteAreaStorage';
import SmartChargingFactory from '../../integration/smart-charging/SmartChargingFactory';
import Tenant from '../../types/Tenant';
import TenantComponents from '../../types/TenantComponents';
import Utils from '../../utils/Utils';

export default class CheckAndComputeSmartChargingTask extends SchedulerTask {
  async processTenant(tenant: Tenant): Promise<void> {
    if (Utils.isTenantComponentActive(tenant, TenantComponents.ORGANIZATION) &&
        Utils.isTenantComponentActive(tenant, TenantComponents.SMART_CHARGING)) {
      // Get all site areas
      const siteAreas = await SiteAreaStorage.getSiteAreas(tenant.id,
        { withChargeBoxes: true, smartCharging: true },
        Constants.DB_PARAMS_MAX_LIMIT);
      // Get Site Area
      for (const siteArea of siteAreas.result) {
        try {
          // Get implementation
          const smartCharging = await SmartChargingFactory.getSmartChargingImpl(tenant.id);
          if (!smartCharging) {
            // Log
            Logging.logError({
              tenantID: tenant.id,
              module: 'CheckAndComputeSmartChargingTask', method: 'run',
              action: Action.CHECK_AND_APPLY_SMART_CHARGING,
              message: `No implementation available for the Smart Charging`,
            });
          }
          // Apply Charging Profiles
          await smartCharging.computeAndApplyChargingProfiles(siteArea);
        } catch (error) {
          // Log error
          Logging.logError({
            tenantID: tenant.id,
            module: 'CheckAndComputeSmartChargingTask', method: 'run',
            action: Action.CHECK_AND_APPLY_SMART_CHARGING,
            message: `Error while running the task '${name}': ${error.message}`,
            detailedMessages: { error }
          });
        }
      }
    }
  }
}
