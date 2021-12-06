import Asset, { AssetType } from '../../../types/Asset';
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
import Utils from '../../../utils/Utils';
import moment from 'moment';

const MODULE_NAME = 'GreencomAssetIntegration';

export default class GreencomAssetIntegration extends AssetIntegration<AssetSetting> {
  private axiosInstance: AxiosInstance;

  public constructor(tenant: Tenant, settings: AssetSetting, connection: AssetConnectionSetting) {
    super(tenant, settings, connection);
    this.axiosInstance = AxiosFactory.getAxiosInstance(tenant);
  }

  public async checkConnection(): Promise<void> {
    await this.connect();
  }

  public async retrieveConsumptions(asset: Asset, manualCall?: boolean): Promise<AbstractCurrentConsumption[]> {
    // Check if refresh interval of connection is exceeded
    if (!manualCall && !this.checkIfIntervalExceeded(asset)) {
      return [];
    }
    // Set new Token
    const token = await this.connect();
    const request = manualCall ?
      `${this.connection.url}/site-api/${asset.meterID}?withEnergy=true&withPower=true&from=${moment().subtract(1, 'minutes').toISOString()}&to=${moment().toISOString()}&step=PT1M` :
      // Check if it is first consumption for this asset
      `${this.connection.url}/site-api/${asset.meterID}?withEnergy=true&withPower=true&from=${(asset.lastConsumption?.timestamp) ? asset.lastConsumption.timestamp.toISOString() : moment().subtract(1, 'minutes').toISOString()}&to=${moment().toISOString()}&step=PT1M`;
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
        message: `${asset.name} > GreenCom web service has been called successfully`,
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

  private filterConsumptionRequest(asset: Asset, data: any): AbstractCurrentConsumption[] {
    const consumptions: AbstractCurrentConsumption[] = [];
    // Check if result is array of consumptions (happens when no consumption was received over some time)
    if (Array.isArray(data.power?.data) || Array.isArray(data.power?.charge?.data)) {
      switch (asset.assetType) {
        case AssetType.CONSUMPTION:
          for (let i = 0; i < data.energy.data.length; i++) {
            const consumption = {
              currentConsumptionWh: data.energy.data[i].value,
              lastConsumption: {
                // Timestamp in array is always start date of the one minute interval
                timestamp: moment(data.energy.data[i].timestamp).add(1, 'minutes').toDate(),
                value: data.energy.data[i].value
              },
              currentInstantWatts: data.power.data[i].value,
            } as AbstractCurrentConsumption;
            if (asset.siteArea?.voltage) {
              consumption.currentInstantAmps = consumption.currentInstantWatts / asset.siteArea.voltage;
            }
            consumptions.push(consumption);
          }
          break;
        case AssetType.PRODUCTION:
          for (let i = 0; i < data.energy.data.length; i++) {
            const consumption = {
              currentConsumptionWh: data.energy.data[i].value * -1,
              lastConsumption: {
                timestamp: moment(data.energy.data[i].timestamp).add(1, 'minutes').toDate(),
                value: data.energy.data[i].value
              },
              currentInstantWatts: data.power.data[i].value * -1,
            } as AbstractCurrentConsumption;
            if (asset.siteArea?.voltage) {
              consumption.currentInstantAmps = consumption.currentInstantWatts / asset.siteArea.voltage;
            }
            consumptions.push(consumption);
          }
          break;
        case AssetType.CONSUMPTION_AND_PRODUCTION:
          for (let i = 0; i < data.energy.charge.data.length; i++) {
            const consumption = {
              currentConsumptionWh: data.energy.charge.data[i].value - data.energy.discharge.data[i].value,
              lastConsumption:{
                timestamp: moment(data.energy.charge.data[i].timestamp).add(1, 'minutes').toDate(),
                value: data.energy.charge.data[i].value - data.energy.discharge.data[i].value,
              },
              currentInstantWatts: data.power.charge.data[i].value - data.power.discharge.data[i].value,
              currentStateOfCharge: data.percent?.soc?.data[i].value,
            } as AbstractCurrentConsumption;
            if (asset.siteArea?.voltage) {
              consumption.currentInstantAmps = consumption.currentInstantWatts / asset.siteArea.voltage;
            }
            consumptions.push(consumption);
          }
          break;
      }
    } else if (data.power && data.energy) {
      const consumption = {} as AbstractCurrentConsumption;
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
          consumption.currentStateOfCharge = data.percent?.soc?.current;
          break;
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
      consumptions.push(consumption);
    }
    return consumptions;
  }

  private async connect(): Promise<string> {
    // Check if connection is initialized
    this.checkConnectionIsProvided();
    // Get Authentication
    const credentials = await this.getAuthentication();
    // Send credentials to get the token
    const response = await Utils.executePromiseWithTimeout(5000,
      this.axiosInstance.post(`${this.connection.url}/authentication-api/tokens`,
        credentials,
        {
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

  private async getAuthentication(): Promise<{grant_type: string; client_id: string; client_secret: string;}> {
    return {
      'grant_type': 'client_credentials',
      'client_id': this.connection.greencomConnection.clientId,
      'client_secret': await Cypher.decrypt(this.tenant, this.connection.greencomConnection.clientSecret)
    };
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
      'Content-Type': 'application/json'
    };
  }

  private buildAuthHeader(token: string): any {
    return {
      'Authorization': 'Bearer ' + token
    };
  }
}
