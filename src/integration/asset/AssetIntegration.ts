import { AssetConnectionSetting, AssetConnectionTokenSetting, AssetSettings } from '../../types/Setting';

import { AbstractCurrentConsumption } from '../../types/Consumption';
import Asset from '../../types/Asset';
import Tenant from '../../types/Tenant';
import Utils from '../../utils/Utils';
import moment from 'moment';

export default abstract class AssetIntegration {
  protected readonly tenant: Tenant;
  protected settings: AssetSettings;
  protected connection: AssetConnectionSetting;

  protected constructor(tenant: Tenant, settings: AssetSettings, connection: AssetConnectionSetting) {
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

  public checkIfTokenExpired(token: AssetConnectionTokenSetting): boolean {
    if (!Utils.isNullOrUndefined(token)) {
      return moment(new Date(token.expires)).subtract(60, 'seconds').isBefore();
    }
    // return true by default if token is not valid
    return true;
  }

  public addConnectionToSensitiveData(): void {
    const connectionIndex = this.settings.asset.connections.findIndex((connection) => connection.id === this.connection.id);
    const currentSensitiveData = new Set(this.settings.sensitiveData);
    currentSensitiveData.add(`content.asset.connections[${connectionIndex}].token.accessToken`);
    this.settings.sensitiveData = Array.from(currentSensitiveData);
  }

  abstract checkConnection(): Promise<void>;

  abstract retrieveConsumptions(asset: Asset, manualCall?: boolean): Promise<AbstractCurrentConsumption[]>;
}
