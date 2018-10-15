const config = require('../../../config');
const axios = require('axios');
const querystring = require('querystring');

class BaseApi {


  constructor(baseURL) {
    this.baseURL = baseURL;
  }

  async send(requestConfig) {
    requestConfig.baseURL = this.baseURL;
    if (requestConfig.data && requestConfig.headers['Content-Type'] === 'application/x-www-form-urlencoded') {
      requestConfig.data = querystring.stringify(requestConfig.data);
    }

    if (config.get('trace_logs')) {
      console.log(JSON.stringify(requestConfig, null, 2));
    }
    let response;
    try {
      response = await axios(requestConfig);
    } catch (error) {
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
    response = {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      data: response.data
    };

    if (config.get('trace_logs')) {
      console.log(JSON.stringify(response, null, 2));
    }
    // if (requestConfig.headers.Accept === 'application/json') {
    //   response = JSON.parse(message.text);
    //   message['response'] = response;
    // }

    return response;
  }
}

module.exports = BaseApi;