const axios = require('axios');
const querystring = require('querystring');
const config = require('../../../config');
const {performance} = require('perf_hooks');

class BaseApi {
  constructor(baseURL) {
    this.baseURL = baseURL;
  }

  async send(httpRequest) {
    let httpResponse;
    // Set the base URL
    httpRequest.baseURL = this.baseURL;
    // Set the Query String
    if (httpRequest.data && httpRequest.headers['Content-Type'] === 'application/x-www-form-urlencoded') {
      httpRequest.data = querystring.stringify(httpRequest.data);
    }
    // Log
    if (config.get('server.logs') === 'json') {
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(httpRequest, null, 2));
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
    let response = {
      executionTime: (t1 - t0),
      status: httpResponse.status,
      statusText: httpResponse.statusText,
      headers: httpResponse.headers,
      data: httpResponse.data
    };
    // Log
    if (config.get('server.logs') === 'json') {
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(response, null, 2));
    }
    return response;
  }
}

module.exports = BaseApi;