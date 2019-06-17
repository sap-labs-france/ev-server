import Tenant from '../../entity/Tenant';
import OCPIServerError from '../../exception/OCPIServerError';
import OCPIUtils from './OCPIUtils';
import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import { Request, Response } from 'express';
import AbstractEndpoint from './ocpi-services-impl/AbstractEndpoint';
import BackendError from '../../exception/BackendError';

const MODULE_NAME = "AbstractOCPIService";

import SourceMap from 'source-map-support';
SourceMap.install();

export interface TenantIdHoldingRequest extends Request {
  tenantID: string;
}

export default abstract class AbstractOCPIService {

  private endpoints: Map<string, AbstractEndpoint> = new Map();

  // Create OCPI Service
  public constructor(private readonly ocpiRestConfig: any, private readonly version = "0.0.0") {}

  /**
   * Register Endpoint to this service
   * @param {*} endpoint AbstractEndpoint
   */
  public registerEndpoint(endpoint: any): void {
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
    const protocol = (this.ocpiRestConfig.externalProtocol ? this.ocpiRestConfig.externalProtocol : "https");

    // Get host from the req
    const host = req.get('host');

    // Return Service url
    return `${protocol}://${host}`;
  }

  // Get Relative path of the service
  public getPath(): string {
    const version = this.getVersion();
    return `/ocpi/cpo/${version}/`;
  }

  /**
   * Return Version of OCPI Service
   */
  public getVersion(): string {
    return this.version;
  }

  // Rest Service Implementation
  public restService(req: TenantIdHoldingRequest, res: Response, next: Function): void { // eslint-disable-line
    // Parse the action
    const regexResult = /^\/\w*/g.exec(req.url);
    if (!regexResult) {
      throw new BackendError("AbstractOCPIService.ts#restService", "Regex did not match.");
    }
    const action = regexResult[0].substring(1);

    // Set default tenant in case of exception
    req.tenantID = Constants.DEFAULT_TENANT;

    // Check action
    switch (action) {
      // If empty - return available endpoints
      case "":
        this.getSupportedEndpoints(req, res, next);
        break;
      default:
        this.processEndpointAction(action, req, res, next);
        break;
    }
  }

  /**
   * Send Supported Endpoints
   */
  public getSupportedEndpoints(req: TenantIdHoldingRequest, res: Response, next: Function): void { // eslint-disable-line
    const fullUrl = this.getServiceUrl(req);
    const registeredEndpointsArray = Object.values(this.getRegisteredEndpoints());

    // Build payload
    const supportedEndpoints = registeredEndpointsArray.map((endpoint) => {
      const identifier = endpoint.getIdentifier();
      return { "identifier": `${identifier}`, "url": `${fullUrl}${identifier}/` };
    });

    // Return payload
    res.json(OCPIUtils.success({ "version": this.getVersion(), "endpoints": supportedEndpoints }));
  }

  /**
   * Process Endpoint action
   */
  public async processEndpointAction(action: string, req: TenantIdHoldingRequest, res: Response, next: Function): Promise<void> { // eslint-disable-line
    try {
      const registeredEndpoints = this.getRegisteredEndpoints();

      // Get token from header
      if (!req.headers || !req.headers.authorization) {
        throw new OCPIServerError(
          'Login',
          `Missing authorization token`, 500,
          MODULE_NAME, 'processEndpointAction', undefined);
      }

      // Log authorization token
      Logging.logInfo({
        tenantID: Constants.DEFAULT_TENANT,
        action: 'Login',
        message: "Authorization Header",
        source: 'OCPI Server',
        module: MODULE_NAME,
        method: `processEndpointAction`,
        detailedMessages: { "Authorization": req.headers.authorization }
      });

      // Get token
      let decodedToken: {tenant: string; tid: string};
      try {
        const token = req.headers.authorization.split(" ")[1];

        // Log token
        Logging.logInfo({
          tenantID: Constants.DEFAULT_TENANT,
          action: 'Login',
          message: "Authorization Token",
          source: 'OCPI Server',
          module: MODULE_NAME,
          method: `processEndpointAction`,
          detailedMessages: { "Token": token }
        });

        decodedToken = JSON.parse(OCPIUtils.atob(token));
      } catch (error) {
        throw new OCPIServerError(
          'Login',
          `Invalid authorization token`, 500,
          MODULE_NAME, 'processEndpointAction', undefined);
      }

      // Get tenant from the called URL - TODO: review this handle tenant and tid in decoded token
      const tenantSubdomain = (decodedToken.tenant ? decodedToken.tenant : decodedToken.tid);

      // Get tenant from database
      const tenant: any = await Tenant.getTenantBySubdomain(tenantSubdomain);

      // Check if tenant is found
      if (!tenant) {
        throw new OCPIServerError(
          'Login',
          `The Tenant '${tenantSubdomain}' does not exist`, 500,
          MODULE_NAME, 'processEndpointAction', undefined);
      }

      // Pass tenant id to req
      req.tenantID = tenant.getID();

      // Check if service is enabled for tenant
      if (!this.ocpiRestConfig.tenantEnabled.includes(tenantSubdomain)) {
        throw new OCPIServerError(
          'Login',
          `The Tenant '${tenantSubdomain}' is not enabled for OCPI`, 500,
          MODULE_NAME, 'processEndpointAction', undefined);
      }

      // TODO: Temporary properties in config: add eMI3 country_id/party_id
      // TODO: to be moved to database
      if (this.ocpiRestConfig.eMI3id &&
        this.ocpiRestConfig.eMI3id[tenantSubdomain] &&
        this.ocpiRestConfig.eMI3id[tenantSubdomain].country_id &&
        this.ocpiRestConfig.eMI3id[tenantSubdomain].party_id) {
        tenant._eMI3 = {};
        tenant._eMI3.country_id = this.ocpiRestConfig.eMI3id[tenantSubdomain].country_id;
        tenant._eMI3.party_id = this.ocpiRestConfig.eMI3id[tenantSubdomain].party_id;
      } else {
        throw new OCPIServerError(
          'Login',
          `The Tenant '${tenantSubdomain}' doesn't have country_id and/or party_id defined`, 500,
          MODULE_NAME, 'processEndpointAction', undefined);
      }

      // Handle request action (endpoint)
      const endpoint = registeredEndpoints.get(action);
      if (endpoint) {
        endpoint.process(req, res, next, tenant);
      } else {
        // pragma res.sendStatus(501);
        throw new OCPIServerError(
          'Process Endpoint',
          `Endpoint ${action} not implemented`, 501,
          MODULE_NAME, 'processEndpointAction');
      }
    } catch (error) {
      next(error);
    }
  }
}
