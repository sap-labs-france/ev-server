import axios from 'axios';
import BackendError from '../../../exception/BackendError';
import Asset, { SchneiderProperty } from '../../../types/Asset';
import { AbstractCurrentConsumption } from '../../../types/Consumption';
import { ServerAction } from '../../../types/Server';
import { AssetConnectionSetting, AssetSetting } from '../../../types/Setting';
import Constants from '../../../utils/Constants';
import Cypher from '../../../utils/Cypher';
import Utils from '../../../utils/Utils';
import AssetIntegration from '../AssetIntegration';
import Logging from '../../../utils/Logging';

const MODULE_NAME = 'SchneiderAssetIntegration';

export default class SchneiderAssetIntegration extends AssetIntegration<AssetSetting> {
  public constructor(tenantID: string, settings: AssetSetting, connection: AssetConnectionSetting) {
    super(tenantID, settings, connection);
  }

  public async checkConnection(): Promise<void> {
    await this.connect();
  }

  public async retrieveConsumption(asset: Asset): Promise<AbstractCurrentConsumption> {
    // Set new Token
    const token = await this.connect();
    const request = `${this.connection.url}/${asset.meterID}`;
    try {
      // Get consumption
      const response = await axios.get(
        request,
        {
          headers: this.buildAuthHeader(token)
        }
      );
      if (response.data && response.data.length > 0) {
        Logging.logDebug({
          tenantID: this.tenantID,
          source: Constants.CENTRAL_SERVER,
          action: ServerAction.RETRIEVE_ASSET_CONSUMPTION,
          message: `${asset.name} > Schneider web service has been called successfully`,
          module: MODULE_NAME, method: 'retrieveConsumption',
          detailedMessages: { response: response.data }
        });
        return this.filterConsumptionRequest(asset, response.data);
      }
    } catch (error) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME,
        method: 'retrieveConsumption',
        action: ServerAction.RETRIEVE_ASSET_CONSUMPTION,
        message: 'Error while retrieving the asset consumption',
        detailedMessages: { request, token, error: error.message, stack: error.stack, asset }
      });
    }
    return null;
  }

  private filterConsumptionRequest(asset: Asset, data: any[]): AbstractCurrentConsumption {
    const consumption = {} as AbstractCurrentConsumption;
    // Convert data value to number and get consumption
    consumption.currentConsumptionWh = this.computeNewConsumptionWh(
      asset, this.getPropertyValue(data, SchneiderProperty.ENERGY_ACTIVE));
    consumption.lastConsumption = {
      value: consumption.currentConsumptionWh,
      timestamp: new Date()
    };
    // Amperage
    consumption.currentInstantAmpsL1 = this.getPropertyValue(data, SchneiderProperty.AMPERAGE_L1);
    consumption.currentInstantAmpsL2 = this.getPropertyValue(data, SchneiderProperty.AMPERAGE_L2);
    consumption.currentInstantAmpsL3 = this.getPropertyValue(data, SchneiderProperty.AMPERAGE_L3);
    consumption.currentInstantAmps = consumption.currentInstantAmpsL1 + consumption.currentInstantAmpsL2 + consumption.currentInstantAmpsL3;
    // Voltage
    consumption.currentInstantVolts = this.getPropertyValue(data, SchneiderProperty.VOLTAGE);
    consumption.currentInstantVoltsL1 = this.getPropertyValue(data, SchneiderProperty.VOLTAGE_L1);
    consumption.currentInstantVoltsL2 = this.getPropertyValue(data, SchneiderProperty.VOLTAGE_L2);
    consumption.currentInstantVoltsL3 = this.getPropertyValue(data, SchneiderProperty.VOLTAGE_L3);
    // Power
    consumption.currentInstantWatts = this.getPropertyValue(data, SchneiderProperty.POWER_ACTIVE) * 1000;
    consumption.currentInstantWattsL1 = this.getPropertyValue(data, SchneiderProperty.POWER_ACTIVE_L1) * 1000;
    consumption.currentInstantWattsL2 = this.getPropertyValue(data, SchneiderProperty.POWER_ACTIVE_L2) * 1000;
    consumption.currentInstantWattsL3 = this.getPropertyValue(data, SchneiderProperty.POWER_ACTIVE_L3) * 1000;
    return consumption;
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
    const credentials = this.getCredentialURLParams();
    // Send credentials to get the token
    const { data } = await Utils.executePromiseWithTimeout(5000,
      axios.post(`${this.connection.url}/GetToken`, credentials, {
        headers: this.buildFormHeaders()
      }),
      `Time out error (5s) when getting the token with the connection URL '${this.connection.url}/GetToken'`
    );
    // Set Token
    if (data && data.access_token) {
      return data.access_token;
    }
  }

  private getCredentialURLParams(): URLSearchParams {
    const params = new URLSearchParams();
    params.append('grant_type', 'password');
    params.append('username', this.connection.connection.user);
    params.append('password', Cypher.decrypt(this.connection.connection.password));
    return params;
  }

  private computeNewConsumptionWh(asset: Asset, newConsumptionkWh: number): number {
    const newConsumptionWh = newConsumptionkWh * 1000;
    if (asset.lastConsumption && asset.lastConsumption.value < newConsumptionWh) {
      return newConsumptionWh - asset.lastConsumption.value;
    }
    return 0;
  }

  private checkConnectionIsProvided(): void {
    if (!this.connection) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
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
