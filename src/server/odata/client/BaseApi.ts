import axios, { AxiosRequestConfig } from 'axios';

import axiosRetry from 'axios-retry';
import querystring from 'querystring';

export default class BaseApi {
  public baseURL: string;

  constructor(baseURL: string) {
    axiosRetry(axios, { retryDelay: axiosRetry.exponentialDelay.bind(this) });
    this.baseURL = baseURL;
  }

  async send(httpRequest: AxiosRequestConfig) {
    let httpResponse;
    // Set the base URL
    httpRequest.baseURL = this.baseURL;
    // Set the Query String
    if (httpRequest.data && httpRequest.headers['Content-Type'] === 'application/x-www-form-urlencoded') {
      httpRequest.data = querystring.stringify(httpRequest.data);
    }
    try {
      // Execute with Axios
      httpResponse = await axios(httpRequest);
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
      status: httpResponse.status,
      statusText: httpResponse.statusText,
      headers: httpResponse.headers,
      data: httpResponse.data
    };

    return response;
  }
}

