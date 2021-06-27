import { AssetConnectionSetting, AssetSetting } from '../../types/Setting';

import { AbstractCurrentConsumption } from '../../types/Consumption';
import Asset from '../../types/Asset';
import Tenant from '../../types/Tenant';
import moment from 'moment';

export default abstract class AssetIntegration<T extends AssetSetting> {
  protected readonly tenant: Tenant;
  protected settings: T;
  protected connection: AssetConnectionSetting;

  protected constructor(tenant: Tenant, settings: T, connection: AssetConnectionSetting) {
    this.tenant = tenant;
    this.settings = settings;
    this.connection = connection;
  }

  public checkIfIntervalExceeded(asset: Asset): boolean {
    if (asset.lastConsumption?.timestamp && this.connection.refreshIntervalMins &&
      moment() < moment(asset.lastConsumption.timestamp).add(this.connection.refreshIntervalMins, 'minutes')) {
      return false;
    }
    return true;
  }

  abstract checkConnection(): Promise<void>;

  abstract retrieveConsumptions(asset: Asset, manualCall?: boolean): Promise<AbstractCurrentConsumption[]>;
}
