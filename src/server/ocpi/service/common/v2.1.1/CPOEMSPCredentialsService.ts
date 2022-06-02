import { NextFunction, Request, Response } from 'express';

import AppError from '../../../../../exception/AppError';
import AxiosFactory from '../../../../../utils/AxiosFactory';
import BackendError from '../../../../../exception/BackendError';
import { HTTPError } from '../../../../../types/HTTPError';
import Logging from '../../../../../utils/Logging';
import OCPICredential from '../../../../../types/ocpi/OCPICredential';
import OCPIEndpointStorage from '../../../../../storage/mongodb/OCPIEndpointStorage';
import { OCPIRegistrationStatus } from '../../../../../types/ocpi/OCPIRegistrationStatus';
import { OCPIStatusCode } from '../../../../../types/ocpi/OCPIStatusCode';
import OCPIUtils from '../../../OCPIUtils';
import OCPIUtilsService from '../../OCPIUtilsService';
import { ServerAction } from '../../../../../types/Server';
import { StatusCodes } from 'http-status-codes';

const MODULE_NAME = 'CPOEMSPCredentialsService';

export default class CPOEMSPCredentialsService {
  public static async handleDeleteCredentials(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    const { tenant, ocpiEndpoint } = req;
    // Get token from header
    let token;
    if (req.headers && req.headers.authorization) {
      token = req.headers.authorization.split(' ')[1];
    }
    // Log body
    await Logging.logInfo({
      tenantID: tenant.id,
      module: MODULE_NAME, method: 'handleDeleteCredentials', action,
      message: 'Received OCPI unregister endpoint',
      detailedMessages: { token }
    });
    // Check if ocpiEndpoint available
    if (ocpiEndpoint.status === OCPIRegistrationStatus.UNREGISTERED) {
      throw new AppError({
        module: MODULE_NAME, method: 'handleDeleteCredentials', action,
        errorCode: StatusCodes.METHOD_NOT_ALLOWED,
        message: 'OCPI endpoint is already unregistered',
        ocpiError: OCPIStatusCode.CODE_3000_GENERIC_SERVER_ERROR
      });
    }
    // Save ocpi endpoint
    ocpiEndpoint.status = OCPIRegistrationStatus.UNREGISTERED;
    ocpiEndpoint.backgroundPatchJob = false;
    await OCPIEndpointStorage.saveOcpiEndpoint(tenant, ocpiEndpoint);
    res.json(OCPIUtils.success());
    next();
  }

  public static async handleUpdateCreateCredentials(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    const { tenant, ocpiEndpoint } = req;
    // Get payload
    const credential = req.body as OCPICredential;
    await Logging.logDebug({
      tenantID: tenant.id,
      module: MODULE_NAME, method: 'handleUpdateCreateCredentials', action,
      message: 'Received credential object',
      detailedMessages: { credential }
    });
    // Check if valid
    if (!CPOEMSPCredentialsService.isValidOCPICredential(credential)) {
      throw new AppError({
        module: MODULE_NAME, method: 'handleUpdateCreateCredentials', action,
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
    await Logging.logDebug({
      tenantID: tenant.id,
      module: MODULE_NAME, method: 'handleUpdateCreateCredentials', action,
      message: 'Received token',
      detailedMessages: { token }
    });
    // Save information
    ocpiEndpoint.baseUrl = credential.url;
    ocpiEndpoint.token = credential.token;
    ocpiEndpoint.countryCode = credential.country_code;
    ocpiEndpoint.partyId = credential.party_id;
    ocpiEndpoint.businessDetails = credential.business_details;
    // Log updated ocpi endpoint
    await Logging.logDebug({
      tenantID: tenant.id,
      module: MODULE_NAME, method: 'handleUpdateCreateCredentials', action,
      message: 'OCPI Server found and updated with credential object',
      detailedMessages: { ocpiEndpoint }
    });
    // Try to access remote ocpi service versions
    // Any error here should result in a 3001 Ocpi result exception based on the specification
    try {
      // Access versions API
      let response = await AxiosFactory.getAxiosInstance(tenant).get(ocpiEndpoint.baseUrl, {
        headers: {
          'Authorization': `Token ${ocpiEndpoint.token}`
        },
      });
      // Log available OCPI Versions
      await Logging.logDebug({
        tenantID: tenant.id,
        module: MODULE_NAME, method: 'handleUpdateCreateCredentials', action,
        message: 'Available OCPI Versions',
        detailedMessages: { versions: response.data }
      });
      // Check response
      if (!response.data?.data) {
        throw new AppError({
          errorCode: StatusCodes.NOT_FOUND,
          module: MODULE_NAME, method: 'handleUpdateCreateCredentials', action,
          message: `Invalid response from GET ${ocpiEndpoint.baseUrl}`,
          detailedMessages: { data: response.data }
        });
      }
      // Loop through versions and pick the same one
      let versionFound = false;
      for (const version of response.data.data) {
        if (version.version === '2.1.1') {
          versionFound = true;
          ocpiEndpoint.version = version.version;
          ocpiEndpoint.versionUrl = version.url;
          // Log correct OCPI service found
          await Logging.logDebug({
            tenantID: tenant.id,
            module: MODULE_NAME, method: 'handleUpdateCreateCredentials', action,
            message: 'Correct OCPI version found',
            detailedMessages: `[${ocpiEndpoint.version}]:${ocpiEndpoint.versionUrl}`
          });
        }
      }
      // If not found trigger exception
      if (!versionFound) {
        throw new AppError({
          errorCode: StatusCodes.NOT_FOUND,
          module: MODULE_NAME, method: 'handleUpdateCreateCredentials', action,
          message: 'OCPI Endpoint version 2.1.1 not found',
          detailedMessages: { data: response.data }
        });
      }
      // Try to read endpoints
      response = await AxiosFactory.getAxiosInstance(tenant).get(ocpiEndpoint.versionUrl, {
        headers: {
          'Authorization': `Token ${ocpiEndpoint.token}`
        }
      });
      // Log available OCPI services
      await Logging.logDebug({
        tenantID: tenant.id,
        module: MODULE_NAME, method: 'handleUpdateCreateCredentials', action,
        message: 'Available OCPI services',
        detailedMessages: { endpoints: response.data }
      });
      // Check response
      if (!response.data?.data) {
        throw new BackendError({
          module: MODULE_NAME, method: 'handleUpdateCreateCredentials', action,
          message: `Invalid response from GET ${ocpiEndpoint.versionUrl}`,
          detailedMessages: { data: response.data }
        });
      }
      // Set available endpoints
      ocpiEndpoint.availableEndpoints = OCPIUtils.convertAvailableEndpoints(response.data.data);
    } catch (error) {
      throw new AppError({
        module: MODULE_NAME, method: 'handleUpdateCreateCredentials', action,
        errorCode: HTTPError.GENERAL_ERROR,
        message: `Unable to use client API: ${error.message as string}`,
        ocpiError: OCPIStatusCode.CODE_3001_UNABLE_TO_USE_CLIENT_API_ERROR,
        detailedMessages: { error: error.stack }
      });
    }
    // Generate new token
    ocpiEndpoint.localToken = OCPIUtils.generateLocalToken(tenant.subdomain);
    ocpiEndpoint.status = OCPIRegistrationStatus.REGISTERED;
    // Save ocpi endpoint
    await OCPIEndpointStorage.saveOcpiEndpoint(tenant, ocpiEndpoint);
    // Get base url
    const versionUrl = OCPIUtilsService.getServiceUrl(req, ocpiEndpoint.role.toLocaleLowerCase()) + '/versions';
    // Build credential object
    const respCredential = await OCPIUtils.buildOcpiCredentialObject(tenant, ocpiEndpoint.localToken, ocpiEndpoint.role, versionUrl);
    // Log available OCPI Versions
    await Logging.logDebug({
      tenantID: tenant.id,
      module: MODULE_NAME, method: 'handleUpdateCreateCredentials', action,
      message: 'Response with credential object',
      detailedMessages: { respCredential }
    });
    // Respond with credentials
    res.json(OCPIUtils.success(respCredential));
    next();
  }

  private static isValidOCPICredential(credential: OCPICredential): boolean {
    return (!credential ||
      !credential.url ||
      !credential.token ||
      !credential.party_id ||
      !credential.country_code) ? false : true;
  }
}
