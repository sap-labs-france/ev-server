import Asset, { AssetType, SchneiderProperty } from '../../../types/Asset';
import { AssetConnectionSetting, AssetSetting } from '../../../types/Setting';

import { AbstractCurrentConsumption } from '../../../types/Consumption';
import AssetIntegration from '../AssetIntegration';
import AxiosFactory from '../../../utils/AxiosFactory';
import { AxiosInstance } from 'axios';
import BackendError from '../../../exception/BackendError';
import Cypher from '../../../utils/Cypher';
import Logging from '../../../utils/Logging';
import { ServerAction } from '../../../types/Server';
import Tenant from '../../../types/Tenant';
import { URLSearchParams } from 'url';
import Utils from '../../../utils/Utils';

const MODULE_NAME = 'SchneiderAssetIntegration';

export default class SchneiderAssetIntegration extends AssetIntegration<AssetSetting> {
  private axiosInstance: AxiosInstance;

  public constructor(tenant: Tenant, settings: AssetSetting, connection: AssetConnectionSetting) {
    super(tenant, settings, connection);
    this.axiosInstance = AxiosFactory.getAxiosInstance(tenant);
  }

  public async checkConnection(): Promise<void> {
    await this.connect();
  }

  public async retrieveConsumptions(asset: Asset, manualCall: boolean): Promise<AbstractCurrentConsumption[]> {
    // Check if refresh interval of connection is exceeded
    if (!manualCall && !this.checkIfIntervalExceeded(asset)) {
      return [];
    }
    // Set new Token
    const token = await this.connect();
    const request = `${this.connection.url}/${asset.meterID}`;
    try {
      // Get consumption
      const response = await this.axiosInstance.get(
        request,
        {
          headers: this.buildAuthHeader(token)
        }
      );
      await Logging.logDebug({
        tenantID: this.tenant.id,
        action: ServerAction.RETRIEVE_ASSET_CONSUMPTION,
        message: `${asset.name} > Schneider web service has been called successfully`,
        module: MODULE_NAME, method: 'retrieveConsumption',
        detailedMessages: { response: response.data }
      });
      return this.filterConsumptionRequest(asset, response.data);
    } catch (error) {
      throw new BackendError({
        module: MODULE_NAME,
        method: 'retrieveConsumption',
        action: ServerAction.RETRIEVE_ASSET_CONSUMPTION,
        message: 'Error while retrieving the asset consumption',
        detailedMessages: { request, token, error: error.stack, asset }
      });
    }
  }


  private filterConsumptionRequest(asset: Asset, data: any[]): AbstractCurrentConsumption[] {
    const consumption = {} as AbstractCurrentConsumption;
    // Convert data value to number and get consumption
    const newConsumptionWh = this.getPropertyValue(data, SchneiderProperty.ENERGY_ACTIVE) * 1000;
    if (asset.lastConsumption && asset.lastConsumption.value < newConsumptionWh) {
      consumption.currentConsumptionWh = newConsumptionWh - asset.lastConsumption.value;
    }
    consumption.lastConsumption = {
      value: newConsumptionWh,
      timestamp: new Date()
    };
    const energyDirection = asset.assetType === AssetType.PRODUCTION ? -1 : 1;
    // Amperage
    consumption.currentInstantAmpsL1 = this.getPropertyValue(data, SchneiderProperty.AMPERAGE_L1) * energyDirection;
    consumption.currentInstantAmpsL2 = this.getPropertyValue(data, SchneiderProperty.AMPERAGE_L2) * energyDirection;
    consumption.currentInstantAmpsL3 = this.getPropertyValue(data, SchneiderProperty.AMPERAGE_L3) * energyDirection;
    consumption.currentInstantAmps = consumption.currentInstantAmpsL1 + consumption.currentInstantAmpsL2 + consumption.currentInstantAmpsL3;
    // Voltage
    consumption.currentInstantVolts = this.getPropertyValue(data, SchneiderProperty.VOLTAGE);
    consumption.currentInstantVoltsL1 = this.getPropertyValue(data, SchneiderProperty.VOLTAGE_L1);
    consumption.currentInstantVoltsL2 = this.getPropertyValue(data, SchneiderProperty.VOLTAGE_L2);
    consumption.currentInstantVoltsL3 = this.getPropertyValue(data, SchneiderProperty.VOLTAGE_L3);
    // Power
    consumption.currentInstantWatts = this.getPropertyValue(data, SchneiderProperty.POWER_ACTIVE) * 1000 * energyDirection;
    consumption.currentInstantWattsL1 = this.getPropertyValue(data, SchneiderProperty.POWER_ACTIVE_L1) * 1000 * energyDirection;
    consumption.currentInstantWattsL2 = this.getPropertyValue(data, SchneiderProperty.POWER_ACTIVE_L2) * 1000 * energyDirection;
    consumption.currentInstantWattsL3 = this.getPropertyValue(data, SchneiderProperty.POWER_ACTIVE_L3) * 1000 * energyDirection;
    return [consumption];
  }

  private getPropertyValue(data: any[], propertyName: string): number {
    for (const measure of data) {
      if (measure.Name === propertyName) {
        return Utils.convertToFloat(measure.Value);
      }
    }
    return 0;
  }

  private async connect(): Promise<string> {
    // Check if connection is initialized
    this.checkConnectionIsProvided();
    // Get credential params
    const credentials = await this.getCredentialURLParams();
    // Send credentials to get the token
    const response = await Utils.executePromiseWithTimeout(5000,
      this.axiosInstance.post(`${this.connection.url}/GetToken`,
        credentials,
        {
          'axios-retry': {
            retries: 0
          },
          headers: this.buildFormHeaders()
        }),
      `Time out error (5s) when getting the token with the connection URL '${this.connection.url}/GetToken'`
    );
    // Return the Token
    return response.data.access_token;
  }

  private async getCredentialURLParams(): Promise<URLSearchParams> {
    const params = new URLSearchParams();
    params.append('grant_type', 'password');
    params.append('username', this.connection.schneiderConnection.user);
    params.append('password', await Cypher.decrypt(this.tenant, this.connection.schneiderConnection.password));
    return params;
  }

  private checkConnectionIsProvided(): void {
    if (!this.connection) {
      throw new BackendError({
        module: MODULE_NAME,
        method: 'checkConnectionIsProvided',
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

  private buildAuthHeader(token: string): any {
    return {
      'Authorization': 'Bearer ' + token
    };
  }
}
