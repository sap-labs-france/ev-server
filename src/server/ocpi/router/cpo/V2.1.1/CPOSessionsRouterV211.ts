/* eslint-disable @typescript-eslint/no-misused-promises */
import { OCPIServerRoute, ServerAction } from '../../../../../types/Server';
import express, { NextFunction, Request, Response } from 'express';

import CPOSessionsService from '../../../service/cpo/v2.1.1/CPOSessionsService';
import RouterUtils from '../../../../../utils/RouterUtils';

export default class CPOSessionsRouterV211 {
  private router: express.Router;

  public constructor() {
    this.router = express.Router();
  }

  public buildRoutes(): express.Router {
    this.buildRouteGetSessions();
    return this.router;
  }

  protected buildRouteGetSessions(): void {
    this.router.get(`/${OCPIServerRoute.OCPI_SESSIONS}*`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleOCPIServerAction(CPOSessionsService.handleGetSessions.bind(this), ServerAction.OCPI_CPO_GET_SESSIONS, req, res, next);
    });
  }
}
