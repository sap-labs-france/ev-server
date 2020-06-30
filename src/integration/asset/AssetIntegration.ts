import { AssetConnectionSetting, AssetSetting } from '../../types/Setting';
import Asset from '../../types/Asset';
import { AbstractConsumption } from '../../types/Consumption';

export default abstract class AssetIntegration<T extends AssetSetting> {
  protected readonly tenantID: string;
  protected settings: T;
  protected connection: AssetConnectionSetting;

  protected constructor(tenantID: string, settings: T, connection: AssetConnectionSetting) {
    this.tenantID = tenantID;
    this.settings = settings;
    this.connection = connection;
  }

  async abstract checkConnection();
  async abstract retrieveMeterValuesByID(asset: Asset, meterID: string): Promise<AbstractConsumption>;
}
