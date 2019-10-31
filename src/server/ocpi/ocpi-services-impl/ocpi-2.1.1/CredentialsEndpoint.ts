import axios from 'axios';
import AbstractEndpoint from '../AbstractEndpoint';
import Constants from '../../../../utils/Constants';
import Logging from '../../../../utils/Logging';
import OCPIMapping from './OCPIMapping';
import OCPIUtils from '../../OCPIUtils';
import { NextFunction, Request, Response } from 'express';
import Tenant from '../../../../types/Tenant';
import AppError from '../../../../exception/AppError';
import AbstractOCPIService from '../../AbstractOCPIService';
import OCPIEndpointStorage from '../../../../storage/mongodb/OCPIEndpointStorage';

const EP_IDENTIFIER = 'credentials';
const EP_VERSION = '2.1.1';
const MODULE_NAME = 'CredentialsEndpoint';

/**
 * Credentials Endpoint
 */
export default class CredentialsEndpoint extends AbstractEndpoint {

  constructor(ocpiService: AbstractOCPIService) {
    super(ocpiService, EP_IDENTIFIER, EP_VERSION);
  }

  /**
   * Main Process Method for the endpoint
   */
  async process(req: Request, res: Response, next: NextFunction, tenant: Tenant, options: { countryID: string; partyID: string; addChargeBoxID?: boolean }) {
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
  }

  /**
   * Registration process initiated by IOP
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async deleteCredentials(req: Request, res: Response, next: NextFunction, tenant: Tenant) {
    // Get token from header
    let token;
    if (req.headers && req.headers.authorization) {
      token = req.headers.authorization.split(' ')[1];
    }

    // Log body
    Logging.logInfo({
      tenantID: tenant.id,
      action: 'DELETE credentials',
      message: 'Received unregister',
      source: 'OCPI Server',
      module: MODULE_NAME,
      method: 'deleteCredentials',
      detailedMessages: token
    });

    // Get ocpiEndpoints based on the given token
    const ocpiEndpoint = await OCPIEndpointStorage.getOcpiEndpoinByLocalToken(tenant.id, token);

    // Check if ocpiEndpoint available
    if (!ocpiEndpoint || ocpiEndpoint.status === Constants.OCPI_REGISTERING_STATUS.OCPI_UNREGISTERED) {
      throw new AppError({
        source: Constants.OCPI_SERVER,
        module: MODULE_NAME,
        method: 'deleteCredentials',
        action: 'DELETE credentials',
        errorCode: 405,
        message: 'method not allowed if the client was not registered',
        ocpiError: Constants.OCPI_STATUS_CODE.CODE_3000_GENERIC_SERVER_ERROR
      });
    }

    // Save ocpi endpoint
    ocpiEndpoint.status = Constants.OCPI_REGISTERING_STATUS.OCPI_UNREGISTERED;
    ocpiEndpoint.backgroundPatchJob = false;
    await OCPIEndpointStorage.saveOcpiEndpoint(tenant.id, ocpiEndpoint);

    // Respond with credentials
    res.json(OCPIUtils.success());
  }

  /**
   * Registration process initiated by IOP
   */
  async postCredentials(req: Request, res: Response, next: NextFunction, tenant: Tenant) {
    // Get payload
    const credential = req.body;

    // Log body
    Logging.logDebug({
      tenantID: tenant.id,
      action: 'OcpiPostCredentials',
      message: 'Received credential object',
      source: 'OCPI Server',
      module: MODULE_NAME,
      method: 'postCredentials',
      detailedMessages: credential
    });

    // Check if valid
    if (!OCPIMapping.isValidOCPICredential(credential)) {
      throw new AppError({
        source: Constants.OCPI_SERVER,
        module: MODULE_NAME,
        method: 'postCredentials',
        action: 'OcpiPostCredentials',
        errorCode: Constants.HTTP_GENERAL_ERROR,
        message: 'Invalid Credential Object',
        ocpiError: Constants.OCPI_STATUS_CODE.CODE_2000_GENERIC_CLIENT_ERROR
      });
    }

    // Get token from header
    let token;
    if (req.headers && req.headers.authorization) {
      token = req.headers.authorization.split(' ')[1];
    }

    // Log body
    Logging.logDebug({
      tenantID: tenant.id,
      action: 'OcpiPostCredentials',
      message: 'Received token',
      source: 'OCPI Server',
      module: MODULE_NAME,
      method: 'postCredentials',
      detailedMessages: token
    });

    // Get ocpiEndpoints based on the given token
    const ocpiEndpoint = await OCPIEndpointStorage.getOcpiEndpoinByLocalToken(tenant.id, token);

    // Check if ocpiEndpoint available
    if (!ocpiEndpoint) {
      throw new AppError({
        source: Constants.OCPI_SERVER,
        module: MODULE_NAME,
        method: 'postCredentials',
        action: 'OcpiPostCredentials',
        errorCode: Constants.HTTP_GENERAL_ERROR,
        message: 'OCPI Endpoint not available or wrong token',
        ocpiError: Constants.OCPI_STATUS_CODE.CODE_3000_GENERIC_SERVER_ERROR
      });
    }

    // Save information
    ocpiEndpoint.baseUrl = credential.url;
    ocpiEndpoint.token = credential.token;
    ocpiEndpoint.countryCode = credential.country_code;
    ocpiEndpoint.partyId = credential.party_id;
    ocpiEndpoint.businessDetails = credential.business_details;

    // Log updated ocpi endpoint
    Logging.logDebug({
      tenantID: tenant.id,
      action: 'OcpiPostCredentials',
      message: 'OCPI Server found and updated with credential object',
      source: 'OCPI Server',
      module: MODULE_NAME,
      method: 'postCredentials',
      detailedMessages: ocpiEndpoint
    });

    // Try to access remote ocpi service versions
    // Any error here should result in a 3001 Ocpi result exception based on the specification
    try {
      // Access versions API
      const ocpiVersions = await axios.get(ocpiEndpoint.baseUrl, {
        headers: {
          'Authorization': `Token ${ocpiEndpoint.token}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      // Log available OCPI Versions
      Logging.logDebug({
        tenantID: tenant.id,
        action: 'OcpiPostCredentials',
        message: 'Available OCPI Versions',
        source: 'OCPI Server',
        module: MODULE_NAME,
        method: 'postCredentials',
        detailedMessages: ocpiVersions.data
      });

      // Check response
      if (!ocpiVersions.data || !ocpiVersions.data.data) {
        throw new Error(`Invalid response from GET ${ocpiEndpoint.baseUrl}`);
      }

      // Loop through versions and pick the same one
      let versionFound = false;
      for (const version of ocpiVersions.data.data) {
        if (version.version === this.getVersion()) {
          versionFound = true;
          ocpiEndpoint.version = version.version;
          ocpiEndpoint.versionUrl = version.url;

          // Log correct OCPI service found
          Logging.logDebug({
            tenantID: tenant.id,
            action: 'OcpiPostCredentials',
            message: 'Correct OCPI version found',
            source: 'OCPI Server',
            module: MODULE_NAME,
            method: 'postCredentials',
            detailedMessages: `[${ocpiEndpoint.version}]:${ocpiEndpoint.versionUrl}`
          });
        }
      }

      // If not found trigger exception
      if (!versionFound) {
        throw new Error(`OCPI Endpoint version ${this.getVersion()} not found`);
      }

      // Try to read endpoints
      // Access versions API
      const endpoints = await axios.get(ocpiEndpoint.versionUrl, {
        headers: {
          'Authorization': `Token ${ocpiEndpoint.token}`,
          'Content-Type': 'application/json'
        }
      });

      // Log available OCPI services
      Logging.logDebug({
        tenantID: tenant.id,
        action: 'OcpiPostCredentials',
        message: 'Available OCPI services',
        source: 'OCPI Server',
        module: MODULE_NAME,
        method: 'postCredentials',
        detailedMessages: endpoints.data
      });
      // Check response
      if (!endpoints.data || !endpoints.data.data) {
        throw new Error(`Invalid response from GET ${ocpiEndpoint.versionUrl}`);
      }

      // Set available endpoints
      ocpiEndpoint.availableEndpoints = OCPIMapping.convertEndpoints(endpoints.data.data);
    } catch (error) {
      throw new AppError({
        source: Constants.OCPI_SERVER,
        module: MODULE_NAME,
        method: 'postCredentials',
        action: 'OcpiPostCredentials',
        errorCode: Constants.HTTP_GENERAL_ERROR,
        message: `Unable to use client API: ${error.message}`,
        ocpiError: Constants.OCPI_STATUS_CODE.CODE_3001_UNABLE_TO_USE_CLIENT_API_ERROR,
        detailedMessages: error.stack
      });
    }

    // Generate new token
    ocpiEndpoint.localToken = OCPIUtils.generateLocalToken(tenant.subdomain);
    ocpiEndpoint.status = Constants.OCPI_REGISTERING_STATUS.OCPI_REGISTERED;

    // Save ocpi endpoint
    await OCPIEndpointStorage.saveOcpiEndpoint(tenant.id, ocpiEndpoint);

    // Get base url
    const versionUrl = this.getServiceUrl(req) + Constants.OCPI_VERSIONS_PATH;

    // Build credential object
    const respCredential = await OCPIMapping.buildOCPICredentialObject(tenant.id, ocpiEndpoint.localToken, versionUrl);

    // Log available OCPI Versions
    Logging.logDebug({
      tenantID: tenant.id,
      action: 'OcpiPostCredentials',
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

