import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

import Constants from './Constants';
import Logging from './Logging';
import { ServerAction } from '../types/Server';
import axiosRetry from 'axios-retry';

const MODULE_NAME = 'AxiosFactory';

export default class AxiosFactory {
  private static axiosInstances: Map<string, AxiosInstance> = new Map();
  private static readonly maxRetries: number = 3;

  private constructor() {}

  // All could have been done at 'axios' level normally!
  public static getAxiosInstance(tenantID: string): AxiosInstance {
    // Get from map
    let axiosInstance = this.axiosInstances.get(tenantID);
    if (!axiosInstance) {
      // Create
      axiosInstance = axios.create();
      // Time out
      axiosInstance.defaults.timeout = Constants.AXIOS_TIMEOUT;
      // Add retry
      axiosRetry(axiosInstance, {
        retries: this.maxRetries,
        retryDelay: axiosRetry.exponentialDelay.bind(this)
      });
      // Add a Request interceptor
      axiosInstance.interceptors.request.use((request: AxiosRequestConfig) => {
        Logging.logDebug({
          tenantID: tenantID,
          action: ServerAction.AXIOS_REQUEST,
          message: `Http Request sent: '${request.url}'`,
          module: MODULE_NAME, method: 'interceptor',
          detailedMessages: { request }
        });
        return request;
      }, async (error: AxiosError) =>
        // Error handling is done outside to get the proper module/stack trace
        Promise.reject(error)
      );
      // Add a Response interceptor
      axiosInstance.interceptors.response.use((response: AxiosResponse) => {
        Logging.logDebug({
          tenantID: tenantID,
          action: ServerAction.AXIOS_RESPONSE,
          message: `Http Response received: '${response.config.url}'`,
          module: MODULE_NAME, method: 'interceptor',
          detailedMessages: {
            status: response.status,
            request: response.config,
            response: response.data
          }
        });
        return response;
      }, async (error: AxiosError) =>
        // Error handling is done outside to get the proper module/stack trace
        Promise.reject(error)
      );
      // Add
      this.axiosInstances.set(tenantID, axiosInstance);
    }
    return axiosInstance;
  }
}
