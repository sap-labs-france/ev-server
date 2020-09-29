import { NextFunction, Request, Response } from 'express';

import AbstractOCPIService from '../../AbstractOCPIService';
import { Configuration } from '../../../../types/configuration/Configuration';
import { StatusCodes } from 'http-status-codes';

const VERSION = '2.0';

/**
 * OCPI Service 2.0 - Not Implemented - Only used for testing multiple Services declaration
 */
export default class OCPIService extends AbstractOCPIService {
  // Create OCPI Service
  constructor(ocpiRestConfig: Configuration['OCPIService'], path: string) {
    super(ocpiRestConfig, path, VERSION);
  }

  // Rest Service Implementation
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async restService(req: Request, res: Response, next: NextFunction): Promise<void> {
    // Not implemented
    res.sendStatus(StatusCodes.NOT_IMPLEMENTED);
  }
}

