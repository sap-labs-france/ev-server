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
    // Check if refresh interval of connection is exceeded
    if (!manualCall && !this.checkIfIntervalExceeded(asset)) {
      return [];
    }
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
    // Create helper map to merge the arrays to combined objects
    const mergedResponseMap = new Map();
    // Rename the value property in logs with tag reference
    for (const dataSet of data.historics) {
      for (const log of dataSet.logs) {
        log[dataSet.tagReference] = log['value'];
        delete log['value'];
        mergedResponseMap.set(log.timestamp, { ...mergedResponseMap.get(log.timestamp), ...log });
      }
    }
    // Create Array with merged consumptions from map
    const mergedResponseArray = Array.from(mergedResponseMap.values());
    // Sort the Array according the timestamp
    mergedResponseArray.sort((a, b) => a.timestamp - b.timestamp);
    const energyDirection = asset.assetType === AssetType.PRODUCTION ? -1 : 1;
    if (!Utils.isEmptyArray(mergedResponseArray)) {
      for (const mergedConsumption of mergedResponseArray) {
        if (Utils.isUndefined(mergedConsumption[IothinkProperty.IO_POW_ACTIVE])) {
          // Skip if current power is undefined
          continue;
        }
        const consumption = {} as AbstractCurrentConsumption;
        switch (asset.assetType) {
          case AssetType.CONSUMPTION:
            consumption.currentInstantWatts = Utils.createDecimal(this.getPropertyValue(mergedConsumption, IothinkProperty.IO_POW_ACTIVE)).mul(energyDirection * 1000).toNumber();
            consumption.currentTotalConsumptionWh = this.getPropertyValue(mergedConsumption, IothinkProperty.IO_ENERGY_INPUT);
            if (asset.siteArea?.voltage) {
              consumption.currentInstantAmps = Utils.createDecimal(consumption.currentInstantWatts).div(asset.siteArea.voltage).toNumber();
            }
            consumption.lastConsumption = {
              timestamp: moment(this.timestampReference).add(mergedConsumption.timestamp, 'seconds').toDate(),
              value: consumption.currentTotalConsumptionWh
            };
            break;
          case AssetType.PRODUCTION:
            consumption.currentInstantWatts = Utils.createDecimal(this.getPropertyValue(mergedConsumption, IothinkProperty.IO_POW_ACTIVE)).mul(energyDirection * 1000).toNumber();
            consumption.currentTotalConsumptionWh = this.getPropertyValue(mergedConsumption, IothinkProperty.IO_ENERGY);
            if (asset.siteArea?.voltage) {
              consumption.currentInstantAmps = Utils.createDecimal(consumption.currentInstantWatts).div(asset.siteArea.voltage).toNumber();
            }
            consumption.lastConsumption = {
              timestamp: moment(this.timestampReference).add(mergedConsumption.timestamp, 'seconds').toDate(),
              value: consumption.currentTotalConsumptionWh
            };
            break;
          case AssetType.CONSUMPTION_AND_PRODUCTION:
            consumption.currentInstantWatts = Utils.createDecimal(this.getPropertyValue(mergedConsumption, IothinkProperty.IO_POW_ACTIVE)).mul(1000).toNumber();
            consumption.currentStateOfCharge = this.getPropertyValue(mergedConsumption, IothinkProperty.IO_SOC);
            consumption.currentConsumptionWh = this.getPropertyValue(mergedConsumption, IothinkProperty.IO_ENERGY_CHARGE)
            - this.getPropertyValue(mergedConsumption, IothinkProperty.IO_ENERGY_DISCHARGE);
            if (asset.siteArea?.voltage) {
              consumption.currentInstantAmps = Utils.createDecimal(consumption.currentInstantWatts).div(asset.siteArea.voltage).toNumber();
            }
            consumption.lastConsumption = {
              timestamp: moment(this.timestampReference).add(mergedConsumption.timestamp, 'seconds').toDate(),
              value: consumption.currentConsumptionWh
            };
            break;
        }
        consumptions.push(consumption);
      }
    }
    if (manualCall) {
      return !Utils.isEmptyArray(consumptions) ? [consumptions[consumptions.length - 1]] : [];
    }
    return consumptions;
  }

  private getPropertyValue(data: any, propertyName: string): number {
    if (!Utils.isUndefined(data[propertyName])) {
      return Utils.convertToFloat(data[propertyName]);
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
