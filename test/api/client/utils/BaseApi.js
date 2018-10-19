const axios = require('axios');
const querystring = require('querystring');
const config = require('../../../config');

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
      console.log(JSON.stringify(httpRequest, null, 2));
    }
    try {
      // Execute with Axios
      httpResponse = await axios(httpRequest);
    } catch (error) {
      // Handle errors
      if (error.response) {
        response = error.response;
      } else if (error.request) {
        console.log(error.request);
        throw error;
      } else {
        console.log('Error', error.message);
        throw error;
      }
    }
    // Set response
    let response = {
      status: httpResponse.status,
      statusText: httpResponse.statusText,
      headers: httpResponse.headers,
      data: httpResponse.data
    };
    // Log
    if (config.get('server.logs') === 'json') {
      console.log(JSON.stringify(response, null, 2));
    }
    return response;
  }
}

module.exports = BaseApi;