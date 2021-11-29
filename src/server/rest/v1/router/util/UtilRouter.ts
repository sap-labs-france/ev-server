/* eslint-disable @typescript-eslint/no-misused-promises */
import { ServerAction, ServerRoute } from '../../../../../types/Server';
import express, { NextFunction, Request, Response } from 'express';

import RouterUtils from '../RouterUtils';
import { StatusCodes } from 'http-status-codes';
import TenantService from '../../service/TenantService';

export default class UtilRouter {
  private router: express.Router;

  public constructor() {
    this.router = express.Router();
  }

  public buildRoutes(): express.Router {
    this.buildRoutePing();
    this.buildRouteGetTenantLogo();
    return this.router;
  }

  private buildRoutePing(): void {
    this.router.get(`/${ServerRoute.REST_PING}`, (req: Request, res: Response, next: NextFunction) => {
      res.sendStatus(StatusCodes.OK);
      next();
    });
  }

  private buildRouteGetTenantLogo(): void {
    this.router.get(`/${ServerRoute.REST_TENANT_LOGO}`, async (req: Request, res: Response, next: NextFunction) => {
      req.query.ID = req.params.id;
      await RouterUtils.handleServerAction(TenantService.handleGetTenantLogo.bind(this), ServerAction.TENANT_LOGO, req, res, next);
    });
  }
}
