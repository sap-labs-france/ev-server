import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

import Constants from './Constants';
import Logging from './Logging';
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
        Logging.logAxiosRequest(tenantID, request);
        return request;
      }, async (error: AxiosError) => {
        Logging.logAxiosError(tenantID, error);
        return Promise.reject(error);
      });
      // Add a Response interceptor
      axiosInstance.interceptors.response.use((response: AxiosResponse) => {
        Logging.logAxiosResponse(tenantID, response);
        return response;
      }, async (error: AxiosError) => {
        Logging.logAxiosError(tenantID, error);
        return Promise.reject(error);
      });
      // Add
      this.axiosInstances.set(tenantID, axiosInstance);
    }
    return axiosInstance;
  }
}
