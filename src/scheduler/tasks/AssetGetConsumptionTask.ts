import Consumption, { AbstractCurrentConsumption } from '../../types/Consumption';

import Asset from '../../types/Asset';
import AssetFactory from '../../integration/asset/AssetFactory';
import AssetStorage from '../../storage/mongodb/AssetStorage';
import Constants from '../../utils/Constants';
import ConsumptionStorage from '../../storage/mongodb/ConsumptionStorage';
import LockingHelper from '../../locking/LockingHelper';
import LockingManager from '../../locking/LockingManager';
import Logging from '../../utils/Logging';
import SchedulerTask from '../SchedulerTask';
import { ServerAction } from '../../types/Server';
import { TaskConfig } from '../../types/TaskConfig';
import Tenant from '../../types/Tenant';
import TenantComponents from '../../types/TenantComponents';
import Utils from '../../utils/Utils';

const MODULE_NAME = 'AssetGetConsumptionTask';

export default class AssetGetConsumptionTask extends SchedulerTask {
  async processTenant(tenant: Tenant, config: TaskConfig): Promise<void> {
    // Check if Asset component is active
    if (Utils.isTenantComponentActive(tenant, TenantComponents.ASSET)) {
      // Get dynamic assets only
      const dynamicAssets = await AssetStorage.getAssets(tenant.id,
        {
          dynamicOnly: true,
          withSiteArea: true
        },
        Constants.DB_PARAMS_MAX_LIMIT
      );
      // Process them
      for (const asset of dynamicAssets.result) {
        const assetLock = await LockingHelper.createAssetRetrieveConsumptionsLock(tenant.id, asset);
        if (assetLock) {
          try {
            // Get asset factory
            const assetImpl = await AssetFactory.getAssetImpl(tenant.id, asset.connectionID);
            if (assetImpl) {
              // Retrieve Consumption
              const assetConsumption = await assetImpl.retrieveConsumption(asset);
              // Set Consumption to Asset
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
                instantAmps: asset.currentInstantAmps,
                instantWatts: asset.currentInstantWatts,
              };
              // Add limits
              await Utils.addSiteLimitationToConsumption(tenant.id, asset.siteArea, consumption);
              // Save Consumption
              await ConsumptionStorage.saveConsumption(tenant.id, consumption);
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
