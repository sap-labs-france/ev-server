import { OCPIServerRoute, ServerAction } from '../../../../../types/Server';
import express, { NextFunction, Request, Response } from 'express';

import CPOCdrsService from '../../../service/cpo/v2.1.1/CPOCdrsService';
import RouterUtils from '../../../../../utils/RouterUtils';

export default class CPOCdrsRouterV211 {
  private router: express.Router;

  public constructor() {
    this.router = express.Router();
  }

  public buildRoutes(): express.Router {
    this.buildRouteGetCdrs();
    return this.router;
  }

  protected buildRouteGetCdrs(): void {
    this.router.get(`/${OCPIServerRoute.OCPI_CDRS}*`, (req: Request, res: Response, next: NextFunction) => {
      void RouterUtils.handleOCPIServerAction(CPOCdrsService.handleGetCdrs.bind(this), ServerAction.OCPI_CPO_GET_CDRS, req, res, next);
    });
  }
}
