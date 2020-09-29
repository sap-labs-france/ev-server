import { NextFunction, Request, Response } from 'express';

import AbstractEndpoint from '../AbstractEndpoint';
import AbstractOCPIService from '../../AbstractOCPIService';
import AppError from '../../../../exception/AppError';
import AxiosFactory from '../../../../utils/AxiosFactory';
import BackendError from '../../../../exception/BackendError';
import Constants from '../../../../utils/Constants';
import { HTTPError } from '../../../../types/HTTPError';
import Logging from '../../../../utils/Logging';
import OCPICredential from '../../../../types/ocpi/OCPICredential';
import OCPIEndpoint from '../../../../types/ocpi/OCPIEndpoint';
import OCPIEndpointStorage from '../../../../storage/mongodb/OCPIEndpointStorage';
import OCPIMapping from './OCPIMapping';
import { OCPIRegistrationStatus } from '../../../../types/ocpi/OCPIRegistrationStatus';
import { OCPIResponse } from '../../../../types/ocpi/OCPIResponse';
import { OCPIStatusCode } from '../../../../types/ocpi/OCPIStatusCode';
import OCPIUtils from '../../OCPIUtils';
import { ServerAction } from '../../../../types/Server';
import { StatusCodes } from 'http-status-codes';
import Tenant from '../../../../types/Tenant';

const EP_IDENTIFIER = 'credentials';
const MODULE_NAME = 'CredentialsEndpoint';

/**
 * Credentials Endpoint
 */
export default class CredentialsEndpoint extends AbstractEndpoint {
  constructor(ocpiService: AbstractOCPIService) {
    super(ocpiService, EP_IDENTIFIER);
  }

  /**
   * Main Process Method for the endpoint
   */
  async process(req: Request, res: Response, next: NextFunction, tenant: Tenant, ocpiEndpoint: OCPIEndpoint): Promise<OCPIResponse> {
    switch (req.method) {
      case 'POST':
        return await this.postCredentials(req, res, next, tenant);
      case 'DELETE':
        return await this.deleteCredentials(req, res, next, tenant);
    }
  }

  /**
   * Registration process initiated by IOP
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async deleteCredentials(req: Request, res: Response, next: NextFunction, tenant: Tenant): Promise<OCPIResponse> {
    // Get token from header
    let token;
    if (req.headers && req.headers.authorization) {
      token = req.headers.authorization.split(' ')[1];
    }
    // Log body
    Logging.logInfo({
      tenantID: tenant.id,
      action: ServerAction.OCPI_DELETE_CREDENTIALS,
      message: 'Received unregister',
      source: Constants.CENTRAL_SERVER,
      module: MODULE_NAME, method: 'deleteCredentials',
      detailedMessages: { token }
    });
    // Get ocpiEndpoints based on the given token
    const ocpiEndpoint = await OCPIEndpointStorage.getOcpiEndpointByLocalToken(tenant.id, token);
    // Check if ocpiEndpoint available
    if (!ocpiEndpoint || ocpiEndpoint.status === OCPIRegistrationStatus.UNREGISTERED) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME, method: 'deleteCredentials',
        errorCode: StatusCodes.METHOD_NOT_ALLOWED,
        action: ServerAction.OCPI_DELETE_CREDENTIALS,
        message: 'Method not allowed if the client was not registered',
        ocpiError: OCPIStatusCode.CODE_3000_GENERIC_SERVER_ERROR
      });
    }
    // Save ocpi endpoint
    ocpiEndpoint.status = OCPIRegistrationStatus.UNREGISTERED;
    ocpiEndpoint.backgroundPatchJob = false;
    await OCPIEndpointStorage.saveOcpiEndpoint(tenant.id, ocpiEndpoint);
    return OCPIUtils.success();
  }

  /**
   * Registration process initiated by IOP
   */
  async postCredentials(req: Request, res: Response, next: NextFunction, tenant: Tenant): Promise<OCPIResponse> {
    // Get payload
    const credential: OCPICredential = req.body;
    // Log body
    Logging.logDebug({
      tenantID: tenant.id,
      action: ServerAction.OCPI_POST_CREDENTIALS,
      message: 'Received credential object',
      source: Constants.CENTRAL_SERVER,
      module: MODULE_NAME, method: 'postCredentials',
      detailedMessages: { credential }
    });
    // Check if valid
    if (!OCPIMapping.isValidOCPICredential(credential)) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME, method: 'postCredentials',
        action: ServerAction.OCPI_POST_CREDENTIALS,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Invalid Credential Object',
        ocpiError: OCPIStatusCode.CODE_2000_GENERIC_CLIENT_ERROR
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
      action: ServerAction.OCPI_POST_CREDENTIALS,
      message: 'Received token',
      source: Constants.CENTRAL_SERVER,
      module: MODULE_NAME, method: 'postCredentials',
      detailedMessages: { token }
    });
    // Get ocpiEndpoints based on the given token
    const ocpiEndpoint = await OCPIEndpointStorage.getOcpiEndpointByLocalToken(tenant.id, token);
    // Check if ocpiEndpoint available
    if (!ocpiEndpoint) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME, method: 'postCredentials',
        action: ServerAction.OCPI_POST_CREDENTIALS,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'OCPI Endpoint not available or wrong token',
        ocpiError: OCPIStatusCode.CODE_3000_GENERIC_SERVER_ERROR
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
      action: ServerAction.OCPI_POST_CREDENTIALS,
      message: 'OCPI Server found and updated with credential object',
      source: Constants.CENTRAL_SERVER,
      module: MODULE_NAME, method: 'postCredentials',
      detailedMessages: { ocpiEndpoint }
    });
    // Try to access remote ocpi service versions
    // Any error here should result in a 3001 Ocpi result exception based on the specification
    try {
      // Access versions API
      let response = await AxiosFactory.getAxiosInstance(tenant.id).get(ocpiEndpoint.baseUrl, {
        headers: {
          'Authorization': `Token ${ocpiEndpoint.token}`
        },
      });
      // Log available OCPI Versions
      Logging.logDebug({
        tenantID: tenant.id,
        action: ServerAction.OCPI_POST_CREDENTIALS,
        message: 'Available OCPI Versions',
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME, method: 'postCredentials',
        detailedMessages: { versions: response.data }
      });
      // Check response
      if (!response.data || !response.data.data) {
        throw new BackendError({
          action: ServerAction.OCPI_POST_CREDENTIALS,
          message: `Invalid response from GET ${ocpiEndpoint.baseUrl}`,
          module: MODULE_NAME, method: 'postCredentials',
          detailedMessages: { data: response.data }
        });
      }
      // Loop through versions and pick the same one
      let versionFound = false;
      for (const version of response.data.data) {
        if (version.version === this.getVersion()) {
          versionFound = true;
          ocpiEndpoint.version = version.version;
          ocpiEndpoint.versionUrl = version.url;

          // Log correct OCPI service found
          Logging.logDebug({
            tenantID: tenant.id,
            action: ServerAction.OCPI_POST_CREDENTIALS,
            message: 'Correct OCPI version found',
            source: Constants.CENTRAL_SERVER,
            module: MODULE_NAME, method: 'postCredentials',
            detailedMessages: `[${ocpiEndpoint.version}]:${ocpiEndpoint.versionUrl}`
          });
        }
      }
      // If not found trigger exception
      if (!versionFound) {
        throw new BackendError({
          action: ServerAction.OCPI_POST_CREDENTIALS,
          message: `OCPI Endpoint version ${this.getVersion()} not found`,
          module: MODULE_NAME, method: 'postCredentials',
          detailedMessages: { data: response.data }
        });
      }
      // Try to read endpoints
      response = await AxiosFactory.getAxiosInstance(tenant.id).get(ocpiEndpoint.versionUrl, {
        headers: {
          'Authorization': `Token ${ocpiEndpoint.token}`
        }
      });
      // Log available OCPI services
      Logging.logDebug({
        tenantID: tenant.id,
        action: ServerAction.OCPI_POST_CREDENTIALS,
        message: 'Available OCPI services',
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME, method: 'postCredentials',
        detailedMessages: { endpoints: response.data }
      });
      // Check response
      if (!response.data || !response.data.data) {
        throw new BackendError({
          action: ServerAction.OCPI_POST_CREDENTIALS,
          message: `Invalid response from GET ${ocpiEndpoint.versionUrl}`,
          module: MODULE_NAME, method: 'postCredentials',
          detailedMessages: { data: response.data }
        });
      }
      // Set available endpoints
      ocpiEndpoint.availableEndpoints = OCPIMapping.convertEndpoints(response.data.data);
    } catch (error) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME, method: 'postCredentials',
        action: ServerAction.OCPI_POST_CREDENTIALS,
        errorCode: HTTPError.GENERAL_ERROR,
        message: `Unable to use client API: ${error.message}`,
        ocpiError: OCPIStatusCode.CODE_3001_UNABLE_TO_USE_CLIENT_API_ERROR,
        detailedMessages: { error: error.message, stack: error.stack }
      });
    }
    // Generate new token
    ocpiEndpoint.localToken = OCPIUtils.generateLocalToken(tenant.subdomain);
    ocpiEndpoint.status = OCPIRegistrationStatus.REGISTERED;
    // Save ocpi endpoint
    await OCPIEndpointStorage.saveOcpiEndpoint(tenant.id, ocpiEndpoint);
    // Get base url
    const versionUrl = this.getServiceUrl(req) + AbstractOCPIService.VERSIONS_PATH;
    // Build credential object
    const respCredential = await OCPIMapping.buildOCPICredentialObject(tenant.id, ocpiEndpoint.localToken, ocpiEndpoint.role, versionUrl);
    // Log available OCPI Versions
    Logging.logDebug({
      tenantID: tenant.id,
      action: ServerAction.OCPI_POST_CREDENTIALS,
      message: 'Response with credential object',
      source: Constants.CENTRAL_SERVER,
      module: MODULE_NAME, method: 'postCredentials',
      detailedMessages: { respCredential }
    });
    // Respond with credentials
    return OCPIUtils.success(respCredential);
  }
}

