import Asset, { AssetType, IothinkProperty } from '../../../types/Asset';
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

const MODULE_NAME = 'IothinkAssetIntegration';

export default class IothinkAssetIntegration extends AssetIntegration<AssetSetting> {
  private axiosInstance: AxiosInstance;
  private timestampReference = moment.utc('20000101 00:00:00', 'YYYYMMDD HH:mm:ss');

  public constructor(tenantID: string, settings: AssetSetting, connection: AssetConnectionSetting) {
    super(tenantID, settings, connection);
    this.axiosInstance = AxiosFactory.getAxiosInstance(tenantID);
  }

  public async checkConnection(): Promise<void> {
    await this.connect();
  }

  public async retrieveConsumptions(asset: Asset, manualCall: boolean): Promise<AbstractCurrentConsumption[]> {
    // Set new Token
    const token = await this.connect();
    // Calculate timestamp of the last consumption in seconds from 1.1.2000, if not available get start of day
    const timestampStart = moment(asset.lastConsumption?.timestamp ? asset.lastConsumption.timestamp : moment().startOf('day')).diff(this.timestampReference, 'seconds');
    const request = `${this.connection.url}/${asset.meterID}&startTime=${timestampStart}`;
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
        message: `${asset.name} > Iothink web service has been called successfully`,
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
    const energyDirection = asset.assetType === AssetType.PRODUCTION ? -1 : 1;
    if (!Utils.isEmptyArray(data.historics)) {
      for (let i = 0; i < data.historics[0].logs.length; i++) {
        const consumption = {} as AbstractCurrentConsumption;
        consumption.currentInstantWatts = this.getPropertyValue(data.historics, IothinkProperty.POWER_ACTIVE, i) * energyDirection;
        consumption.currentInstantWattsL1 = this.getPropertyValue(data.historics, IothinkProperty.POWER_L1, i) * energyDirection;
        consumption.currentInstantWattsL2 = this.getPropertyValue(data.historics, IothinkProperty.POWER_L2, i) * energyDirection;
        consumption.currentInstantWattsL3 = this.getPropertyValue(data.historics, IothinkProperty.POWER_L3, i) * energyDirection;
        if (asset.siteArea?.voltage) {
          consumption.currentInstantAmps = consumption.currentInstantWatts / asset.siteArea.voltage;
          consumption.currentInstantAmpsL1 = consumption.currentInstantWattsL1 / asset.siteArea.voltage;
          consumption.currentInstantAmpsL2 = consumption.currentInstantWattsL2 / asset.siteArea.voltage;
          consumption.currentInstantAmpsL3 = consumption.currentInstantWattsL3 / asset.siteArea.voltage;
        }
        consumption.lastConsumption = {
          timestamp: moment(this.timestampReference).add(data.historics[0].logs[i].timestamp, 'seconds').toDate(),
          value: consumption.currentInstantWatts / 60
        };
        consumptions.push(consumption);
      }
    }
    if (manualCall) {
      return !Utils.isEmptyArray(consumptions) ? [consumptions[consumptions.length - 1]] : [];
    }
    return consumptions;
  }

  private getPropertyValue(data: any[], propertyName: string, index: number): number {
    for (const measure of data) {
      if (measure.tagReference === propertyName) {
        return Utils.convertToFloat(Utils.createDecimal(measure.logs[index]?.value ? measure.logs[index].value : 0)) * 1000;
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
      this.axiosInstance.post(`${this.connection.url}/token`,
        credentials,
        {
          // @ts-ignore
          'axios-retry': {
            retries: 0
          },
          headers: this.buildFormHeaders()
        }),
      `Time out error (5s) when getting the token with the connection URL '${this.connection.url}/token'`
    );
    // Return the Token
    return response.data.access_token;
  }

  private async getCredentialURLParams(): Promise<URLSearchParams> {
    const params = new URLSearchParams();
    params.append('grant_type', 'password');
    params.append('username', this.connection.iothinkConnection.user);
    params.append('password', await Cypher.decrypt(this.tenantID, this.connection.iothinkConnection.password));
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
