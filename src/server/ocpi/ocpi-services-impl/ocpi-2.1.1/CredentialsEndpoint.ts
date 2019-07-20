import axios from 'axios';
import AbstractEndpoint from '../AbstractEndpoint';
import Constants from '../../../../utils/Constants';
import Logging from '../../../../utils/Logging';
import OCPIClientError from '../../../../exception/OCPIClientError';
import OCPIEndpoint from '../../../../entity/OCPIEndpoint';
import OCPIMapping from './OCPIMapping';
import OCPIServerError from '../../../../exception/OCPIServerError';
import OCPIUtils from '../../OCPIUtils';

const EP_IDENTIFIER = 'credentials';
const EP_VERSION = '2.1.1';
const MODULE_NAME = 'CredentialsEndpoint';

/**
 * Credentials Endpoint
 */export default class CredentialsEndpoint extends AbstractEndpoint {
  public getVersion: any;
  public getBaseUrl: any;

  constructor(ocpiService) {
    super(ocpiService, EP_IDENTIFIER, EP_VERSION);
  }

  /**
   * Main Process Method for the endpoint
   */
  async process(req, res, next, tenant) {
    try {
      switch (req.method) {
        case 'POST':
          await this.postCredentials(req, res, next, tenant);
          break;
        case 'DELETE':
          await this.deleteCredentials(req, res, next, tenant);
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
   * Registration process initiated by IOP
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async deleteCredentials(req, res, next, tenant) {
    // Get token from header
    let token;
    if (req.headers && req.headers.authorization) {
      token = req.headers.authorization.split(' ')[1];
    }

    // Log body
    Logging.logInfo({
      tenantID: tenant.getID(),
      action: 'DELETE credentials',
      message: 'Received unregister',
      source: 'OCPI Server',
      module: MODULE_NAME,
      method: 'deleteCredentials',
      detailedMessages: token
    });

    // Get ocpiEndpoints based on the given token
    const ocpiEndpoint = await OCPIEndpoint.getOcpiEndpointWithToken(tenant.getID(), token);

    // Check if ocpiEndpoint available
    if (!ocpiEndpoint || ocpiEndpoint.getStatus() === Constants.OCPI_REGISTERING_STATUS.OCPI_UNREGISTERED) {
      throw new OCPIServerError(
        'DELETE credentials',
        'method not allowed if the client was not registered', 405,
        EP_IDENTIFIER, 'deleteCredentials', null);
    }

    // Save ocpi endpoint
    ocpiEndpoint.setStatus(Constants.OCPI_REGISTERING_STATUS.OCPI_UNREGISTERED);
    ocpiEndpoint.setBackgroundPatchJobFlag(false);
    await ocpiEndpoint.save();

    // Respond with credentials
    res.json(OCPIUtils.success());
  }

  /**
   * Registration process initiated by IOP
   */
  async postCredentials(req, res, next, tenant) {
    // Get payload
    const credential = req.body;

    // Log body
    Logging.logDebug({
      tenantID: tenant.getID(),
      action: 'POST credentials',
      message: 'Received credential object',
      source: 'OCPI Server',
      module: MODULE_NAME,
      method: 'postCredentials',
      detailedMessages: credential
    });

    // Check if valid
    if (!OCPIMapping.isValidOCPICredential(credential)) {
      throw new OCPIClientError(
        'POST credentials',
        'Invalid Credential Object', Constants.HTTP_GENERAL_ERROR,
        EP_IDENTIFIER, 'postCredentials');
    }

    // Get token from header
    let token;
    if (req.headers && req.headers.authorization) {
      token = req.headers.authorization.split(' ')[1];
    }

    // Log body
    Logging.logDebug({
      tenantID: tenant.getID(),
      action: 'POST credentials',
      message: 'Received token',
      source: 'OCPI Server',
      module: MODULE_NAME,
      method: 'postCredentials',
      detailedMessages: token
    });

    // Get ocpiEndpoints based on the given token
    const ocpiEndpoint = await OCPIEndpoint.getOcpiEndpointWithToken(tenant.getID(), token);

    // Check if ocpiEndpoint available
    if (!ocpiEndpoint) {
      throw new OCPIServerError(
        'POST credentials',
        'OCPI Endpoint not available or wrong token', Constants.HTTP_GENERAL_ERROR,
        EP_IDENTIFIER, 'postCredentials');
    }

    // Save information
    ocpiEndpoint.setBaseUrl(credential.url);
    ocpiEndpoint.setToken(credential.token);
    ocpiEndpoint.setCountryCode(credential.country_code);
    ocpiEndpoint.setPartyId(credential.party_id);
    ocpiEndpoint.setBusinessDetails(credential.business_details);

    // Log updated ocpi endpoint
    Logging.logDebug({
      tenantID: tenant.getID(),
      action: 'POST credentials',
      message: 'OCPI Server found and updated with credential object',
      source: 'OCPI Server',
      module: MODULE_NAME,
      method: 'postCredentials',
      detailedMessages: ocpiEndpoint.getModel()
    });

    // Try to access remote ocpi service versions
    // Any error here should result in a 3001 Ocpi result exception based on the specification
    try {
      // Access versions API
      const ocpiVersions = await axios.get(ocpiEndpoint.getBaseUrl(), {
        headers: {
          'Authorization': `Token ${ocpiEndpoint.getToken()}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      // Log available OCPI Versions
      Logging.logDebug({
        tenantID: tenant.getID(),
        action: 'POST credentials',
        message: 'Available OCPI Versions',
        source: 'OCPI Server',
        module: MODULE_NAME,
        method: 'postCredentials',
        detailedMessages: ocpiVersions.data
      });

      // Check response
      if (!ocpiVersions.data || !ocpiVersions.data.data) {
        throw new Error(`Invalid response from GET ${ocpiEndpoint.getBaseUrl()}`);
      }

      // Loop through versions and pick the same one
      let versionFound = false;
      for (const version of ocpiVersions.data.data) {
        if (version.version === this.getVersion()) {
          versionFound = true;
          ocpiEndpoint.setVersion(version.version);
          ocpiEndpoint.setVersionUrl(version.url);

          // Log correct OCPI service found
          Logging.logDebug({
            tenantID: tenant.getID(),
            action: 'POST credentials',
            message: 'Correct OCPI version found',
            source: 'OCPI Server',
            module: MODULE_NAME,
            method: 'postCredentials',
            detailedMessages: `[${ocpiEndpoint.getVersion()}]:${ocpiEndpoint.getVersionUrl()}`
          });
        }
      }

      // If not found trigger exception
      if (!versionFound) {
        throw new Error(`OCPI Endpoint version ${this.getVersion()} not found`);
      }

      // Try to read endpoints
      // Access versions API
      const endpoints = await axios.get(ocpiEndpoint.getVersionUrl(), {
        headers: {
          'Authorization': `Token ${ocpiEndpoint.getToken()}`,
          'Content-Type': 'application/json'
        }
      });

      // Log available OCPI services
      Logging.logDebug({
        tenantID: tenant.getID(),
        action: 'POST credentials',
        message: 'Available OCPI services',
        source: 'OCPI Server',
        module: MODULE_NAME,
        method: 'postCredentials',
        detailedMessages: endpoints.data
      });
      // Check response
      if (!endpoints.data || !endpoints.data.data) {
        throw new Error(`Invalid response from GET ${ocpiEndpoint.getVersionUrl()}`);
      }

      // Set available endpoints
      ocpiEndpoint.setAvailableEndpoints(OCPIMapping.convertEndpoints(endpoints.data.data));
    } catch (error) {
      throw new OCPIServerError(
        'POST credentials',
        `Unable to use client API: ${error.message}`, Constants.HTTP_GENERAL_ERROR,
        EP_IDENTIFIER, 'postCredentials', Constants.OCPI_STATUS_CODE.CODE_3001_UNABLE_TO_USE_CLIENT_API_ERROR,
        error.stack);
    }

    // Generate new token
    await ocpiEndpoint.generateLocalToken(tenant);
    ocpiEndpoint.setStatus(Constants.OCPI_REGISTERING_STATUS.OCPI_REGISTERED);

    // Save ocpi endpoint
    await ocpiEndpoint.save();

    // Get base url
    const versionUrl = this.getBaseUrl(req) + Constants.OCPI_SERVER_BASE_PATH;

    // Build credential object
    const respCredential = await OCPIMapping.buildOCPICredentialObject(tenant, ocpiEndpoint.getLocalToken(), versionUrl);

    // Log available OCPI Versions
    Logging.logDebug({
      tenantID: tenant.getID(),
      action: 'POST credentials',
      message: 'Response with credential object',
      source: 'OCPI Server',
      module: MODULE_NAME,
      method: 'postCredentials',
      detailedMessages: respCredential
    });

    // Respond with credentials
    res.json(OCPIUtils.success(respCredential));
  }
}

