import { Request, Response } from 'express';
import OCPIUtils from '../OCPIUtils';
import Tenant from '../../../types/Tenant';
import AbstractOCPIService from '../AbstractOCPIService';
import Site from '../../../types/Site';

/**
 * Abstract Endpoint
 */
export default class AbstractEndpoint {
  // Create OCPI Service
  constructor(readonly ocpiService: AbstractOCPIService, readonly identifier: string = 'default', readonly version: string = '0.0.0') {}

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
    return this.ocpiService.getBaseUrl(req);
  }

  // Return based URL of OCPI Service
  public getServiceUrl(req: Request): string {
    return this.ocpiService.getServiceUrl(req);
  }

  // Abstract - Process endpoint
  // eslint-disable-next-line @typescript-eslint/no-unused-vars,require-await
  public async process(req: Request, res: Response, next: Function, tenant: Tenant, options: {countryID: string; partyID: string; addChargeBoxID?: boolean}) {
    res.sendStatus(501);
  }
}
