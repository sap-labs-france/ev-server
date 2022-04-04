/* eslint-disable @typescript-eslint/no-misused-promises */
import { OCPIServerRoute, ServerAction } from '../../../../../types/Server';
import express, { NextFunction, Request, Response } from 'express';

import CPOTariffsService from '../../../service/cpo/v2.1.1/CPOTariffsService';
import RouterUtils from '../../../../../utils/RouterUtils';

export default class CPOTariffsRouterV211 {
  private router: express.Router;

  public constructor() {
    this.router = express.Router();
  }

  public buildRoutes(): express.Router {
    this.buildRouteGetTariffs();
    return this.router;
  }

  protected buildRouteGetTariffs(): void {
    this.router.get(`/${OCPIServerRoute.OCPI_TARIFFS}*`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleOCPIServerAction(CPOTariffsService.handleGetTariffs.bind(this), ServerAction.OCPI_CPO_GET_TARIFFS, req, res, next);
    });
  }
}
