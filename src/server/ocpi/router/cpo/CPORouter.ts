/* eslint-disable @typescript-eslint/no-misused-promises */
import { OCPIServerRoute, ServerAction } from '../../../../types/Server';
import express, { NextFunction, Request, Response } from 'express';

import CPOVersionsService from './service/CPOVersionsService';
import OCPICPOV211Router from './V2.1.1/OCPICPOV211Router';
import RouterUtils from '../../../../utils/RouterUtils';

export default class CPORouter {
  private router: express.Router;

  public constructor() {
    this.router = express.Router();
  }

  public buildRoutes(): express.Router {
    this.buildRouteCpoVersions();
    this.buildRouteCpoV211();
    return this.router;
  }

  protected buildRouteCpoVersions(): void {
    this.router.get(`/${OCPIServerRoute.OCPI_VERSIONS}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(CPOVersionsService.handleGetVersions.bind(this), ServerAction.OCPI_GET_VERSIONS, req, res, next);
    });
  }

  protected buildRouteCpoV211(): void {
    this.router.use('/2.1.1', new OCPICPOV211Router().buildRoutes());
  }
}
