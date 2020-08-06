import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import axiosRetry, { IAxiosRetryConfig } from 'axios-retry';

import Constants from './Constants';
import Logging from './Logging';

const MODULE_NAME = 'AxiosFactory';

export default class AxiosFactory {
  private static axiosInstances: Map<string, AxiosInstance> = new Map();
  private static readonly maxRetries: number = 3;

  private constructor() {}

  // All could have been done at 'axios' level normally!
  public static getAxiosInstance(tenantID: string, axiosConfig?: AxiosRequestConfig, axiosRetryConfig?: IAxiosRetryConfig): AxiosInstance {
    // Get from map
    let axiosInstance = this.axiosInstances.get(tenantID);
    if (!axiosInstance) {
      // Set timeout
      if (!axiosConfig || !axiosConfig.timeout) {
        axiosConfig.timeout = Constants.AXIOS_TIMEOUT;
      }
      // Create
      axiosInstance = axios.create(axiosConfig);
      // Set retry configuration
      AxiosFactory.applyAxiosRetryConfiguration(axiosInstance, axiosRetryConfig);
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

  private static applyAxiosRetryConfiguration(axiosInstance: AxiosInstance, axiosRetryConfig?: IAxiosRetryConfig) {
    if (!axiosRetryConfig || !axiosRetryConfig.retries) {
      axiosRetryConfig.retries = AxiosFactory.maxRetries;
    }
    if (!axiosRetryConfig || !axiosRetryConfig.retryDelay) {
      axiosRetryConfig.retryDelay = axiosRetry.exponentialDelay.bind(this);
    }
    axiosRetry(axiosInstance, axiosRetryConfig);
  }
}
