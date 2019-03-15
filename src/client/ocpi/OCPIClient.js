const axios = require('axios');
const OCPIMapping = require('../../server/ocpi/ocpi-services-impl/ocpi-2.1.1/OCPIMapping');
const Constants = require('../../utils/Constants');
const Logging = require('../../utils/Logging');

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
      await this._ocpiEndpoint.save();

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
    // log
    Logging.logInfo({
      tenantID: this._ocpiEndpoint.getTenantID(),
      action: 'GET versions',
      message: `get versions at ${this._ocpiEndpoint.getVersionUrl()}`,
      source: 'OCPI Client',
      module: 'OCPI Client',
      method: `getServices`
    });

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

    // log
    Logging.logInfo({
      tenantID: tenant.getID(),
      action: 'POST credentials',
      message: `Post creadentials at ${credentialsUrl}`,
      source: 'OCPI Client',
      module: 'OCPI Client',
      method: `postCredentials`,
      detailedMessages: cpoCredentials
    });

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

  /**
   * PATH EVSE Status
   */
  async patchEVSEStatus(locationId, evseId, newStatus) {
    // check for input parameter
    if (!locationId || !evseId || !newStatus) {
      throw new Error('Invalid parameters');
    }

    // get locations endpoint url
    const locationsUrl = this._ocpiEndpoint.getEndpointUrl('locations');

    if (!locationsUrl) {
      throw new Error('Locations endpoint URL undefined');
    }

    // read configuration to retrieve country_code and party_id
    const tenant = await this._ocpiEndpoint.getTenant();
    const ocpiSetting = await tenant.getSetting(Constants.COMPONENTS.OCPI_COMPONENT);

    if (!ocpiSetting || !ocpiSetting.getContent()) {
      throw new Error('OCPI Settings not found');
    }

    const ocpiContent = ocpiSetting.getContent();
    if (!ocpiContent.country_code || !ocpiContent.party_id) {
      throw new Error('OCPI Country Code and/or Party ID undefined');
    }

    const country_code = ocpiContent.country_code;
    const party_id = ocpiContent.party_id;

    // build url to EVSE
    const fullUrl = locationsUrl + `/${country_code}/${party_id}/${locationId}/${evseId}`;

    // build payload
    const payload = { "status": newStatus };

    // log
    Logging.logInfo({
      tenantID: tenant.getID(),
      action: 'PATCH locations',
      message: `Patch location at ${fullUrl}`,
      source: 'OCPI Client',
      module: 'OCPI Client',
      method: `patchEVSEStatus`,
      detailedMessages: payload
    });

    // call IOP
    const response = await axios.patch(fullUrl, payload,
      {
        headers: {
          Authorization: `Token ${this._ocpiEndpoint.getToken()}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

    // check response
    if (!response.data) {
      throw new Error(`Invalid response from PATCH`);
    }
  }


  /**
   * Send all EVSEs
   */
  async sendEVSEStatuses() {
    // result
    const sendResult = { success: 0, failure: 0, logs: [], chargeBoxIDsInFailure: [] };

    // read configuration to retrieve country_code and party_id
    const tenant = await this._ocpiEndpoint.getTenant();
    // get ocpi service configuration
    const ocpiSetting = await tenant.getSetting(Constants.COMPONENTS.OCPI_COMPONENT);
    // define eMI3
    tenant._eMI3 = {};

    if (ocpiSetting && ocpiSetting.getContent()) {
      const configuration = ocpiSetting.getContent();
      tenant._eMI3.country_id = configuration.country_code;
      tenant._eMI3.party_id = configuration.party_id;
    } else {
      // log error if failure
      Logging.logError({
        tenantID: tenant.getID(),
        action: 'sendEVSEStatuses',
        message: `OCPI Configuration not active`,
        source: 'OCPI Client',
        module: 'OCPI Client',
        method: `sendEVSEStatuses`
      });
      return;
    }

    // define get option
    const options = { "addChargeBoxID": true };

    // get timestamp before starting process - to be saved in DB
    const startDate = new Date();

    // get all EVSES from all locations
    const locationsResult = await OCPIMapping.getAllLocations(tenant, null, null, options);

    for (const location of locationsResult.locations) {
      if (location && location.evses) {
        for (const evse of location.evses) {
          if (evse && location.id && evse.id) {
            try {
              await this.patchEVSEStatus(location.id, evse.uid, evse.status);
              sendResult.success++;
            } catch (error) {
              sendResult.failure++;
              sendResult.chargeBoxIDsInFailure.push(evse.chargeBoxId);
              sendResult.logs.push( 
                `failure updating status for locationID:${location.id} - evseID:${evse.id}:${error.message}`
              );
            }
          }
        }
      }
    }

    // log error if any
    if (sendResult.failure > 0) {
      // log error if failure
      Logging.logError({
        tenantID: tenant.getID(),
        action: 'sendEVSEStatuses',
        message: `Patching locations log details`,
        detailedMessages: sendResult.logs,
        source: 'OCPI Client',
        module: 'OCPI Client',
        method: `sendEVSEStatuses`
      });
    }

    // save result in ocpi endpoint
    this._ocpiEndpoint.setLastPatchJobOn(startDate);

    // set result
    if (sendResult) {
      this._ocpiEndpoint.setLastPatchJobResult(sendResult.success, sendResult.failure);
    } else {
      this._ocpiEndpoint.setLastPatchJobResult(0, 0);
    }

    // save
    await this._ocpiEndpoint.save();

    // return result
    return sendResult;
  }

}

module.exports = OCPIClient;