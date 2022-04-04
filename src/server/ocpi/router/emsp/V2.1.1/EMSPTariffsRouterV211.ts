import { OCPIServerRoute, ServerAction } from '../../../../../types/Server';
/* eslint-disable @typescript-eslint/no-misused-promises */
import express, { NextFunction, Request, Response } from 'express';

import EMSPTariffsService from '../../../service/emsp/v2.1.1/EMSPTariffsService';
import RouterUtils from '../../../../../utils/RouterUtils';

export default class EMSPTariffsRouterV211 {
  private router: express.Router;

  public constructor() {
    this.router = express.Router();
  }

  public buildRoutes(): express.Router {
    this.buildRouteGetTariff();
    return this.router;
  }

  protected buildRouteGetTariff(): void {
    this.router.get(`/${OCPIServerRoute.OCPI_TARIFFS}*`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleOCPIServerAction(EMSPTariffsService.handleGetTariff.bind(this), ServerAction.OCPI_EMSP_GET_TARIFF, req, res, next);
    });
  }
}
