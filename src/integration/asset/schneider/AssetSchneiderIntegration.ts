import { AssetConnectionSetting, AssetSetting } from '../../../types/Setting';

import AssetIntegration from '../AssetIntegration';

const MODULE_NAME = 'AssetSchneiderIntegration';

export default class AssetSchneiderIntegration extends AssetIntegration<AssetSetting> {
  public constructor(tenantID: string, settings: AssetSetting, connection: AssetConnectionSetting) {
    super(tenantID, settings, connection);
  }

  public async checkConnection() {
    // TODO: Check connection provided in 'this.connection' and throw an exception in case of failure
  }
}
