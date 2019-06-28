import SourceMap from 'source-map-support';
import OCPIUtils from '../OCPIUtils';
SourceMap.install();
import { Request, Response } from 'express';
import OCPIService from '../OCPIServices';
import Tenant from '../../../entity/Tenant';
/**
 * Abstract Endpoint
 */
export default class AbstractEndpoint {
  // Create OCPI Service
  constructor(readonly ocpiService: OCPIService, readonly identifier: string = 'default', readonly version: string = '0.0.0') {}

  // Get Endpoint Identifier
  public getIdentifier(): string {
    return this.identifier;
  }

  // Get Endpoint version
  public getVersion(): string {
    return this.version;
  }

  // Return based URL of OCPI Service
  public getBaseUrl(req: Request): string {
    return '/';
    // TODO: getBaseUrl does not exist in OCPIServices. Please fix.
    // return this.ocpiService.getBaseUrl(req);
  }

  // Abstract - Process endpoint
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public process(req: Request, res: Response, next: Function, tenant: Tenant) {
    res.sendStatus(501);
  }

  /**
   * Handle error and return correct payload
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private handleError(error: any, req: Request, res: Response, next: Function, action: string, module: string, method: string) {
    // TODO: add logging

    // Return response with error
    res.status(error.errorCode).json(OCPIUtils.error(error));
  }
}
