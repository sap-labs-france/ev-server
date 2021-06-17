import { NextFunction, Request, Response } from 'express';

import AbstractOICPService from '../AbstractOICPService';
import { OICPAcknowledgment } from '../../../types/oicp/OICPAcknowledgment';
import Tenant from '../../../types/Tenant';

export default abstract class AbstractEndpoint {

  constructor(readonly oicpService: AbstractOICPService, readonly identifier: string = 'default') {
  }

  public getIdentifier(): string {
    return this.identifier;
  }

  public getVersion(): string {
    return this.oicpService.getVersion();
  }

  public getBaseUrl(req: Request): string {
    return this.oicpService.getBaseUrl(req);
  }

  public getServiceUrl(req: Request): string {
    return this.oicpService.getServiceUrl(req);
  }

  abstract process(req: Request, res: Response, next: NextFunction, tenant: Tenant): Promise<OICPAcknowledgment>;
}

