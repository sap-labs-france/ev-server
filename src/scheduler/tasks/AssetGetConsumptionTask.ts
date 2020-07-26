import AssetFactory from '../../integration/asset/AssetFactory';
import LockingHelper from '../../locking/LockingHelper';
import LockingManager from '../../locking/LockingManager';
import AssetStorage from '../../storage/mongodb/AssetStorage';
import ConsumptionStorage from '../../storage/mongodb/ConsumptionStorage';
import Asset from '../../types/Asset';
import Consumption, { AbstractCurrentConsumption } from '../../types/Consumption';
import { ServerAction } from '../../types/Server';
import { TaskConfig } from '../../types/TaskConfig';
import Tenant from '../../types/Tenant';
import TenantComponents from '../../types/TenantComponents';
import Logging from '../../utils/Logging';
import Utils from '../../utils/Utils';
import SchedulerTask from '../SchedulerTask';

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
    if (assetLock) {
      try {
        // Get dynamic assets only
        const dynamicAssets = await AssetStorage.getAssets(tenant.id,
          {
            dynamicOnly: true,
            withSiteArea: true
          },
          {
            limit: 100,
            skip: 0,
          }
        );
        for (const asset of dynamicAssets.result) {
          // Get asset factory
          const assetImpl = await AssetFactory.getAssetImpl(tenant.id, asset.connectionID);
          if (assetImpl) {
            // Retrieve consumption
            const assetConsumption = await assetImpl.retrieveConsumption(asset);
            this.assignAssetConsumption(asset, assetConsumption);
            // Save Asset
            await AssetStorage.saveAsset(tenant.id, asset);
            // Create Consumption
            const consumption: Consumption = {
              startedAt: asset.lastConsumption.timestamp,
              endedAt: new Date(),
              assetID: asset.id,
              cumulatedConsumptionWh: asset.currentConsumptionWh,
              cumulatedConsumptionAmps: Math.floor(asset.currentConsumptionWh / 230),
            };
            Utils.addSiteLimitationToConsumption(tenant.id, asset.siteArea, consumption);
            // Save
            ConsumptionStorage.saveConsumption(tenant.id, consumption);
          }
        }
      } catch (error) {
        // Log error
        Logging.logActionExceptionMessage(tenant.id, ServerAction.RETRIEVE_ASSET_CONSUMPTION, error);
      } finally {
        // Release the lock
        await LockingManager.release(assetLock);
      }
    }
  }

  private assignAssetConsumption(asset: Asset, consumption: AbstractCurrentConsumption) {
    // Assign
    asset.lastConsumption = consumption.lastConsumption;
    asset.currentConsumptionWh = consumption.currentConsumptionWh;
    asset.currentInstantAmps = consumption.currentInstantAmps;
    asset.currentInstantAmpsL1 = consumption.currentInstantAmpsL1;
    asset.currentInstantAmpsL2 = consumption.currentInstantAmpsL2;
    asset.currentInstantAmpsL3 = consumption.currentInstantAmpsL3;
    asset.currentInstantVolts = consumption.currentInstantVolts;
    asset.currentInstantVoltsL1 = consumption.currentInstantVoltsL1;
    asset.currentInstantVoltsL2 = consumption.currentInstantVoltsL2;
    asset.currentInstantVoltsL3 = consumption.currentInstantVoltsL3;
    asset.currentInstantWatts = consumption.currentInstantWatts;
    asset.currentInstantWattsL1 = consumption.currentInstantWattsL1;
    asset.currentInstantWattsL2 = consumption.currentInstantWattsL2;
    asset.currentInstantWattsL3 = consumption.currentInstantWattsL3;
  }
}
