import { NextFunction, Request, Response } from 'express';

import OCPIUtils from '../../../OCPIUtils';
import { ServerAction } from '../../../../../types/Server';

export default class CPOVersionsService {
  public static handleGetVersions(action: ServerAction, req: Request, res: Response, next: NextFunction): void {
    try {
      const versions = [
        {
          version: '2.1.1',
          url: `https://${req.get('host')}/ocpi/cpo/2.1.1/`
        }
      ];
      res.json(OCPIUtils.success(versions));
    } catch (error) {
      next(error);
    }
  }
}
