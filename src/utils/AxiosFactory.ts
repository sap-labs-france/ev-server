import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import axiosRetry, { IAxiosRetryConfig } from 'axios-retry';

import Constants from './Constants';
import Logging from './Logging';
import { StatusCodes } from 'http-status-codes';

const MODULE_NAME = 'AxiosFactory';

export default class AxiosFactory {
  private static axiosInstances: Map<string, AxiosInstance> = new Map();

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() { }

  // All could have been done at 'axios' level normally!
  public static getAxiosInstance(tenantID: string, instanceConfiguration?: { axiosConfig?: AxiosRequestConfig, axiosRetryConfig?: IAxiosRetryConfig }): AxiosInstance {
    if (!instanceConfiguration) {
      instanceConfiguration = {};
    }
    if (!instanceConfiguration.axiosConfig) {
      instanceConfiguration.axiosConfig = {} as AxiosRequestConfig;
    }
    // Set timeout
    if (!instanceConfiguration.axiosConfig.timeout) {
      instanceConfiguration.axiosConfig.timeout = Constants.AXIOS_DEFAULT_TIMEOUT;
    }
    // Get from map
    let axiosInstance = this.axiosInstances.get(tenantID);
    if (!axiosInstance) {
      // Create
      axiosInstance = axios.create(instanceConfiguration.axiosConfig);
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
    // Set retry configuration
    AxiosFactory.applyAxiosRetryConfiguration(axiosInstance, instanceConfiguration.axiosRetryConfig);
    return axiosInstance;
  }

  private static applyAxiosRetryConfiguration(axiosInstance: AxiosInstance, axiosRetryConfig?: IAxiosRetryConfig) {
    if (!axiosRetryConfig) {
      axiosRetryConfig = {} as IAxiosRetryConfig;
    }
    if (!axiosRetryConfig.retries) {
      axiosRetryConfig.retries = 3;
    }
    if (!axiosRetryConfig.retryCondition) {
      axiosRetryConfig.retryCondition = AxiosFactory.isNetworkOrDefaultIdempotentRequestError.bind(this);
    }
    if (!axiosRetryConfig.retryDelay) {
      axiosRetryConfig.retryDelay = axiosRetry.exponentialDelay.bind(this);
    }
    axiosRetry(axiosInstance, axiosRetryConfig);
  }

  private static isNetworkOrDefaultIdempotentRequestError(error: AxiosError): boolean {
    const noRetryHTTPErrorCodes: number[] = [StatusCodes.NOT_IMPLEMENTED];
    if (noRetryHTTPErrorCodes.includes(error.response?.status)) {
      return false;
    }
    return axiosRetry.isNetworkOrIdempotentRequestError(error);
  }
}
