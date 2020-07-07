import axios from 'axios';
import BackendError from '../../../exception/BackendError';
import Asset from '../../../types/Asset';
import { AbstractConsumption } from '../../../types/Consumption';
import { ServerAction } from '../../../types/Server';
import { AssetConnectionSetting, AssetSetting } from '../../../types/Setting';
import Constants from '../../../utils/Constants';
import Cypher from '../../../utils/Cypher';
import Utils from '../../../utils/Utils';
import AssetIntegration from '../AssetIntegration';

const MODULE_NAME = 'SchneiderAssetIntegration';

export default class SchneiderAssetIntegration extends AssetIntegration<AssetSetting> {
  public constructor(tenantID: string, settings: AssetSetting, connection: AssetConnectionSetting) {
    super(tenantID, settings, connection);
  }

  public async checkConnection() {
    // Check if connection is initialized
    this.isAssetConnectionInitialized();
    // Get credential params
    const params = this.getCredentialParams();
    // Send credentials to get the token
    await Utils.executePromiseWithTimeout(5000,
      axios.post(`${this.connection.url}/GetToken`, params, {
        headers: this.buildFormHeaders()
      }),
      `Time out error (5s) when trying to test the connection URL '${this.connection.url}/GetToken'`
    );
  }

  public async retrieveMeterValues(asset: Asset): Promise<AbstractConsumption> {
    // Set new Token
    await this.setToken();
    try {
      // Get consumption
      const { data } = await axios.get(
        `${this.connection.url}/Containers/${Constants.DEFAULT_ASSET_SCHNEIDER_BASE_ID}${asset.meterID}/Children`,
        {
          headers: this.buildAuthHeader()
        }
      );
      if (data && data.length > 0) {
        return this.filterConsumptionRequest(asset, data);
      }
    } catch (error) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME,
        method: 'retrieveMeterValues',
        action: ServerAction.REFRESH_ASSET_CONNECTION,
        message: 'Error while retrieving meter values',
        detailedMessages: { error: error.message, stack: error.stack }
      });
    }
    return null;
  }

  private filterConsumptionRequest(asset: Asset, data: any): AbstractConsumption {
    let consumption = {} as AbstractConsumption;
    // Convert data value to number and get consumption
    consumption.consumptionWh = +data[0].Value * 1000;
    consumption.lastConsumptionWh = this.getLastConsumptionWh(asset, +data[0].Value)
    consumption.instantAmpsL1 = +data[6].Value;
    consumption.instantAmpsL2 = +data[7].Value;
    consumption.instantAmpsL3 = +data[8].Value;
    consumption.instantAmps = +data[6].Value + +data[7].Value + +data[8].Value;
    consumption.instantVoltsL1 = +data[11].Value;
    consumption.instantVoltsL2 = +data[13].Value;
    consumption.instantVoltsL3 = +data[15].Value;
    consumption.instantVolts = +data[11].Value + +data[13].Value + +data[15].Value;
    consumption.instantWattsL1 = +data[17].Value * 1000;
    consumption.instantWattsL2 = +data[18].Value * 1000;
    consumption.instantWattsL3 = +data[19].Value * 1000;
    consumption.instantWatts = +data[20].Value * 1000;
    return consumption;
  }

  private async setToken() {
    // Check if connection is initialized
    this.isAssetConnectionInitialized();
    // Get credential params
    const params = this.getCredentialParams();
    // Send credentials to get the token
    const { data } = await Utils.executePromiseWithTimeout(5000,
      axios.post(`${this.connection.url}/GetToken`, params, {
        headers: this.buildFormHeaders()
      }),
      `Time out error (5s) when getting the token with the connection URL '${this.connection.url}/GetToken'`
    );
    // Set Token
    if (data && data.access_token) {
      this.token = data.access_token;
    }
  }

  private getCredentialParams(): URLSearchParams {
    const params = new URLSearchParams();
    params.append('grant_type', 'password');
    params.append('username', this.connection.connection.user);
    params.append('password', Cypher.decrypt(this.connection.connection.password));
    return params;
  }

  private getLastConsumptionWh(asset: Asset, consumptionkWh: number): number {
    const consumptionWh = consumptionkWh * 1000;
    if (asset.consumption && consumptionWh > asset.consumption.consumptionWh) {
      return consumptionWh - asset.consumption.consumptionWh;
    }
    return 0;
  }

  private isAssetConnectionInitialized(): void {
    if (!this.connection) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME,
        method: 'isAssetConnectionInitialized',
        action: ServerAction.CHECK_CONNECTION,
        message: 'No connection provided'
      });
    }
  }

  private buildFormHeaders(): any {
    return {
      'Content-Type': 'application/x-www-form-urlencoded'
    };
  }

  private buildAuthHeader(): any {
    return {
      'Authorization': 'Bearer ' + this.token
    };
  }
}
