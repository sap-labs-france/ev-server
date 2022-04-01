import { OCPIServerRoute, ServerAction } from '../../../../../types/Server';
/* eslint-disable @typescript-eslint/no-misused-promises */
import express, { NextFunction, Request, Response } from 'express';

import CPOCdrsService from '../../../service/cpo/v2.1.1/CPOCdrsService';
import RouterUtils from '../../../../../utils/RouterUtils';

export default class CPOCdrsRouterV211 {
  private router: express.Router;

  public constructor() {
    this.router = express.Router();
  }

  public buildRoutes(): express.Router {
    this.buildRouteCdrs();
    return this.router;
  }

  protected buildRouteCdrs(): void {
    this.router.get(`/${OCPIServerRoute.OCPI_CDRS}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(CPOCdrsService.handleGetCdrs.bind(this), ServerAction.OCPI_CPO_GET_CDRS, req, res, next);
    });
  }
}
