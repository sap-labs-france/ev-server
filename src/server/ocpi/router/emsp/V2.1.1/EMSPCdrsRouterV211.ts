/* eslint-disable @typescript-eslint/no-misused-promises */
import { OCPIServerRoute, ServerAction } from '../../../../../types/Server';
import express, { NextFunction, Request, Response } from 'express';

import EMSPCdrsService from '../../../service/emsp/v2.1.1/EMSPCdrsService';
import RouterUtils from '../../../../../utils/RouterUtils';

export default class EMSPCdrsRouterV211 {
  private router: express.Router;

  public constructor() {
    this.router = express.Router();
  }

  public buildRoutes(): express.Router {
    this.buildRouteGetCdr();
    this.buildRoutePostCdr();
    return this.router;
  }

  protected buildRouteGetCdr(): void {
    this.router.get(`/${OCPIServerRoute.OCPI_CDRS}*`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleOCPIServerAction(EMSPCdrsService.handleGetCdr.bind(this), ServerAction.OCPI_EMSP_GET_CDR, req, res, next);
    });
  }

  protected buildRoutePostCdr(): void {
    this.router.post(`/${OCPIServerRoute.OCPI_CDRS}*`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleOCPIServerAction(EMSPCdrsService.handlePostCdr.bind(this), ServerAction.OCPI_EMSP_CREATE_CDR, req, res, next);
    });
  }
}
