const AbstractEndpoint = require('../AbstractEndpoint');
const OCPIUtils = require('../../OCPIUtils');
const OCPIMapping = require('./OCPIMapping');
const OCPIClientError = require('../../../../exception/OCPIClientError');
const OCPIServerError = require('../../../../exception/OCPIServerError');
const OCPIEndpoint = require('../../../../entity/OCPIEndpoint');
const Constants = require("../../../../utils/Constants");
const axios = require('axios');

require('source-map-support').install();

const EP_IDENTIFIER = "credentials";
const EP_VERSION = "2.1.1";

/**
 * Credentials Endpoint
 */
class CredentialsEndpoint extends AbstractEndpoint {
  constructor(ocpiService) {
    super(ocpiService, EP_IDENTIFIER, EP_VERSION);
  }

  /**
   * Main Process Method for the endpoint
   */
  async process(req, res, next, tenant) { // eslint-disable-line
    try {
      switch (req.method) {
        case "POST":
          // call method
          await this.postCredentials(req, res, next, tenant);
          break;
        default:
          res.sendStatus(501);
          break;
      }
    } catch (error) {
      next(error);
    }
  }


  /**
   * Get Locations according to the requested url Segement
   */
  async postCredentials(req, res, next, tenant) { // eslint-disable-line
    // get payload
    const credential = req.body;

    // check if valid
    if (!OCPIMapping.isValidOCPICredential(credential)) {
      throw new OCPIClientError(
        'POST credentials',
        `Invalid Credential Object`, 500,
        EP_IDENTIFIER, 'postCredentials', null);
    }

    // get token from header
    let token;
    if (req.headers && req.headers.authorization) {
      token = req.headers.authorization.split(" ")[1];
    }

    // Get ocpiEndpoints based on the given token
    const ocpiEndpoint = await OCPIEndpoint.getOcpiendpointWithToken(tenant.getID(), token);

    // check if ocpiEndpoint available
    if (!ocpiEndpoint) {
      throw new OCPIServerError(
        'POST credentials',
        `OCPI Endpoint not available or wrong token`, 500,
        EP_IDENTIFIER, 'postCredentials', null);
    }

    // save information
    ocpiEndpoint.setBaseUrl(credential.url);
    ocpiEndpoint.setToken(credential.token);
    ocpiEndpoint.setCountryCode(credential.country_code);
    ocpiEndpoint.setPartyId(credential.party_id);
    ocpiEndpoint.setBusinessDetails(credential.business_details);

    // try to access remote ocpi service versions
    // any error here should result in a 3001 Ocpi result execption based on the specification
    try {
      // access versions API
      const ocpiVersions = await axios.get(ocpiEndpoint.getBaseUrl(), {
        headers: {
          'Authorization': `Token ${ocpiEndpoint.getToken()}`,
          'Content-Type': 'application/json'
        }
      });

      // check response
      if (!ocpiVersions.data || !ocpiVersions.data.data) {
        throw new Error(`Invalid response from GET ${ocpiEndpoint.getBaseUrl()}`);
      }

      // loop through versions and pick the same one
      let versionFound = false;
      for (const version of ocpiVersions.data.data) {
        if (version.version === this.getVersion()) {
          versionFound = true;
          ocpiEndpoint.setVersion(version.version);
          ocpiEndpoint.setVersionUrl(version.url);
        }
      }

      // if not found trigger exception
      if (!versionFound) {
        throw new Error(`OCPI Endpoint version ${this.getVersion()} not found`);
      }

      // try to read endpoints
      // access versions API
      const endpoints = await axios.get(ocpiEndpoint.getVersionUrl(), {
        headers: {
          'Authorization': `Token ${ocpiEndpoint.getToken()}`,
          'Content-Type': 'application/json'
        }
      });

      // check response
      if (!endpoints.data || !endpoints.data.data) {
        throw new Error(`Invalid response from GET ${ocpiEndpoint.getVersionUrl()}`);
      }

      // set available endpoints
      ocpiEndpoint.setAvailableEndpoints(OCPIMapping.convertEndpoints(endpoints.data.data));
    } catch (error) {
      throw new OCPIServerError(
        'POST credentials',
        `Unable to use client API: ${error.message}`, 500,
        EP_IDENTIFIER, 'postCredentials', Constants.OCPI_STATUS_CODE.CODE_3001_UNABLE_TO_USE_CLIENT_API_ERROR);
    }

    // generate new token
    ocpiEndpoint.generateLocalToken(tenant);
    ocpiEndpoint.setStatus(Constants.OCPI_REGISTERING_STATUS.OCPI_REGISTERED);

    // save copi endpoint
    ocpiEndpoint.save();

    // build credential object
    const respCredential = await OCPIMapping.buildOCPICredentialObject(tenant, ocpiEndpoint.getLocalToken());

    // respond with credentials
    res.json(OCPIUtils.success(respCredential));
  }
}




module.exports = CredentialsEndpoint;