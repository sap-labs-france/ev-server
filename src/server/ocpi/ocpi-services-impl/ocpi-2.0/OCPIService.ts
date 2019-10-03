import AbstractOCPIService from '../../AbstractOCPIService';
import { NextFunction, Request, Response } from 'express';
import Config from '../../../../types/configuration/Config';

const VERSION = '2.0';

/**
 * OCPI Service 2.0 - Not Implemented - Only used for testing multiple Services declaration
 */
export default class OCPIService extends AbstractOCPIService {
  // Create OCPI Service
  constructor(ocpiRestConfig: Config['OCPIService']) {
    super(ocpiRestConfig, VERSION);
  }

  // Rest Service Implementation
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  restService(req: Request, res: Response, next: NextFunction) {
    // Not implemented
    res.sendStatus(501);
  }
}

