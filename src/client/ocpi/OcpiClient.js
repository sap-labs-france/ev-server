const axios = require('axios');

class OcpiClient {
  constructor(ocpiEndpoint) {
    this._ocpiEndpoint = ocpiEndpoint;
  }

  // Ping eMSP
  async ping() {
    const pingResult = {};
    // try to access base Url (GET .../versions)
    // access versions API
    try {
      const endpoints = await axios.get(this._ocpiEndpoint.getBaseUrl(), {
        headers: {
          'Authorization': `Token ${this._ocpiEndpoint.getToken()}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      // check response
      if (!endpoints.data || !(endpoints.data.status_code == 1000) || !endpoints.data.data) {
        pingResult.statusCode = 412;
        pingResult.statusText = `Invalid response from GET ${this._ocpiEndpoint.getBaseUrl()}`;
      } else {
        pingResult.statusCode = endpoints.status;
        pingResult.statusText = endpoints.statusText;
      }
    } catch (error) {
      pingResult.message = error.message;
      pingResult.statusCode  = (error.response)?error.response.status:500;
    }

    // return result
    return pingResult;
  }

}

module.exports = OcpiClient;
