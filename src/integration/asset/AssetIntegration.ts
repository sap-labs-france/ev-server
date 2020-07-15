import { AssetConnectionSetting, AssetSetting } from '../../types/Setting';
import { AbstractCurrentConsumption } from '../../types/Consumption';
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

  async abstract checkConnection(): Promise<void>;

  async abstract retrieveConsumption(asset: Asset): Promise<AbstractCurrentConsumption>;
}
