import OCPIUtils from '../OCPIUtils';
import SourceMap from 'source-map-support';
SourceMap.install();
import OCPIService from '../OCPIServices';
import Tenant from '../../../entity/Tenant';
import { Request, Response } from 'express';
/**
 * Abstract Endpoint
 */
export default class AbstractEndpoint {
  // Create OCPI Service
  constructor(readonly ocpiService: OCPIService, readonly identifier: string = "default", readonly version: string = "0.0.0") {}

  // get Endpoint Identifier
  public getIdentifier(): string {
    return this.identifier;
  }

  // get Endpoint version
  public getVersion(): string {
    return this.version;
  }

  // Return based URL of OCPI Service
  public getBaseUrl(req: Request): string {
    return '/'; //TODO: getBaseUrl does not exist in OCPIServices. Please fix
    //return this.ocpiService.getBaseUrl(req);
  }

  // Abstract - Process endpoint
  public process(req: Request, res: Response, next: Function, tenant: Tenant) { // eslint-disable-line
    res.sendStatus(501);
  }

  /**
   * Handle error and return correct payload
   */
  private handleError(error: any, req: Request, res: Response, next: Function, action: string, module: string, method: string) { // eslint-disable-line
    // TODO: add logging

    // return response with error
    res.status(error.errorCode).json(OCPIUtils.error(error));
  }
}
