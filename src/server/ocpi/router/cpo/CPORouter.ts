/* eslint-disable @typescript-eslint/no-misused-promises */
import { OCPIServerRoute, ServerAction } from '../../../../types/Server';
import express, { NextFunction, Request, Response } from 'express';

import CPOCdrsRouterV211 from './V2.1.1/CPOCdrsRouterV211';
import CPOCommandsRouterV211 from './V2.1.1/CPOCommandsRouterV211';
import CPOLocationsRouterV211 from './V2.1.1/CPOLocationsRouterV211';
import CPOTariffsRouterV211 from './V2.1.1/CPOTariffsRouterV211';
import CPOTokensRouterV211 from './V2.1.1/CPOTokensRouterV211';
import CPOVersionsService from '../../service/cpo/CPOVersionsService';
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
    this.router.use('/2.1.1', [
      new CPOLocationsRouterV211().buildRoutes(),
      new CPOTokensRouterV211().buildRoutes(),
      new CPOCdrsRouterV211().buildRoutes(),
      new CPOCommandsRouterV211().buildRoutes(),
      new CPOTariffsRouterV211().buildRoutes(),
    ]);
  }
}
