import { NextFunction, Request, Response } from 'express';
import Tenant, { TenantComponents } from '../../types/Tenant';

import AbstractEndpoint from './ocpi-services-impl/AbstractEndpoint';
import AppAuthError from '../../exception/AppAuthError';
import AppError from '../../exception/AppError';
import BackendError from '../../exception/BackendError';
import Constants from '../../utils/Constants';
import { HTTPError } from '../../types/HTTPError';
import Logging from '../../utils/Logging';
import OCPIEndpointStorage from '../../storage/mongodb/OCPIEndpointStorage';
import OCPIServiceConfiguration from '../../types/configuration/OCPIServiceConfiguration';
import { OCPIStatusCode } from '../../types/ocpi/OCPIStatusCode';
import OCPIUtils from './OCPIUtils';
import { ServerAction } from '../../types/Server';
import { StatusCodes } from 'http-status-codes';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import Utils from '../../utils/Utils';

const MODULE_NAME = 'AbstractOCPIService';

export interface TenantIdHoldingRequest extends Request {
  tenantID: string;
}

export default abstract class AbstractOCPIService {
  public static readonly VERSIONS_PATH = '/versions';

  private endpoints: Map<string, AbstractEndpoint> = new Map<string, AbstractEndpoint>();

  protected constructor(
      private readonly ocpiRestConfig: OCPIServiceConfiguration,
      private readonly role: string,
      private readonly version: string) {
  }

  public registerEndpoint(endpoint: AbstractEndpoint): void {
    this.endpoints.set(endpoint.getIdentifier(), endpoint);
  }

  public getRegisteredEndpoints(): Map<string, AbstractEndpoint> {
    return this.endpoints;
  }

  public getServiceUrl(req: Request): string {
    const baseUrl = this.getBaseUrl(req);
    const path = this.getPath();
    // Return Service url
    return `${baseUrl}${path}`;
  }

  public getBaseUrl(req: Request): string {
    // Get host from the req
    const host = req.get('host');
    // Return Service url
    return `https://${host}`;
  }

  public getPath(): string {
    return `${this.role}/${this.version}/`;
  }

  public getVersion(): string {
    return this.version;
  }

  public async restService(req: TenantIdHoldingRequest, res: Response, next: NextFunction): Promise<void> {
    // Parse the action
    const regexResult = /^\/\w*/g.exec(req.url);
    if (!regexResult) {
      throw new BackendError({
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

  public async processEndpointAction(ocpiAction: string, req: TenantIdHoldingRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const registeredEndpoints = this.getRegisteredEndpoints();
      // Get token from header
      if (!req.headers || !req.headers.authorization) {
        throw new AppError({
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
          module: MODULE_NAME, method: 'processEndpointAction',
          action: ServerAction.OCPI_ENDPOINT,
          errorCode: StatusCodes.UNAUTHORIZED,
          message: 'Invalid authorization token',
          ocpiError: OCPIStatusCode.CODE_3000_GENERIC_SERVER_ERROR,
          detailedMessages: { error: error.stack }
        });
      }
      // Get tenant from the called URL - TODO: review this handle tenant and tid in decoded token
      const tenantSubdomain = (decodedToken.tenant ? decodedToken.tenant : decodedToken.tid);
      // Get tenant from database
      const tenant = await TenantStorage.getTenantBySubdomain(tenantSubdomain);
      // Check if tenant is found
      if (!tenant) {
        throw new AppError({
          module: MODULE_NAME, method: 'processEndpointAction',
          action: ServerAction.OCPI_ENDPOINT,
          errorCode: StatusCodes.UNAUTHORIZED,
          message: `The Tenant '${tenantSubdomain}' does not exist`,
          ocpiError: OCPIStatusCode.CODE_3000_GENERIC_SERVER_ERROR
        });
      }
      if (!Utils.isTenantComponentActive(tenant, TenantComponents.OCPI)) {
        throw new AppError({
          module: MODULE_NAME, method: 'processEndpointAction',
          action: ServerAction.OCPI_ENDPOINT,
          errorCode: StatusCodes.UNAUTHORIZED,
          message: `The Tenant '${tenantSubdomain}' does not support OCPI`,
          ocpiError: OCPIStatusCode.CODE_3000_GENERIC_SERVER_ERROR
        });
      }
      const ocpiEndpoint = await OCPIEndpointStorage.getOcpiEndpointByLocalToken(tenant, token);
      // Check if endpoint is found
      if (!ocpiEndpoint) {
        throw new AppError({
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
      const endpoint = registeredEndpoints.get(ocpiAction);
      if (endpoint) {
        await Logging.logDebug({
          tenantID: tenant.id,
          module: MODULE_NAME, method: ocpiAction,
          message: `>> OCPI Request ${req.method} ${req.originalUrl}`,
          action: ServerAction.OCPI_ENDPOINT,
          detailedMessages: { params: req.body }
        });
        const response = await endpoint.process(req, res, next, tenant, ocpiEndpoint);
        if (response) {
          await Logging.logDebug({
            tenantID: tenant.id,
            module: MODULE_NAME, method: ocpiAction,
            message: `<< OCPI Response ${req.method} ${req.originalUrl}`,
            action: ServerAction.OCPI_ENDPOINT,
            detailedMessages: { response }
          });
          res.json(response);
        } else {
          await Logging.logWarning({
            tenantID: tenant.id,
            module: MODULE_NAME, method: ocpiAction,
            message: `<< OCPI Endpoint ${req.method} ${req.originalUrl} not implemented`,
            action: ServerAction.OCPI_ENDPOINT
          });
          res.sendStatus(StatusCodes.NOT_IMPLEMENTED);
        }
      } else {
        throw new AppError({
          module: MODULE_NAME, method: 'processEndpointAction',
          action: ServerAction.OCPI_ENDPOINT,
          errorCode: HTTPError.NOT_IMPLEMENTED_ERROR,
          message: `Endpoint '${ocpiAction}' not implemented`,
          ocpiError: OCPIStatusCode.CODE_3000_GENERIC_SERVER_ERROR
        });
      }
    } catch (error) {
      await Logging.logError({
        tenantID: req.tenant?.id ?? Constants.DEFAULT_TENANT,
        module: MODULE_NAME, method: ocpiAction,
        message: `<< OCPI Response Error ${req.method} ${req.originalUrl}`,
        action: error.params?.action ?? ServerAction.OCPI_ENDPOINT,
        detailedMessages: { error: error.stack }
      });
      await Logging.logActionExceptionMessage(req.tenant?.id ?? Constants.DEFAULT_TENANT, error.params?.action ?? ServerAction.OCPI_ENDPOINT, error);
      res.status(error.params?.errorCode ?? HTTPError.GENERAL_ERROR).json(OCPIUtils.toErrorResponse(error));
    }
  }
}
