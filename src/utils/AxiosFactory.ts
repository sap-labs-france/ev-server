import axios, { AxiosInstance } from 'axios';

import axiosRetry from 'axios-retry';

export default class AxiosFactory {
  private static axiosInstance: AxiosInstance;
  private static readonly maxRetries: number = 3;

  private constructor() {}

  public static getAxiosInstance(): AxiosInstance {
    AxiosFactory.setupAxiosInstance();
    if (!AxiosFactory.axiosInstance) {
      AxiosFactory.axiosInstance = axios.create();
    }
    return AxiosFactory.axiosInstance;
  }

  private static setupAxiosInstance() {
    axiosRetry(axios, { retries: this.maxRetries, retryDelay: axiosRetry.exponentialDelay.bind(this) });
  }
}
