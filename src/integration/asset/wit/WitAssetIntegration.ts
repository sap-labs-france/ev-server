import Asset, { AssetType } from '../../../types/Asset';
import { AssetConnectionSetting, AssetSetting } from '../../../types/Setting';

import { AbstractCurrentConsumption } from '../../../types/Consumption';
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

const MODULE_NAME = 'WitAssetIntegration';

export default class WitAssetIntegration extends AssetIntegration<AssetSetting> {
  private axiosInstance: AxiosInstance;

  public constructor(tenantID: string, settings: AssetSetting, connection: AssetConnectionSetting) {
    super(tenantID, settings, connection);
    this.axiosInstance = AxiosFactory.getAxiosInstance(tenantID);
  }

  public async checkConnection(): Promise<void> {
    await this.connect();
  }

  public async retrieveConsumptions(asset: Asset, manualCall: boolean): Promise<AbstractCurrentConsumption[]> {
    if (asset.lastConsumption?.timestamp && moment(asset.lastConsumption.timestamp).add(this.connection.witConnection.refreshInterval, 'minutes') > moment()) {
      return [];
    }
    // Set new Token
    const token = await this.connect();
    const request = manualCall ?
      `${this.connection.url}/${asset.meterID}?From=${moment().subtract(this.connection.witConnection.refreshInterval, 'minutes').toISOString()}` :
      // Check if it is first consumption for this asset
      `${this.connection.url}/${asset.meterID}?From=${(asset.lastConsumption?.timestamp) ? asset.lastConsumption.timestamp.toISOString() : moment().startOf('day').toISOString()}`;
    try {
      // Get consumption
      const response = await this.axiosInstance.get(
        request,
        {
          headers: this.buildAuthHeader(token)
        }
      );
      await Logging.logDebug({
        tenantID: this.tenantID,
        source: Constants.CENTRAL_SERVER,
        action: ServerAction.RETRIEVE_ASSET_CONSUMPTION,
        message: `${asset.name} > WIT web service has been called successfully`,
        module: MODULE_NAME, method: 'retrieveConsumption',
        detailedMessages: { response: response.data }
      });
      return this.filterConsumptionRequest(asset, response.data, manualCall);
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

  private filterConsumptionRequest(asset: Asset, data: any, manualCall: boolean): AbstractCurrentConsumption[] {
    const consumptions: AbstractCurrentConsumption[] = [];
    if (!Utils.isEmptyArray(data)) {
      for (const dataset of data) {
        const consumption = {} as AbstractCurrentConsumption;
        switch (asset.assetType) {
          case AssetType.CONSUMPTION:
            consumption.currentInstantWatts = Utils.createDecimal(dataset.V).mul(1000).toNumber();
            consumption.currentConsumptionWh = Utils.createDecimal(consumption.currentInstantWatts).
              mul(Utils.createDecimal(this.connection.witConnection.refreshInterval / 60)).toNumber() ;
            consumption.lastConsumption = {
              timestamp: dataset.T,
              value: consumption.currentConsumptionWh
            };
            break;
          case AssetType.PRODUCTION:
            consumption.currentInstantWatts = Utils.createDecimal(dataset.V).mul(-1000).toNumber();
            consumption.currentConsumptionWh = Utils.createDecimal(consumption.currentInstantWatts).
              mul(Utils.createDecimal(this.connection.witConnection.refreshInterval / 60)).toNumber() ;
            consumption.lastConsumption = {
              timestamp: dataset.T,
              value: consumption.currentConsumptionWh
            };
            break;
          case AssetType.CONSUMPTION_AND_PRODUCTION:
            throw new Error('Asset connection does not support producing and consuming assets');
        }
        consumptions.push(consumption);
      }
    }
    if (manualCall) {
      return !Utils.isEmptyArray(consumptions) ? [consumptions[consumptions.length - 1]] : [];
    }
    return consumptions;
  }

  private async connect(): Promise<string> {
    // Check if connection is initialized
    this.checkConnectionIsProvided();
    // Get credential params
    const credentials = await this.getCredentialURLParams();
    // Send credentials to get the token
    const response = await Utils.executePromiseWithTimeout(5000,
      this.axiosInstance.post(`${this.connection.witConnection.authenticationUrl}/token`,
        credentials,
        {
          // @ts-ignore
          'axios-retry': {
            retries: 0
          },
          headers: this.buildFormHeaders()
        }),
      `Time out error (5s) when getting the token with the connection URL '${this.connection.witConnection.authenticationUrl}/token'`
    );
    // Return the Token
    return response.data.access_token;
  }

  private async getCredentialURLParams(): Promise<URLSearchParams> {
    const params = new URLSearchParams();
    params.append('client_id', this.connection.witConnection.clientId);
    params.append('client_secret', await Cypher.decrypt(this.tenantID, this.connection.witConnection.clientSecret));
    params.append('grant_type', 'password');
    params.append('username', this.connection.witConnection.user);
    params.append('password', await Cypher.decrypt(this.tenantID, this.connection.witConnection.password));
    params.append('scope', 'https://api.wit-datacenter.com');
    return params;
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
