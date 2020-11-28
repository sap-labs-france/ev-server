import { NextFunction, Request, Response } from 'express';

import AbstractEndpoint from './ocpi-services-impl/AbstractEndpoint';
import AppAuthError from '../../exception/AppAuthError';
import AppError from '../../exception/AppError';
import BackendError from '../../exception/BackendError';
import { Configuration } from '../../types/configuration/Configuration';
import Constants from '../../utils/Constants';
import { HTTPError } from '../../types/HTTPError';
import Logging from '../../utils/Logging';
import OCPIEndpointStorage from '../../storage/mongodb/OCPIEndpointStorage';
import { OCPIStatusCode } from '../../types/ocpi/OCPIStatusCode';
import OCPIUtils from './OCPIUtils';
import { ServerAction } from '../../types/Server';
import { StatusCodes } from 'http-status-codes';
import Tenant from '../../types/Tenant';
import TenantComponents from '../../types/TenantComponents';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import Utils from '../../utils/Utils';

const MODULE_NAME = 'AbstractOCPIService';

export interface TenantIdHoldingRequest extends Request {
  tenantID: string;
}

export default abstract class AbstractOCPIService {
  public static readonly VERSIONS_PATH = '/versions';

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
    // FIXME: use a express request parameter instead of using regexp to parse the request URL
    const regexResult = /^\/\w*/g.exec(req.url);
    if (!regexResult) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME, method: 'restService',
        message: 'Regex did not match.'
      });
    }
    const action = regexResult[0].substring(1) as ServerAction;
    // Set default tenant in case of exception
    req.user = { tenantID: Constants.DEFAULT_TENANT };
    // Check action
    switch (action) {
      // If empty - return available endpoints
      case '' as ServerAction:
        this.getSupportedEndpoints(req, res, next);
        break;
      default:
        await this.processEndpointAction(action, req, res, next);
        break;
    }
    next();
  }

  /**
   * Send Supported Endpoints
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public getSupportedEndpoints(req: TenantIdHoldingRequest, res: Response, next: NextFunction): void {
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
  public async processEndpointAction(action: ServerAction, req: TenantIdHoldingRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const registeredEndpoints = this.getRegisteredEndpoints();
      // Get token from header
      if (!req.headers || !req.headers.authorization) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          module: MODULE_NAME, method: 'processEndpointAction',
          action: ServerAction.OCPI_ENDPOINT,
          errorCode: StatusCodes.UNAUTHORIZED,
          message: 'Missing authorization token',
          ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR
        });
      }
      // Get token
      let decodedToken: { tenant: string; tid: string };
      const token = req.headers.authorization.split(' ')[1];
      try {
        decodedToken = JSON.parse(OCPIUtils.atob(token));
      } catch (error) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          module: MODULE_NAME, method: 'processEndpointAction',
          action: ServerAction.OCPI_ENDPOINT,
          errorCode: StatusCodes.UNAUTHORIZED,
          message: 'Invalid authorization token',
          ocpiError: OCPIStatusCode.CODE_3000_GENERIC_SERVER_ERROR,
          detailedMessages: { error: error.message, stack: error.stack }
        });
      }
      // Get tenant from the called URL - TODO: review this handle tenant and tid in decoded token
      const tenantSubdomain = (decodedToken.tenant ? decodedToken.tenant : decodedToken.tid);
      // Get tenant from database
      const tenant: Tenant = await TenantStorage.getTenantBySubdomain(tenantSubdomain);
      // Check if tenant is found
      if (!tenant) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          module: MODULE_NAME, method: 'processEndpointAction',
          action: ServerAction.OCPI_ENDPOINT,
          errorCode: StatusCodes.UNAUTHORIZED,
          message: `The Tenant '${tenantSubdomain}' does not exist`,
          ocpiError: OCPIStatusCode.CODE_3000_GENERIC_SERVER_ERROR
        });
      }
      if (!Utils.isTenantComponentActive(tenant, TenantComponents.OCPI)) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          module: MODULE_NAME, method: 'processEndpointAction',
          action: ServerAction.OCPI_ENDPOINT,
          errorCode: StatusCodes.UNAUTHORIZED,
          message: `The Tenant '${tenantSubdomain}' does not support OCPI`,
          ocpiError: OCPIStatusCode.CODE_3000_GENERIC_SERVER_ERROR
        });
      }
      const ocpiEndpoint = await OCPIEndpointStorage.getOcpiEndpointByLocalToken(tenant.id, token);
      // Check if endpoint is found
      if (!ocpiEndpoint) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          module: MODULE_NAME, method: 'processEndpointAction',
          action: ServerAction.OCPI_ENDPOINT,
          errorCode: StatusCodes.UNAUTHORIZED,
          message: 'Invalid token',
          ocpiError: OCPIStatusCode.CODE_3000_GENERIC_SERVER_ERROR
        });
      }
      // Pass tenant id to req
      req.user.tenantID = tenant.id;
      // Handle request action (endpoint)
      const endpoint = registeredEndpoints.get(action);
      if (endpoint) {
        Logging.logDebug({
          tenantID: tenant.id,
          source: Constants.CENTRAL_SERVER,
          module: MODULE_NAME, method: action,
          message: `>> OCPI Request ${req.method} ${req.originalUrl}`,
          action: ServerAction.OCPI_ENDPOINT,
          detailedMessages: { params: req.body }
        });
        const response = await endpoint.process(req, res, next, tenant, ocpiEndpoint);
        if (response) {
          Logging.logDebug({
            tenantID: tenant.id,
            source: Constants.CENTRAL_SERVER,
            module: MODULE_NAME, method: action,
            message: `<< OCPI Response ${req.method} ${req.originalUrl}`,
            action: ServerAction.OCPI_ENDPOINT,
            detailedMessages: { response }
          });
          res.json(response);
        } else {
          Logging.logWarning({
            tenantID: tenant.id,
            source: Constants.CENTRAL_SERVER,
            module: MODULE_NAME, method: action,
            message: `<< OCPI Endpoint ${req.method} ${req.originalUrl} not implemented`,
            action: ServerAction.OCPI_ENDPOINT
          });
          res.sendStatus(StatusCodes.NOT_IMPLEMENTED);
        }
      } else {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          module: MODULE_NAME, method: 'processEndpointAction',
          action: ServerAction.OCPI_ENDPOINT,
          errorCode: HTTPError.NOT_IMPLEMENTED_ERROR,
          message: `Endpoint ${action} not implemented`,
          ocpiError: OCPIStatusCode.CODE_3000_GENERIC_SERVER_ERROR
        });
      }
    } catch (error) {
      Logging.logError({
        tenantID: req.user && req.user.tenantID ? req.user.tenantID : Constants.DEFAULT_TENANT,
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME, method: action,
        message: `<< OCPI Response Error ${req.method} ${req.originalUrl}`,
        action: ServerAction.OCPI_ENDPOINT,
        detailedMessages: { error: error.message, stack: error.stack }
      });
      Logging.logActionExceptionMessage(req.user && req.user.tenantID ? req.user.tenantID : Constants.DEFAULT_TENANT, ServerAction.OCPI_ENDPOINT, error);
      let errorCode: any = {};
      if (error instanceof AppError || error instanceof AppAuthError) {
        errorCode = error.params.errorCode;
      } else {
        errorCode = HTTPError.GENERAL_ERROR;
      }
      res.status(errorCode).json(OCPIUtils.toErrorResponse(error));
    }
  }
}
