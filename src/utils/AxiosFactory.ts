import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import axiosRetry, { IAxiosRetryConfig } from 'axios-retry';

import Configuration from './Configuration';
import Logging from './Logging';
import { Promise } from 'bluebird';
import { StatusCodes } from 'http-status-codes';
import Tenant from '../types/Tenant';

export default class AxiosFactory {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() { }

  // All could have been done at 'axios' level normally!
  public static getAxiosInstance(tenant: Tenant, instanceConfiguration?: { axiosConfig?: AxiosRequestConfig, axiosRetryConfig?: IAxiosRetryConfig }): AxiosInstance {
    instanceConfiguration = instanceConfiguration ?? {};
    instanceConfiguration.axiosConfig = instanceConfiguration.axiosConfig ?? {} as AxiosRequestConfig;
    // Set timeout
    instanceConfiguration.axiosConfig.timeout = instanceConfiguration.axiosConfig.timeout ?? Configuration.getAxiosConfig()?.timeoutSecs * 1000;
    // Create
    const axiosInstance = axios.create(instanceConfiguration.axiosConfig);
    // Add a Request interceptor
    axiosInstance.interceptors.request.use(async (request: AxiosRequestConfig) => {
      await Logging.traceAxiosRequest(tenant, request);
      return request;
    }, async (error: AxiosError) => {
      await Logging.traceAxiosError(tenant, error);
      return Promise.reject(error);
    });
    // Add a Response interceptor
    axiosInstance.interceptors.response.use(async (response: AxiosResponse) => {
      await Logging.traceAxiosResponse(tenant, response);
      return response;
    }, async (error: AxiosError) => {
      await Logging.traceAxiosError(tenant, error);
      return Promise.reject(error);
    });
    // Set retry configuration
    AxiosFactory.applyAxiosRetryConfiguration(axiosInstance, instanceConfiguration.axiosRetryConfig);
    return axiosInstance;
  }

  private static applyAxiosRetryConfiguration(axiosInstance: AxiosInstance, axiosRetryConfig?: IAxiosRetryConfig) {
    axiosRetryConfig = axiosRetryConfig ?? {} as IAxiosRetryConfig;
    axiosRetryConfig.retries = axiosRetryConfig.retries ?? Configuration.getAxiosConfig()?.retries;
    axiosRetryConfig.retryCondition = axiosRetryConfig.retryCondition ?? AxiosFactory.isNetworkOrDefaultIdempotentRequestError.bind(this);
    axiosRetryConfig.retryDelay = axiosRetryConfig.retryDelay ?? axiosRetry.exponentialDelay.bind(this);
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
