/* eslint-disable @typescript-eslint/no-misused-promises */
import { OCPIServerRoute, ServerAction } from '../../../../types/Server';
import express, { NextFunction, Request, Response } from 'express';

import EMSPVersionsService from '../../service/emsp/EMSPVersionsService';
import OCPIEMSPV211Router from './V2.1.1/OCPIEMSPV211Router';
import RouterUtils from '../../../../utils/RouterUtils';

export default class EMSPRouter {
  private router: express.Router;

  public constructor() {
    this.router = express.Router();
  }

  public buildRoutes(): express.Router {
    this.buildRouteEmspVersions();
    this.buildRouteEmspV211();
    return this.router;
  }

  protected buildRouteEmspVersions(): void {
    this.router.get(`/${OCPIServerRoute.OCPI_VERSIONS}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(EMSPVersionsService.handleGetVersions.bind(this), ServerAction.OCPI_GET_VERSIONS, req, res, next);
    });
  }

  protected buildRouteEmspV211(): void {
    this.router.use('/2.1.1', new OCPIEMSPV211Router().buildRoutes());
  }
}
