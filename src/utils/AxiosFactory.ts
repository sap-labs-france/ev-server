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
        request['timestamp'] = new Date();
        Logging.logDebug({
          tenantID: tenantID,
          action: ServerAction.HTTP_REQUEST,
          message: `HTTP Request >> ${request.method.toLocaleUpperCase()} '${request.url}'`,
          module: MODULE_NAME, method: 'interceptor',
          detailedMessages: { request }
        });
        return request;
      }, async (error: AxiosError) => {
        // Error handling is done outside to get the proper module information
        Logging.logError({
          tenantID: tenantID,
          action: ServerAction.HTTP_REQUEST,
          message: `HTTP Request Error >> ${error.config.method.toLocaleUpperCase()}/${error.code} '${error.config.url}' - ${error.message}`,
          module: MODULE_NAME, method: 'interceptor',
          detailedMessages: {
            url: error.config.url,
            message: error.message,
            axiosError: error.toJSON(),
          }
        });
        return Promise.reject(error);
      });
      // Add a Response interceptor
      axiosInstance.interceptors.response.use((response: AxiosResponse) => {
        // Compute duration
        let durationSecs = 0;
        if (response.config['timestamp']) {
          durationSecs = (new Date().getTime() - response.config['timestamp'].getTime()) / 1000;
        }
        // Compute Length
        let contentLengthKB = response.headers['content-length'] as number;
        if (contentLengthKB) {
          contentLengthKB /= 1000;
        }
        Logging.logDebug({
          tenantID: tenantID,
          action: ServerAction.HTTP_RESPONSE,
          message: response.config['timestamp'] ?
            `HTTP Response - ${durationSecs}s - ${!isNaN(contentLengthKB) ? contentLengthKB : '? '}kB << ${response.config.method.toLocaleUpperCase()}/${response.status} '${response.config.url}'` :
            `HTTP Response - ${!isNaN(contentLengthKB) ? contentLengthKB : '? '}kB << ${response.config.method.toLocaleUpperCase()}/${response.status} '${response.config.url}'`,
          module: MODULE_NAME, method: 'interceptor',
          detailedMessages: {
            status: response.status,
            request: response.config,
            response: response.data
          }
        });
        return response;
      }, async (error: AxiosError) => {
        // Compute duration
        let durationSecs = 0;
        if (error.config['timestamp']) {
          durationSecs = (new Date().getTime() - error.config['timestamp'].getTime()) / 1000;
        }
        // Error handling is done outside to get the proper module information
        Logging.logError({
          tenantID: tenantID,
          action: ServerAction.HTTP_RESPONSE,
          message: error.config['timestamp'] ?
            `HTTP Response Error - ${durationSecs}s << ${error.config.method.toLocaleUpperCase()}/${error.code} '${error.config.url}' - ${error.message}` :
            `HTTP Response Error << ${error.config.method.toLocaleUpperCase()}/${error.code} '${error.config.url}' - ${error.message}`,
          module: MODULE_NAME, method: 'interceptor',
          detailedMessages: {
            url: error.config.url,
            message: error.message,
            axiosError: error.toJSON(),
          }
        });
        return Promise.reject(error);
      });
      // Add
      this.axiosInstances.set(tenantID, axiosInstance);
    }
    return axiosInstance;
  }
}
