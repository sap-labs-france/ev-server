const axios = require('axios');
const OCPIMapping = require('../../server/ocpi/ocpi-services-impl/ocpi-2.1.1/OCPIMapping');
const Constants = require('../../utils/Constants');

class OCPIClient {
  constructor(ocpiEndpoint) {
    this._ocpiEndpoint = ocpiEndpoint;
  }

  // Ping eMSP
  async ping() {
    const pingResult = {};
    // try to access base Url (GET .../versions)
    // access versions API
    try {
      // get versions
      const endpoints = await this.getVersions();

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
      pingResult.statusCode = (error.response) ? error.response.status : 500;
    }

    // return result
    return pingResult;
  }

  // Trigger Registration process for  eMSP
  async register() {
    const registerResult = {};

    try {
      // get available version.
      const ocpiVersions = await this.getVersions();

      // loop through versions and pick the same one
      let versionFound = false;
      for (const ocpiVersion of ocpiVersions.data.data) {
        if (ocpiVersion.version === '2.1.1') {
          versionFound = true;
          this._ocpiEndpoint.setVersion(ocpiVersion.version);
          this._ocpiEndpoint.setVersionUrl(ocpiVersion.url);
          break;
        }
      }

      // if not found trigger exception
      if (!versionFound) {
        throw new Error(`OCPI Endpoint version 2.1.1 not found`);
      }

      // try to read services
      const services = await this.getServices();

      // set available endpoints
      this._ocpiEndpoint.setAvailableEndpoints(OCPIMapping.convertEndpoints(services.data.data));

      // post credentials and recieve response
      const respPostCredentials = await this.postCredentials();
      const credential = respPostCredentials.data.data;

      // store information
      // this._ocpiEndpoint.setBaseUrl(credential.url);
      this._ocpiEndpoint.setToken(credential.token);
      this._ocpiEndpoint.setCountryCode(credential.country_code);
      this._ocpiEndpoint.setPartyId(credential.party_id);
      this._ocpiEndpoint.setBusinessDetails(credential.business_details);

      // save endpoint
      this._ocpiEndpoint.setStatus(Constants.OCPI_REGISTERING_STATUS.OCPI_REGISTERED);
      this._ocpiEndpoint.save();

      // send success
      registerResult.statusCode = 200;
      registerResult.statusText = 'OK';
    } catch (error) {
      registerResult.message = error.message;
      registerResult.statusCode = (error.response) ? error.response.status : 500;
    }

    // return result
    return registerResult;
  }

  /**
   * GET /ocpi/emsp/versions
   */
  async getVersions() {
    const respOcpiVersions = await axios.get(this._ocpiEndpoint.getBaseUrl(), {
      headers: {
        'Authorization': `Token ${this._ocpiEndpoint.getToken()}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    // check response
    if (!respOcpiVersions.data || !respOcpiVersions.data.data) {
      throw new Error(`Invalid response from GET ${this._ocpiEndpoint.getBaseUrl()}`);
    }

    return respOcpiVersions;
  }

  /**
   * GET /ocpi/emsp/{version}
   */
  async getServices() {
    const respOcpiServices = await axios.get(this._ocpiEndpoint.getVersionUrl(), {
      headers: {
        'Authorization': `Token ${this._ocpiEndpoint.getToken()}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    // check response
    if (!respOcpiServices.data || !respOcpiServices.data.data) {
      throw new Error(`Invalid response from GET ${this._ocpiEndpoint.getVersionUrl()}`);
    }

    return respOcpiServices;
  }

  /**
   * POST /ocpi/emsp/{version}/credentials
   */
  async postCredentials() {
    // get credentials url
    const credentialsUrl = this._ocpiEndpoint.getEndpointUrl('credentials');

    if (!credentialsUrl) {
      throw new Error('Credentials url not available');
    }

    // build CPO credential object
    const tenant = await this._ocpiEndpoint.getTenant();
    const cpoCredentials = await OCPIMapping.buildOCPICredentialObject(tenant, await this._ocpiEndpoint.generateLocalToken());

    // call eMSP with CPO credentials
    const respOcpiCredentials = await axios.post(credentialsUrl, cpoCredentials,
      {
        headers: {
          Authorization: `Token ${this._ocpiEndpoint.getToken()}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

    // check response
    if (!respOcpiCredentials.data || !respOcpiCredentials.data.data) {
      throw new Error(`Invalid response from POST`);
    }

    return respOcpiCredentials;
  }

}

module.exports = OCPIClient;
