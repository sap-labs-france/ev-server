import { NextFunction, Request, Response } from 'express';

import AbstractOCPIService from '../../AbstractOCPIService';
import OCPIServiceConfiguration from '../../../../types/configuration/OCPIServiceConfiguration';
import { StatusCodes } from 'http-status-codes';

const VERSION = '2.0';

export default class OCPIService extends AbstractOCPIService {
  // Create OCPI Service
  public constructor(ocpiRestConfig: OCPIServiceConfiguration, path: string) {
    super(ocpiRestConfig, path, VERSION);
  }

  // Rest Service Implementation
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async restService(req: Request, res: Response, next: NextFunction): Promise<void> {
    // Not implemented
    res.sendStatus(StatusCodes.NOT_IMPLEMENTED);
  }
}

