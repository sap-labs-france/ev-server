import { NextFunction, Request, Response } from 'express';
import Tenant, { TenantComponents } from '../../types/Tenant';

import AbstractEndpoint from './oicp-services-impl/AbstractEndpoint';
import AppAuthError from '../../exception/AppAuthError';
import AppError from '../../exception/AppError';
import Constants from '../../utils/Constants';
import { HTTPError } from '../../types/HTTPError';
import Logging from '../../utils/Logging';
import OICPServiceConfiguration from '../../types/configuration/OICPServiceConfiguration';
import { OICPStatusCode } from '../../types/oicp/OICPStatusCode';
import OICPUtils from './OICPUtils';
import { ServerAction } from '../../types/Server';
import { StatusCodes } from 'http-status-codes';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import Utils from '../../utils/Utils';

const MODULE_NAME = 'AbstractOICPService';

export interface TenantIdHoldingRequest extends Request {
  tenantID: string;
}

export default abstract class AbstractOICPService {

  private endpoints: Map<string, AbstractEndpoint> = new Map();

  protected constructor(
      private readonly oicpRestConfig: OICPServiceConfiguration,
      private readonly path: string,
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
    return `${this.path}`; // Changed to params
  }

  public getVersion(): string {
    return this.version;
  }

  public async restService(req: TenantIdHoldingRequest, res: Response, next: NextFunction): Promise<void> {
    // Parse the action
    // Full endpoint path /:protocol/:role/:version/:tenantSubdomain/api/oicp/:module/:endpointVersion/providers/:providerID/:endpoint/:endpointAction?
    // Fixed path /:protocol/:role/:version/:tenantSubdomain
    // Added path by Hubject /api/oicp/:module/:endpointVersion/providers/:providerID/:endpoint/:endpointAction?
    // Set default tenant in case of exception
    req.user = { tenantID: Constants.DEFAULT_TENANT_ID };
    await this.processEndpointAction(req.params, req, res, next);
  }

  public async processEndpointAction(params: any, req: TenantIdHoldingRequest, res: Response, next: NextFunction): Promise<void> {
    // Get tenant subdomain and endpoint from url parameters
    const tenantSubdomain = params.tenantSubdomain as string;
    const endpointName = params.endpoint as string;
    try {
      const registeredEndpoints = this.getRegisteredEndpoints();
      // Get tenant from database
      const tenant: Tenant = await TenantStorage.getTenantBySubdomain(tenantSubdomain);
      // Check if tenant was found
      if (!tenant) {
        throw new AppError({
          module: MODULE_NAME, method: 'processEndpointAction',
          action: ServerAction.OICP_ENDPOINT,
          errorCode: StatusCodes.UNAUTHORIZED,
          message: `The Tenant '${tenantSubdomain}' does not exist`,
          oicpError: OICPStatusCode.Code021
        });
      }
      if (!Utils.isTenantComponentActive(tenant, TenantComponents.OICP)) {
        throw new AppError({
          module: MODULE_NAME, method: 'processEndpointAction',
          action: ServerAction.OICP_ENDPOINT,
          errorCode: StatusCodes.UNAUTHORIZED,
          message: `The Tenant '${tenantSubdomain}' does not support OICP`,
          oicpError: OICPStatusCode.Code021
        });
      }
      // Pass tenant id to req
      req.user.tenantID = tenant.id;
      // Handle request action (endpoint)
      const endpoint = registeredEndpoints.get(endpointName);
      if (endpoint) {
        await Logging.logDebug({
          tenantID: tenant.id,
          module: MODULE_NAME, method: endpointName,
          message: `>> OICP Request ${req.method} ${req.originalUrl}`,
          action: ServerAction.OICP_ENDPOINT,
          detailedMessages: { params: req.body }
        });
        const response = await endpoint.process(req, res, next, tenant);
        if (response) {
          await Logging.logDebug({
            tenantID: tenant.id,
            module: MODULE_NAME, method: endpointName,
            message: `<< OICP Response ${req.method} ${req.originalUrl}`,
            action: ServerAction.OICP_ENDPOINT,
            detailedMessages: { response }
          });
          res.json(response);
        } else {
          await Logging.logWarning({
            tenantID: tenant.id,
            module: MODULE_NAME, method: endpointName,
            message: `<< OICP Endpoint ${req.method} ${req.originalUrl} not implemented`,
            action: ServerAction.OICP_ENDPOINT
          });
          res.sendStatus(StatusCodes.NOT_IMPLEMENTED);
        }
      } else {
        throw new AppError({
          module: MODULE_NAME, method: 'processEndpointAction',
          action: ServerAction.OICP_ENDPOINT,
          errorCode: HTTPError.NOT_IMPLEMENTED_ERROR,
          message: `Endpoint ${endpointName} not implemented`,
          oicpError: OICPStatusCode.Code021
        });
      }
    } catch (error) {
      await Logging.logError({
        tenantID: req.user && req.user.tenantID ? req.user.tenantID : Constants.DEFAULT_TENANT_ID,
        module: MODULE_NAME, method: endpointName,
        message: `<< OICP Response Error ${req.method} ${req.originalUrl}`,
        action: ServerAction.OICP_ENDPOINT,
        detailedMessages: { error: error.stack }
      });
      await Logging.logActionExceptionMessage(req.user && req.user.tenantID ? req.user.tenantID : Constants.DEFAULT_TENANT_ID, ServerAction.OICP_ENDPOINT, error);
      let errorCode: any = {};
      if (error instanceof AppError || error instanceof AppAuthError) {
        errorCode = error.params.errorCode;
      } else {
        errorCode = HTTPError.GENERAL_ERROR;
      }
      res.status(errorCode).json(OICPUtils.toErrorResponse(error));
    }
  }
}
