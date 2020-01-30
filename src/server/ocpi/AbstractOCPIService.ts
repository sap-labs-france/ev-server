import { NextFunction, Request, Response } from 'express';
import AbstractEndpoint from './ocpi-services-impl/AbstractEndpoint';
import BackendError from '../../exception/BackendError';
import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import OCPIUtils from './OCPIUtils';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import AppError from '../../exception/AppError';
import AppAuthError from '../../exception/AppAuthError';
import { Configuration } from '../../types/configuration/Configuration';
import Tenant from '../../types/Tenant';
import HttpStatusCodes from 'http-status-codes';
import OCPIEndpointStorage from '../../storage/mongodb/OCPIEndpointStorage';

const MODULE_NAME = 'AbstractOCPIService';

export interface TenantIdHoldingRequest extends Request {
  tenantID: string;
}

export default abstract class AbstractOCPIService {

  private endpoints: Map<string, AbstractEndpoint> = new Map();

  // Create OCPI Service
  protected constructor(
    private readonly ocpiRestConfig: Configuration['OCPIService'],
    private readonly role: string,
    private readonly version: string) {
  }

  /**
   * Register Endpoint to this service
   * @param {*} endpoint AbstractEndpoint
   */
  public registerEndpoint(endpoint: AbstractEndpoint): void {
    this.endpoints.set(endpoint.getIdentifier(), endpoint);
  }

  // Get All Registered Endpoint
  public getRegisteredEndpoints(): Map<string, AbstractEndpoint> {
    return this.endpoints;
  }

  // Return based URL of OCPI Service
  public getServiceUrl(req: Request): string {
    const baseUrl = this.getBaseUrl(req);
    const path = this.getPath();

    // Return Service url
    return `${baseUrl}${path}`;
  }

  // Get BaseUrl ${protocol}://${host}
  public getBaseUrl(req: Request): string {
    const protocol = (this.ocpiRestConfig.externalProtocol ? this.ocpiRestConfig.externalProtocol : 'https');

    // Get host from the req
    const host = req.get('host');

    // Return Service url
    return `${protocol}://${host}`;
  }

  // Get Relative path of the service
  public getPath(): string {
    return `${this.role}/${this.version}/`;
  }

  /**
   * Return Version of OCPI Service
   */
  public getVersion(): string {
    return this.version;
  }

  // Rest Service Implementation
  public async restService(req: TenantIdHoldingRequest, res: Response, next: NextFunction): Promise<void> {
    // Parse the action
    const regexResult = /^\/\w*/g.exec(req.url);
    if (!regexResult) {
      throw new BackendError({
        source: Constants.OCPI_SERVER,
        module: 'AbstractOCPIService',
        method: 'restService',
        message: 'Regex did not match.'
      });
    }
    const action = regexResult[0].substring(1);

    // Set default tenant in case of exception
    req.user = { tenantID: Constants.DEFAULT_TENANT };

    // Check action
    switch (action) {
      // If empty - return available endpoints
      case '':
        this.getSupportedEndpoints(req, res, next);
        break;
      default:
        await this.processEndpointAction(action, req, res, next);
        break;
    }
  }

  /**
   * Send Supported Endpoints
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public getSupportedEndpoints(req: TenantIdHoldingRequest, res: Response, next: Function): void {
    const fullUrl = this.getServiceUrl(req);
    const registeredEndpointsArray = Array.from(this.getRegisteredEndpoints().values());

    // Build payload
    const supportedEndpoints = registeredEndpointsArray.map((endpoint) => {
      const identifier = endpoint.getIdentifier();
      return { 'identifier': `${identifier}`, 'url': `${fullUrl}${identifier}/` };
    });

    // Return payload
    res.json(OCPIUtils.success({ 'version': this.getVersion(), 'endpoints': supportedEndpoints }));
  }

  /**
   * Process Endpoint action
   */
  public async processEndpointAction(action: string, req: TenantIdHoldingRequest, res: Response, next: Function): Promise<void> {
    try {
      const registeredEndpoints = this.getRegisteredEndpoints();

      // Get token from header
      if (!req.headers || !req.headers.authorization) {
        throw new AppError({
          source: Constants.OCPI_SERVER,
          module: MODULE_NAME,
          method: 'processEndpointAction',
          action: action,
          errorCode: HttpStatusCodes.UNAUTHORIZED,
          message: 'Missing authorization token',
          ocpiError: Constants.OCPI_STATUS_CODE.CODE_2001_INVALID_PARAMETER_ERROR
        });
      }

      // Get token
      let decodedToken: { tenant: string; tid: string };
      const token = req.headers.authorization.split(' ')[1];
      try {
        decodedToken = JSON.parse(OCPIUtils.atob(token));
      } catch (error) {
        throw new AppError({
          source: Constants.OCPI_SERVER,
          module: MODULE_NAME,
          method: 'processEndpointAction',
          action: action,
          errorCode: HttpStatusCodes.UNAUTHORIZED,
          message: 'Invalid authorization token',
          ocpiError: Constants.OCPI_STATUS_CODE.CODE_3000_GENERIC_SERVER_ERROR
        });
      }

      // Get tenant from the called URL - TODO: review this handle tenant and tid in decoded token
      const tenantSubdomain = (decodedToken.tenant ? decodedToken.tenant : decodedToken.tid);

      // Get tenant from database
      const tenant: Tenant = await TenantStorage.getTenantBySubdomain(tenantSubdomain);

      // Check if tenant is found
      if (!tenant) {
        throw new AppError({
          source: Constants.OCPI_SERVER,
          module: MODULE_NAME,
          method: 'processEndpointAction',
          action: action,
          errorCode: HttpStatusCodes.UNAUTHORIZED,
          message: `The Tenant '${tenantSubdomain}' does not exist`,
          ocpiError: Constants.OCPI_STATUS_CODE.CODE_3000_GENERIC_SERVER_ERROR
        });
      }

      const ocpiEndpoint = await OCPIEndpointStorage.getOcpiEndpointByLocalToken(tenant.id, token);
      // Check if endpoint is found
      if (!ocpiEndpoint) {
        throw new AppError({
          source: Constants.OCPI_SERVER,
          module: MODULE_NAME,
          method: 'processEndpointAction',
          action: action,
          errorCode: HttpStatusCodes.UNAUTHORIZED,
          message: 'Invalid token',
          ocpiError: Constants.OCPI_STATUS_CODE.CODE_3000_GENERIC_SERVER_ERROR
        });
      }

      // Pass tenant id to req
      req.user.tenantID = tenant.id;

      // Check if service is enabled for tenant
      if (!this.ocpiRestConfig.tenantEnabled.includes(tenantSubdomain)) {
        throw new AppError({
          source: Constants.OCPI_SERVER,
          module: MODULE_NAME,
          method: 'processEndpointAction',
          action: action,
          errorCode: Constants.HTTP_GENERAL_ERROR,
          message: `The Tenant '${tenantSubdomain}' is not enabled for OCPI`,
          ocpiError: Constants.OCPI_STATUS_CODE.CODE_3000_GENERIC_SERVER_ERROR
        });
      }
      // Define get option
      const options = {
        'addChargeBoxID': true,
        countryID: '',
        partyID: ''
      };
      if (this.ocpiRestConfig.eMI3id &&
        this.ocpiRestConfig.eMI3id[tenantSubdomain] &&
        this.ocpiRestConfig.eMI3id[tenantSubdomain].country_id &&
        this.ocpiRestConfig.eMI3id[tenantSubdomain].party_id) {
        options.countryID = this.ocpiRestConfig.eMI3id[tenantSubdomain].country_id;
        options.partyID = this.ocpiRestConfig.eMI3id[tenantSubdomain].party_id;
      } else {
        throw new AppError({
          source: Constants.OCPI_SERVER,
          module: MODULE_NAME,
          method: 'processEndpointAction',
          action: action,
          errorCode: Constants.HTTP_GENERAL_ERROR,
          message: `The Tenant '${tenantSubdomain}' doesn't have country_id and/or party_id defined`,
          ocpiError: Constants.OCPI_STATUS_CODE.CODE_3000_GENERIC_SERVER_ERROR
        });
      }

      // Handle request action (endpoint)
      const endpoint = registeredEndpoints.get(action);
      if (endpoint) {
        Logging.logDebug({
          tenantID: tenant.id,
          source: Constants.OCPI_SERVER,
          module: MODULE_NAME,
          method: action,
          message: `>> OCPI Request ${req.method} ${req.originalUrl}`,
          action: action,
          detailedMessages: req.body
        });
        const response = await endpoint.process(req, res, next, tenant, ocpiEndpoint, options);
        if (response) {
          Logging.logDebug({
            tenantID: tenant.id,
            source: Constants.OCPI_SERVER,
            module: MODULE_NAME,
            method: action,
            message: `<< OCPI Response ${req.method} ${req.originalUrl}`,
            action: action,
            detailedMessages: response
          });
          res.json(response);
        } else {
          Logging.logWarning({
            tenantID: tenant.id,
            source: Constants.OCPI_SERVER,
            module: MODULE_NAME,
            method: action,
            message: `<< OCPI Endpoint ${req.originalUrl} not implemented`,
            action: action
          });
          res.sendStatus(501);
        }
      } else {
        // pragma res.sendStatus(501);
        throw new AppError({
          source: Constants.OCPI_SERVER,
          module: MODULE_NAME,
          method: 'processEndpointAction',
          action: action,
          errorCode: Constants.HTTP_NOT_IMPLEMENTED_ERROR,
          message: `Endpoint ${action} not implemented`,
          ocpiError: Constants.OCPI_STATUS_CODE.CODE_3000_GENERIC_SERVER_ERROR
        });
      }
    } catch (error) {
      Logging.logActionExceptionMessage(req.user && req.user.tenantID ? req.user.tenantID : Constants.DEFAULT_TENANT, action, error);
      let errorCode = Constants.HTTP_GENERAL_ERROR;
      if (error instanceof AppError || error instanceof AppAuthError) {
        errorCode = error.params.errorCode;
      }
      res.status(errorCode).json(OCPIUtils.toErrorResponse(error));
    }
  }
}
