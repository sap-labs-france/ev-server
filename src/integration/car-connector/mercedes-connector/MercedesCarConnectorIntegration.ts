import { AxiosInstance, AxiosResponse } from 'axios';
import { CarConnectorConnectionSetting, CarConnectorConnectionType, CarConnectorSetting } from '../../../types/Setting';
import axiosRetry, { IAxiosRetryConfig } from 'axios-retry';

import AxiosFactory from '../../../utils/AxiosFactory';
import BackendError from '../../../exception/BackendError';
import CarConnectorIntegration from '../CarConnectorIntegration';
import Connection from '../../../types/Connection';
import ConnectionStorage from '../../../storage/mongodb/ConnectionStorage';
import Constants from '../../../utils/Constants';
import Cypher from '../../../utils/Cypher';
import Logging from '../../../utils/Logging';
import { ServerAction } from '../../../types/Server';
import { StatusCodes } from 'http-status-codes';
import Tenant from '../../../types/Tenant';
import moment from 'moment-timezone';
import querystring from 'querystring';

const MODULE_NAME = 'MercedesCarConnectorIntegration';

export default class MercedesCarConnectorIntegration extends CarConnectorIntegration<CarConnectorSetting> {
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

  constructor(tenant: Tenant, settings: CarConnectorSetting, connection: CarConnectorConnectionSetting) {
    super(tenant, settings, connection);
    // Get Axios
    this.axiosInstance = AxiosFactory.getAxiosInstance(this.tenant.id,
      {
        axiosRetryConfig: this.axiosRetryConfiguration,
      });
  }

  public async createConnection(userID: string, data: any): Promise<Connection> {
    try {
      await Logging.logDebug({
        user: userID,
        tenantID: this.tenant.id,
        module: MODULE_NAME, method: 'createConnection',
        action: ServerAction.CAR_CONNECTOR, message: 'Request Mercedes access token'
      });
      const mercedesURL = `${this.connection.mercedesConnection.authenticationUrl}/as/token.oauth2 `;
      const response = await this.axiosInstance.post(mercedesURL,
        querystring.stringify({
          code: data.code,
          redirect_uri: data.redirectUri,
          grant_type: 'authorization_code'
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${Buffer.from(this.connection.mercedesConnection.clientId + ':' + await Cypher.decrypt(this.tenant, this.connection.mercedesConnection.clientSecret)).toString('base64')}`
          },
        });
      await Logging.logDebug({
        user: userID,
        tenantID: this.tenant.id,
        module: MODULE_NAME, method: 'createConnection',
        action: ServerAction.CAR_CONNECTOR, message: 'Mercedes access token granted'
      });
      // Check first
      let connection = await ConnectionStorage.getConnectionByConnectorIdAndUserId(this.tenant, CarConnectorConnectionType.MERCEDES, userID);
      if (connection) {
        // Update
        connection.data = response.data;
        connection.updatedAt = new Date();
        connection.validUntil = this.computeValidUntilAt(response);
      } else {
        // Create new
        connection = {
          data: response.data,
          userId: userID,
          connectorId: CarConnectorConnectionType.MERCEDES,
          createdAt: new Date(),
          validUntil: this.computeValidUntilAt(response)
        };
      }
      // Save
      connection.id = await ConnectionStorage.saveConnection(this.tenant, connection);
      return connection;
    } catch (error) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        message: 'Mercedes access token not granted',
        module: MODULE_NAME,
        method: 'createConnection',
        user: userID,
        action: ServerAction.CAR_CONNECTOR,
        detailedMessages: { error: error.stack }
      });
    }
  }

  public async getCurrentSoC(userID: string): Promise<number> {
    // To be implemented
    const connection = await this.getRefreshedConnection(userID);
    return 0;
  }

  private computeValidUntilAt(response: AxiosResponse) {
    const now = new Date();
    return new Date(now.getTime() + response.data.expires_in * 1000);
  }

  private isTokenExpired(connection: Connection) {
    const referenceDate = connection.updatedAt ? connection.updatedAt : connection.createdAt;
    if (!referenceDate || !connection.data.expires_in) {
      return true;
    }
    return moment(referenceDate).add(connection.data.expires_in, 'seconds').isBefore(moment.now());
  }

  private getRetryCount(response) {
    if (response && response.config) {
      return response.config['axios-retry'].retryCount;
    }
    return 0;
  }

  private async refreshToken(userID: string, connection: Connection): Promise<Connection> {
    try {
      const startDate = moment();
      const mercedesURL = `${this.connection.mercedesConnection.authenticationUrl}/as/token.oauth2`;
      const response = await this.axiosInstance.post(mercedesURL,
        querystring.stringify({
          refresh_token: connection.data.refresh_token,
          grant_type: 'refresh_token'
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${Buffer.from(this.connection.mercedesConnection.clientId + ':' + await Cypher.decrypt(this.tenant, this.connection.mercedesConnection.clientSecret)).toString('base64')}`
          }
        });
      await Logging.logDebug({
        tenantID: this.tenant.id,
        user: userID,
        action: ServerAction.CAR_CONNECTOR,
        module: MODULE_NAME, method: 'refreshToken',
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        message: `Mercedes access token has been successfully generated in ${moment().diff(startDate, 'milliseconds')} ms with ${this.getRetryCount(response)} retries`
      });
      connection.data = response.data;
      connection.updatedAt = new Date();
      connection.validUntil = this.computeValidUntilAt(response);
      connection.id = await ConnectionStorage.saveConnection(this.tenant, connection);
      return connection;
    } catch (error) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        message: 'Mercedes access token not refreshed',
        module: MODULE_NAME,
        method: 'refreshToken',
        action: ServerAction.CAR_CONNECTOR,
        user: userID,
        detailedMessages: { error: error.stack }
      });
    }
  }

  private async getRefreshedConnection(userID: string): Promise<Connection> {
    let connection = await ConnectionStorage.getConnectionByConnectorIdAndUserId(this.tenant, CarConnectorConnectionType.MERCEDES, userID);
    if (!connection) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        message: `The user does not have a connection to connector '${CarConnectorConnectionType.MERCEDES}'`,
        module: MODULE_NAME,
        method: 'getRefreshedConnection',
        action: ServerAction.CAR_CONNECTOR,
        user: userID
      });
    }
    if (this.isTokenExpired(connection)) {
      connection = await this.refreshToken(userID, connection);
    }
    return connection;
  }
}
