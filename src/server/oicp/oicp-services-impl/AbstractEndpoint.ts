import { NextFunction, Request, Response } from 'express';

import AbstractOICPService from '../AbstractOICPService';
import { OICPAcknowledgment } from '../../../types/oicp/OICPAcknowledgment';
import Tenant from '../../../types/Tenant';

/**
 * Abstract Endpoint
 */
export default abstract class AbstractEndpoint {

  // Create OICP Service
  constructor(readonly oicpService: AbstractOICPService, readonly identifier: string = 'default') {
  }

  // Get Endpoint Identifier
  public getIdentifier(): string {
    return this.identifier;
  }

  // Get Endpoint version
  public getVersion(): string {
    return this.oicpService.getVersion();
  }

  // Return based URL of OICP Service
  public getBaseUrl(req: Request): string {
    return this.oicpService.getBaseUrl(req);
  }

  // Return based URL of OICP Service
  public getServiceUrl(req: Request): string {
    return this.oicpService.getServiceUrl(req);
  }

  // Abstract - Process endpoint
  abstract process(req: Request, res: Response, next: NextFunction, tenant: Tenant): Promise<OICPAcknowledgment>;
}

