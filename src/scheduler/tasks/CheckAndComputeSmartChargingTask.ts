import Tenant, { TenantComponents } from '../../types/Tenant';

import Constants from '../../utils/Constants';
import LockingHelper from '../../locking/LockingHelper';
import LockingManager from '../../locking/LockingManager';
import Logging from '../../utils/Logging';
import { ServerAction } from '../../types/Server';
import SiteAreaStorage from '../../storage/mongodb/SiteAreaStorage';
import SmartChargingFactory from '../../integration/smart-charging/SmartChargingFactory';
import TenantSchedulerTask from '../TenantSchedulerTask';
import Utils from '../../utils/Utils';

const MODULE_NAME = 'CheckAndComputeSmartChargingTask';

export default class CheckAndComputeSmartChargingTask extends TenantSchedulerTask {
  public async processTenant(tenant: Tenant): Promise<void> {
    if (Utils.isTenantComponentActive(tenant, TenantComponents.ORGANIZATION) &&
        Utils.isTenantComponentActive(tenant, TenantComponents.SMART_CHARGING)) {
      // Get all site areas
      const siteAreas = await SiteAreaStorage.getSiteAreas(tenant,
        { smartCharging: true, withNoParentSiteArea: true },
        Constants.DB_PARAMS_MAX_LIMIT);
      // Get Site Area
      for (const siteArea of siteAreas.result) {
        const siteAreaLock = await LockingHelper.acquireSiteAreaSmartChargingLock(tenant.id, siteArea);
        if (siteAreaLock) {
          try {
            // Get implementation
            const smartCharging = await SmartChargingFactory.getSmartChargingImpl(tenant);
            if (!smartCharging) {
              // Log
              await Logging.logError({
                tenantID: tenant.id,
                module: MODULE_NAME, method: 'processTenant',
                action: ServerAction.CHECK_AND_APPLY_SMART_CHARGING,
                message: 'No implementation available for the Smart Charging',
              });
            }
            // Apply Charging Profiles
            await smartCharging.computeAndApplyChargingProfiles(siteArea);
          } catch (error) {
            // Log error
            await Logging.logError({
              tenantID: tenant.id,
              module: MODULE_NAME, method: 'processTenant',
              action: ServerAction.CHECK_AND_APPLY_SMART_CHARGING,
              message: `Error while running the task '${CheckAndComputeSmartChargingTask.name}': ${error.message as string}`,
              detailedMessages: { error: error.stack }
            });
          } finally {
            // Release lock
            await LockingManager.release(siteAreaLock);
          }
        }
      }
      await Logging.logInfo({
        tenantID: Constants.DEFAULT_TENANT_ID,
        module: MODULE_NAME, method: 'processTenant',
        action: ServerAction.CHECK_AND_APPLY_SMART_CHARGING,
        message: `Processed '${siteAreas.count}' Site Area(s) with Smart Charging`,
      });
    }
  }
}
