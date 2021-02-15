import { AssetConnectionSetting, AssetSetting } from '../../types/Setting';
import Consumption, { AbstractCurrentConsumption } from '../../types/Consumption';

import Asset from '../../types/Asset';

export default abstract class AssetIntegration<T extends AssetSetting> {
  protected readonly tenantID: string;
  protected settings: T;
  protected connection: AssetConnectionSetting;

  protected constructor(tenantID: string, settings: T, connection: AssetConnectionSetting) {
    this.tenantID = tenantID;
    this.settings = settings;
    this.connection = connection;
  }

  abstract checkConnection(): Promise<void>;

  abstract retrieveConsumption(asset: Asset, manualCall?: boolean): Promise<AbstractCurrentConsumption[]>;

}
