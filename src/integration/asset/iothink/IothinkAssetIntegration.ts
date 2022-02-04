import Asset, { AssetConnectionToken, AssetType, IothinkProperty } from '../../../types/Asset';
import { AssetConnectionSetting, AssetSetting } from '../../../types/Setting';

import { AbstractCurrentConsumption } from '../../../types/Consumption';
import AssetIntegration from '../AssetIntegration';
import AssetTokenCache from '../AssetTokenCache';
import AxiosFactory from '../../../utils/AxiosFactory';
import { AxiosInstance } from 'axios';
import BackendError from '../../../exception/BackendError';
import Cypher from '../../../utils/Cypher';
import Logging from '../../../utils/Logging';
import { ServerAction } from '../../../types/Server';
import Tenant from '../../../types/Tenant';
import { URLSearchParams } from 'url';
import Utils from '../../../utils/Utils';
import moment from 'moment';

const MODULE_NAME = 'IothinkAssetIntegration';

export default class IothinkAssetIntegration extends AssetIntegration<AssetSetting> {
  private axiosInstance: AxiosInstance;
  private timestampReference = moment.utc('20000101 00:00:00', 'YYYYMMDD HH:mm:ss');

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
        tenantID: this.tenant.id,
        action: ServerAction.RETRIEVE_ASSET_CONSUMPTION,
        message: `${asset.name} > Iothink web service has been called successfully`,
        module: MODULE_NAME, method: 'retrieveConsumption',
        detailedMessages: { response: response.data }
      });
      return this.filterConsumptionRequest(asset, response.data, manualCall);
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
        if (Utils.isUndefined(mergedConsumption[IothinkProperty.IO_POW_ACTIVE]) &&
            Utils.isUndefined(mergedConsumption[IothinkProperty.IO_POW_L1]) &&
            Utils.isUndefined(mergedConsumption[IothinkProperty.IO_POW_L2]) &&
            Utils.isUndefined(mergedConsumption[IothinkProperty.IO_POW_L3])) {
          // Skip if current power is undefined
          continue;
        }
        const consumption = {} as AbstractCurrentConsumption;
        switch (asset.assetType) {
          case AssetType.CONSUMPTION:
          case AssetType.PRODUCTION:
            if (!Utils.isUndefined(mergedConsumption[IothinkProperty.IO_POW_ACTIVE])) {
              consumption.currentInstantWatts = Utils.createDecimal(this.getPropertyValue(mergedConsumption, IothinkProperty.IO_POW_ACTIVE)).mul(energyDirection * 1000).toNumber();
            } else {
              consumption.currentInstantWatts = Utils.createDecimal(this.getPropertyValue(mergedConsumption, IothinkProperty.IO_POW_L1))
                .plus(this.getPropertyValue(mergedConsumption, IothinkProperty.IO_POW_L2))
                .plus(this.getPropertyValue(mergedConsumption, IothinkProperty.IO_POW_L3)).mul(energyDirection * 1000).toNumber();
            }
            if (!Utils.isUndefined(mergedConsumption[IothinkProperty.IO_ENERGY_INPUT])) {
              consumption.currentTotalConsumptionWh = Utils.createDecimal(this.getPropertyValue(mergedConsumption, IothinkProperty.IO_ENERGY_INPUT)).mul(1000).toNumber();
            } else {
              consumption.currentTotalConsumptionWh =
                Utils.createDecimal(this.getPropertyValue(mergedConsumption, IothinkProperty.IO_ENERGY_L1))
                  .plus(this.getPropertyValue(mergedConsumption, IothinkProperty.IO_ENERGY_L2))
                  .plus(this.getPropertyValue(mergedConsumption, IothinkProperty.IO_ENERGY_L3)).mul(1000).toNumber();
            }
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
            consumption.currentConsumptionWh = Utils.createDecimal(this.getPropertyValue(mergedConsumption, IothinkProperty.IO_ENERGY_CHARGE)
              - this.getPropertyValue(mergedConsumption, IothinkProperty.IO_ENERGY_DISCHARGE)).mul(1000).toNumber();
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
    // Get token from cache
    const key = this.connection.id + this.connection.iothinkConnection.user + this.connection.iothinkConnection.password;
    let token = AssetTokenCache.getInstanceForTenant(this.tenant).getToken(key);
    if (!token) {
      this.checkConnectionIsProvided();
      // Get a fresh token (if not found or expired)
      token = await this.fetchAssetProviderToken(await this.getCredentialURLParams());
      // Cache it for better performance
      AssetTokenCache.getInstanceForTenant(this.tenant).setToken(this.connection.id, token);
    }
    return token.accessToken;
  }

  private async fetchAssetProviderToken(credentials: URLSearchParams): Promise<AssetConnectionToken> {
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
    return {
      accessToken: response.data.access_token,
      tokenType: response.data.token_type,
      expiresIn: response.data.expires_in,
      userName: response.data.userName,
      issued: response.data['.issued'],
      expires: response.data['.expires']
    };
  }

  private async getCredentialURLParams(): Promise<URLSearchParams> {
    const params = new URLSearchParams();
    params.append('grant_type', 'password');
    params.append('username', this.connection.iothinkConnection.user);
    params.append('password', await Cypher.decrypt(this.tenant, this.connection.iothinkConnection.password));
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
