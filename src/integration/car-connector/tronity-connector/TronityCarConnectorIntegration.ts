import { CarConnectorConnectionSetting, CarConnectorConnectionToken, CarConnectorSettings } from '../../../types/Setting';
import axiosRetry, { IAxiosRetryConfig } from 'axios-retry';

import AxiosFactory from '../../../utils/AxiosFactory';
import { AxiosInstance } from 'axios';
import BackendError from '../../../exception/BackendError';
import { Car } from '../../../types/Car';
import CarConnectorIntegration from '../CarConnectorIntegration';
import Constants from '../../../utils/Constants';
import Cypher from '../../../utils/Cypher';
import Logging from '../../../utils/Logging';
import { ServerAction } from '../../../types/Server';
import SettingStorage from '../../../storage/mongodb/SettingStorage';
import { StatusCodes } from 'http-status-codes';
import Tenant from '../../../types/Tenant';
import Utils from '../../../utils/Utils';

const MODULE_NAME = 'TronityCarConnectorIntegration';

export default class TronityCarConnectorIntegration extends CarConnectorIntegration<CarConnectorSettings> {
  private axiosInstance: AxiosInstance;
  private readonly axiosRetryConfiguration: IAxiosRetryConfig = {
    retries: 3,
    retryCondition: (error) => error.response.status === StatusCodes.INTERNAL_SERVER_ERROR || axiosRetry.isNetworkError(error),
    retryDelay: (retryCount, error) => {
      try {
        if (error.config.method === 'post') {
          if (error.config.url.endsWith('/token.oauth2')) {
            throw new BackendError({
              source: Constants.CENTRAL_SERVER,
              module: MODULE_NAME,
              method: 'retryDelay',
              message: `Unable to post token, response status ${error.response.status}, attempt ${retryCount}`,
              action: ServerAction.CAR_CONNECTOR,
              detailedMessages: { response: error.response }
            });
          } else {
            const payload = {
              error: error.response.data,
              payload: JSON.parse(error.config.data)
            };
            throw new BackendError({
              source: Constants.CENTRAL_SERVER,
              module: MODULE_NAME,
              method: 'retryDelay',
              message: `Unable to post data on ${error.config.url}, response status ${error.response.status}, attempt ${retryCount}`,
              action: ServerAction.CAR_CONNECTOR,
              detailedMessages: { payload }
            });
          }
        } else {
          throw new BackendError({
            source: Constants.CENTRAL_SERVER,
            module: MODULE_NAME,
            method: 'retryDelay',
            message: `Unable to make data request on ${error.config.url}, response status ${error.response.status}, attempt ${retryCount}`,
            action: ServerAction.CAR_CONNECTOR,
            detailedMessages: { response: error.response.data }
          });
        }
      } catch (err) {
        void Logging.logException(
          err, ServerAction.CAR_CONNECTOR, Constants.CENTRAL_SERVER, MODULE_NAME, 'anonymous', this.tenant.id, null);
      }
      return axiosRetry.exponentialDelay(retryCount);
    },
    shouldResetTimeout: true
  };

  constructor(tenant: Tenant, settings: CarConnectorSettings, connection: CarConnectorConnectionSetting) {
    super(tenant, settings, connection);
    // Get Axios
    this.axiosInstance = AxiosFactory.getAxiosInstance(this.tenant.id,
      {
        axiosRetryConfig: this.axiosRetryConfiguration,
      });
  }

  public async connect(): Promise<string> {
    if (!this.checkIfTokenExpired(this.connection.token)) {
      return this.connection.token.accessToken;
    }
    // Check if connection is initialized
    this.checkConnectionIsProvided();
    // Get credential params
    const credentials = await this.getCredentialURLParams();
    const response = await this.fetchNewToken(credentials);
    return response.accessToken;
  }

  public async getCurrentSoC(userID: string, car: Car): Promise<number> {
    const connectionToken = await this.connect();
    const request = `${this.connection.tronityConnection.apiUrl}/`;
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
        source: Constants.CENTRAL_SERVER,
        action: ServerAction.CAR_CONNECTOR,
        message: `${car.vin} > Tronity web service has been called successfully`,
        module: MODULE_NAME, method: 'getCurrentSoC',
        detailedMessages: { response: response.data }
      });
      if (response?.data?.soc?.value) {
        return response.data.soc.value;
      }
      return null;
    } catch (error) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
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
    const data = response.data;
    const token : CarConnectorConnectionToken = {
      accessToken: data.access_token,
      tokenType: data.token_type,
      expiresIn: data.expires_in,
      userName: data.userName,
      issued: data['.issued'],
      expires: data['.expires']
    };
    this.connection.token = token;
    await SettingStorage.saveSettings(this.tenant, this.settings);
    return token;
  }

  private buildFormHeaders(): any {
    return {
      'Content-Type': 'application/x-www-form-urlencoded'
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

  private async getCredentialURLParams(): Promise<URLSearchParams> {
    const params = new URLSearchParams();
    params.append('grant_type', 'app');
    params.append('client_id', this.connection.tronityConnection.clientId);
    params.append('client_secret', await Cypher.decrypt(this.tenant, this.connection.tronityConnection.clientSecret));
    return params;
  }
}
