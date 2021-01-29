import Asset, { AssetType } from '../../../types/Asset';
import { AssetConnectionSetting, AssetSetting } from '../../../types/Setting';
import Consumption, { AbstractCurrentConsumption } from '../../../types/Consumption';

import AssetIntegration from '../AssetIntegration';
import AxiosFactory from '../../../utils/AxiosFactory';
import { AxiosInstance } from 'axios';
import BackendError from '../../../exception/BackendError';
import Constants from '../../../utils/Constants';
import Cypher from '../../../utils/Cypher';
import Logging from '../../../utils/Logging';
import { ServerAction } from '../../../types/Server';
import Utils from '../../../utils/Utils';
import moment from 'moment';

const MODULE_NAME = 'GreencomAssetIntegration';

export default class GreencomAssetIntegration extends AssetIntegration<AssetSetting> {
  private axiosInstance: AxiosInstance;

  public constructor(tenantID: string, settings: AssetSetting, connection: AssetConnectionSetting) {
    super(tenantID, settings, connection);
    this.axiosInstance = AxiosFactory.getAxiosInstance(tenantID);
  }

  public async checkConnection(): Promise<void> {
    await this.connect();
  }

  public async retrieveConsumption(asset: Asset, manualCall?: boolean): Promise<AbstractCurrentConsumption> {
    // Set new Token
    const token = await this.connect();
    const request = manualCall ?
      `${this.connection.url}/site-api/${asset.meterID}?withEnergy=true&withPower=true&from=${moment().subtract(1, 'minutes').toISOString()}&to=${moment().toISOString()}&step=PT1M` :
      `${this.connection.url}/site-api/${asset.meterID}?withEnergy=true&withPower=true&from=${asset.lastConsumption.timestamp.toISOString()}&to=${moment().toISOString()}&step=PT1M`;
    try {
      // Get consumption
      const response = await this.axiosInstance.get(
        request,
        {
          headers: this.buildAuthHeader(token)
        }
      );
      Logging.logDebug({
        tenantID: this.tenantID,
        source: Constants.CENTRAL_SERVER,
        action: ServerAction.RETRIEVE_ASSET_CONSUMPTION,
        message: `${asset.name} > GreenCom web service has been called successfully`,
        module: MODULE_NAME, method: 'retrieveConsumption',
        detailedMessages: { response: response.data }
      });
      return this.filterConsumptionRequest(asset, response.data);
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
  }

  private filterConsumptionRequest(asset: Asset, data: any): AbstractCurrentConsumption {
    const consumption = {} as AbstractCurrentConsumption;
    // Convert data
    if (data.power && data.energy) {
      switch (asset.assetType) {
        case AssetType.CONSUMPTION:
          consumption.currentInstantWatts = data.power.average;
          consumption.currentConsumptionWh = data.energy.sum;
          break;
        case AssetType.PRODUCTION:
          consumption.currentInstantWatts = data.power.average * -1;
          consumption.currentConsumptionWh = data.energy.sum * -1;
          break;
        case AssetType.CONSUMPTION_AND_PRODUCTION:
          consumption.currentInstantWatts = data.power.charge.average - data.power.discharge.average;
          consumption.currentConsumptionWh = data.energy.charge.sum - data.energy.discharge.sum;
          break;
      }
    }
    // Check if site area provided and set amp value
    if (asset.siteArea?.voltage) {
      consumption.currentInstantAmps = consumption.currentInstantWatts / asset.siteArea.voltage;
    }

    // Set last consumption
    consumption.lastConsumption = {
      value: consumption.currentConsumptionWh,
      timestamp: new Date()
    };

    return consumption;
  }

  private async connect(): Promise<string> {
    // Check if connection is initialized
    this.checkConnectionIsProvided();
    // Get Authentication
    const credentials = this.getAuthentication();
    // Send credentials to get the token
    const response = await Utils.executePromiseWithTimeout(5000,
      this.axiosInstance.post(`${this.connection.url}/authentication-api/tokens`,
        credentials,
        {
          // @ts-ignore
          'axios-retry': {
            retries: 0
          },
          headers: this.buildFormHeaders()
        }),
      `Time out error (5s) when getting the token with the connection URL '${this.connection.url}/authentication-api/tokens'`
    );
    // Return the Token
    return response.data.access_token;
  }

  private getAuthentication(): any {
    return {
      'grant_type': 'client_credentials',
      'client_id': this.connection.greencomConnection.clientId,
      'client_secret': Cypher.decrypt(this.connection.greencomConnection.clientSecret)
    };
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
      'Content-Type': 'application/json'
    };
  }

  private buildAuthHeader(token: string): any {
    return {
      'Authorization': 'Bearer ' + token
    };
  }
}
