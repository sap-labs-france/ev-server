import axios from 'axios';
import querystring from 'querystring';
const config = require('../../../config');
import {performance} from 'perf_hooks';

export default class BaseApi {
  private baseURL: string;

  public constructor(baseURL) {
    this.baseURL = baseURL;
  }

  public async send(httpRequest): Promise<any> {
    let httpResponse;
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
      httpResponse = await axios(httpRequest);
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

// module.exports = BaseApi;
