/* eslint-disable @typescript-eslint/no-misused-promises */
import { OCPIServerRoute, ServerAction } from '../../../../../types/Server';
import express, { NextFunction, Request, Response } from 'express';

import EMSPSessionsService from '../../../service/emsp/v2.1.1/EMSPSessionsService';
import RouterUtils from '../../../../../utils/RouterUtils';

export default class EMSPSessionsRouterV211 {
  private router: express.Router;

  public constructor() {
    this.router = express.Router();
  }

  public buildRoutes(): express.Router {
    this.buildRouteGetSession();
    this.buildRoutePatchSession();
    this.buildRoutePutSession();
    return this.router;
  }

  protected buildRouteGetSession(): void {
    this.router.get(`/${OCPIServerRoute.OCPI_SESSIONS}*`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleOCPIServerAction(EMSPSessionsService.handleGetSession.bind(this), ServerAction.OCPI_EMSP_GET_SESSION, req, res, next);
    });
  }

  protected buildRoutePatchSession(): void {
    this.router.patch(`/${OCPIServerRoute.OCPI_SESSIONS}*`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleOCPIServerAction(EMSPSessionsService.handlePatchSession.bind(this), ServerAction.OCPI_EMSP_UPDATE_SESSION, req, res, next);
    });
  }

  protected buildRoutePutSession(): void {
    this.router.put(`/${OCPIServerRoute.OCPI_SESSIONS}*`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleOCPIServerAction(EMSPSessionsService.handlePutSession.bind(this), ServerAction.OCPI_EMSP_UPDATE_SESSION, req, res, next);
    });
  }
}
