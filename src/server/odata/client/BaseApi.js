const axios = require('axios');
const querystring = require('querystring');

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

module.exports = BaseApi;