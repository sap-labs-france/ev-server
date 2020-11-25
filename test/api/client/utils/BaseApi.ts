import AxiosFactory from '../../../../src/utils/AxiosFactory';
import { AxiosRequestConfig } from 'axios';
import Constants from '../../../../src/utils/Constants';
import { performance } from 'perf_hooks';
import querystring from 'querystring';

export default class BaseApi {
  private baseURL: string;

  public constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  public async send(httpRequest: AxiosRequestConfig): Promise<any> {
    let httpResponse;
    const axiosInstance = AxiosFactory.getAxiosInstance(Constants.DEFAULT_TENANT);
    // Set the base URL
    httpRequest.baseURL = this.baseURL;
    // Set the Query String
    if (httpRequest.data && httpRequest.headers['Content-Type'] === 'application/x-www-form-urlencoded') {
      httpRequest.data = querystring.stringify(httpRequest.data);
    }
    let t0 = 0;
    let t1 = 0;
    try {
      t0 = performance.now();
      // Execute with Axios
      httpResponse = await axiosInstance(httpRequest);
      // Debug
      // console.log('HTTP Request ====================================');
      // console.log(httpRequest.baseURL);
      // console.log(httpRequest.url);
      // console.log(httpRequest.method);
      // console.log(httpRequest.data);
      // console.log(httpResponse.status);
      // console.log(httpResponse.statusText);
      // console.log(httpResponse.data);
      // console.log('====================================');
      t1 = performance.now();
    } catch (error) {
      // Handle errors
      if (error.response) {
        httpResponse = error.response;
      } else if (error.request) {
        throw error;
      } else {
        throw error;
      }
    }
    // Set response
    const response = {
      executionTime: (t1 - t0),
      status: httpResponse.status,
      statusText: httpResponse.statusText,
      headers: httpResponse.headers,
      data: httpResponse.data
    };
    return response;
  }
}
