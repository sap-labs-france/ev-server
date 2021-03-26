import AssetStorage from '../../storage/mongodb/AssetStorage';
import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import MigrationTask from '../MigrationTask';
import { ServerAction } from '../../types/Server';
import Tenant from '../../types/Tenant';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import Utils from '../../utils/Utils';
import global from '../../types/GlobalType';

const MODULE_NAME = 'AddSiteAreaIDToAssetConsumptionTask';

export default class AddSiteAreaIDToAssetConsumptionTask extends MigrationTask {
  async migrate(): Promise<void> {
    const tenants = await TenantStorage.getTenants({}, Constants.DB_PARAMS_MAX_LIMIT);
    for (const tenant of tenants.result) {
      await this.migrateTenant(tenant);
    }
  }

  async migrateTenant(tenant: Tenant): Promise<void> {
    let modifiedCount = 0;
    // Get Assets
    const assets = await AssetStorage.getAssets(tenant.id, { withSiteArea: true }, Constants.DB_PARAMS_MAX_LIMIT);
    for (const asset of assets.result) {
      const result = await global.database.getCollection(tenant.id, 'consumptions').updateMany(
        {
          assetID: Utils.convertToObjectID(asset.id),
        },
        {
          $set: {
            siteAreaID: Utils.convertToObjectID(asset.siteAreaID),
            siteID: Utils.convertToObjectID(asset.siteArea.siteID),
          }
        }
      );
      modifiedCount += result.modifiedCount;
    }
    // Log in the default tenant
    if (modifiedCount > 0) {
      await Logging.logDebug({
        tenantID: Constants.DEFAULT_TENANT,
        action: ServerAction.MIGRATION,
        module: MODULE_NAME, method: 'migrateTenant',
        message: `${modifiedCount} Consumptions have been updated in Tenant ${Utils.buildTenantName(tenant)}`
      });
    }
  }

  getVersion(): string {
    return '1.0';
  }

  getName(): string {
    return 'AddSiteAreaIDToAssetConsumptionTask';
  }

  isAsynchronous(): boolean {
    return true;
  }
}
