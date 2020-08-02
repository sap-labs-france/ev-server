import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import axiosRetry, { IAxiosRetryConfig } from 'axios-retry';

export default class AxiosFactory {
  private static axiosInstance: AxiosInstance;
  private static readonly maxRetries: number = 3;

  private constructor() {}

  public static getAxiosInstance(axiosConfig?: AxiosRequestConfig, axiosRetryConfig?: IAxiosRetryConfig): AxiosInstance {
    AxiosFactory.setupAxiosRetry(axiosRetryConfig);
    if (!AxiosFactory.axiosInstance) {
      AxiosFactory.axiosInstance = axios.create(axiosConfig);
    }
    return AxiosFactory.axiosInstance;
  }

  private static setupAxiosRetry(axiosRetryConfig?: IAxiosRetryConfig) {
    let localAxiosRetryConfig: IAxiosRetryConfig;
    if (!axiosRetryConfig || !axiosRetryConfig.retries) {
      localAxiosRetryConfig.retries = this.maxRetries;
    }
    if (!axiosRetryConfig || !axiosRetryConfig.retryDelay) {
      localAxiosRetryConfig.retryDelay = axiosRetry.exponentialDelay.bind(this);
    }
    axiosRetry(axios, localAxiosRetryConfig);
  }
}
