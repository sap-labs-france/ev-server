import { CarConnectorConnectionSetting, CarConnectorConnectionToken, CarConnectorSettings } from '../../../types/Setting';

import AxiosFactory from '../../../utils/AxiosFactory';
import { AxiosInstance } from 'axios';
import BackendError from '../../../exception/BackendError';
import { Car } from '../../../types/Car';
import CarConnectorIntegration from '../CarConnectorIntegration';
import Cypher from '../../../utils/Cypher';
import Logging from '../../../utils/Logging';
import { ServerAction } from '../../../types/Server';
import SettingStorage from '../../../storage/mongodb/SettingStorage';
import Tenant from '../../../types/Tenant';
import { URLSearchParams } from 'url';
import Utils from '../../../utils/Utils';

const MODULE_NAME = 'TronityCarConnectorIntegration';

export default class TronityCarConnectorIntegration extends CarConnectorIntegration<CarConnectorSettings> {
  private axiosInstance: AxiosInstance;

  public constructor(tenant: Tenant, settings: CarConnectorSettings, connection: CarConnectorConnectionSetting) {
    super(tenant, settings, connection);
    // Get Axios
    this.axiosInstance = AxiosFactory.getAxiosInstance(this.tenant);
  }

  public async connect(): Promise<string> {
    if (!this.checkIfTokenExpired(this.connection.token)) {
      return Cypher.decrypt(this.tenant, this.connection.token.accessToken);
    }
    // Check if connection is initialized
    this.checkConnectionIsProvided();
    // Get credential params
    const credentials = await this.getCredentialURLParams();
    const token = await this.fetchNewToken(credentials);
    return Cypher.decrypt(this.tenant, token.accessToken);
  }

  public async getCurrentSoC(car: Car): Promise<number> {
    if (Utils.isNullOrUndefined(car.carConnectorData.carConnectorMeterID)) {
      await Logging.logError({
        tenantID: this.tenant.id,
        module: MODULE_NAME,
        method: 'getCurrentSoC',
        action: ServerAction.CAR_CONNECTOR,
        message: `No Tronity meter id for > ${car.vin}`,
      });
      return null;
    }
    const connectionToken = await this.connect();
    const request = `${this.connection.tronityConnection.apiUrl}/v1/vehicles/${car.carConnectorData.carConnectorMeterID}/battery`;
    try {
      // Get consumption
      const response = await this.axiosInstance.get(
        request,
        {
          headers: { 'Authorization': 'Bearer ' + connectionToken }
        }
      );
      await Logging.logDebug({
        tenantID: this.tenant.id,
        action: ServerAction.CAR_CONNECTOR,
        message: `${car.vin} > Tronity web service has been called successfully`,
        module: MODULE_NAME, method: 'getCurrentSoC',
        detailedMessages: { response: response.data }
      });
      if (response.data?.level) {
        return response.data.level;
      }
      return null;
    } catch (error) {
      throw new BackendError({
        module: MODULE_NAME,
        method: 'getCurrentSoC',
        action: ServerAction.CAR_CONNECTOR,
        message: 'Error while retrieving the SOC',
        detailedMessages: { request, error: error.stack }
      });
    }
  }


  private async fetchNewToken(credentials: URLSearchParams) {
    const response = await Utils.executePromiseWithTimeout(5000,
      this.axiosInstance.post(`${this.connection.tronityConnection.apiUrl}/oauth/authentication`,
        credentials,
        {
          'axios-retry': {
            retries: 0
          },
          headers: this.buildFormHeaders()
        }),
      `Time out error (5s) when getting the token with the connection URL '${this.connection.tronityConnection.apiUrl}/oauth/authentication'`
    );
    const currentTime = new Date();
    const token : CarConnectorConnectionToken = {
      accessToken: await Cypher.encrypt(this.tenant, response.data.access_token),
      tokenType: response.data.token_type,
      expiresIn: response.data.expires_in,
      issued: currentTime,
      expires: new Date(currentTime.getTime() + response.data.expires_in * 1000)
    };
    this.connection.token = token;
    // Sensitive data will be handled by helper method in the future
    const sensitiveData = `content.carConnector.connections[${this.settings.carConnector.connections.indexOf(this.connection)}].token.accessToken`;
    if (this.settings.sensitiveData.indexOf(sensitiveData) === -1) {
      this.settings.sensitiveData.push(sensitiveData);
    }
    await SettingStorage.saveCarConnectorSettings(this.tenant, this.settings);
    return token;
  }

  private buildFormHeaders(): any {
    return {
      'Content-Type': 'application/json'
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

  private async getCredentialURLParams(): Promise<any> {
    return {
      'grant_type': 'app',
      'client_id': this.connection.tronityConnection.clientId,
      'client_secret': await Cypher.decrypt(this.tenant, this.connection.tronityConnection.clientSecret)
    };
  }
}
