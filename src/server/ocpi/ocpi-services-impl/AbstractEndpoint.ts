import { NextFunction, Request, Response } from 'express';

import AbstractOCPIService from '../AbstractOCPIService';
import OCPIEndpoint from '../../../types/ocpi/OCPIEndpoint';
import { OCPIResponse } from '../../../types/ocpi/OCPIResponse';
import Tenant from '../../../types/Tenant';

export default abstract class AbstractEndpoint {
  // Create OCPI Service
  public constructor(protected readonly ocpiService: AbstractOCPIService, protected readonly identifier: string = 'default') {
  }

  // Get Endpoint Identifier
  public getIdentifier(): string {
    return this.identifier;
  }

  // Get Endpoint version
  public getVersion(): string {
    return this.ocpiService.getVersion();
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
  abstract process(req: Request, res: Response, next: NextFunction, tenant: Tenant, ocpiEndpoint: OCPIEndpoint): Promise<OCPIResponse>;
}

