import SettingStorage from '../../storage/mongodb/SettingStorage';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import { AssetConnectionType, AssetSetting } from '../../types/Setting';
import Tenant from '../../types/Tenant';
import TenantComponents from '../../types/TenantComponents';
import Logging from '../../utils/Logging';
import Utils from '../../utils/Utils';
import AssetIntegration from './AssetIntegration';
import AssetSchneiderIntegration from './schneider/AssetSchneiderIntegration';

const MODULE_NAME = 'AssetFactory';

export default class AssetFactory {
  static async getAssetImpl(tenantID: string, connectionID: string): Promise<AssetIntegration<AssetSetting>> {
    // Get the tenant
    const tenant: Tenant = await TenantStorage.getTenant(tenantID);
    // Check if component is active
    if (Utils.isTenantComponentActive(tenant, TenantComponents.ASSET)) {
      // Get the Asset's settings
      const settings = await SettingStorage.getAssetsSettings(tenantID);
      if (settings && settings.asset && settings.asset.connections) {
        // Find connection
        const foundConnection = settings.asset.connections.find((connection) => connection.id === connectionID);
        if (foundConnection) {
          let assetIntegrationImpl = null;
          switch (foundConnection.type) {
            case AssetConnectionType.SCHNEIDER:
              assetIntegrationImpl = new AssetSchneiderIntegration(tenantID, settings.asset, foundConnection);
              break;
          }
          return assetIntegrationImpl;
        }
      }
      Logging.logDebug({
        tenantID: tenant.id,
        module: MODULE_NAME, method: 'getAssetImpl',
        message: 'Asset settings are not configured'
      });
    }
    return null;
  }
}

